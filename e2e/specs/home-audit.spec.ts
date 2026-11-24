import { startWizard } from '../helpers.ts';
import { expect, test } from '@playwright/test';

test('starting the wizard moves focus into it and cancelling returns it to the start button', async ({
  page,
}) => {
  await startWizard(page);
  await expect(page.locator('form legend')).toBeFocused();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(
    page.getByRole('button', { name: /plan|start|find/i }).first()
  ).toBeFocused();
});

test('the About page fits instead of scrolling the page on a phone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/about');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  expect(overflow).toBe(false);
});

test('the padded wordmark and squared-off controls fit at 320px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  const wordmark = page.getByRole('link', { name: 'Owl Be There' });
  const admin = page.getByRole('link', { name: 'Admin' });
  const panel = page.getByText('Your event list is empty.', { exact: false });
  await expect(panel).toBeVisible();
  await expect(wordmark).toHaveCSS('border-radius', '6px');
  await expect(wordmark).toHaveCSS('padding-inline-start', '10px');
  await expect(wordmark).toHaveCSS('padding-inline-end', '10px');
  await expect(wordmark).toHaveCSS('padding-block-start', '8px');
  await expect(wordmark).toHaveCSS('padding-block-end', '8px');
  await expect(admin).toHaveCSS('border-radius', '5px');
  await expect(panel).toHaveCSS('border-radius', '8px');
  expect((await admin.boundingBox())!.x).toBeGreaterThan(
    (await wordmark.boundingBox())!.x
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  expect(overflow).toBe(false);
});
