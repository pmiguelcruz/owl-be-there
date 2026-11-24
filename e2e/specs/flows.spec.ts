import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  greeting,
  answer,
  createEvent,
  day,
  dayFromNow,
  groupCalendar,
  isMobile,
  joinAs,
  saved,
  myCalendar,
  openAsOrganiser,
  organiserTools,
  showView,
  snapshot,
  startWizard,
  unlockAdmin,
  utcDateOf,
} from '../helpers.ts';

const D = (offset: number) => dayFromNow(offset);

test('an organiser creates an event with the wizard and gets the share sheet', async ({
  page,
}) => {
  await startWizard(page);
  await page.getByLabel('Title').fill('Five-a-side');
  const picker = page.getByRole('group', { name: 'Wallpaper pattern' });
  const options = picker.getByRole('radio');
  const selected = picker.locator('figure [data-pattern]');
  const recipes = () =>
    picker
      .locator('label [data-pattern]')
      .evaluateAll((choices) =>
        choices.map((choice) => choice.getAttribute('data-pattern'))
      );
  await expect(options).toHaveCount(10);
  const original = await recipes();
  expect(new Set(original).size).toBe(10);
  await expect(
    picker.locator('label [data-spacing="sparse"]').first()
  ).toBeVisible();
  await expect(
    picker.locator('label [data-spacing="packed"]').first()
  ).toBeVisible();
  await picker.getByRole('button', { name: 'Refresh patterns' }).click();
  const refreshed = await recipes();
  expect(new Set(refreshed).size).toBe(10);
  expect(refreshed.every((recipe) => !original.includes(recipe))).toBe(true);
  await expect(selected).toHaveAttribute('data-pattern', original[0]!);
  await picker.getByRole('radio', { name: /^Pattern 3\b/ }).check();
  const wallpaper = refreshed[2]!;
  await expect(selected).toHaveAttribute('data-pattern', wallpaper);
  const colorsOf = (wallpaper: Locator) =>
    wallpaper.locator('linearGradient, radialGradient');
  const colorFields = (wallpaper: Locator) =>
    colorsOf(wallpaper).evaluateAll((shapes) =>
      shapes.map((shape) => ({
        tag: shape.tagName,
        attrs: Array.from(shape.attributes)
          .filter(({ name }) => name !== 'id')
          .map(({ name, value }) => [name, value]),
        stops: Array.from(shape.children).map((stop) => stop.outerHTML),
      }))
    );
  const styles = await picker
    .locator('label [data-gradient]')
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-gradient'))
    );
  expect(new Set(styles)).toEqual(new Set(['linear', 'radial', 'flow']));
  const gradientStyle = await selected.getAttribute('data-gradient');
  await expect(colorsOf(selected)).toHaveCount(
    gradientStyle === 'flow' ? 4 : 1
  );
  if (gradientStyle === 'linear')
    await expect(selected.locator('radialGradient')).toHaveCount(0);
  const originalFields = await colorFields(selected);
  await page.getByLabel('Place (optional)').fill('North field');
  await page.getByRole('button', { name: 'Next' }).click();

  // Fridays to Sundays only, and two days in a row.
  for (const weekday of ['Friday', 'Saturday', 'Sunday']) {
    // The accessible name is "Fri: Friday": the visible text first.
    await page
      .getByRole('button', { name: new RegExp(`: ${weekday}$`) })
      .click();
  }
  await page.getByRole('button', { name: 'One day more in a row' }).click();
  await expect(page.getByText(/days? to choose from/)).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Names (optional)').fill('Anna\nBen');
  await page.getByRole('button', { name: 'Create event' }).click();

  await expect(
    page.getByRole('heading', { name: 'Share with your group' })
  ).toBeVisible();
  await expect(
    page.getByText('All set! Send the link to the others.')
  ).toBeVisible();
  const link = await page
    .getByRole('textbox', { name: 'Link for everyone' })
    .inputValue();
  // The canonical origin from PUBLIC_URL, not the 127.0.0.1 the test opened.
  expect(link).toMatch(/^http:\/\/localhost:\d+\/e\/[1-9A-HJ-NP-Za-km-z]{12}$/);
  await expect(
    page.getByRole('textbox', { name: 'Your organizer link' })
  ).toHaveCount(0);
  await expect(page.getByRole('img', { name: link })).toBeVisible();
  // One participant link and its QR code — and
  // no invitation text to copy; the system share sheet carries that.
  await expect(page.getByLabel('Invitation text')).toHaveCount(0);
  const top = async (locator: Locator) => (await locator.boundingBox())!.y;
  const order = [
    await top(page.getByRole('textbox', { name: 'Link for everyone' })),
    await top(page.getByRole('img', { name: link })),
  ];
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Close', exact: true })
    .click();

  await expect(
    page.getByRole('heading', { name: 'Five-a-side' })
  ).toBeVisible();
  const eventWallpaper = page.locator('[data-wallpaper="event"]');
  await expect(eventWallpaper).toHaveAttribute('data-pattern', wallpaper);
  expect(await colorFields(eventWallpaper)).toEqual(originalFields);
  await expect(eventWallpaper).toHaveAttribute('data-repeat-scale', '0.5');
  await expect(eventWallpaper).toHaveAttribute('data-gradient', gradientStyle!);
  await expect
    .poll(() =>
      eventWallpaper.locator('canvas').evaluate((canvas: HTMLCanvasElement) =>
        canvas
          .getContext('2d')!
          .getImageData(0, 0, canvas.width, canvas.height)
          .data.some((channel, index) => index % 4 === 3 && channel > 0)
      )
    )
    .toBe(true);
  const colors = page.locator('[data-event-palette]');
  const themeColor = (token: string) =>
    colors.evaluate(
      (element, name) =>
        getComputedStyle(element).getPropertyValue(name).trim(),
      token
    );
  const initialAccent = await themeColor('--owl-brand');
  const initialBase = await themeColor('--owl-bg');
  await expect(eventWallpaper.locator('rect').first()).toHaveAttribute(
    'fill',
    initialBase
  );
  const button = page.getByRole('button', { name: 'Share', exact: true });
  const rgb = (hex: string) =>
    `rgb(${hex
      .slice(1)
      .match(/../g)!
      .map((channel) => parseInt(channel, 16))
      .join(', ')})`;
  await expect(button).toHaveCSS('background-color', rgb(initialAccent));
  const about = page.getByRole('link', { name: 'About', exact: true });
  const card = page.locator('main section.bg-surface:visible').first();
  const background = (element: Locator) =>
    element.evaluate((node) => getComputedStyle(node).backgroundColor);
  const initialSurface = await background(card);
  await expect(about).toHaveCSS('background-color', initialSurface);

  const id = new URL(page.url()).pathname.split('/').at(-1)!;
  await openAsOrganiser(page, { id });
  await expect(eventWallpaper).toHaveAttribute('data-pattern', wallpaper);
  await page
    .locator('details > summary')
    .filter({ hasText: 'Wallpaper pattern' })
    .click();
  const editor = page.getByRole('group', { name: 'Wallpaper pattern' });
  const preview = editor.locator('figure [data-pattern]');
  await expect(preview).toHaveAttribute('data-pattern', wallpaper);
  const otherColor = await editor
    .locator('label [data-pattern]')
    .evaluateAll(
      (options, base) =>
        options.findIndex(
          (option) =>
            option.querySelector('rect')?.getAttribute('fill') !== base
        ),
      initialBase
    );
  expect(otherColor).toBeGreaterThanOrEqual(0);
  await editor.getByRole('radio').nth(otherColor).check();
  const replacement = (await preview.getAttribute('data-pattern'))!;
  const replacementFields = await colorFields(preview);
  expect(replacementFields).not.toEqual(originalFields);
  await expect(eventWallpaper).toHaveAttribute('data-pattern', wallpaper);
  await page.getByRole('button', { name: 'Save pattern' }).click();
  await expect(eventWallpaper).toHaveAttribute('data-pattern', replacement);
  const newAccent = await themeColor('--owl-brand');
  expect(newAccent).not.toBe(initialAccent);
  await expect(button).toHaveCSS('background-color', rgb(newAccent));
  const newSurface = await background(card);
  expect(newSurface).not.toBe(initialSurface);
  await expect(about).toHaveCSS('background-color', newSurface);
  await expect(page.getByText('2 days in a row')).toBeVisible();
  expect(new URL(page.url()).hash).toBe('');
  await showView(page, 'mine');
  await expect(page.getByRole('button', { name: 'Anna' })).toBeVisible();

  // Participants get the saved wallpaper with their registration view.
  await page.goto(new URL(link).pathname);
  await expect(eventWallpaper).toHaveAttribute('data-pattern', replacement);
  expect(await colorFields(eventWallpaper)).toEqual(replacementFields);
  expect(await themeColor('--owl-brand')).toBe(newAccent);
  await expect(page.getByRole('button', { name: 'Save pattern' })).toHaveCount(
    0
  );
});

test('a saved wild wallpaper leaves event text and controls readable', async ({
  page,
  request,
}) => {
  const { id } = await createEvent(request, {
    title: 'Neon night',
    description: 'Meet under the pink lights.',
    theme: { version: 1, pattern: { kind: 'chevrons', seed: 112, wild: true } },
  });
  await openAsOrganiser(page, { id });
  const wallpaper = page.locator('[data-wallpaper="event"]');
  await expect(wallpaper).toHaveAttribute('data-pattern', 'chevrons:112:wild');
  const heading = page.getByRole('heading', { name: 'Neon night' });
  const surface = page.locator('.event-intro');
  const description = surface.getByText('Meet under the pink lights.');
  const button = page.getByRole('button', { name: 'Share', exact: true });

  async function rgba(element: Locator, property: 'color' | 'backgroundColor') {
    return element.evaluate((node, key) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d')!;
      const style = getComputedStyle(node);
      if (key === 'backgroundColor') {
        // Measure the translucent panel over the brightest possible backdrop.
        context.fillStyle = '#fff';
        context.fillRect(0, 0, 1, 1);
      }
      context.fillStyle = style[key];
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
    }, property);
  }
  function luminance(rgb: number[]) {
    const factors = [0.2126, 0.7152, 0.0722];
    return rgb.reduce((sum, value, i) => {
      const channel = value / 255;
      const linear =
        channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4;
      return sum + linear * factors[i]!;
    }, 0);
  }
  for (const [label, backdrop] of [
    [heading, surface],
    [description, surface],
    [button, button],
  ] as const) {
    const color = await rgba(label, 'color');
    if (label === button) expect(Math.max(...color)).toBeLessThan(45);
    else expect(Math.max(...color) - Math.min(...color)).toBeGreaterThan(25);
    const shades = [
      luminance(color),
      luminance(await rgba(backdrop, 'backgroundColor')),
    ];
    expect(
      (Math.max(...shades) + 0.05) / (Math.min(...shades) + 0.05)
    ).toBeGreaterThanOrEqual(4.5);
  }
  await page.goto(`/e/${id}`);
  await expect(wallpaper).toHaveAttribute('data-wild', 'true');
});

test('changing the range keeps the days the organiser already chose', async ({
  page,
}) => {
  await startWizard(page);
  await page.getByLabel('Title').fill('Book club');
  await page.getByRole('button', { name: 'Next' }).click();

  const from = page.getByLabel('From', { exact: true });
  const to = page.getByLabel('To', { exact: true });
  const grid = page.getByRole('grid', { name: 'Calendar' });
  const count = page.getByText(/days? to choose from/);

  await from.fill(D(3));
  await to.fill(D(10));
  await expect(count).toHaveText('8 days to choose from');
  // One day in the middle and the last day of the range taken away.
  await day(grid, D(5)).click();
  await day(grid, D(10)).click();
  await expect(count).toHaveText('6 days to choose from');

  // A longer range: the new days are candidates, the taken-away ones stay off.
  await to.fill(D(14));
  await expect(count).toHaveText('10 days to choose from');
  await expect(day(grid, D(5))).toHaveAttribute('aria-pressed', 'false');
  await expect(day(grid, D(10))).toHaveAttribute('aria-pressed', 'false');
  await expect(day(grid, D(12))).toHaveAttribute('aria-pressed', 'true');

  // A later start drops D(5) out of the range; moving back brings it back off.
  await from.fill(D(7));
  await expect(count).toHaveText('7 days to choose from');
  await expect(day(grid, D(5))).toHaveCount(0);
  await from.fill(D(3));
  await expect(count).toHaveText('10 days to choose from');
  await expect(day(grid, D(5))).toHaveAttribute('aria-pressed', 'false');
  await expect(day(grid, D(3))).toHaveAttribute('aria-pressed', 'true');
});

test('changing the weekdays keeps the days the organiser already chose', async ({
  page,
}) => {
  await startWizard(page);
  await page.getByLabel('Title').fill('Book club');
  await page.getByRole('button', { name: 'Next' }).click();

  const grid = page.getByRole('grid', { name: 'Calendar' });
  const count = page.getByText(/days? to choose from/);
  const weekday = (iso: string) =>
    page.getByRole('button', {
      name: new RegExp(
        `: ${new Intl.DateTimeFormat('en-US', {
          weekday: 'long',
          timeZone: 'UTC',
        }).format(utcDateOf(iso))}$`
      ),
    });

  // Two weeks, so every weekday is there twice.
  await page.getByLabel('From', { exact: true }).fill(D(3));
  await page.getByLabel('To', { exact: true }).fill(D(16));
  await expect(count).toHaveText('14 days to choose from');
  // A day left out by hand before any weekday is picked.
  await day(grid, D(6)).click();
  await expect(count).toHaveText('13 days to choose from');

  // The first weekday leaves only its own days, and keeps what was painted on them.
  await weekday(D(6)).click();
  await expect(count).toHaveText('1 day to choose from');
  await expect(day(grid, D(6))).toHaveAttribute('aria-pressed', 'false');
  await expect(day(grid, D(13))).toHaveAttribute('aria-pressed', 'true');

  // Another weekday adds its days and leaves D(6) alone.
  await weekday(D(4)).click();
  await expect(count).toHaveText('3 days to choose from');
  await day(grid, D(11)).click();
  await expect(count).toHaveText('2 days to choose from');
  await weekday(D(5)).click();
  await expect(count).toHaveText('4 days to choose from');
  await expect(day(grid, D(6))).toHaveAttribute('aria-pressed', 'false');
  await expect(day(grid, D(11))).toHaveAttribute('aria-pressed', 'false');

  // Taking a weekday away removes only its days.
  await weekday(D(5)).click();
  await expect(count).toHaveText('2 days to choose from');
  await expect(day(grid, D(4))).toHaveAttribute('aria-pressed', 'true');
  await expect(day(grid, D(11))).toHaveAttribute('aria-pressed', 'false');
});

test('legacy icons give way to stable dark wallpapers and the owl favicon', async ({
  page,
  request,
}) => {
  const first = await createEvent(request, { title: 'Kick-off' });
  const second = await createEvent(request, {
    title: 'Chess night',
    emoji: 'chess',
  });
  const icon = page.locator('link[rel="icon"]');
  const wallpaper = page.locator('[data-wallpaper="event"]');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(`/e/${second.id}`);
  await expect(page).toHaveTitle('Chess night · Owl Be There');
  await expect(wallpaper).toBeVisible();
  const recipe = (await wallpaper.getAttribute('data-pattern'))!;
  const darkMode = await page
    .locator('html')
    .evaluate((html) => getComputedStyle(html).colorScheme);
  expect(darkMode).toBe('dark');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  await page.goto(`/e/${first.id}`);
  await expect(page).toHaveTitle('Kick-off · Owl Be There');
  await expect(icon).toHaveAttribute('href', '/favicon.svg');
  await expect(wallpaper).not.toHaveAttribute('data-pattern', recipe);
  await expect(page.getByRole('heading', { name: 'Kick-off' })).toHaveText(
    'Kick-off'
  );

  await page.getByRole('link', { name: 'Owl Be There' }).first().click();
  await expect(page.getByRole('list', { name: 'Your events' })).toBeVisible();
  await page.getByRole('link', { name: /Chess night/ }).click();
  await expect(page).toHaveTitle('Chess night · Owl Be There');
  await expect(wallpaper).toHaveAttribute('data-pattern', recipe);
  await expect(icon).toHaveAttribute('href', '/favicon.svg');
});

test('everything clickable shows the hand, and a disabled button does not', async ({
  page,
  request,
}) => {
  const { id } = await createEvent(request, { roster: ['Anna'] });
  const cursor = (locator: Locator) =>
    locator.evaluate((element) => getComputedStyle(element).cursor);

  await page.goto('/about');
  expect(await cursor(page.getByRole('link', { name: 'Admin' }))).toBe(
    'pointer'
  );
  expect(await cursor(page.getByLabel('Language'))).toBe('pointer');
  expect(await cursor(page.getByRole('link').first())).toBe('pointer');

  await page.goto(`/e/${id}`);
  await showView(page, 'mine');
  await joinAs(page, 'Anna');
  expect(await cursor(day(myCalendar(page), D(5)))).toBe('pointer');
  // Nothing to undo yet: the button is disabled and says so.
  const undo = page.getByRole('button', { name: 'Undo' });
  await expect(undo).toBeDisabled();
  expect(await cursor(undo)).toBe('not-allowed');
});

test('a select keeps its shape on focus and draws its own arrow', async ({
  page,
}) => {
  const style = (locator: Locator) =>
    locator.evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        focusVisible: element.matches(':focus-visible'),
        radius: computed.borderTopLeftRadius,
        appearance: computed.appearance,
      };
    });

  await page.goto('/about');
  for (const name of ['Language', 'Theme']) {
    const select = page.getByLabel(name);
    const before = await style(select);
    expect(before.appearance).toBe('none');
    await select.focus();
    const after = await style(select);
    expect(after.focusVisible).toBe(true);
    expect(after.radius).toBe(before.radius);
    expect(after.radius).not.toBe('8px');
  }

  // Something without a rounding of its own still gets a rounded ring.
  const source = page.getByRole('link', { name: 'Crab Fit' });
  await page.keyboard.press('Tab');
  await source.focus();
  expect(await style(source)).toMatchObject({
    focusVisible: true,
    radius: '8px',
  });
});

test('the admin sees participant updates live, and the day sheet names them', async ({
  browser,
  request,
}) => {
  const { id } = await createEvent(request, { roster: ['Anna', 'Ben'] });
  const one = await browser.newPage();
  const two = await browser.newPage();
  await one.goto(`/e/${id}`);
  await openAsOrganiser(two, { id });
  await showView(two, 'group');
  await expect(two.getByText('No answers yet')).toBeVisible();

  await joinAs(one, 'Anna');
  await day(myCalendar(one), D(5)).click();

  // Ben's page updates by itself.
  const cell = day(groupCalendar(two), D(5));
  await expect(cell).toHaveAttribute('data-heat', '5', { timeout: 10_000 });
  // The count is drawn by CSS, so it never runs into the day number's text.
  const count = cell.locator('.cal-count');
  await expect(count).toHaveAttribute('data-count', '1');
  expect(
    await count.evaluate((e) => getComputedStyle(e, '::before').content)
  ).toBe('"1"');
  await expect(cell).toHaveAccessibleName(/: 1 can, 0 maybe, 0 cannot$/);
  await expect(
    two.getByText(/Not answered yet: \u2068Ben\u2069/)
  ).toBeVisible();

  // Without a note anywhere, neither page has a notes block.
  const notesHeading = (scope: Page | Locator) =>
    scope.getByRole('heading', { name: /^Notes\b/ });
  await expect(notesHeading(two)).toHaveCount(0);
  await cell.click();
  await expect(
    two.getByRole('dialog').getByRole('heading', { level: 3, name: /^Can\b/ })
  ).toBeVisible();
  await expect(notesHeading(two.getByRole('dialog'))).toHaveCount(0);
  await two.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

  // Someone with a note: the day sheet gives it a block of its own.
  const cleo = await (
    await request.post(`/api/events/${id}/session`, { data: { name: 'Cleo' } })
  ).json();
  const headers = { 'x-participant-token': cleo.token };
  const base = `/api/events/${id}/participants/${cleo.participantId}`;
  expect(
    (
      await request.patch(base, { headers, data: { note: 'After six' } })
    ).status()
  ).toBe(200);
  expect(
    (
      await request.put(`${base}/marks`, {
        headers,
        data: { baseRev: 0, yes: [D(5)], maybe: [] },
      })
    ).status()
  ).toBe(200);
  await expect(count).toHaveAttribute('data-count', '2', { timeout: 10_000 });

  await cell.click();
  const sheet = two.getByRole('dialog');
  const can = sheet
    .locator('section')
    .filter({ has: two.getByRole('heading', { level: 3, name: /^Can\b/ }) });
  await expect(can.getByRole('listitem')).toHaveText(['Anna', 'Cleo']);
  const notes = sheet.locator('section').filter({
    has: two.getByRole('heading', { level: 3, name: /^Notes\b/ }),
  });
  await expect(notes.getByRole('heading')).toHaveText('Notes · 1');
  await expect(notes.getByRole('listitem')).toHaveText(['Cleo (Can)After six']);

  // Ben has not answered yet, but his note shows, with the dashed chip.
  const ben = await (
    await request.post(`/api/events/${id}/session`, { data: { name: 'Ben' } })
  ).json();
  const benBase = `/api/events/${id}/participants/${ben.participantId}`;
  const benHeaders = { 'x-participant-token': ben.token };
  const noteOf = async (
    path: string,
    auth: Record<string, string>,
    note: string | null
  ) =>
    expect(
      (await request.patch(path, { headers: auth, data: { note } })).status()
    ).toBe(200);
  await noteOf(benBase, benHeaders, 'Abroad until the 9th');
  await expect(notes.getByRole('heading')).toHaveText('Notes · 2', {
    timeout: 10_000,
  });
  await expect(notes.getByRole('listitem')).toHaveText([
    'Ben (Not answered)Abroad until the 9th',
    'Cleo (Can)After six',
  ]);
  await expect(
    notes.getByRole('listitem').first().locator('span.border-dashed')
  ).toHaveCount(1);

  // Notes taken back: the block goes again, here and in the group view.
  await noteOf(benBase, benHeaders, null);
  await noteOf(base, headers, null);
  await expect(notes).toHaveCount(0, { timeout: 10_000 });
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(notesHeading(two)).toHaveCount(0);
  await cell.click();
  // An empty group is its heading alone.
  const maybe = sheet
    .locator('section')
    .filter({ has: two.getByRole('heading', { level: 3, name: /^Maybe\b/ }) });
  await expect(maybe.getByRole('heading')).toHaveText('Maybe · 0');
  await expect(maybe.getByRole('list')).toHaveCount(0);
  await expect(sheet.getByText('nobody')).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Close' }).click();
  await one.close();
  await two.close();
});

test('a protected name needs its password on another device', async ({
  browser,
  request,
}) => {
  const { id } = await createEvent(request);
  const phone = await browser.newPage();
  await phone.goto(`/e/${id}`);
  await showView(phone, 'mine');
  await phone.getByLabel('Your name', { exact: true }).fill('Maxi');
  await phone.getByLabel('Protect my entry with a password').check();
  await phone.getByLabel('Password', { exact: true }).fill('secret-1');
  await phone.getByRole('button', { name: 'Continue' }).click();
  await expect(greeting(phone, 'Maxi')).toBeVisible();

  const laptop = await browser
    .newContext()
    .then((context) => context.newPage());
  await laptop.goto(`/e/${id}`);
  await showView(laptop, 'mine');
  await laptop.getByLabel('Your name', { exact: true }).fill('maxi');
  await laptop.getByRole('button', { name: 'Continue' }).click();
  await expect(
    laptop.getByText(
      '“\u2068maxi\u2069” is protected. Enter the password to continue.'
    )
  ).toBeVisible();
  await laptop.getByLabel('Password', { exact: true }).fill('wrong!');
  await laptop.getByRole('button', { name: 'Continue' }).click();
  await expect(laptop.getByText('That password is not right.')).toBeVisible();
  await laptop.getByLabel('Password', { exact: true }).fill('secret-1');
  await laptop.getByRole('button', { name: 'Continue' }).click();
  await expect(greeting(laptop, 'Maxi')).toBeVisible();
});

test('the organiser removes a password only after confirming it', async ({
  page,
  request,
}) => {
  const { id, adminToken } = await createEvent(request);
  const session = await request.post(`/api/events/${id}/session`, {
    data: { name: 'Maxi', password: 'secret-1' },
  });
  expect(session.status()).toBe(200);
  const protectedEntry = async () =>
    (await snapshot(request, id)).participants[0].hasPassword;

  await openAsOrganiser(page, { id, adminToken });
  await page.locator('summary', { hasText: 'People' }).click();
  await page.getByRole('button', { name: /^Maxi/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Maxi' });
  const unlock = dialog.getByRole('button', { name: 'Remove password' });
  await unlock.click();
  await expect(dialog).toContainText('This signs them out');
  // Cancel goes back to the person's actions, not out of the sheet.
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(unlock).toBeFocused();
  expect(await protectedEntry()).toBe(true);

  await unlock.click();
  await dialog.getByRole('button', { name: 'Remove password' }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(protectedEntry).toBe(false);
});

test('a person’s row opens a sheet to fill in for them or remove them', async ({
  page,
  request,
}) => {
  const { id, adminToken } = await createEvent(request, {
    roster: ['Anna', 'Ben'],
  });
  await answer(request, id, 'Anna', [D(5)]);
  const ben = (await snapshot(request, id)).participants.find(
    (p: { name: string }) => p.name === 'Ben'
  );
  await openAsOrganiser(page, { id, adminToken });
  const people = await openSection(page, 'People');
  const annaRow = people.getByRole('button', { name: /^Anna/ });
  const benRow = people.getByRole('button', { name: /^Ben/ });
  // Who has not answered says so under the name; nobody has any buttons inline.
  await expect(annaRow).toHaveAccessibleName('Anna');
  await expect(benRow).toHaveAccessibleName(/^Ben\s+Not answered$/);
  await expect(people.getByRole('button', { name: 'Remove' })).toHaveCount(0);

  await benRow.click();
  const sheet = page.getByRole('dialog', { name: 'Ben' });
  await sheet.getByRole('button', { name: 'Fill in' }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText('Filling in for \u2068Ben\u2069')).toBeVisible();

  await annaRow.click();
  await page
    .getByRole('dialog', { name: 'Anna' })
    .getByRole('button', { name: 'Remove' })
    .click();
  await expect(page.getByRole('dialog', { name: 'Anna' })).toContainText(
    'Remove Anna and their days?'
  );
  await page
    .getByRole('dialog', { name: 'Anna' })
    .getByRole('button', { name: 'Remove' })
    .click();
  await expect(annaRow).toHaveCount(0);
  await expect
    .poll(async () =>
      (await snapshot(request, id)).participants.map(
        (p: { id: string }) => p.id
      )
    )
    .toEqual([ben.id]);
});

test('on a phone every row of the people list is as tall as the next', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 400, height: 800 });
  const { id, adminToken } = await createEvent(request, {
    roster: ['Al', 'Maximiliane Theresa von Hohenberg', 'Bo'],
  });
  for (const name of ['Al', 'Maximiliane Theresa von Hohenberg', 'Bo'])
    await answer(request, id, name, [D(5)]);
  const session = await request.post(`/api/events/${id}/session`, {
    data: { name: 'Bo' },
  });
  const { participantId, token } = await session.json();
  await request.patch(`/api/events/${id}/participants/${participantId}`, {
    headers: { 'x-participant-token': token },
    data: { password: 'secret-1', note: 'only after 6 pm' },
  });
  await openAsOrganiser(page, { id, adminToken });
  const people = await openSection(page, 'People');
  // The rows' buttons: the last list item has no divider and is 1 px shorter.
  const rows = people.getByRole('list').getByRole('button');
  await expect(rows).toHaveCount(3);
  const heights = await rows.evaluateAll((buttons) =>
    buttons.map((button) => button.getBoundingClientRect().height)
  );
  // A long name may wrap, but a password or a note never adds a line.
  expect(heights[2]).toBe(heights[0]);
  expect(heights[1]).toBeGreaterThanOrEqual(heights[0]!);
});

test('the organiser chooses the best day; everyone gets a calendar file', async ({
  page,
  request,
}) => {
  const { id, adminToken } = await createEvent(request, { minCount: 2 });
  const visitor = await page.context().browser()!.newPage();
  await visitor.goto(`/e/${id}`);
  await joinAs(visitor, 'Anna');
  await day(myCalendar(visitor), D(7)).click();
  await saved(visitor);
  await answer(request, id, 'Ben', [D(7)], [D(6)]);

  await openAsOrganiser(page, { id, adminToken });
  await showView(page, 'group');
  const best = page
    .getByRole('listitem')
    .filter({ hasText: '2 of 2 can' })
    .first();
  await expect(best.getByText('enough people')).toBeVisible();
  await best.getByRole('button', { name: 'Choose this date' }).click();

  await expect(page.getByText('The date is set!')).toBeVisible();
  const ics = await request.get(`/api/events/${id}/calendar.ics`);
  expect(ics.status()).toBe(200);
  expect(await ics.text()).toContain(
    `DTSTART;VALUE=DATE:${D(7).replaceAll('-', '')}`
  );
  const data = await snapshot(request, id);
  expect(data.event).toMatchObject({ status: 'finalized', finalStart: D(7) });

  await expect(myCalendar(visitor)).toHaveAttribute('aria-readonly', 'true');
  await expect(
    visitor.getByText('The poll is closed. You can’t change your days now.')
  ).toBeVisible();
  await visitor.close();
});

test('blocks of several days are ranked as blocks', async ({
  page,
  request,
}) => {
  const { id } = await createEvent(request, { durationDays: 2 });
  await answer(request, id, 'Anna', [D(6), D(7), D(8)]);
  await answer(request, id, 'Ben', [D(7), D(8)]);
  await openAsOrganiser(page, { id });
  await showView(page, 'group');
  const first = page.locator('ol > li').first();
  await expect(first).toContainText('2 of 2 can');
  const range = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    timeZone: 'UTC',
  }).format(utcDateOf(D(7)));
  await expect(first).toContainText(range);
});

test('leaving someone out changes the count', async ({ page, request }) => {
  const { id } = await createEvent(request);
  await answer(request, id, 'Anna', [D(6)]);
  await answer(request, id, 'Ben', [D(6)]);
  await openAsOrganiser(page, { id });
  await showView(page, 'group');
  await expect(page.locator('ol > li').first()).toContainText('2 of 2 can');
  await page.getByRole('button', { name: 'Ben', exact: true }).click();
  await expect(page.locator('ol > li').first()).toContainText('1 of 1 can');
});

test('an unknown event shows the missing-event message', async ({ page }) => {
  const response = await page.goto('/e/AAAAAAAAAAAA');
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole('heading', { name: 'We can’t find this event.' })
  ).toBeVisible();
});

test('the configured legal notice names the operator', async ({ page }) => {
  await page.goto('/imprint');
  await expect(page.getByRole('heading', { name: 'Imprint' })).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'Provider identification under § 5 DDG and § 18(1) MStV',
    })
  ).toBeVisible();
  const provider = page.locator('p').filter({
    hasText: 'Example Organisation',
  });
  await expect(provider.locator('bdi')).toHaveText([
    'Example Organisation',
    'Musterstraße 1',
    '12345 Musterstadt',
    'Germany',
  ]);
  await expect(provider).toContainText('Example Organisation');
  await expect(page.getByText('Email:')).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'privacy@example.org' })
  ).toHaveAttribute('href', 'mailto:privacy@example.org');
  await expect(
    page.getByRole('heading', { name: 'About Owl Be There' })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Consumer dispute resolution' })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Liability for content and links' })
  ).toBeVisible();

  // The address with a slash is the same page; German keeps the statute names.
  await page.getByRole('link', { name: 'About' }).click();
  await page.getByLabel('Language').selectOption('de');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await page.goto('/imprint/');
  await expect(
    page.getByRole('heading', {
      name: 'Anbieterkennzeichnung nach § 5 DDG und § 18 Abs. 1 MStV',
    })
  ).toBeVisible();
  await expect(page.getByText('Kontakt', { exact: true })).toBeVisible();
});

const REMEMBERED_LANGUAGES = [
  {
    code: 'es',
    name: 'Spanish',
    plan: 'Planear un evento',
    titleLabel: 'Título',
    title: 'Partido en el parque',
    next: 'Siguiente',
    create: 'Crear evento',
    shared: 'Compartir con el grupo',
  },
  {
    code: 'fr',
    name: 'French',
    plan: 'Organiser un événement',
    titleLabel: 'Titre',
    title: 'Foot au parc',
    next: 'Suivant',
    create: 'Créer l’événement',
    shared: 'Partager avec le groupe',
  },
  {
    code: 'pt',
    name: 'Portuguese',
    plan: 'Planear um evento',
    titleLabel: 'Título',
    title: 'Jogo no parque',
    next: 'Seguinte',
    create: 'Criar evento',
    shared: 'Partilhar com o grupo',
  },
  {
    code: 'it',
    name: 'Italian',
    plan: 'Organizza un evento',
    titleLabel: 'Titolo',
    title: 'Partita al parco',
    next: 'Avanti',
    create: 'Crea evento',
    shared: 'Condividi con il gruppo',
  },
  {
    code: 'ja',
    name: 'Japanese',
    plan: '予定を立てる',
    titleLabel: 'タイトル',
    title: '公園でサッカー',
    next: '次へ',
    create: '予定を作る',
    shared: 'みんなに共有',
    font: { family: 'Noto Sans CJK JP UI', sample: 'みんな' },
  },
  {
    code: 'nl',
    name: 'Dutch',
    plan: 'Plan een evenement',
    titleLabel: 'Titel',
    title: 'Voetbal in het park',
    next: 'Volgende',
    create: 'Evenement maken',
    shared: 'Deel met je groep',
  },
];

for (const language of REMEMBERED_LANGUAGES) {
  test(`${language.name} is remembered and new events use it`, async ({
    page,
    request,
  }) => {
    await page.goto('/about');
    await page.getByLabel('Language').selectOption(language.code);
    await expect(page.locator('html')).toHaveAttribute('lang', language.code);
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.lang)).toBe(
      language.code
    );
    if (language.font) {
      const { family, sample } = language.font;
      expect(
        await page.evaluate(
          async ([fontFamily, text]) => {
            const faces = await document.fonts.load(
              `16px "${fontFamily}"`,
              text
            );
            return faces.some(
              (face) => face.family === fontFamily && face.status === 'loaded'
            );
          },
          [family, sample] as const
        )
      ).toBe(true);
    }
    await unlockAdmin(page);
    await page.getByRole('button', { name: language.plan }).click();
    await page.getByLabel(language.titleLabel).fill(language.title);
    await page.getByRole('button', { name: language.next }).click();
    await page.getByRole('button', { name: language.next }).click();
    await page.getByRole('button', { name: language.create }).click();
    await expect(
      page.getByRole('heading', { name: language.shared })
    ).toBeVisible();
    const id = new URL(page.url()).pathname.split('/').at(-1)!;
    expect((await snapshot(request, id)).event.language).toBe(language.code);
  });
}

test('the count of answers is spelled out and follows live', async ({
  page,
  request,
}) => {
  const { id } = await createEvent(request);
  await answer(request, id, 'Anna', [D(6)]);
  await openAsOrganiser(page, { id });
  await showView(page, 'group');
  await expect(page.locator('main')).toContainText('1 answer');
  await answer(request, id, 'Ben', [D(6)]);
  await expect(page.locator('main')).toContainText('2 answers', {
    timeout: 10_000,
  });
});

/** One of the organiser's sections, opened. */
async function openSection(page: Page, title: string): Promise<Locator> {
  const section = page.locator('details').filter({
    has: page.locator('summary', { hasText: title }),
  });
  await section.locator('summary').click();
  return section;
}

test('the days editor saves only the days its calendar shows', async ({
  page,
  request,
}) => {
  const { id, adminToken } = await createEvent(request, {
    days: [D(3), D(4), D(5)],
  });
  await openAsOrganiser(page, { id, adminToken });
  const section = await openSection(page, 'Days');
  const until = section.getByLabel('Add days up to');
  // A far date typed first, then corrected to a near one: the days in between
  // that are no longer shown must not be saved.
  await until.fill(D(40));
  await until.fill(D(8));
  await section.getByRole('button', { name: 'Save' }).click();
  await expect(section.getByText('Saved')).toBeVisible();
  expect((await snapshot(request, id)).event.days).toEqual(
    [3, 4, 5, 6, 7, 8].map(D)
  );
});

test('a day switched off in the days editor stays off when the end date moves on', async ({
  page,
  request,
}) => {
  const { id, adminToken } = await createEvent(request, {
    days: [D(3), D(4), D(5)],
  });
  await openAsOrganiser(page, { id, adminToken });
  const section = await openSection(page, 'Days');
  const grid = section.getByRole('grid');
  const until = section.getByLabel('Add days up to');
  await until.fill(D(8));
  await expect(day(grid, D(6))).toHaveAttribute('aria-pressed', 'true');
  await day(grid, D(6)).click();
  await expect(day(grid, D(6))).toHaveAttribute('aria-pressed', 'false');

  // Further, back to a date still past the last day, and the same date again:
  // the day stays off and the others follow the date.
  await until.fill(D(10));
  await expect(day(grid, D(10))).toHaveAttribute('aria-pressed', 'true');
  await expect(day(grid, D(6))).toHaveAttribute('aria-pressed', 'false');
  await until.fill(D(7));
  await expect(day(grid, D(6))).toHaveAttribute('aria-pressed', 'false');
  await expect(day(grid, D(7))).toHaveAttribute('aria-pressed', 'true');
  await until.fill(D(9));
  await expect(day(grid, D(6))).toHaveAttribute('aria-pressed', 'false');
  await expect(day(grid, D(8))).toHaveAttribute('aria-pressed', 'true');
  await expect(day(grid, D(9))).toHaveAttribute('aria-pressed', 'true');
  await section.getByRole('button', { name: 'Save' }).click();
  await expect(section.getByText('Saved')).toBeVisible();
  expect((await snapshot(request, id)).event.days).toEqual(
    [3, 4, 5, 7, 8, 9].map(D)
  );
});

test('saving days or a duration that takes answers or the date away asks first', async ({
  page,
  request,
}) => {
  const { id, adminToken } = await createEvent(request, {
    days: [3, 4, 5, 6, 7, 8].map(D),
    durationDays: 3,
  });
  await answer(request, id, 'Anna', [D(7), D(8)]);
  const response = await request.put(`/api/events/${id}/status`, {
    headers: { 'x-site-admin-token': adminToken },
    data: { status: 'finalized', start: D(3) },
  });
  expect(response.status()).toBe(200);
  const current = async () => (await snapshot(request, id)).event;
  const dialog = page.getByRole('dialog');

  await openAsOrganiser(page, { id, adminToken });
  const days = await openSection(page, 'Days');
  await day(days.getByRole('grid'), D(8)).click();
  await days.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toContainText('deletes 1 answer');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  expect((await current()).days).toHaveLength(6);
  const annasDays = async () => {
    const [anna] = (await snapshot(request, id)).participants;
    return anna.yes;
  };
  expect(await annasDays()).toEqual([D(7), D(8)]);

  await days.getByRole('button', { name: 'Save' }).click();
  await dialog.getByRole('button', { name: 'Save anyway' }).click();
  await expect.poll(async () => (await current()).days).toHaveLength(5);
  expect(await annasDays()).toEqual([D(7)]);

  // A day without answers goes without a question.
  await day(days.getByRole('grid'), D(6)).click();
  await days.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(async () => (await current()).days).toHaveLength(4);

  // A shorter duration cuts the chosen date short.
  const details = await openSection(page, 'Details');
  await details.getByLabel('Days in a row').fill('2');
  await details.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toContainText('The chosen date becomes shorter');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect((await current()).durationDays).toBe(3);
  await details.getByRole('button', { name: 'Save' }).click();
  await dialog.getByRole('button', { name: 'Save anyway' }).click();
  await expect.poll(async () => (await current()).durationDays).toBe(2);
  expect((await current()).finalEnd).toBe(D(4));
});

const HOME_TITLE = 'Owl Be There — Find a day everyone can make.';

test('a keyboard user who follows a header link lands in the page, which names the tab', async ({
  page,
  request,
}, testInfo) => {
  test.skip(isMobile(testInfo), 'keyboards are a desktop thing');
  const { id } = await createEvent(request, { title: 'Chess club' });
  const main = page.locator('main');
  const navigation = page.getByRole('banner').getByRole('navigation');
  const scrollY = () => page.evaluate(() => window.scrollY);

  // A fresh load leaves focus where the browser puts it.
  await page.goto('/');
  await expect(page).toHaveTitle(HOME_TITLE);
  expect(
    await page.evaluate(() => document.activeElement === document.body)
  ).toBe(true);

  const about = navigation.getByRole('link', { name: 'About' });
  await about.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/about$/);
  await expect(main).toBeFocused();
  await expect(page).toHaveTitle('About · Owl Be There');
  await expect.poll(scrollY).toBe(0);

  // Back and Forward are page changes too.
  await about.focus();
  await page.goBack();
  await expect(page).toHaveTitle(HOME_TITLE);
  await expect(main).toBeFocused();
  await about.focus();
  await page.goForward();
  await expect(page).toHaveTitle('About · Owl Be There');
  await expect(main).toBeFocused();

  await navigation.getByRole('link', { name: 'Admin' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveTitle('Admin · Owl Be There');
  await expect(main).toBeFocused();

  // An event keeps its own title, and the way back to it gives it again.
  await page.goto(`/e/${id}`);
  await expect(page).toHaveTitle('Chess club · Owl Be There');
  await about.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveTitle('About · Owl Be There');
  await about.focus();
  await page.goBack();
  await expect(page).toHaveTitle('Chess club · Owl Be There');
  await expect(main).toBeFocused();

  // An unknown address has a title of its own, and a load steals no focus.
  await page.goto('/nowhere');
  await expect(page).toHaveTitle('We can’t find this page. · Owl Be There');
  expect(
    await page.evaluate(() => document.activeElement === document.body)
  ).toBe(true);
});

test('an event that cannot be shown does not keep the title of the page before it', async ({
  page,
}) => {
  await page.goto('/e/AAAAAAAAAAAA');
  await expect(page).toHaveTitle(HOME_TITLE);
  await page.getByRole('banner').getByRole('link', { name: 'About' }).click();
  await expect(page).toHaveTitle('About · Owl Be There');
  await page.goBack();
  await expect(page).toHaveURL(/\/e\/AAAAAAAAAAAA$/);
  await expect(page).toHaveTitle(HOME_TITLE);
});

test('a dialog that opens on arrival keeps focus, and closing it without an opener lands in the page', async ({
  page,
}, testInfo) => {
  test.skip(isMobile(testInfo), 'keyboards are a desktop thing');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await startWizard(page);
  await page.getByLabel('Title').fill('Pub quiz');
  await page.getByRole('button', { name: 'Next' }).click();
  // The accessible name is "Sat: Saturday": the visible text first.
  await page.getByRole('button', { name: /: Saturday$/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Create event' }).click();

  // The share sheet opens with the new page; the page's own focus move must
  // not pull focus out of it.
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(':focus')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('main')).toBeFocused();
  expect(errors).toEqual([]);
});

test('confirming a save that costs answers moves focus into the organiser panel, and cancelling returns to Save', async ({
  page,
  request,
}, testInfo) => {
  test.skip(isMobile(testInfo), 'keyboards are a desktop thing');
  const { id, adminToken } = await createEvent(request, {
    days: [3, 4, 5, 6, 7, 8].map(D),
    durationDays: 3,
  });
  await answer(request, id, 'Anna', [D(7), D(8)]);
  const chosen = await request.put(`/api/events/${id}/status`, {
    headers: { 'x-site-admin-token': adminToken },
    data: { status: 'finalized', start: D(3) },
  });
  expect(chosen.status()).toBe(200);
  const current = async () => (await snapshot(request, id)).event;
  const dialog = page.getByRole('dialog');
  const panel = organiserTools(page);
  await openAsOrganiser(page, { id, adminToken });

  // Days: switch the last day off, which deletes Anna's answer for it.
  const days = await openSection(page, 'Days');
  await day(days.getByRole('grid'), D(8)).click();
  const saveDays = days.getByRole('button', { name: 'Save' });
  await saveDays.focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toContainText('deletes 1 answer');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(saveDays).toBeFocused();
  await page.keyboard.press('Enter');
  await dialog.getByRole('button', { name: 'Cancel' }).focus();
  await page.keyboard.press('Enter');
  await expect(saveDays).toBeFocused();
  await page.keyboard.press('Enter');
  await dialog.getByRole('button', { name: 'Save anyway' }).focus();
  await page.keyboard.press('Enter');
  await expect(panel).toBeFocused();
  await expect.poll(async () => (await current()).days).toHaveLength(5);

  // Details: a shorter duration.
  const details = await openSection(page, 'Details');
  await details.getByLabel('Days in a row').fill('2');
  const saveDetails = details.getByRole('button', { name: 'Save' });
  await saveDetails.focus();
  await page.keyboard.press('Enter');
  await dialog.getByRole('button', { name: 'Cancel' }).focus();
  await page.keyboard.press('Enter');
  await expect(saveDetails).toBeFocused();
  await page.keyboard.press('Enter');
  await dialog.getByRole('button', { name: 'Save anyway' }).focus();
  await page.keyboard.press('Enter');
  await expect(panel).toBeFocused();
  await expect.poll(async () => (await current()).durationDays).toBe(2);

  // A person's sheet: Cancel on the second step returns to the button that led
  // there, and closing the sheet returns to the person's row.
  const people = await openSection(page, 'People');
  const row = people.getByRole('button', { name: /^Anna/ });
  await row.focus();
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'Anna' });
  const remove = sheet.getByRole('button', { name: 'Remove', exact: true });
  await remove.focus();
  await page.keyboard.press('Enter');
  await expect(sheet.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(remove).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(row).toBeFocused();
});
