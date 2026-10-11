import { expect, test } from '@playwright/test';
import { advance, ARENA_QUERY, arrange, openApp, startMatch, state } from './helpers';

test.describe('Combat', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page, { query: ARENA_QUERY });
    await startMatch(page);
  });

  test('front shot: one projectile, damage once, score once', async ({ page }) => {
    await arrange(page, {
      player: { x: 760, y: 620, heading: 0 },
      enemies: [{ kind: 'shooter', x: 1000, y: 620, heading: Math.PI / 2, health: 1 }],
    });
    await page.keyboard.down('Space');
    await advance(page, 20);
    await page.keyboard.up('Space');
    expect((await state(page)).projectiles.filter((p) => p.owner === 'player')).toHaveLength(1);

    await advance(page, 1500);
    const s = await state(page);
    expect(s.enemies).toHaveLength(0); // destroyed enemy left the simulation
    expect(s.score).toBe(1);
    await advance(page, 1500);
    expect((await state(page)).score).toBe(1); // no duplicate points
  });

  test('side broadside fires three parallel projectiles, left and right', async ({ page }) => {
    await page.keyboard.down('KeyQ');
    await advance(page, 20);
    await page.keyboard.up('KeyQ');
    let s = await state(page);
    expect(s.projectiles).toHaveLength(3);
    const ys = s.projectiles.map((p) => p.y);
    expect(new Set(ys.map((y) => Math.round(y))).size).toBe(1); // same row: parallel, side by side along the hull

    await page.keyboard.down('KeyE');
    await advance(page, 20);
    await page.keyboard.up('KeyE');
    s = await state(page);
    expect(s.projectiles).toHaveLength(6);
  });

  test('respects weapon cooldowns', async ({ page }) => {
    await page.keyboard.down('Space');
    const seen = new Set<number>();
    for (let i = 0; i < 6; i++) {
      await advance(page, 166.7); // 1 second in total
      (await state(page)).projectiles.forEach((p) => seen.add(p.id));
    }
    await page.keyboard.up('Space');
    expect(seen.size).toBe(3); // 0.35 s cooldown -> shots at 0, 0.35 and 0.7 s

    await page.keyboard.down('KeyQ');
    await advance(page, 500);
    await page.keyboard.up('KeyQ');
    const side = (await state(page)).projectiles.filter((p) => !seen.has(p.id));
    expect(side).toHaveLength(3); // second broadside is still cooling down (1.1 s)
  });

  test('projectiles are stopped by islands', async ({ page }) => {
    const island = (await state(page)).arena.islands.find((i) => i.id === 'grass')!;
    await arrange(page, { player: { x: island.x + 200, y: island.y, heading: Math.PI } });
    await page.keyboard.down('Space');
    await advance(page, 20);
    await page.keyboard.up('Space');
    await advance(page, 1500);
    expect((await state(page)).projectiles).toHaveLength(0);
  });
});
