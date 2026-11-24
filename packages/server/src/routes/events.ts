import { z } from 'zod';
import { randomInt } from 'node:crypto';
import {
  addDays,
  blockFits,
  buildIcs,
  candidateBlocks,
  checkCandidateDays,
  AdminPinBody,
  ADMIN_HEADER,
  PARTICIPANT_HEADER,
  CreateEventBody,
  isId,
  LIMITS,
  makeId,
  nameKey,
  normalizeDays,
  RosterBody,
  SERVER_TEXTS,
  snapshotEtag,
  StatusBody,
  todayUTC,
  UpdateEventBody,
  type ISODate,
} from '@owl/shared';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { isAdmin, requireAdmin } from '../auth/access.js';
import { readParticipantToken } from '../auth/tokens.js';
import { MAX_VISITS, rememberVisits, visitedIds } from '../auth/visits.js';
import { limit, type AppContext } from '../context.js';
import {
  addRoster,
  countEvents,
  countParticipants,
  deleteEvent,
  findParticipantByKey,
  getDays,
  getEvent,
  getParticipant,
  eventDirectory,
  insertEvent,
  setStatus,
  snapshot,
  updateEvent,
  type EventRow,
  type NewParticipant,
} from '../db/repo.js';
import {
  ApiError,
  header,
  matchesEtag,
  networkKey,
  notFound,
  parseBody,
} from '../http.js';

type IdParams = { Params: { id: string } };

/** The event an `:id` names, or a 404 — a malformed id never reaches the database. */
export function eventOr404(ctx: AppContext, id: string): EventRow {
  const event = isId(id) ? getEvent(ctx.db, id) : undefined;
  if (!event) throw notFound();
  return event;
}

/** A 409 `full` when `adding` more people would not fit into the event. */
export function assertRoom(ctx: AppContext, eventId: string, adding = 1): void {
  if (countParticipants(ctx.db, eventId) + adding > LIMITS.participants) {
    throw new ApiError(409, 'full', 'This event has no room for more people');
  }
}

/**
 * The first day a new candidate day may be: yesterday in UTC. The server does
 * not know the organiser's time zone; one day of slack covers everyone from
 * UTC-12 to UTC+14.
 */
function earliestDay(ctx: AppContext): ISODate {
  return addDays(todayUTC(new Date(ctx.clock.now())), -1);
}

/**
 * The last day a new candidate day may be: about five years ahead. The client
 * counts the horizon from its local date, which is a day ahead of UTC in
 * UTC+14, so the server allows one day more than the limit says.
 */
function latestDay(ctx: AppContext): ISODate {
  return addDays(todayUTC(new Date(ctx.clock.now())), LIMITS.horizon + 1);
}

function checkDays(
  days: readonly ISODate[],
  earliest: ISODate | null,
  latest: ISODate | null,
  duration: number
): void {
  const problem = checkCandidateDays(days, earliest, latest);
  if (problem !== null) throw new ApiError(400, 'invalid_days', problem);
  if (candidateBlocks(days, duration).length === 0) {
    throw new ApiError(
      400,
      'no_block',
      `No ${duration} consecutive candidate days to choose from`
    );
  }
}

/** Whether two lists hold the same days, in any order. */
function sameDays(a: readonly ISODate[], b: readonly ISODate[]): boolean {
  const left = new Set(a);
  return left.size === new Set(b).size && b.every((day) => left.has(day));
}

/** Roster names, without duplicates by name key, as new participants. */
function rosterEntries(names: readonly string[]): NewParticipant[] {
  const seen = new Set<string>();
  const entries: NewParticipant[] = [];
  for (const name of names) {
    const key = nameKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({ id: makeId(randomInt), name, nameKey: key });
  }
  return entries;
}

/** Answer with the event as everyone sees it now. */
function sendSnapshot(
  ctx: AppContext,
  reply: FastifyReply,
  id: string
): FastifyReply {
  const data = snapshot(ctx.db, id);
  if (!data) throw notFound();
  return reply.header('cache-control', 'private, no-store').send(data);
}

/** Tell the open streams that the event moved on. */
export function published(ctx: AppContext, id: string): void {
  const event = getEvent(ctx.db, id);
  if (event) ctx.hub.changed(id, event.version);
}

/**
 * Creation also has a ceiling for the whole instance per hour, on top of the
 * per-address limit — a botnet has many addresses. One network (an address or
 * an IPv6 /48) may take only a tenth of it, so a single rented prefix cannot
 * use it all up and lock everyone else out. Kept in memory, like every other
 * limit; the map holds at most as many networks as the ceiling allows events.
 */
export class HourlyCeiling {
  private windowStart = 0;
  private count = 0;
  private readonly perNetwork = new Map<string, number>();

  allow(now: number, max: number, network: string): boolean {
    // A clock stepped back (now < windowStart) would keep the window shut for
    // as long as the step, so it counts as an expired window too.
    if (now < this.windowStart || now - this.windowStart >= 3_600_000) {
      this.windowStart = now;
      this.count = 0;
      this.perNetwork.clear();
    }
    const share = Math.max(1, Math.floor(max / 10));
    const used = this.perNetwork.get(network) ?? 0;
    if (this.count >= max || used >= share) return false;
    this.count += 1;
    this.perNetwork.set(network, used + 1);
    return true;
  }
}

export function registerEventRoutes(
  app: FastifyInstance,
  ctx: AppContext
): void {
  const { config } = ctx;
  const ceiling = new HourlyCeiling();
  app.post(
    '/api/admin/unlock',
    { config: limit(config, 5, '15 minutes') },
    async (request, reply) => {
      reply.header('cache-control', 'no-store');
      const policy = ctx.admin;
      if (!policy)
        throw new ApiError(503, 'admin_disabled', 'Admin is unavailable');
      const { pin } = parseBody(AdminPinBody, request.body);
      const result = policy.unlock(pin, ctx.clock.now());
      if (result === 'limited') {
        throw new ApiError(
          429,
          'rate_limited',
          'Too many PIN attempts; try again later'
        );
      }
      if (result === 'invalid') {
        throw new ApiError(403, 'invalid_pin', 'Incorrect PIN');
      }
      return reply.send(result);
    }
  );

  app.post(
    '/api/admin/lock',
    { config: limit(config, 60, '1 minute') },
    async (request, reply) =>
      reply
        .header('cache-control', 'no-store')
        .code(204)
        .send(ctx.admin?.lock(header(request, ADMIN_HEADER)))
  );

  app.get(
    '/api/admin/events',
    { config: limit(config, 60, '1 minute') },
    async (request, reply) => {
      reply.header('cache-control', 'no-store');
      requireAdmin(request, ctx);
      return reply.send(eventDirectory(ctx.db));
    }
  );

  app.get(
    '/api/visited-events',
    { config: limit(config, 120, '1 minute') },
    async (request, reply) => {
      return reply
        .header('cache-control', 'private, no-store')
        .send(eventDirectory(ctx.db, visitedIds(ctx, request)));
    }
  );

  const ImportVisits = z.strictObject({
    ids: z.array(z.string().refine(isId)).max(MAX_VISITS),
  });
  app.post(
    '/api/visited-events',
    { config: limit(config, 20, '1 minute') },
    async (request, reply) => {
      const { ids } = parseBody(ImportVisits, request.body);
      const known = eventDirectory(ctx.db, ids).map((event) => event.id);
      rememberVisits(ctx, request, reply, known);
      return reply
        .header('cache-control', 'private, no-store')
        .code(204)
        .send();
    }
  );

  app.post(
    '/api/events',
    { config: limit(config, 10, '1 hour', 'creation_limit') },
    async (request, reply) => {
      reply.header('cache-control', 'no-store');
      if (!config.creationEnabled || ctx.admin === null) {
        throw new ApiError(
          503,
          'creation_disabled',
          'This instance does not take new events'
        );
      }
      if (!isAdmin(request, ctx)) {
        throw new ApiError(
          403,
          'creation_locked',
          'Unlock the admin page to create an event'
        );
      }
      const body = parseBody(CreateEventBody, request.body);
      const days = normalizeDays(body.days);
      checkDays(days, earliestDay(ctx), latestDay(ctx), body.durationDays);
      if (
        !ceiling.allow(
          ctx.clock.now(),
          300 * config.rateLimitMultiplier,
          networkKey(request.ip)
        )
      ) {
        throw new ApiError(
          429,
          'creation_limit',
          'Too many new events right now'
        );
      }
      if (
        countEvents(ctx.db) >= config.maxEvents ||
        (config.maxDbBytes !== null && ctx.db.sizeBytes() >= config.maxDbBytes)
      ) {
        throw new ApiError(503, 'capacity', 'This instance is full');
      }
      const id = makeId(randomInt);
      insertEvent(
        ctx.db,
        {
          id,
          adminHash: '', // Legacy column, ignored for access.
          title: body.title,
          description: body.description || null,
          location: body.location || null,
          emoji: body.emoji,
          theme: body.theme,
          creatorName: body.creatorName || null,
          language: body.language,
          durationDays: body.durationDays,
          minCount: body.minCount ?? null,
          days,
          roster: rosterEntries(body.roster ?? []),
        },
        ctx.clock.now()
      );
      return reply.code(201).send({ id });
    }
  );

  app.get<IdParams>(
    '/api/events/:id',
    { config: limit(config, 600, '1 minute') },
    async (request, reply) => {
      const admin = header(request, ADMIN_HEADER) !== undefined;
      if (admin) requireAdmin(request, ctx);
      const event = eventOr404(ctx, request.params.id);
      const data = snapshot(ctx.db, event.id)!;
      if (!admin && request.method === 'GET')
        rememberVisits(ctx, request, reply, [event.id]);

      const claim = readParticipantToken(
        ctx.secret,
        event.id,
        header(request, PARTICIPANT_HEADER)
      );
      const participant =
        claim && getParticipant(ctx.db, event.id, claim.participantId);
      const ownId =
        participant && participant.token_gen === claim?.generation
          ? participant.id
          : null;
      const scope = admin ? '-admin' : ownId ? `-self-${ownId}` : '';
      const etag = snapshotEtag(event.version, scope);
      reply
        .header('etag', etag)
        .header(
          'cache-control',
          admin || ownId ? 'private, no-store' : 'private, no-cache'
        )
        .header('vary', `${ADMIN_HEADER}, ${PARTICIPANT_HEADER}`);
      if (matchesEtag(header(request, 'if-none-match'), etag))
        return reply.code(304).send();
      return reply.send(
        admin
          ? data
          : {
              event: data.event,
              participants: ownId
                ? data.participants.filter((person) => person.id === ownId)
                : [],
            }
      );
    }
  );

  app.patch<IdParams>(
    '/api/events/:id',
    { config: limit(config, 60, '1 minute') },
    async (request, reply) => {
      requireAdmin(request, ctx);
      const event = eventOr404(ctx, request.params.id);
      const body = parseBody(UpdateEventBody, request.body);
      const current = getDays(ctx.db, event.id).map((row) => row.day);
      const days = body.days ? normalizeDays(body.days) : current;
      const duration = body.durationDays ?? event.duration_days;
      if (body.days) {
        if (!sameDays(body.baseDays!, current)) {
          throw new ApiError(
            409,
            'days_changed',
            'The days changed since you started editing'
          );
        }
        // Days that have passed may stay; only new ones must lie ahead, and
        // not too far.
        const existing = new Set(current);
        const added = days.filter((day) => !existing.has(day));
        if (added.length > 0) {
          const problem = checkCandidateDays(
            added,
            earliestDay(ctx),
            latestDay(ctx)
          );
          if (problem !== null) {
            throw new ApiError(400, 'invalid_days', problem);
          }
        }
      }
      checkDays(days, null, null, duration);
      const changed = updateEvent(
        ctx.db,
        event.id,
        {
          ...(body.title !== undefined && { title: body.title }),
          ...(body.description !== undefined && {
            description: body.description || null,
          }),
          ...(body.location !== undefined && {
            location: body.location || null,
          }),
          ...(body.emoji !== undefined && { emoji: body.emoji }),
          ...(body.theme !== undefined && {
            theme: JSON.stringify(body.theme),
          }),
          ...(body.creatorName !== undefined && {
            creatorName: body.creatorName || null,
          }),
          ...(body.durationDays !== undefined && {
            durationDays: body.durationDays,
          }),
          ...(body.minCount !== undefined && { minCount: body.minCount }),
          ...(body.days !== undefined && { days }),
        },
        ctx.clock.now()
      );
      if (changed) published(ctx, event.id);
      return sendSnapshot(ctx, reply, event.id);
    }
  );

  app.put<IdParams>(
    '/api/events/:id/status',
    { config: limit(config, 60, '1 minute') },
    async (request, reply) => {
      requireAdmin(request, ctx);
      const event = eventOr404(ctx, request.params.id);
      const body = parseBody(StatusBody, request.body);
      if (body.status === 'finalized') {
        const days = getDays(ctx.db, event.id).map((row) => row.day);
        if (!blockFits(days, body.start, event.duration_days)) {
          throw new ApiError(
            400,
            'invalid_block',
            'That is not a block of candidate days'
          );
        }
        const end = addDays(body.start, event.duration_days - 1);
        setStatus(
          ctx.db,
          event.id,
          { start: body.start, end },
          ctx.clock.now()
        );
      } else {
        setStatus(ctx.db, event.id, body.status, ctx.clock.now());
      }
      published(ctx, event.id);
      return sendSnapshot(ctx, reply, event.id);
    }
  );

  app.delete<IdParams>(
    '/api/events/:id',
    { config: limit(config, 60, '1 minute') },
    async (request, reply) => {
      requireAdmin(request, ctx);
      const event = eventOr404(ctx, request.params.id);
      deleteEvent(ctx.db, event.id);
      ctx.hub.deleted(event.id);
      ctx.db.requestCheckpoint();
      return reply.code(204).send();
    }
  );

  app.post<IdParams>(
    '/api/events/:id/participants',
    { config: limit(config, 60, '1 minute') },
    async (request, reply) => {
      requireAdmin(request, ctx);
      const event = eventOr404(ctx, request.params.id);
      const body = parseBody(RosterBody, request.body);
      // Names already there are skipped, so only the new ones count.
      const entries = rosterEntries(body.names).filter(
        (entry) => !findParticipantByKey(ctx.db, event.id, entry.nameKey)
      );
      assertRoom(ctx, event.id, entries.length);
      addRoster(ctx.db, event.id, entries, ctx.clock.now());
      published(ctx, event.id);
      return sendSnapshot(ctx, reply, event.id);
    }
  );

  app.get<IdParams>(
    '/api/events/:id/calendar.ics',
    { config: limit(config, 600, '1 minute') },
    async (request, reply) => {
      const event = eventOr404(ctx, request.params.id);
      if (event.final_start === null || event.final_end === null) {
        throw new ApiError(404, 'not_decided', 'No date has been chosen yet');
      }
      const ics = buildIcs(
        {
          uid: `${event.id}@owl-be-there`,
          title: event.title,
          description: SERVER_TEXTS[event.language].calendarNote,
          location: event.location,
          start: event.final_start,
          end: event.final_end,
          url: `${config.publicUrl}/e/${event.id}`,
        },
        new Date(ctx.clock.now())
      );
      return reply
        .header('content-type', 'text/calendar; charset=utf-8')
        .header(
          'content-disposition',
          'attachment; filename="owl-be-there.ics"'
        )
        .header('cache-control', 'private, no-cache')
        .send(ics);
    }
  );
}
