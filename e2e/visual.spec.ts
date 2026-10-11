import { expect, test } from '@playwright/test';
import { advance, ARENA_QUERY, arrange, finishMatchByTime, openApp, SHORT_MATCH, startMatch } from './helpers';

// Baselines are versioned in e2e/visual.spec.ts-snapshots (create them with `npm run test:e2e:update`).
test('visual: main menu', async ({ page }) => {
  await openApp(page, { query: { retries: '0' } });
  await expect(page.getByTestId('ranking-row')).toHaveCount(8);
  await expect(page).toHaveScreenshot('menu.png');
});

test('visual: arena in a stable state', async ({ page }) => {
  await openApp(page, { query: ARENA_QUERY });
  await startMatch(page);
  await arrange(page, {
    player: { x: 760, y: 380, heading: 0 },
    enemies: [
      { kind: 'shooter', x: 1000, y: 560, heading: Math.PI, health: 2 },
      { kind: 'chaser', x: 560, y: 130, heading: Math.PI / 2, health: 1 },
    ],
  });
  await advance(page, 0);
  await expect(page).toHaveScreenshot('arena.png');
});

test('visual: result screen', async ({ page }) => {
  await openApp(page, { query: { clock: 'manual', nospawn: '1', seed: '1' }, options: SHORT_MATCH });
  await finishMatchByTime(page);
  await expect(page.getByTestId('record-status')).toContainText('saved');
  await expect(page).toHaveScreenshot('result.png');
});
