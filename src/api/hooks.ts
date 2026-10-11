import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchHistory, fetchRanking } from './client';
import { PAGE_SIZE, type MatchConfig } from './contracts';

export const queryKeys = {
  ranking: ['ranking'] as const,
  history: ['history'] as const,
};

export function useRankingQuery(page: number, config: MatchConfig) {
  return useQuery({
    queryKey: [...queryKeys.ranking, config.sessionTimeSec, config.enemySpawnTimeSec, page],
    // `signal` aborts superseded requests, so a late response can never overwrite newer data.
    queryFn: ({ signal }) => fetchRanking({ page, pageSize: PAGE_SIZE, config }, signal),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
}

export function useHistoryQuery(playerId: string, page: number) {
  return useQuery({
    queryKey: [...queryKeys.history, playerId, page],
    queryFn: ({ signal }) => fetchHistory({ playerId, page, pageSize: PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
}
