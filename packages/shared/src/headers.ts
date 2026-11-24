/** The request header that carries a participant's token. */
export const PARTICIPANT_HEADER = 'x-participant-token';

/** The ETag of the event snapshot at `version`. */
export const snapshotEtag = (version: number, scope = ''): string =>
  `"v${version}${scope}"`;

/** The short-lived site administrator session. */
export const ADMIN_HEADER = 'x-site-admin-token';
