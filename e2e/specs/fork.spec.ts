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
  await expect(main).toHaveText('');

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
