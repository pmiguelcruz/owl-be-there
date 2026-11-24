import { CREATION_HEADER } from '@owl/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { countEvents } from '../src/db/repo.js';
import {
  creationHeaders,
  eventBody,
  TEST_ADMIN_PIN,
  testApp,
  type TestApp,
} from './helpers.js';

describe('PIN-protected event creation', () => {
  let t: TestApp;
  beforeEach(async () => {
    t = await testApp();
  });
  afterEach(async () => {
    await t.app.close();
  });

  const unlock = (pin: string, remoteAddress?: string) =>
    t.app.inject({
      method: 'POST',
      url: '/api/admin/unlock',
      payload: { pin },
      ...(remoteAddress && { remoteAddress }),
    });

  const create = (headers: Record<string, string> = {}, body = eventBody()) =>
    t.app.inject({
      method: 'POST',
      url: '/api/events',
      headers,
      payload: body,
    });

  it('requires an unexpired creation credential and keeps credentials out of cache', async () => {
    expect((await create()).json().error).toBe('creation_locked');
    expect((await unlock('9999')).json().error).toBe('invalid_pin');
    expect(countEvents(t.db)).toBe(0);

    const session = await unlock(TEST_ADMIN_PIN);
    expect(session.statusCode).toBe(200);
    expect(session.headers['cache-control']).toBe('no-store');
    const token = session.json().token as string;
    const headers = { [CREATION_HEADER]: token };
    expect(
      (await create({ [CREATION_HEADER]: 'x' + token.slice(1) })).statusCode
    ).toBe(403);

    const created = await create(headers);
    expect(created.statusCode).toBe(201);
    expect(created.headers['cache-control']).toBe('no-store');
    expect(
      (await create({ 'x-admin-token': created.json().adminToken })).statusCode
    ).toBe(403);

    t.clock.time += 30 * 60_000;
    expect((await create(headers)).statusCode).toBe(403);
    expect(countEvents(t.db)).toBe(1);
  });

  it('caps failed guesses across networks and allows a new window', async () => {
    for (let i = 1; i <= 30; i += 1)
      expect((await unlock('9999', `203.0.113.${i}`)).statusCode).toBe(403);
    expect((await unlock(TEST_ADMIN_PIN)).statusCode).toBe(429);
    t.clock.time += 15 * 60_000;
    expect((await unlock(TEST_ADMIN_PIN)).statusCode).toBe(200);
  });

  it('disables creation when the PIN is not configured', async () => {
    const off = await testApp({ env: { ADMIN_PIN: '' } });
    try {
      expect(
        (await off.app.inject('/api/instance')).json().creationEnabled
      ).toBe(false);
      const response = await off.app.inject({
        method: 'POST',
        url: '/api/admin/unlock',
        payload: { pin: TEST_ADMIN_PIN },
      });
      expect(response.statusCode).toBe(503);
    } finally {
      await off.app.close();
    }
  });

  it('validates the theme and persists its exact gradient and shape', async () => {
    const headers = await creationHeaders(t.app);
    const theme = {
      gradient: { start: '#f4696b', end: '#7279d3', angle: 40 },
      shape: 0xffffffff,
    };
    for (const invalid of [
      { ...theme, gradient: { ...theme.gradient, start: 'url(#elsewhere)' } },
      { ...theme, gradient: { ...theme.gradient, angle: 360 } },
      { ...theme, shape: -1 },
      { ...theme, shape: 1.5 },
    ]) {
      expect(
        (await create(headers, eventBody({ theme: invalid }))).statusCode
      ).toBe(400);
    }
    const response = await create(
      headers,
      eventBody({ theme, emoji: undefined })
    );
    expect(response.statusCode).toBe(201);
    const { id } = response.json();
    const loaded = await t.app.inject(`/api/events/${id}`);
    expect(loaded.json().event.theme).toEqual(theme);
    expect(
      JSON.parse(
        t.db.get<{ theme: string }>(
          'SELECT theme FROM events WHERE id = ?',
          id
        )!.theme
      )
    ).toEqual(theme);
  });
});
