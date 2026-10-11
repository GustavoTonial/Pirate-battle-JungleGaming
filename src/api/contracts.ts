/** Typed REST contracts shared by the client, the MSW handlers and the fixtures. */
export type EndReason = 'time' | 'death';

export interface MatchConfig {
  sessionTimeSec: number;
  enemySpawnTimeSec: number;
}

/** One finished match. `matchId` is the idempotency key. */
export interface MatchRecord {
  matchId: string;
  playerId: string;
  playerName: string;
  /** ISO-8601 timestamp of the end of the match. */
  playedAt: string;
  score: number;
  /** Effective active play time. */
  durationMs: number;
  endReason: EndReason;
  config: MatchConfig;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface RankingEntry {
  /** 1-based position after the deterministic ordering below. */
  rank: number;
  matchId: string;
  playerId: string;
  playerName: string;
  score: number;
  durationMs: number;
  playedAt: string;
  endReason: EndReason;
}

export type RankingPage = Page<RankingEntry>;
export type HistoryPage = Page<MatchRecord>;

export interface RecordMatchResponse {
  record: MatchRecord;
  /** `true` on first registration (HTTP 201); `false` when the match already existed (HTTP 200). */
  created: boolean;
}

export interface ApiErrorBody {
  code: string;
  message: string;
}

/**
 * Ranking order (deterministic): score desc, then earlier `playedAt` wins, then `matchId` asc.
 * Only matches played with the same configuration are compared.
 */
export function compareRanking(a: MatchRecord, b: MatchRecord): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.playedAt !== b.playedAt) return a.playedAt < b.playedAt ? -1 : 1;
  return a.matchId < b.matchId ? -1 : a.matchId > b.matchId ? 1 : 0;
}

export const sameConfig = (a: MatchConfig, b: MatchConfig): boolean =>
  a.sessionTimeSec === b.sessionTimeSec && a.enemySpawnTimeSec === b.enemySpawnTimeSec;

export const PAGE_SIZE = 8;
