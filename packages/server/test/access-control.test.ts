import { ADMIN_HEADER, PARTICIPANT_HEADER } from '@owl/shared';
import { expect, it } from 'vitest';
import { createEvent, getSnapshot, join, mark, testApp } from './helpers.js';

it('gives each browser only its visited events and removes deleted entries', async () => {
  const t = await testApp();
  try {
    const visited = await createEvent(t.app, { title: 'Visited' });
    const other = await createEvent(t.app, {
      title: 'Private directory entry',
    });
    const read = (cookie?: string) =>
      t.app.inject({
        url: '/api/visited-events',
        ...(cookie && { headers: { cookie } }),
      });
    expect((await read()).json()).toEqual([]);
    const link = await t.app.inject(`/e/${visited.id}`);
    const [setCookie] = link.cookies;
    expect(setCookie).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    });
    const cookie = `${setCookie!.name}=${setCookie!.value}`;
    expect((await read(cookie)).json()).toEqual([
      { id: visited.id, title: 'Visited', status: 'open' },
    ]);
    expect((await read(cookie.replace(visited.id, other.id))).json()).toEqual(
      []
    );
    expect((await t.app.inject('/api/admin/events')).statusCode).toBe(403);
    expect(
      (await t.app.inject('/api/admin/events?token=' + visited.adminToken))
        .statusCode
    ).toBe(403);
    const headers = { [ADMIN_HEADER]: visited.adminToken };
    const directory = await t.app.inject({ url: '/api/admin/events', headers });
    expect(directory.headers['cache-control']).toBe('no-store');
    expect(directory.json().map((event: { id: string }) => event.id)).toEqual([
      other.id,
      visited.id,
    ]);
    const removed = await t.app.inject({
      method: 'DELETE',
      url: `/api/events/${visited.id}`,
      headers,
    });
    expect(removed.statusCode).toBe(204);
    expect((await read(cookie)).json()).toEqual([]);
    await t.app.inject({ method: 'POST', url: '/api/admin/lock', headers });
    expect(
      (await t.app.inject({ url: '/api/admin/events', headers })).statusCode
    ).toBe(403);
  } finally {
    await t.app.close();
  }
});

it('lets a shared link register and edit only the entry its token owns', async () => {
  const t = await testApp();
  try {
    const { id, adminToken } = await createEvent(t.app);
    const url = `/api/events/${id}`;
    const anna = await join(t.app, id, 'Anna');
    const ben = await join(t.app, id, 'Ben');
    const selfHeaders = { [PARTICIPANT_HEADER]: anna.token };
    const publicView = await t.app.inject(url);
    expect(publicView.json().participants).toEqual([]);
    const ownView = await t.app.inject({ url, headers: selfHeaders });
    expect(
      ownView.json().participants.map((p: { name: string }) => p.name)
    ).toEqual(['Anna']);
    expect(ownView.headers.etag).not.toBe(publicView.headers.etag);
    expect((await getSnapshot(t.app, id)).participants).toHaveLength(2);

    for (const headers of [selfHeaders, { 'x-admin-token': adminToken }]) {
      expect(
        (
          await t.app.inject({
            method: 'PATCH',
            url,
            headers,
            payload: { title: 'Denied' },
          })
        ).statusCode
      ).toBe(403);
      expect(
        (await t.app.inject({ method: 'DELETE', url, headers })).statusCode
      ).toBe(403);
    }
    expect(
      (
        await t.app.inject({
          method: 'DELETE',
          url: `${url}/participants/${ben.participantId}`,
          headers: selfHeaders,
        })
      ).statusCode
    ).toBe(403);
    expect(
      (
        await t.app.inject({
          method: 'POST',
          url: `${url}/session`,
          payload: { name: 'Anna' },
        })
      ).statusCode
    ).toBe(409);
    expect((await mark(t.app, id, anna, ['2027-03-05'])).statusCode).toBe(200);
  } finally {
    await t.app.close();
  }
});
