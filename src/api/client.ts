import axios, { AxiosError, type AxiosInstance } from 'axios';
import { API_CONFIG } from './apiConfig';
import type {
  ApiErrorBody,
  HistoryPage,
  MatchConfig,
  MatchRecord,
  RankingPage,
  RecordMatchResponse,
} from './contracts';

export const http: AxiosInstance = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeoutMs,
  headers: { Accept: 'application/json' },
});

export interface RankingParams {
  page: number;
  pageSize: number;
  config: MatchConfig;
}

export async function fetchRanking(p: RankingParams, signal?: AbortSignal): Promise<RankingPage> {
  const { data } = await http.get<RankingPage>('/ranking', {
    params: {
      page: p.page,
      pageSize: p.pageSize,
      sessionTimeSec: p.config.sessionTimeSec,
      enemySpawnTimeSec: p.config.enemySpawnTimeSec,
    },
    signal,
  });
  return data;
}

export interface HistoryParams {
  playerId: string;
  page: number;
  pageSize: number;
}

export async function fetchHistory(p: HistoryParams, signal?: AbortSignal): Promise<HistoryPage> {
  const { data } = await http.get<HistoryPage>(`/players/${encodeURIComponent(p.playerId)}/matches`, {
    params: { page: p.page, pageSize: p.pageSize },
    signal,
  });
  return data;
}

/** Idempotent: re-sending the same `matchId` returns the existing record (HTTP 200, `created: false`). */
export async function postMatch(record: MatchRecord): Promise<RecordMatchResponse> {
  const { data } = await http.post<RecordMatchResponse>('/matches', record, {
    headers: { 'Idempotency-Key': record.matchId },
  });
  return data;
}

/** Retry only what can succeed later: network errors, timeouts, 5xx, 408 and 429. */
export function isRetryable(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  if (axios.isCancel(error)) return false;
  const status = error.response?.status;
  if (status === undefined) return true;
  return status >= 500 || status === 408 || status === 429;
}

export function describeError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const e = error as AxiosError<ApiErrorBody>;
    if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT') return 'The request timed out.';
    if (!e.response) return 'Could not reach the server.';
    return e.response.data?.message ?? `The server responded with an error (HTTP ${e.response.status}).`;
  }
  return 'Something went wrong.';
}
