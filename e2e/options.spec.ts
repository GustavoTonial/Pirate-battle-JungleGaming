import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

test.describe('Options', () => {
  test('navigates, validates, saves and persists after refresh', async ({ page }) => {
    const errors = await openApp(page);
    await page.getByRole('button', { name: 'Options' }).click();
    await expect(page.getByRole('heading', { name: 'Options' })).toBeVisible();

    const session = page.getByLabel('Game session time (seconds)');
    const spawn = page.getByLabel('Enemy spawn time (seconds)');
    await expect(session).toHaveValue('90');
    await expect(spawn).toHaveValue('2.5');

    // Out of range / invalid values are rejected with accessible errors and nothing is saved.
    await session.fill('30');
    await spawn.fill('0');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'between 60 and 180' })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'greater than zero' })).toBeVisible();
    await expect(session).toHaveAttribute('aria-invalid', 'true');
    await expect(session).toBeFocused();

    await session.fill('181');
    await spawn.fill('abc');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'between 60 and 180' })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'Enter a number' })).toBeVisible();

    await session.fill('75');
    await spawn.fill('3');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Options saved.')).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: 'Options' }).click();
    await expect(page.getByLabel('Game session time (seconds)')).toHaveValue('75');
    await expect(page.getByLabel('Enemy spawn time (seconds)')).toHaveValue('3');

    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('is fully operable with the keyboard', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Options' }).focus();
    await page.keyboard.press('Enter');
    await page.getByLabel('Game session time (seconds)').focus();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('100');
    await page.keyboard.press('Enter'); // submits the form
    await expect(page.getByText('Options saved.')).toBeVisible();
  });
});
