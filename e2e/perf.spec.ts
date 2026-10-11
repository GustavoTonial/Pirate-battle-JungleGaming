import { test } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { openApp, startMatch, state } from './helpers';

/**
 * Profiling (opt-in): `PERF=1 npx playwright test e2e/perf.spec.ts --project=desktop-chromium`
 * Runs in REAL time (3 minutes) against the production build and writes perf-results/*.json.
 */
test.skip(!process.env.PERF, 'Set PERF=1 to run the profiling spec.');
test.use({ launchOptions: { args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'] } });

/** Simple bot: sails in a loop and keeps firing so there is always combat. */
async function botStep(page: import('@playwright/test').Page, tick: number) {
  if (tick === 0) {
    await page.keyboard.down('KeyW');
    await page.keyboard.down('Space');
  }
  if (tick % 8 === 0) await page.keyboard.down('KeyD');
  if (tick % 8 === 4) await page.keyboard.up('KeyD');
  if (tick % 6 === 0) await page.keyboard.press('KeyQ');
  if (tick % 6 === 3) await page.keyboard.press('KeyE');
}

test('3-minute match: frame rate, p95 frame time, entities', async ({ page }, info) => {
  test.setTimeout(5 * 60_000);
  await openApp(page, { query: { seed: '11' }, options: { sessionTimeSec: 180, enemySpawnTimeSec: 1.5 } });
  await startMatch(page);
  let last = await page.evaluate(() => window.__PB__!.perf());
  for (let tick = 0; ; tick++) {
    await botStep(page, tick);
    await page.waitForTimeout(500);
    const s = await page.evaluate(() => window.__PB__?.state().status).catch(() => undefined);
    if (s === 'running') last = await page.evaluate(() => window.__PB__!.perf());
    else if (s === undefined || s === 'ended') break;
    if ((await state(page).catch(() => null))?.player.health === 0) break;
  }
  const env = {
    userAgent: await page.evaluate(() => navigator.userAgent),
    viewport: page.viewportSize(),
    devicePixelRatio: await page.evaluate(() => window.devicePixelRatio),
    match: { sessionTimeSec: 180, enemySpawnTimeSec: 1.5, maxAlive: 10 },
  };
  mkdirSync('perf-results', { recursive: true });
  writeFileSync(`perf-results/frames-${info.project.name}.json`, JSON.stringify({ env, ...last }, null, 2));
  console.log('PERF', JSON.stringify({ env, ...last }));
});

test('memory after 5 start/play/quit cycles', async ({ page }, info) => {
  test.setTimeout(5 * 60_000);
  await openApp(page, { query: { seed: '3' }, options: { sessionTimeSec: 60, enemySpawnTimeSec: 1 } });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const heap = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    const { metrics } = await cdp.send('Performance.getMetrics');
    return {
      jsHeapMB: Math.round((metrics.find((m) => m.name === 'JSHeapUsedSize')!.value / 1048576) * 100) / 100,
      nodes: metrics.find((m) => m.name === 'Nodes')!.value,
      listeners: metrics.find((m) => m.name === 'JSEventListeners')!.value,
    };
  };
  const samples = [await heap()];
  for (let i = 0; i < 5; i++) {
    await startMatch(page);
    for (let t = 0; t < 20; t++) {
      await botStep(page, t);
      await page.waitForTimeout(500);
    }
    await page.keyboard.up('KeyW');
    await page.keyboard.up('Space');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Main Menu' }).click();
    samples.push(await heap());
  }
  mkdirSync('perf-results', { recursive: true });
  writeFileSync(`perf-results/memory-${info.project.name}.json`, JSON.stringify(samples, null, 2));
  console.log('MEMORY', JSON.stringify(samples));
});
