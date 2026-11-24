# Security policy

## Reporting a vulnerability

Please use [GitHub private vulnerability reporting](https://github.com/ni-c/owl-be-there/security/advisories/new). Do not open a public issue for an unpatched vulnerability, and never include a real event link in a report: the link is the key to that event.

You get a first response within 14 days. Only the latest release and the current `main` branch receive security fixes.

## What the application stores

- **Per event:** the title, an optional description, location, emoji and organiser name, the candidate days and the event's settings.
- **Per participant:** the name they typed, an optional password hash (scrypt), an optional short note, and which days they marked as _yes_ or _maybe_.
- **Nothing else.** No accounts, no e-mail addresses, no stored IP addresses or analytics. Signed HttpOnly visit cookies remember the event links a browser has opened. The application never writes an IP address to its database or its log. The one exception is a click on _Add to Google Calendar_ once a date is chosen: that opens Google with the event's title, description, location and link filled in, as any such button does. The description goes along with `<` and `>` replaced by `‹` and `›`, so Google cannot read it as HTML and no disguised link appears there. The `.ics` file carries only a fixed note, not the description.

An administrator or operator can delete an event explicitly. SQLite uses `secure_delete` to overwrite deleted data in free pages.

## How access works

- **Participant links** use 12 random base58 characters. Anyone with a link can open the event and register an entry. Responses are private to their owner and Admin.
- **Admin** requires a server-verified PIN and a rate-limited unlock. The server holds the PIN ciphertext and reads the decryption key from its private environment. Admin can list every event and manage its details, roster, or deletion. Session tokens live in the unlocked tab and expire after 30 minutes or when locked.
- **Participants** receive a token scoped to their own event and entry. An existing entry requires its current token or password. A roster placeholder can be claimed once. Changing or removing a password revokes previous tokens for that entry.

## Abuse resistance

Public scheduling tools attract phishing: a poll is a free page on a trusted domain. So:

- Everything an organiser writes is plain text. Links in descriptions are never made clickable.
- Link previews show the event title, the state of the poll and the candidate days as a small calendar. Availability, names and descriptions stay out of public previews.
- A participant name that mixes Latin letters with Cyrillic or Greek letters is refused, so a lookalike of an existing name cannot be registered. A name written wholly in another script that resembles a Latin one is not caught; that is a residual risk.
- Rate limits per IP address — an IPv6 address counts as its /48, for every route limit and for the cap on live streams — kept in memory only, size limits on every field and list, and a ceiling on the number of stored events. The hourly ceiling on new events is shared out: one address or IPv6 /48 may take at most a tenth of it.
- Passwords cannot be guessed at speed. Wrong passwords are counted per event and name, in memory: after five, that name answers only after a wait that doubles with every further miss, up to 15 minutes, and ends with the right password. It is a wait, not a lock. On top of that, one address or IPv6 /48 may ask for at most 60 password checks in five minutes across all names. New passwords need at least six characters.
- `CREATION_ENABLED=false` stops new events without touching existing ones. The operator command line can delete a single event, list the events created since a day with how many people answered (marked days), and purge those nobody answered.

## Deployment requirements

- Terminate TLS at a reverse proxy, set `PUBLIC_URL` to the exact public origin and `TRUST_PROXY` to the proxy's address only (with Docker's port publishing, the compose network's gateway address, not the whole network).
- Keep the container as shipped: non-root user, read-only root filesystem, all capabilities dropped, `no-new-privileges`.
- `/data` holds the database and `secret.key`. Treat both as confidential and back them up together.
- Disable response buffering for `/api/events/*/stream` in the proxy, or live updates arrive in bursts.

## Deliberate trade-offs

- **The wait after wrong passwords belongs to a name, not to a person.** Someone who keeps guessing a name keeps its owner waiting on a new device; sessions that are already open keep working. The count of wrong passwords for a name starts over after 30 minutes without a miss.
- **A participant's session alone can change or remove that entry's password**, and sessions do not expire. Log out on borrowed devices.

## Dependencies

The link-preview pictures use `@resvg/resvg-wasm` and `wawoff2`. They only ever see SVG that the server builds itself from escaped text and bundled assets, and fonts that ship with the image; nothing a visitor sends reaches them. That is why the old Rust crates embedded in resvg-wasm 2.6.2 (which `npm audit` cannot see into) and the unmaintained wawoff2 are acceptable for now. Never feed either of them an uploaded image or font.
