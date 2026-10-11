import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useRecordStatus } from '@/state/recordStatus';
import { postMatch } from './client';
import type { MatchRecord } from './contracts';
import { queryKeys } from './hooks';
import { pendingStore } from './pendingStore';
import { retryDelay, retryPolicy } from './queryClient';

interface Recorder {
  /** Persists the record locally, then registers it. Safe to call repeatedly for the same match. */
  submit: (record: MatchRecord) => Promise<void>;
  /** Retries one match (or all pending ones) that is still unconfirmed. */
  retry: (matchId?: string) => Promise<void>;
}

const RecorderContext = createContext<Recorder | null>(null);

export function useRecorder(): Recorder {
  const ctx = useContext(RecorderContext);
  if (!ctx) throw new Error('useRecorder must be used inside <MatchRecorderProvider>.');
  return ctx;
}

/**
 * Lives above every screen, so a registration continues even if the player leaves the result
 * screen. Idempotency is enforced twice: here (one in-flight request per matchId) and on the
 * server (matchId is a unique key; a repeat returns the stored record).
 */
export function MatchRecorderProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const setStatus = useRecordStatus((s) => s.set);
  const inFlight = useRef(new Set<string>());

  const mutation = useMutation({
    mutationFn: postMatch,
    retry: retryPolicy,
    retryDelay,
    onMutate: (record) => setStatus(record.matchId, 'saving'),
    onSuccess: async (_res, record) => {
      pendingStore.remove(record.matchId);
      setStatus(record.matchId, 'saved');
      // Both tabs show server state: refresh them so the new match appears everywhere.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.ranking }),
        queryClient.invalidateQueries({ queryKey: queryKeys.history }),
      ]);
    },
    onError: (_err, record) => setStatus(record.matchId, 'pending'),
  });
  const { mutateAsync } = mutation;

  const send = useCallback(
    async (record: MatchRecord) => {
      if (inFlight.current.has(record.matchId)) return; // repeated clicks do not create parallel requests
      inFlight.current.add(record.matchId);
      try {
        await mutateAsync(record);
      } catch {
        /* surfaced through the 'pending' status; the record stays in the pending store */
      } finally {
        inFlight.current.delete(record.matchId);
      }
    },
    [mutateAsync],
  );

  const submit = useCallback(
    async (record: MatchRecord) => {
      pendingStore.add(record); // durable before the first attempt
      await send(record);
    },
    [send],
  );

  const retry = useCallback(
    async (matchId?: string) => {
      const list = pendingStore.list().filter((r) => !matchId || r.matchId === matchId);
      for (const r of list) await send(r); // sequential: gentle on a recovering server
    },
    [send],
  );

  // Recover pending records after a refresh and when connectivity returns.
  useEffect(() => {
    for (const r of pendingStore.list()) setStatus(r.matchId, 'pending');
    void retry();
    const onOnline = () => void retry();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [retry, setStatus]);

  const value = useMemo(() => ({ submit, retry }), [submit, retry]);
  return <RecorderContext.Provider value={value}>{children}</RecorderContext.Provider>;
}
