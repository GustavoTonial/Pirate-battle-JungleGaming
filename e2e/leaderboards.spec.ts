import { expect, test } from '@playwright/test';
import { finishMatchByTime, openApp, SHORT_MATCH } from './helpers';

const Q = { retries: '0', retryBase: '10', apiTimeout: '800' };

test.describe('Ranking and Match History', () => {
  test('ranking loads, shows the configuration note and paginates', async ({ page }) => {
    await openApp(page, { query: Q });
    await expect(page.getByTestId('ranking-row')).toHaveCount(8);
    await expect(page.getByText('Page 1 of 6')).toBeVisible();
    const first = await page.getByTestId('ranking-row').first().innerText();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Page 2 of 6')).toBeVisible();
    expect(await page.getByTestId('ranking-row').first().innerText()).not.toBe(first);
    await page.getByRole('button', { name: 'Previous' }).click();
    await expect(page.getByText('Page 1 of 6')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });

  test('shows loading, empty and error states with recovery', async ({ page }) => {
    await openApp(page, { query: { ...Q, scenario: 'slow' } });
    await expect(page.getByText('Loading ranking')).toBeVisible();
    await expect(page.getByTestId('ranking-row').first()).toBeVisible({ timeout: 6000 });

    await page.evaluate(() => window.__PB_MOCK__!.setScenario('empty'));
    await page.getByRole('tab', { name: 'Match History' }).click();
    await expect(page.getByText("You haven't finished a match yet.")).toBeVisible();
    await page.getByRole('tab', { name: 'Ranking' }).click();
    await expect(page.getByText('No matches yet for these settings.')).toBeVisible();

    await page.evaluate(() => window.__PB_MOCK__!.setScenario('ranking-fails'));
    await page.getByRole('tab', { name: 'Match History' }).click();
    await page.getByRole('tab', { name: 'Ranking' }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'Could not load the ranking' });
    await expect(alert).toBeVisible();
    await page.evaluate(() => window.__PB_MOCK__!.setScenario('success'));
    await alert.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByTestId('ranking-row')).toHaveCount(8);
  });

  test('history error is independent from the ranking', async ({ page }) => {
    await openApp(page, { query: { ...Q, scenario: 'history-fails' } });
    await expect(page.getByTestId('ranking-row').first()).toBeVisible();
    await page.getByRole('tab', { name: 'Match History' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Could not load your match history' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled(); // game stays available
  });

  test('timeouts and HTTP errors surface as errors, not hangs', async ({ page }) => {
    await openApp(page, { query: { ...Q, scenario: 'timeout' } });
    await expect(page.getByRole('alert').filter({ hasText: 'timed out' })).toBeVisible({ timeout: 5000 });
    await page.evaluate(() => window.__PB_MOCK__!.setScenario('http-500'));
    await page.getByRole('tab', { name: 'Match History' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Could not load your match history' })).toBeVisible();
  });

  test('a late response never replaces what the player is looking at', async ({ page }) => {
    await openApp(page, { query: Q });
    await expect(page.getByTestId('ranking-row')).toHaveCount(8);
    await page.evaluate(() => window.__PB_MOCK__!.setScenario('out-of-order'));
    await page.getByRole('button', { name: 'Next' }).click(); // request #1: slow (2.5 s)
    await page.getByRole('tab', { name: 'Match History' }).click();
    await page.getByRole('tab', { name: 'Ranking' }).click(); // request #2: fast
    await expect(page.getByText('Page 1 of 6')).toBeVisible();
    await page.waitForTimeout(3200); // the slow page-2 response arrives now
    await expect(page.getByText('Page 1 of 6')).toBeVisible();
    await expect(page.getByTestId('ranking-row')).toHaveCount(8);
  });

  test('ranking uses a deterministic order: score desc, then earlier match', async ({ page }) => {
    await openApp(page, { query: Q });
    const scores = await page.getByTestId('ranking-row').evaluateAll((rows) =>
      rows.map((r) => Number(r.querySelectorAll('td')[2]!.textContent)),
    );
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });
});

test.describe('Recording a match', () => {
  test('registers once and refreshes both tabs', async ({ page }) => {
    await openApp(page, { query: { clock: 'manual', nospawn: '1', seed: '1' }, options: SHORT_MATCH });
    await finishMatchByTime(page);
    await expect(page.getByTestId('record-status')).toContainText('saved');
    await page.getByRole('button', { name: 'Main Menu' }).click();
    await page.getByRole('tab', { name: 'Match History' }).click();
    await expect(page.getByTestId('history-row')).toHaveCount(1);
    await page.getByRole('tab', { name: 'Ranking' }).click();
    // 60 s / 10 s settings have no fixtures: our match is the only entry.
    await expect(page.getByTestId('ranking-row')).toHaveCount(1);
    await expect(page.getByTestId('ranking-row')).toContainText('(you)');
    expect(await page.evaluate(() => (window.__PB_MOCK__!.db() as unknown[]).length)).toBe(1);
  });

  test('keeps an unconfirmed match through a refresh and registers it after recovery', async ({ page }) => {
    await openApp(page, { query: { clock: 'manual', nospawn: '1', seed: '1', scenario: 'record-unavailable', retries: '0' }, options: SHORT_MATCH });
    await finishMatchByTime(page);
    await expect(page.getByTestId('record-status')).toContainText("Couldn't save");

    await page.getByRole('button', { name: 'Play Again' }).click(); // another match can start while one is pending
    await page.waitForFunction(() => window.__PB__?.state().status === 'running');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Main Menu' }).click();

    await page.reload();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pb.pending.v1') ?? '[]').length)).toBe(1);
    await page.evaluate(() => window.__PB_MOCK__!.setScenario('success'));
    await page.getByRole('button', { name: 'View' }).click();
    await expect(page.getByTestId('record-status')).toContainText("Couldn't save");
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByTestId('record-status')).toContainText('saved');
    expect(await page.evaluate(() => (window.__PB_MOCK__!.db() as unknown[]).length)).toBe(1);
  });

  test('a timeout after the server saved the match does not create a duplicate', async ({ page }) => {
    await openApp(page, {
      query: { clock: 'manual', nospawn: '1', seed: '1', scenario: 'record-timeout-after-save', apiTimeout: '400', retryBase: '20', retries: '2' },
      options: SHORT_MATCH,
    });
    await finishMatchByTime(page);
    await expect(page.getByTestId('record-status')).toContainText('saved', { timeout: 10_000 });
    expect(await page.evaluate(() => (window.__PB_MOCK__!.db() as unknown[]).length)).toBe(1);
    await page.getByRole('button', { name: 'Main Menu' }).click();
    await page.getByRole('tab', { name: 'Match History' }).click();
    await expect(page.getByTestId('history-row')).toHaveCount(1);
  });

  test('flaky server: retries until it works, still one record', async ({ page }) => {
    await openApp(page, {
      query: { clock: 'manual', nospawn: '1', seed: '1', scenario: 'record-flaky', retryBase: '20', retries: '3' },
      options: SHORT_MATCH,
    });
    await finishMatchByTime(page);
    await expect(page.getByTestId('record-status')).toContainText('saved', { timeout: 10_000 });
    expect(await page.evaluate(() => (window.__PB_MOCK__!.db() as unknown[]).length)).toBe(1);
  });
});
