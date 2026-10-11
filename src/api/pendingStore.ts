import { readJson, STORAGE_KEYS, writeJson } from '@/state/storage';
import type { MatchRecord } from './contracts';

/**
 * Matches finished locally but not yet confirmed by the server. Written *before* the first
 * request, removed only on confirmation, so a refresh or a crash never loses a result.
 */
export const pendingStore = {
  list(): MatchRecord[] {
    const v = readJson<MatchRecord[]>(STORAGE_KEYS.pending, []);
    return Array.isArray(v) ? v : [];
  },
  add(record: MatchRecord): void {
    const list = this.list();
    if (list.some((r) => r.matchId === record.matchId)) return; // never duplicate a pending entry
    writeJson(STORAGE_KEYS.pending, [...list, record]);
  },
  remove(matchId: string): void {
    writeJson(
      STORAGE_KEYS.pending,
      this.list().filter((r) => r.matchId !== matchId),
    );
  },
};
