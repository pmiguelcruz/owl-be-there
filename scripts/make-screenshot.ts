/**
 * Capture a sample event in light and dark mode and regenerate the default
 * link preview. The sample exists only in the temporary screenshot database.
 *
 *     npm run build
 *     npm run screenshot -- --out <dir>
 */
import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { createServer, type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  CREATION_HEADER,
  exampleSnapshot,
  PREVIEW_COLOURS,
  todayUTC,
} from '@owl/shared';
import { chromium, type Browser, type Page } from '@playwright/test';

const root = resolve(import.meta.dirname, '..');

// Anything but `--out <dir>` (or `--out=<dir>`) is refused: a typo must not fall
// back to overwriting the tracked pictures.
let out: string | undefined;
try {
  out = parseArgs({ strict: true, options: { out: { type: 'string' } } }).values
    .out;
  if (out === '') throw new Error('--out needs a directory');
} catch (error) {
  console.error(
    `${(error as Error).message}\nusage: npm run screenshot [-- --out <dir>]`
  );
  process.exit(2);
}
const outDir = out === undefined ? join(root, 'docs') : resolve(out);
const ogPath =
  out === undefined
    ? join(root, 'packages/client/public/og.png')
    : join(outDir, 'og.png');
// A port the system hands out, so a leftover server of an earlier run, or any
// other listener, cannot be mistaken for the one started here.
const PORT = await new Promise<number>((done, fail) => {
  const probe = createServer();
  probe.once('error', fail);
  probe.listen(0, '127.0.0.1', () => {
    const { port } = probe.address() as AddressInfo;
    probe.close(() => done(port));
  });
});
const base = `http://127.0.0.1:${PORT}`;

for (const built of ['packages/server/dist/index.js', 'packages/client/dist']) {
  if (!existsSync(join(root, built))) {
    console.error(`${built} is missing; run npm run build first.`);
    process.exit(2);
  }
}

async function waitForServer(failure: () => Error | null): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const died = failure();
    if (died) throw died;
    try {
      if ((await fetch(`${base}/api/health`)).ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error('The server did not start');
}

const SCREENSHOT_PIN = '4182';

async function postJson(
  path: string,
  body: unknown,
  headers: Record<string, string> = {}
) {
  const response = await fetch(base + path, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`POST ${path}: ${response.status}`);
  return response.json();
}

async function sampleEvent(): Promise<string> {
  const { event, participants } = exampleSnapshot({
    today: todayUTC(),
    title: 'Team dinner',
    anna: new Map(),
  });
  const { token } = await postJson('/api/admin/unlock', {
    pin: SCREENSHOT_PIN,
  });
  const { id } = await postJson(
    '/api/events',
    {
      title: event.title,
      days: event.days,
      language: 'en',
      durationDays: 1,
      theme: {
        gradient: { start: '#52b9b8', end: '#9a69cf', angle: 25 },
        shape: 98253,
      },
    },
    { [CREATION_HEADER]: token }
  );
  const path = `/api/events/${id}`;
  for (const person of participants) {
    const { participantId, token } = await postJson(`${path}/session`, {
      name: person.name,
    });
    const response = await fetch(
      `${base}${path}/participants/${participantId}/marks`,
      {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'x-participant-token': token,
        },
        body: JSON.stringify({
          baseRev: 0,
          yes: person.yes,
          maybe: person.maybe,
        }),
      }
    );
    if (!response.ok)
      throw new Error(`Could not seed sample responses: ${response.status}`);
  }
  return id;
}

async function shoot(
  page: Page,
  id: string,
  theme: 'light' | 'dark'
): Promise<void> {
  await page.goto(`${base}/e/${id}`);
  await page.getByRole('grid', { name: 'Group' }).waitFor();
  await page.mouse.move(0, 0);
  const path = join(outDir, `screenshot-${theme}.png`);
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  console.log(`screenshot-${theme}.png: ${statSync(path).size} bytes`);
}

// The picture is typeset in the bundled Nunito, like the app and the per-event
// pictures, not in whatever font the machine running this happens to have.
const require = createRequire(import.meta.url);
const font = (weight: 400 | 800) =>
  readFileSync(
    require.resolve(
      `@fontsource/nunito/files/nunito-latin-${weight}-normal.woff2`
    )
  ).toString('base64');
const fontFace = (weight: 400 | 800) =>
  `@font-face { font-family: 'Nunito'; font-weight: ${weight}; src: url(data:font/woff2;base64,${font(weight)}) format('woff2'); }`;

/** The default link-preview picture, the same in every language: the owl, the name and a strip of heat. */
async function shootOg(browser: Browser): Promise<void> {
  const owl = readFileSync(
    join(root, 'packages/client/public/favicon.svg'),
    'utf8'
  );
  // The empty cell and the steps of the heatmap ramp, as a strip of calendar days.
  const { heat } = PREVIEW_COLOURS;
  const cells = [heat[0], heat[1], heat[0], heat[2], heat[3], heat[5], heat[4]];
  const html = `<!doctype html><html><head><style>
  ${fontFace(800)}
  html, body { margin: 0; width: 1200px; height: 630px; }
  body { display: flex; align-items: center; justify-content: center; gap: 64px;
    background: ${PREVIEW_COLOURS.bg}; font-family: 'Nunito', ui-rounded, system-ui, sans-serif; color: ${PREVIEW_COLOURS.ink}; }
  .owl { width: 340px; height: 352px; }
  h1 { font-size: 92px; margin: 0; font-weight: 800; letter-spacing: -2px; }
  .cal { display: grid; grid-template-columns: repeat(7, 46px); gap: 8px; margin-top: 36px; }
  .cal span { height: 46px; border-radius: 12px; }
</style></head><body>
  <div class="owl">${owl}</div>
  <div>
    <h1>Owl Be There</h1>
    <div class="cal">${cells
      .map((c) => `<span style="background:${c}"></span>`)
      .join('')}</div>
  </div>
</body></html>`;

  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
  });
  try {
    await page.setContent(html);
    await page.evaluate(() => document.fonts.load('800 92px Nunito'));
    if (!(await page.evaluate(() => document.fonts.check('800 92px Nunito'))))
      throw new Error('The bundled Nunito did not load');
    await page.locator('.owl svg').evaluate((svg) => {
      svg.setAttribute('width', '340');
      svg.setAttribute('height', '352');
    });
    await page.screenshot({ path: ogPath, type: 'png' });
  } finally {
    await page.close();
  }
  console.log(`og.png: ${statSync(ogPath).size} bytes`);
}

const dataDir = mkdtempSync(join(tmpdir(), 'owl-screenshot-'));
const server = spawn('node', ['packages/server/dist/index.js'], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: String(PORT),
    HOST: '127.0.0.1',
    PUBLIC_URL: base,
    CLIENT_DIR: 'packages/client/dist',
    DATA_DIR: dataDir,
    LOG_LEVEL: 'warn',
    CREATION_ENABLED: 'true',
    ADMIN_PIN: SCREENSHOT_PIN,
  },
});

// A server that dies at start is reported at once, not after the poll limit.
let serverFailure: Error | null = null;
server.once('error', (error) => {
  serverFailure = error;
});
server.once('exit', (code, signal) => {
  serverFailure = new Error(
    `The server exited (code ${code}, signal ${signal})`
  );
});

// An interrupted run still stops the server and removes its data directory;
// the `finally` below does not run on a signal.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.kill();
    rmSync(dataDir, { recursive: true, force: true });
    process.exit(signal === 'SIGINT' ? 130 : 143);
  });
}

try {
  mkdirSync(outDir, { recursive: true });
  await waitForServer(() => serverFailure);
  const id = await sampleEvent();
  const browser = await chromium.launch();
  try {
    for (const theme of ['light', 'dark'] as const) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        deviceScaleFactor: 1.25,
        locale: 'en-GB',
        colorScheme: theme,
      });
      await context.addInitScript((choice) => {
        localStorage.setItem('owl.theme', JSON.stringify(choice));
        localStorage.setItem('owl.lang', JSON.stringify('en'));
      }, theme);
      await shoot(await context.newPage(), id, theme);
      await context.close();
    }
    await shootOg(browser);
  } finally {
    await browser.close();
  }
} finally {
  server.kill();
  rmSync(dataDir, { recursive: true, force: true });
}
