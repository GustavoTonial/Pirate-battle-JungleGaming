import { expect, test } from '@playwright/test';
import { advance, ARENA_QUERY, arrange, openApp, startMatch, state } from './helpers';

test('Chaser pursues, rams the player and explodes without giving points', async ({ page }) => {
  await openApp(page, { query: ARENA_QUERY });
  await startMatch(page);
  await arrange(page, { player: { x: 800, y: 600, heading: 0 }, enemies: [{ kind: 'chaser', x: 800, y: 250, heading: 0 }] });
  const d0 = (await state(page)).enemies[0]!;
  await advance(page, 800);
  const d1 = (await state(page)).enemies[0]!;
  expect(Math.hypot(d1.x - 800, d1.y - 600)).toBeLessThan(Math.hypot(d0.x - 800, d0.y - 600));
  await advance(page, 5000);
  const s = await state(page);
  expect(s.enemies).toHaveLength(0);
  expect(s.player.health).toBe(7);
  expect(s.score).toBe(0);
});

test('Shooter approaches and fires only once in range', async ({ page }) => {
  await openApp(page, { query: ARENA_QUERY });
  await startMatch(page);
  await arrange(page, { player: { x: 900, y: 620, heading: 0 }, enemies: [{ kind: 'shooter', x: 300, y: 650, heading: 0 }] });
  await advance(page, 1000);
  let s = await state(page);
  expect(s.projectiles.filter((p) => p.owner === 'enemy')).toHaveLength(0); // still far away
  const dist0 = Math.hypot(s.enemies[0]!.x - 900, s.enemies[0]!.y - 620);
  await advance(page, 6000);
  s = await state(page);
  expect(Math.hypot(s.enemies[0]!.x - 900, s.enemies[0]!.y - 620)).toBeLessThan(dist0);
  expect(s.player.health).toBeLessThan(10); // it reached attack range and hit the player
});

test('spawns follow the configured interval and both types appear', async ({ page }) => {
  await openApp(page, { query: { seed: '5', clock: 'manual' }, options: { sessionTimeSec: 60, enemySpawnTimeSec: 3 } });
  await startMatch(page);
  const spawns: Array<{ t: number; kind: string }> = [];
  const known = new Set<number>();
  for (let i = 0; i < 600; i++) {
    await advance(page, 1000 / 60);
    const s = await state(page);
    for (const e of s.enemies) if (!known.has(e.id)) { known.add(e.id); spawns.push({ t: s.time, kind: e.kind }); }
    if (spawns.length >= 3) break;
  }
  expect(spawns.length).toBeGreaterThanOrEqual(3);
  expect(spawns[0]!.t).toBeCloseTo(3, 1);
  expect(spawns[1]!.t).toBeCloseTo(6, 1);
  expect(spawns.slice(0, 2).map((s) => s.kind)).toEqual(['chaser', 'shooter']);
});

test('spawns appear away from the player', async ({ page }) => {
  await openApp(page, { query: { seed: '9', clock: 'manual' }, options: { sessionTimeSec: 60, enemySpawnTimeSec: 1 } });
  await startMatch(page);
  await advance(page, 1020);
  const s = await state(page);
  const e = s.enemies[0]!;
  expect(Math.hypot(e.x - s.player.x, e.y - s.player.y)).toBeGreaterThan(300);
});
