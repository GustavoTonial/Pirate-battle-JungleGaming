import { readJson, removeKey, STORAGE_KEYS, writeJson } from '@/state/storage';

export type Behavior =
  | 'ok'
  | 'empty'
  | 'timeout' // never answers: the client's own timeout fires
  | 'network' // connection failure
  | 'http500'
  | 'http503'
  | 'http404'
  | 'timeoutAfterSave' // (record only) persists the match, then never answers
  | 'flaky503'; // (record only) first 2 attempts per match fail with 503, then it works

export type Latency =
  | { kind: 'none' }
  | { kind: 'fixed'; ms: number }
  | { kind: 'variable'; minMs: number; maxMs: number }
  /** Odd requests are slow, even ones fast: responses arrive out of order. */
  | { kind: 'outOfOrder'; slowMs: number; fastMs: number };

export type Dataset = 'default' | 'large';

export interface Scenario {
  id: string;
  label: string;
  description: string;
  ranking: Behavior;
  history: Behavior;
  record: Behavior;
  latency: Latency;
  dataset: Dataset;
}

const base = { ranking: 'ok', history: 'ok', record: 'ok', latency: { kind: 'none' }, dataset: 'default' } as const;

export const SCENARIOS: Scenario[] = [
  { ...base, id: 'success', label: 'Success (default)', description: 'Fast, healthy API. Ranking has several pages.' },
  { ...base, id: 'empty', label: 'Empty lists', description: 'Ranking and history return no items.', ranking: 'empty', history: 'empty' },
  { ...base, id: 'multi-page', label: 'Many pages', description: 'Large ranking (150 entries).', dataset: 'large' },
  { ...base, id: 'slow', label: 'Slow (1.5 s)', description: 'Every response takes 1.5 seconds.', latency: { kind: 'fixed', ms: 1500 } },
  { ...base, id: 'variable-latency', label: 'Variable latency', description: 'Seeded random latency, 100 ms to 1.8 s.', latency: { kind: 'variable', minMs: 100, maxMs: 1800 } },
  { ...base, id: 'out-of-order', label: 'Out-of-order responses', description: 'Odd requests take 2.5 s, even ones 150 ms.', latency: { kind: 'outOfOrder', slowMs: 2500, fastMs: 150 } },
  { ...base, id: 'timeout', label: 'Timeout (all)', description: 'No endpoint answers; the client times out.', ranking: 'timeout', history: 'timeout', record: 'timeout' },
  { ...base, id: 'network-error', label: 'Connection failure (all)', description: 'All requests fail at the network level.', ranking: 'network', history: 'network', record: 'network' },
  { ...base, id: 'http-500', label: 'HTTP 500 (all)', description: 'All endpoints answer 500.', ranking: 'http500', history: 'http500', record: 'http500' },
  { ...base, id: 'http-404', label: 'HTTP 404 (queries)', description: 'Ranking and history answer 404 (not retried).', ranking: 'http404', history: 'http404' },
  { ...base, id: 'ranking-fails', label: 'Ranking fails', description: 'Only the ranking endpoint answers 500.', ranking: 'http500' },
  { ...base, id: 'history-fails', label: 'History fails', description: 'Only the history endpoint answers 500.', history: 'http500' },
  { ...base, id: 'record-timeout-after-save', label: 'Record: timeout after save', description: 'POST /matches stores the match but never answers. A retry must not duplicate it.', record: 'timeoutAfterSave' },
  { ...base, id: 'record-unavailable', label: 'Record: unavailable', description: 'POST /matches answers 503 until you switch scenario; the match stays pending.', record: 'http503' },
  { ...base, id: 'record-flaky', label: 'Record: flaky', description: 'POST /matches fails twice per match, then succeeds.', record: 'flaky503' },
];

export const DEFAULT_SCENARIO_ID = 'success';

export function getScenario(): Scenario {
  const id = readJson<string>(STORAGE_KEYS.mockScenario, DEFAULT_SCENARIO_ID);
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]!;
}

export function setScenario(id: string): void {
  if (!SCENARIOS.some((s) => s.id === id)) return;
  writeJson(STORAGE_KEYS.mockScenario, id);
  runtime.counters = {};
}

export function resetScenario(): void {
  removeKey(STORAGE_KEYS.mockScenario);
  runtime.counters = {};
}

/** In-memory counters (request ordering, flaky attempts). Reset with the scenario. */
export const runtime: { counters: Record<string, number> } = { counters: {} };
