import { expect, test } from '@playwright/test';
import { advance, ARENA, ARENA_QUERY, arrange, openApp, startMatch, state } from './helpers';

test.describe('Movement and arena', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page, { query: ARENA_QUERY });
    await startMatch(page);
  });

  test('sails forward and rotates in both directions', async ({ page }) => {
    const s0 = await state(page);
    await page.keyboard.down('KeyW');
    await advance(page, 1000);
    await page.keyboard.up('KeyW');
    const s1 = await state(page);
    expect(s1.player.x).toBeGreaterThan(s0.player.x + 100);

    await page.keyboard.down('KeyD');
    await advance(page, 500);
    await page.keyboard.up('KeyD');
    const s2 = await state(page);
    expect(s2.player.heading).toBeGreaterThan(s1.player.heading + 0.5);

    await page.keyboard.down('ArrowLeft');
    await advance(page, 1000);
    await page.keyboard.up('ArrowLeft');
    const s3 = await state(page);
    expect(s3.player.heading).toBeLessThan(s2.player.heading - 1);
  });

  test('moving and rotating can happen while firing', async ({ page }) => {
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyD');
    await page.keyboard.down('Space');
    await advance(page, 800);
    const s = await state(page);
    expect(s.player.speed).toBeGreaterThan(50);
    expect(s.player.heading).toBeGreaterThan(0.3);
    expect(s.projectiles.length).toBeGreaterThan(0);
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyD');
    await page.keyboard.up('Space');
  });

  test('stays inside the visible arena', async ({ page }) => {
    await page.keyboard.down('KeyW'); // heading east
    await advance(page, 8000);
    let s = await state(page);
    expect(s.player.x).toBeLessThanOrEqual(ARENA.width - 20 + 0.01);
    await page.keyboard.up('KeyW');
    await arrange(page, { player: { x: 640, y: 40, heading: -Math.PI / 2 } });
    await page.keyboard.down('KeyW');
    await advance(page, 4000);
    s = await state(page);
    expect(s.player.y).toBeGreaterThanOrEqual(20 - 0.01);
    await page.keyboard.up('KeyW');
  });

  test('cannot sail through an island', async ({ page }) => {
    const island = (await state(page)).arena.islands.find((i) => i.id === 'grass')!;
    await arrange(page, { player: { x: island.x + 250, y: island.y, heading: Math.PI } });
    await page.keyboard.down('KeyW');
    await advance(page, 6000);
    await page.keyboard.up('KeyW');
    const s = await state(page);
    const d = Math.hypot(s.player.x - island.x, s.player.y - island.y);
    expect(d).toBeGreaterThanOrEqual(island.radius + 20 - 1);
  });
});
