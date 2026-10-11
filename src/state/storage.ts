/** Thin, failure-tolerant localStorage helpers (private mode / quota errors never crash the game). */
export const STORAGE_KEYS = {
  options: 'pb.options.v1',
  lastResult: 'pb.lastResult.v1',
  pending: 'pb.pending.v1',
  player: 'pb.player.v1',
  mockDb: 'pb.mock.db.v1',
  mockScenario: 'pb.mock.scenario.v1',
} as const;

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: state simply is not persisted */
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
