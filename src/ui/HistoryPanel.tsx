import { describeError } from '@/api/client';
import { useHistoryQuery } from '@/api/hooks';
import { getPlayer } from '@/state/player';
import { useState } from 'react';
import { END_REASON_LABEL, formatDate, formatDuration } from './format';
import { Pager } from './Pager';

export function HistoryPanel() {
  const [page, setPage] = useState(1);
  const q = useHistoryQuery(getPlayer().id, page);

  return (
    <div role="tabpanel" id="panel-history" aria-labelledby="tab-history" tabIndex={-1}>
      <div className="updating" aria-live="polite">
        {q.isFetching && !q.isPending ? 'Updating\u2026' : ''}
      </div>

      {q.isPending && (
        <div className="state-box" role="status">
          <div className="spinner" aria-hidden="true" />
          Loading match history&hellip;
        </div>
      )}

      {q.isError && !q.data && (
        <div className="state-box error" role="alert">
          <p>Could not load your match history. {describeError(q.error)}</p>
          <button type="button" className="link-btn" onClick={() => void q.refetch()}>
            Try again
          </button>
        </div>
      )}

      {q.isError && q.data && (
        <p role="alert" style={{ color: 'var(--danger)', margin: '0 0 6px', fontSize: 14 }}>
          Could not refresh. Showing the last loaded data.{' '}
          <button type="button" className="link-btn" onClick={() => void q.refetch()}>
            Try again
          </button>
        </p>
      )}

      {q.data && q.data.total === 0 && (
        <div className="state-box">
          <p>You haven&rsquo;t finished a match yet.</p>
          <p style={{ color: 'var(--ink-dim)' }}>Press Play and your results will show up here.</p>
        </div>
      )}

      {q.data && q.data.total > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Your match history, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col" className="num">Score</th>
                  <th scope="col" className="num">Time</th>
                  <th scope="col">Ended</th>
                </tr>
              </thead>
              <tbody>
                {q.data.items.map((m) => (
                  <tr key={m.matchId} data-testid="history-row">
                    <td>{formatDate(m.playedAt)}</td>
                    <td className="num">{m.score}</td>
                    <td className="num">{formatDuration(m.durationMs)}</td>
                    <td>{END_REASON_LABEL[m.endReason]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={q.data.page} totalPages={q.data.totalPages} onPage={setPage} label="History" />
        </>
      )}
    </div>
  );
}
