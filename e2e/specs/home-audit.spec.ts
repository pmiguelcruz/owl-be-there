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

test('the start page does not scroll sideways at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  expect(overflow).toBe(false);
});
