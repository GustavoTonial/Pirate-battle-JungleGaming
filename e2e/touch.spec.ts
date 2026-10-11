import { expect, test } from '@playwright/test';
import { advance, ARENA_QUERY, openApp, startMatch, state } from './helpers';

/** Synthetic pointer events: one distinct pointer per button, which is how real multi-touch behaves. */
const press = (page: import('@playwright/test').Page, id: string, pointerId: number) =>
  page.getByTestId(`touch-${id}`).dispatchEvent('pointerdown', { pointerId, pointerType: 'touch', isPrimary: pointerId === 1, bubbles: true });
const release = (page: import('@playwright/test').Page, id: string, pointerId: number) =>
  page.getByTestId(`touch-${id}`).dispatchEvent('pointerup', { pointerId, pointerType: 'touch', bubbles: true });

test('touch controls move, rotate and fire at the same time', async ({ page }) => {
  await openApp(page, { query: { ...ARENA_QUERY, touch: '1' } });
  await startMatch(page);
  await expect(page.getByRole('group', { name: 'Touch controls' })).toBeVisible();

  await press(page, 'forward', 1);
  await press(page, 'right', 2);
  await press(page, 'fireFront', 3);
  await advance(page, 700);
  const s = await state(page);
  expect(s.player.speed).toBeGreaterThan(50);
  expect(s.player.heading).toBeGreaterThan(0.3);
  expect(s.projectiles.length).toBeGreaterThan(0);

  await release(page, 'forward', 1);
  await release(page, 'right', 2);
  await release(page, 'fireFront', 3);
  const h = (await state(page)).player.heading;
  await advance(page, 500);
  expect((await state(page)).player.heading).toBeCloseTo(h, 5);

  await press(page, 'fireLeft', 4);
  await advance(page, 20);
  await release(page, 'fireLeft', 4);
  expect((await state(page)).projectiles.length).toBeGreaterThanOrEqual(3);
});

test('HUD and touch controls fit inside the viewport', async ({ page }) => {
  await openApp(page, { query: { ...ARENA_QUERY, touch: '1' } });
  await startMatch(page);
  const vp = page.viewportSize()!;
  for (const target of [page.getByTestId('touch-forward'), page.getByTestId('touch-fireFront'), page.getByRole('button', { name: 'Pause' }), page.getByTestId('hud-score')]) {
    const box = (await target.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
  }
});
