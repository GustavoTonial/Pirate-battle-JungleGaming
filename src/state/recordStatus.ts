import { create } from 'zustand';

export type RecordStatus = 'saving' | 'saved' | 'pending';

interface RecordStatusState {
  byMatch: Record<string, RecordStatus>;
  set: (matchId: string, status: RecordStatus) => void;
}

/** UI-facing registration status per match. The durable source of truth is `pendingStore`. */
export const useRecordStatus = create<RecordStatusState>((set) => ({
  byMatch: {},
  set: (matchId, status) => set((s) => ({ byMatch: { ...s.byMatch, [matchId]: status } })),
}));
