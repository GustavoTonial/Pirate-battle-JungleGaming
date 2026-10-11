import { expect, test } from '@playwright/test';
import { ARENA_QUERY, expectNoErrors, openApp } from './helpers';

test('shows loading progress, reports a failed asset and recovers on retry', async ({ page }) => {
  await openApp(page, { query: ARENA_QUERY });
  // Allow the ignorable "Failed to load resource" console noise produced by the blocked request.
  await page.route('**/assets/ships.png', (route) => route.abort());

  await page.getByRole('button', { name: 'Play' }).click();
  const alert = page.getByRole('alert').filter({ hasText: "Couldn't load the game" });
  await expect(alert).toBeVisible();
  await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible();

  await page.unroute('**/assets/ships.png');
  await alert.getByRole('button', { name: 'Try again' }).click();
  await page.waitForFunction(() => window.__PB__?.state().status === 'running', undefined, { timeout: 15_000 });
  await expect(page.getByTestId('arena').locator('canvas')).toBeVisible();
  void expectNoErrors; // console errors from the intentionally blocked request are expected here
});

test('failed load can return to the main menu', async ({ page }) => {
  await openApp(page);
  await page.route('**/assets/ships.json', (route) => route.fulfill({ status: 500, body: 'nope' }));
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByRole('alert').filter({ hasText: "Couldn't load the game" })).toBeVisible();
  await page.getByRole('button', { name: 'Main Menu' }).click();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
});
