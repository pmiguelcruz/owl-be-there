import { EventEmitter } from 'node:events';
import { get, type ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { networkKey } from '../src/http.js';
import {
  createEvent,
  join,
  mark,
  testApp,
  WEEKEND,
  type TestApp,
  adminHeaders,
} from './helpers.js';

let t: TestApp;
let base: string;

beforeEach(async () => {
  t = await testApp({ streamLimits: { perClient: 2, perEvent: 3, total: 4 } });
  await t.app.listen({ host: '127.0.0.1', port: 0 });
  const address = t.app.server.address();
  if (typeof address !== 'object' || address === null)
    throw new Error('no address');
  base = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await t.app.close();
});

/** Read server-sent events until `count` have arrived or the stream ends. */
async function readEvents(
  response: Response,
  count: number
): Promise<string[]> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const events: string[] = [];
  while (events.length < count) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let end: number;
    while ((end = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      if (!block.startsWith(':')) events.push(block);
    }
  }
  await reader.cancel().catch(() => undefined);
  return events;
}

describe('live updates', () => {
  it('say hello with the current version, then announce every change', async () => {
    const { id } = await createEvent(t.app);
    const response = await fetch(`${base}/api/events/${id}/stream`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(
      'text/event-stream; charset=utf-8'
    );
    expect(response.headers.get('x-accel-buffering')).toBe('no');
    const reading = readEvents(response, 3);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const max = await join(t.app, id, 'Max');
    await mark(t.app, id, max, WEEKEND);
    const events = await reading;
    expect(events[0]).toBe('retry: 5000\nevent: changed\ndata: {"version":1}');
    expect(events[1]).toBe('event: changed\ndata: {"version":2}');
    expect(events[2]).toBe('event: changed\ndata: {"version":3}');
  });

  it('say goodbye when the event is deleted', async () => {
    const { id, adminToken } = await createEvent(t.app);
    const response = await fetch(`${base}/api/events/${id}/stream`);
    const reading = readEvents(response, 5);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await t.app.inject({
      method: 'DELETE',
      url: `/api/events/${id}`,
      headers: adminHeaders(adminToken),
    });
    const events = await reading;
    expect(events.at(-1)).toBe('event: deleted\ndata: {}');
  });

  it('refuse a stream for an unknown event', async () => {
    const response = await fetch(`${base}/api/events/AAAAAAAAAAAA/stream`);
    expect(response.status).toBe(404);
  });

  it('do not run the stream for HEAD: a monitor gets an answer and no slot', async () => {
    const { id } = await createEvent(t.app);
    const head = await t.app.inject({
      method: 'HEAD',
      url: `/api/events/${id}/stream`,
    });
    expect(head.statusCode).toBe(404);
    expect(t.app.hub.size).toBe(0);
    // Over a real connection too, where the hijacked handler never answered.
    const answered = await fetch(`${base}/api/events/${id}/stream`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(1000),
    });
    expect(answered.status).toBe(404);
    expect(t.app.hub.size).toBe(0);
    // GET still opens a stream.
    const response = await fetch(`${base}/api/events/${id}/stream`);
    expect(response.status).toBe(200);
    expect(t.app.hub.size).toBe(1);
    await response.body!.cancel();
  });

  it('refuse streams beyond the limits and count closed ones out', async () => {
    const { id } = await createEvent(t.app);
    const open = [
      await fetch(`${base}/api/events/${id}/stream`),
      await fetch(`${base}/api/events/${id}/stream`),
    ];
    const third = await fetch(`${base}/api/events/${id}/stream`);
    expect(third.status).toBe(429);
    expect((await third.json()).error).toBe('too_many_streams');
    for (const response of open) await response.body!.cancel();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(t.app.hub.size).toBe(0);
    const again = await fetch(`${base}/api/events/${id}/stream`);
    expect(again.status).toBe(200);
    await again.body!.cancel();
  });
});

describe('event retention', () => {
  it('keeps an existing event and its responses after its former expiry date and restart', async () => {
    const { id } = await createEvent(t.app);
    const person = await join(t.app, id, 'Max');
    await mark(t.app, id, person, WEEKEND);
    t.db.run("UPDATE events SET expires_on = '2027-03-08' WHERE id = ?", id);
    t.clock.advanceDays(200);
    const restarted = await buildApp({
      config: t.config,
      db: t.db,
      secret: Buffer.alloc(32, 7),
      clock: t.clock,
    });
    try {
      const response = await restarted.inject({
        url: `/api/events/${id}`,
        headers: { 'x-participant-token': person.token },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().event).not.toHaveProperty('expiresOn');
      expect(response.json().participants[0].yes).toEqual(WEEKEND);
    } finally {
      await restarted.close();
    }
  });
});

describe('shutting down', () => {
  it('ends the open streams instead of waiting for them', async () => {
    const { id } = await createEvent(t.app);
    // A plain HTTP client, as a browser holds the stream: it reads the first
    // message and keeps the connection open.
    const ended = new Promise<void>((resolve, reject) => {
      get(`${base}/api/events/${id}/stream`, (response) => {
        response.once('data', () => void close());
        response.on('end', resolve);
      }).on('error', reject);
    });
    let closed = false;
    const close = async () => {
      await t.app.close();
      closed = true;
    };
    await ended;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(closed).toBe(true);
    expect(t.app.hub.size).toBe(0);
  }, 3000);
});

describe('stream slots per network', () => {
  // A stream that is open as far as the hub knows, from the given address.
  const holdFrom = (id: string, ip: string): void => {
    const response = Object.assign(new EventEmitter(), {
      write: () => true,
      end: () => true,
      destroyed: false,
      writableEnded: false,
    }) as unknown as ServerResponse;
    t.app.hub.add(id, networkKey(ip), response, 1);
  };
  const streamFrom = (id: string, remoteAddress: string) =>
    t.app.inject({
      method: 'GET',
      url: `/api/events/${id}/stream`,
      remoteAddress,
    });

  it('are shared by every /64 of one /48, not by an IPv4 address or another /48', async () => {
    const { id } = await createEvent(t.app);
    holdFrom(id, '2001:db8:1:1::1');
    holdFrom(id, '2001:db8:1:2::1');
    // A third /64 of the same /48 finds both slots taken.
    const refused = await streamFrom(id, '2001:db8:1:ffff::1');
    expect(refused.statusCode).toBe(429);
    expect(refused.json().error).toBe('too_many_streams');
    // Another /48 and an IPv4 address are other clients. Their streams stay
    // open, so shut the hub to let the answers finish.
    // (A second event keeps the limit per event out of it.)
    const { id: other } = await createEvent(t.app);
    const others = [
      streamFrom(id, '2001:db8:2::1'),
      streamFrom(other, '203.0.113.7'),
    ];
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(t.app.hub.size).toBe(4);
    t.app.hub.close();
    expect((await Promise.all(others)).map((r) => r.statusCode)).toEqual([
      200, 200,
    ]);
  });

  it('are freed when the streams of the network close', async () => {
    const { id } = await createEvent(t.app);
    const key = networkKey('2001:db8:1:1::1');
    const ends: (() => void)[] = [];
    for (let i = 0; i < 2; i += 1) {
      const response = Object.assign(new EventEmitter(), {
        write: () => true,
        end: () => true,
        destroyed: false,
        writableEnded: false,
      });
      ends.push(() => response.emit('close'));
      t.app.hub.add(id, key, response as unknown as ServerResponse, 1);
    }
    expect((await streamFrom(id, '2001:db8:1:9::1')).statusCode).toBe(429);
    for (const end of ends) end();
    expect(t.app.hub.size).toBe(0);
    const again = streamFrom(id, '2001:db8:1:9::1');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(t.app.hub.size).toBe(1);
    t.app.hub.close();
    expect((await again).statusCode).toBe(200);
  });
});
