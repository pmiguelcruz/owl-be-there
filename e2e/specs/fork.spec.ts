import { expect, test } from '@playwright/test';
import { createEvent, unlockAdmin } from '../helpers.ts';

test('the public home is only the saved events list and the header opens About', async ({
  page,
  request,
}) => {
  await page.goto('/');
  const header = page.getByRole('banner');
  const main = page.getByRole('main');
  await expect(header.getByRole('navigation').getByRole('link')).toHaveText([
    'About',
    'Admin',
  ]);
  await expect(page.getByRole('contentinfo')).toHaveCount(0);
  await expect(main).toHaveText(
    'Your event list is empty. Open a shared event link to mark when you’re free. The event will show up here the next time you visit in this browser.'
  );

  const { id } = await createEvent(request);
  await page.goto(`/e/${id}`);
  await expect(
    main.getByRole('heading', { name: 'Summer tournament' })
  ).toBeVisible();
  await expect(main.getByText('Plan an event')).toHaveCount(0);
  await expect(main.getByText(/automatically deleted/)).toHaveCount(0);
  await header.getByRole('link', { name: 'Owl Be There' }).click();
  await expect(
    main.getByRole('list', { name: 'Your events' }).getByRole('link')
  ).toHaveText(['Summer tournament']);
  await expect(main.getByRole('heading')).toHaveCount(0);

  await header.getByRole('link', { name: 'About' }).click();
  await expect(
    main.getByRole('heading', { name: 'Data privacy' })
  ).toBeVisible();
  await expect(main).toContainText('No accounts');
  await expect(main).toContainText('Providence, Rhode Island');
  await expect(main).toContainText('A95X F2 TV box');
  await expect(main).toContainText('manually deletes');
  await expect(main.locator('a[href^="https://github.com/"]')).toHaveCount(3);
  await expect(page.locator('.owl-eyes')).toHaveCount(1);
  await expect(header.locator('.owl-eyes')).toHaveCount(1);
});

test('the homepage rotates its look and gradient on refresh', async ({
  page,
}) => {
  await page.goto('/');
  const home = page.locator('[data-wallpaper="home"]');
  await expect(home).toBeVisible();
  const original = (await home.getAttribute('data-look'))!.split(':')[0]!;
  const style = (await home.getAttribute('data-gradient'))!;
  await page.reload();
  await expect(home).toBeVisible();
  expect((await home.getAttribute('data-look'))!.split(':')[0]).not.toBe(
    original
  );
  await expect(home).not.toHaveAttribute('data-gradient', style);
  await expect(
    page.getByText('Your event list is empty.', { exact: false })
  ).toBeVisible();
});

test('admin unlock rejects an incorrect PIN and a reload locks the page', async ({
  page,
}) => {
  await page.goto('/admin');
  const action = page.getByRole('button', { name: 'Plan an event' });
  await expect(action).toHaveCount(0);
  await page.getByLabel('Admin PIN').fill('9999');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByRole('alert')).toHaveText('Incorrect PIN.');
  await expect(action).toHaveCount(0);
  await unlockAdmin(page);
  await expect(action).toBeVisible();
  await page.reload();
  await expect(action).toHaveCount(0);
  await expect(page.getByLabel('Admin PIN')).toBeVisible();
});

test('a participant link remembers one event and Admin alone can see and edit them all', async ({
  browser,
  page,
  request,
}) => {
  const one = await createEvent(request, { title: 'Shared dinner' });
  const other = await createEvent(request, { title: 'Private event' });
  await page.goto('/');
  await expect(page.getByText('Your event list is empty.')).toBeVisible();
  await page.goto(`/e/${one.id}#admin=${one.adminToken}`);
  await expect(page).toHaveURL(new RegExp(`/e/${one.id}$`));
  await expect(
    page.getByRole('heading', { name: 'Organizer tools' })
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Share', exact: true })
  ).toHaveCount(0);
  await page.getByLabel('Your name', { exact: true }).fill('Rita');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const calendar = page.getByRole('grid', { name: 'My days' });
  await calendar.locator('[data-kind="day"]').first().click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Owl Be There' }).click();
  await expect(
    page.getByRole('list', { name: 'Your events' }).getByRole('link')
  ).toHaveText(['Shared dinner']);
  const otherContext = await browser.newContext();
  const newcomer = await otherContext.newPage();
  await newcomer.goto(new URL('/', page.url()).href);
  await expect(newcomer.getByText('Your event list is empty.')).toBeVisible();
  await otherContext.close();

  await unlockAdmin(page);
  const directory = page.getByRole('list', { name: 'All events' });
  const manage = directory.locator(`a[href="/admin/events/${one.id}"]`);
  await expect(manage).toHaveText('Shared dinner');
  await expect(
    directory.locator(`a[href="/admin/events/${other.id}"]`)
  ).toHaveText('Private event');
  await manage.click();
  await expect(
    page.getByRole('heading', { name: 'Organizer tools' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  const share = await page
    .getByRole('textbox', { name: 'Link for everyone' })
    .inputValue();
  expect(new URL(share).pathname).toBe(`/e/${one.id}`);
  expect(new URL(share).hash).toBe('');
  await page.reload();
  await expect(page.getByLabel('Admin PIN')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Organizer tools' })
  ).toHaveCount(0);

  await request.delete(`/api/events/${one.id}`, {
    headers: { 'x-site-admin-token': one.adminToken },
  });
  await page.goto('/');
  await expect(page.getByText('Your event list is empty.')).toBeVisible();
});
