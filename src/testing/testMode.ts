/**
 * Test/diagnostic hooks. Enabled only with `?e2e=1`. They *observe* state and control the
 * clock; all rules, input handling, collisions and rendering still run for real.
 *
 *   ?e2e=1            expose window.__PB__
 *   &seed=<int>       seed for spawn randomness
 *   &clock=manual     the ticker is stopped; the test advances time with __PB__.advance(ms)
 *   &nospawn=1        disable timed spawns (scenario is arranged with __PB__.arrange)
 *   &perf=1           show a small FPS / frame-time overlay
 */
export interface TestMode {
  enabled: boolean;
  seed: number | null;
  manualClock: boolean;
  noSpawn: boolean;
  perf: boolean;
}

export function readTestMode(search = window.location.search): TestMode {
  const q = new URLSearchParams(search);
  const seed = q.get('seed');
  return {
    enabled: q.get('e2e') === '1',
    seed: seed !== null && Number.isFinite(Number(seed)) ? Number(seed) : null,
    manualClock: q.get('clock') === 'manual',
    noSpawn: q.get('nospawn') === '1',
    perf: q.get('perf') === '1',
  };
}
