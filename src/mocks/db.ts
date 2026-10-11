import type { MatchRecord } from '@/api/contracts';
import { readJson, removeKey, STORAGE_KEYS, writeJson } from '@/state/storage';

/**
 * The mock "server database": matches confirmed for the local player, persisted in
 * localStorage so they survive a refresh (the same way a real backend would).
 */
export const mockDb = {
  all(): MatchRecord[] {
    const v = readJson<MatchRecord[]>(STORAGE_KEYS.mockDb, []);
    return Array.isArray(v) ? v : [];
  },
  find(matchId: string): MatchRecord | undefined {
    return this.all().find((m) => m.matchId === matchId);
  },
  insert(record: MatchRecord): void {
    writeJson(STORAGE_KEYS.mockDb, [...this.all(), record]);
  },
  reset(): void {
    removeKey(STORAGE_KEYS.mockDb);
  },
};
