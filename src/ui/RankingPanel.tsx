import { describeError } from '@/api/client';
import { useRankingQuery } from '@/api/hooks';
import { useAppStore } from '@/state/appStore';
import { getPlayer } from '@/state/player';
import { useState } from 'react';
import { END_REASON_LABEL, formatDate, formatDuration } from './format';
import { Pager } from './Pager';

export function RankingPanel() {
  const options = useAppStore((s) => s.options);
  const [page, setPage] = useState(1);
  const me = getPlayer().id;
  const q = useRankingQuery(page, { sessionTimeSec: options.sessionTimeSec, enemySpawnTimeSec: options.enemySpawnTimeSec });

  return (
    <div role="tabpanel" id="panel-ranking" aria-labelledby="tab-ranking" tabIndex={-1}>
      <p style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--ink-dim)' }}>
        Matches with the same settings: {options.sessionTimeSec} s sessions, spawn every {options.enemySpawnTimeSec} s.
      </p>
      <div className="updating" aria-live="polite">
        {q.isFetching && !q.isPending ? 'Updating\u2026' : ''}
      </div>

      {q.isPending && (
        <div className="state-box" role="status">
          <div className="spinner" aria-hidden="true" />
          Loading ranking&hellip;
        </div>
      )}

      {q.isError && !q.data && (
        <div className="state-box error" role="alert">
          <p>Could not load the ranking. {describeError(q.error)}</p>
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
          <p>No matches yet for these settings.</p>
          <p style={{ color: 'var(--ink-dim)' }}>Play a match to claim the first place.</p>
        </div>
      )}

      {q.data && q.data.total > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Ranking by score</caption>
              <thead>
                <tr>
                  <th scope="col" className="num">#</th>
                  <th scope="col">Player</th>
                  <th scope="col" className="num">Score</th>
                  <th scope="col" className="num">Time</th>
                  <th scope="col">Ended</th>
                </tr>
              </thead>
              <tbody>
                {q.data.items.map((e) => (
                  <tr key={e.matchId} className={e.playerId === me ? 'me' : undefined} data-testid="ranking-row">
                    <td className="num">{e.rank}</td>
                    <td>
                      {e.playerName}
                      {e.playerId === me ? ' (you)' : ''}
                    </td>
                    <td className="num">{e.score}</td>
                    <td className="num">{formatDuration(e.durationMs)}</td>
                    <td title={formatDate(e.playedAt)}>{END_REASON_LABEL[e.endReason]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={q.data.page} totalPages={q.data.totalPages} onPage={setPage} label="Ranking" />
        </>
      )}
    </div>
  );
}
