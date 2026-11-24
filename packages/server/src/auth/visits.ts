import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppContext } from '../context.js';

const PREFIX = 'owl_visit_';
export const MAX_VISITS = 40;
const MAX_AGE = 365 * 24 * 60 * 60;

function sign(ctx: AppContext, id: string, time: string): Buffer {
  return createHmac('sha256', ctx.secret)
    .update(`visit:${id}:${time}`)
    .digest()
    .subarray(0, 16);
}

export function visitedIds(ctx: AppContext, request: FastifyRequest): string[] {
  const visits = new Map<string, number>();
  for (const cookie of (request.headers.cookie ?? '').split(';')) {
    const match =
      /^owl_visit_([1-9A-HJ-NP-Za-km-z]{12})=(\d{1,16})\.([a-f0-9]{32})$/.exec(
        cookie.trim()
      );
    if (!match) continue;
    const id = match[1]!;
    const time = match[2]!;
    const token = match[3]!;
    const age = ctx.clock.now() - Number(time);
    if (
      age >= 0 &&
      age <= MAX_AGE * 1000 &&
      timingSafeEqual(sign(ctx, id, time), Buffer.from(token, 'hex'))
    )
      visits.set(id, Number(time));
  }
  return [...visits].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

export function rememberVisits(
  ctx: AppContext,
  request: FastifyRequest,
  reply: FastifyReply,
  ids: readonly string[]
): void {
  const visited = visitedIds(ctx, request);
  const newIds = [...new Set(ids)].filter((id) => !visited.includes(id));
  if (newIds.length === 0) return;
  const now = ctx.clock.now();
  const attributes = `Path=/; HttpOnly; SameSite=Lax${ctx.config.publicUrl.startsWith('https:') ? '; Secure' : ''}`;
  reply.header('set-cookie', [
    ...newIds.map((id) => {
      const time = String(now);
      return `${PREFIX}${id}=${time}.${sign(ctx, id, time).toString('hex')}; Max-Age=${MAX_AGE}; ${attributes}`;
    }),
    ...visited
      .slice(MAX_VISITS - newIds.length)
      .map((old) => `${PREFIX}${old}=; Max-Age=0; ${attributes}`),
  ]);
}
