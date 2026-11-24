<p align="center">
  <img src="packages/client/public/favicon.svg" width="120" alt="The Owl Be There owl" />
</p>

# Owl Be There

**Find a day everyone can make.**

<p>
  <a href="https://www.bestpractices.dev/projects/15274"><img src="https://www.bestpractices.dev/projects/15274/badge" alt="OpenSSF Best Practices" /></a>
  <a href="https://scorecard.dev/viewer/?uri=github.com/ni-c/owl-be-there"><img src="https://api.scorecard.dev/projects/github.com/ni-c/owl-be-there/badge" alt="OpenSSF Scorecard" /></a>
</p>

This is [Pedro’s fork](https://github.com/pmiguelcruz/owl-be-there) of [Owl Be There](https://github.com/ni-c/owl-be-there), a whole-day group scheduling tool inspired by [Rallly](https://github.com/lukevella/rallly) and [Crab Fit](https://github.com/GRA0007/crab.fit). Participants open a link and mark their own availability. Admin reviews the group’s calendar. No accounts.

The home page lists existing events whose links this browser has opened. Unlock **Admin** with the PIN to see all events, edit them, or choose **Plan an event**. Choose from ten gradients under **Look and feel**, refresh for another set, then send the participant link to your group.

## Features

- **Mark days the way you think about them:** tap a day to switch it on or off, drag across the calendar to mark a whole block — say, every weekend in March — in one go. Start a drag on a marked day and it erases instead. Weekday and week headers toggle a whole column or row; the keyboard does everything too.
- **Yes and maybe:** a second brush for "if need be". Maybe is hatched and carries a question mark, so it never depends on colour alone.
- **The group at a glance in Admin:** the same calendar as a heatmap with a count on every day, the best days ranked, a minimum head count, and a sheet per day naming who can, who might, who cannot and who has not answered yet. Updates arrive live.
- **Multi-day events:** looking for a whole weekend? Ask for two days in a row and get the best blocks.
- **No accounts:** your name, and a password only if you want one. An entry belongs to the browser that first claimed it. Add a password to recover it in another browser. Admin can edit the event, correct entries, close the poll, and choose the date. Everyone with the participant link can download the chosen date.
- **Sharing:** the system share sheet with a ready-made invitation, the link to copy, and a QR code. Messengers show a link preview with the title, the state of the poll and the candidate days as a small calendar.
- **Minimal data:** no e-mail addresses, no stored IP addresses or tracking. Signed browser cookies remember opened event links. Events stay until manually deleted.
- **Made for phones:** the whole range in one calendar, big tap targets, dark mode, Arabic, Persian and Urdu (right to left), Czech, Dutch, English, Finnish, French, German, Indonesian, Italian, Japanese, Korean, Norwegian Bokmål, Polish, Portuguese (Portugal and Brazil), Russian, Simplified Chinese, Spanish (Spain and Latin America), Swedish, Traditional Chinese, Turkish, Ukrainian and Vietnamese.
- **Self-hostable:** one container, one SQLite file.

The Japanese interface, and the link previews in Japanese, Korean and Traditional Chinese, use a locally hosted Noto Sans CJK JP font (© 2014–2021 Adobe). Its SIL Open Font License is included with the font files.
The Simplified Chinese interface and link previews use a locally hosted Noto Sans CJK SC font under the same license.
The Arabic, Persian and Urdu interface and link previews use locally hosted Noto Sans Arabic fonts. Their Apache License 2.0 is included with the font files.
Link previews draw everything else in Nunito, bundled with the server under its SIL Open Font License.

## Self-hosting

Build the container from this fork. It runs as a non-root user on a read-only root filesystem and keeps everything it writes in `/data`: the database `owl.db` and the server secret `secret.key`, which signs participant tokens and visit cookies.

1. Copy [`compose.example.yaml`](compose.example.yaml) to `compose.yaml` and set `PUBLIC_URL`.
2. Create the data directory for the container's user: `mkdir data && sudo chown 1000:1000 data`.
3. Put the fork’s `ADMIN_PIN_KEY` in an ignored, owner-readable `.env` file. The repository contains only the encrypted PIN.
4. Run `docker compose up -d --build` and put a reverse proxy with TLS in front (below).

### Configuration

| Variable               | Default                 | Meaning                                                                                                                                                                            |
| ---------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_URL`           | `http://localhost:8080` | The public origin, without a path. The only source of absolute URLs (link previews, calendar files) — moving to another domain means changing this and nothing else.               |
| `TRUST_PROXY`          | `127.0.0.1,::1`         | Addresses or CIDR ranges whose `X-Forwarded-For` is believed. Behind Docker's port publishing that is the compose network's gateway, so trust that address. `false` trusts nobody. |
| `PORT` / `HOST`        | `8080` / `0.0.0.0`      | Where the server listens inside the container.                                                                                                                                     |
| `ADMIN_PIN_KEY`        | unset                   | Server-only AES-256 key, encoded as 64 hexadecimal characters. Admin is unavailable without a key.                                                                                 |
| `ADMIN_PIN_CIPHERTEXT` | fork default            | Optional encrypted four-digit PIN for a separate installation. Encode the 12-byte nonce, 16-byte GCM tag, and 4-byte ciphertext together as hex.                                   |
| `CREATION_ENABLED`     | `true`                  | `false` stops new events from being created; existing ones keep working. The emergency switch against abuse.                                                                       |
| `MAX_EVENTS`           | `10000`                 | No new events beyond this many.                                                                                                                                                    |
| `MAX_DB_BYTES`         | unset                   | No new events once the data in the database holds this many bytes; space freed by deletions counts as free. A full event takes about 3 MB.                                         |
| `OWL_SECRET`           | generated               | At least 32 characters. Normally left unset: the server creates `/data/secret.key` on first start.                                                                                 |
| `LOG_LEVEL`            | `info`                  | `fatal`, `error`, `warn`, `info`, `debug` or `trace`. Requests are never logged.                                                                                                   |

The instance applies per-network and instance-wide PIN attempt limits. An unlock lasts up to 30 minutes in the current tab. Locking Admin revokes the session. Reloading the tab discards it.

### Reverse proxy

Any proxy works. The one thing to get right is the live-update stream at `/api/events/<id>/stream`: it is a long-lived response that must not be buffered. The server sends `X-Accel-Buffering: no`, which nginx honours, and a heartbeat every 25 seconds; a dedicated location makes the intent explicit:

```nginx
server {
    server_name owl.example.org;
    listen 443 ssl;
    http2 on;
    # ssl_certificate …

    client_max_body_size 64k;

    location ~ ^/api/events/[^/]+/stream$ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_read_timeout 1h;
    }

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
    }
}
```

The application sets its own security headers (a strict Content Security Policy, `Referrer-Policy: no-referrer` and the rest); do not add a second CSP in the proxy.

**Moving to another domain:** set `PUBLIC_URL` to the new origin. You can keep the old domain serving the application as well — point a second server block at the same container. Links to share, QR codes, invitation texts and link previews then always carry `PUBLIC_URL`, whichever domain a visitor came through, so the old one fades out without breaking a single link. Visit cookies and participant sessions belong to their browser origin. Keep the event path when redirecting to the new domain.

### Operating it

```sh
docker compose exec owl node packages/server/dist/cli.js stats
docker compose exec owl node packages/server/dist/cli.js weeks
docker compose exec owl node packages/server/dist/cli.js delete <event id>
docker compose exec owl node packages/server/dist/cli.js list 2027-03-01
docker compose exec owl node packages/server/dist/cli.js purge 2027-03-01 --yes
```

`stats` counts events, participants and marks; `weeks` counts per ISO week the events created, how many of them somebody answered and the people who joined. `delete` removes an event at once, for abuse reports. `list` shows the events created since a day with how many people answered (marked days), and `purge` deletes those among them that nobody answered — for cleaning up after a flood of new events; without `--yes` it only says how many it would delete. No events are deleted on a schedule.

The CLI never creates or upgrades a database: the server must have started once on that data directory, and after an update of the image it has to be started once before the CLI works again.

**Backups:** copy `owl.db` with SQLite's online backup (`sqlite3 data/owl.db ".backup backup.db"`) rather than the file itself, which may be mid-write. Keep `secret.key` too; without it, participants with a password must log in again.

## Development

Use Node 26. Run `npm ci`, provision `ADMIN_PIN_KEY` in the local `.env` file, and run `npm run dev`. See [CONTRIBUTING.md](CONTRIBUTING.md) for the commands and the conventions, and [docs/design.md](docs/design.md) for the colours and why they are what they are.

## License

[MIT](LICENSE)
