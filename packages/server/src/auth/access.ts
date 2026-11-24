import { ADMIN_HEADER, PARTICIPANT_HEADER } from '@owl/shared';
import type { FastifyRequest } from 'fastify';
import type { EventRow, ParticipantRow } from '../db/repo.js';
import type { AppContext } from '../context.js';
import { ApiError, header } from '../http.js';
import { readParticipantToken } from './tokens.js';

export function isAdmin(request: FastifyRequest, ctx: AppContext): boolean {
  return (
    ctx.admin?.allows(header(request, ADMIN_HEADER), ctx.clock.now()) === true
  );
}

export function requireAdmin(request: FastifyRequest, ctx: AppContext): void {
  if (!isAdmin(request, ctx))
    throw new ApiError(403, 'forbidden', 'Unlock Admin with the PIN');
}

/**
 * Whether the request carries a valid token for this very participant, of the
 * current generation — a token from before the last password change is dead.
 */
export function isParticipant(
  request: FastifyRequest,
  secret: Buffer,
  event: EventRow,
  participant: ParticipantRow
): boolean {
  const claim = readParticipantToken(
    secret,
    event.id,
    header(request, PARTICIPANT_HEADER)
  );
  return (
    claim !== null &&
    claim.participantId === participant.id &&
    claim.generation === participant.token_gen
  );
}
