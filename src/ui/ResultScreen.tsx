import { useRecorder } from '@/api/MatchRecorder';
import { pendingStore } from '@/api/pendingStore';
import { useAppStore } from '@/state/appStore';
import { useRecordStatus } from '@/state/recordStatus';
import { useEffect } from 'react';
import { Button } from './Button';
import { END_REASON_LABEL, formatDuration } from './format';

export function ResultScreen() {
  const result = useAppStore((s) => s.lastResult);
  const goto = useAppStore((s) => s.goto);
  const beginMatch = useAppStore((s) => s.beginMatch);
  const tracked = useRecordStatus((s) => (result ? s.byMatch[result.matchId] : undefined));
  const recorder = useRecorder();

  useEffect(() => {
    if (!result) goto('menu');
  }, [result, goto]);
  if (!result) return null;

  // After a refresh nothing is tracked in memory: fall back to the durable pending store.
  const status = tracked ?? (pendingStore.list().some((r) => r.matchId === result.matchId) ? 'pending' : 'saved');

  return (
    <main className="screen">
      <section className="panel card" aria-labelledby="result-title">
        <h1 id="result-title">{result.endReason === 'time' ? "Time's up!" : 'Ship sunk!'}</h1>
        <dl className="result-grid">
          <dt>Score</dt>
          <dd data-testid="result-score">{result.score}</dd>
          <dt>Time played</dt>
          <dd data-testid="result-duration">{formatDuration(result.durationMs)}</dd>
          <dt>Match ended</dt>
          <dd data-testid="result-reason">{END_REASON_LABEL[result.endReason]}</dd>
        </dl>

        <div className={`record-status ${status}`} data-testid="record-status" role="status">
          {status === 'saving' && 'Saving your match\u2026'}
          {status === 'saved' && 'Match saved to the ranking and your history.'}
          {status === 'pending' && (
            <>
              <div>Couldn&rsquo;t save this match yet. It&rsquo;s kept on this device and will be retried.</div>
              <button type="button" className="link-btn" onClick={() => void recorder.retry(result.matchId)}>
                Try again
              </button>
            </>
          )}
        </div>

        <div className="actions">
          <Button onClick={beginMatch}>Play Again</Button>
          <Button variant="secondary" onClick={() => goto('menu')}>
            Main Menu
          </Button>
        </div>
      </section>
    </main>
  );
}
