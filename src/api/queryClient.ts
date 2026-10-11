import { QueryClient } from '@tanstack/react-query';
import { API_CONFIG } from './apiConfig';
import { isRetryable } from './client';

export const retryPolicy = (failureCount: number, error: unknown): boolean =>
  failureCount < API_CONFIG.retries && isRetryable(error);

export const retryDelay = (attempt: number): number => Math.min(API_CONFIG.retryBaseMs * 2 ** attempt, 4000);

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        gcTime: 5 * 60_000,
        retry: retryPolicy,
        retryDelay,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: { retry: retryPolicy, retryDelay },
    },
  });
}
