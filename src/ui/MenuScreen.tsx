import { useRef, useState, type KeyboardEvent } from 'react';
import { useAppStore, type MenuTab } from '@/state/appStore';
import { END_REASON_LABEL } from './format';
import { Button } from './Button';
import { ControlsHelp } from './ControlsHelp';
import { HistoryPanel } from './HistoryPanel';
import { NetworkSimulator } from './NetworkSimulator';
import { RankingPanel } from './RankingPanel';

const TABS: Array<{ id: MenuTab; label: string }> = [
  { id: 'ranking', label: 'Ranking' },
  { id: 'history', label: 'Match History' },
];

export function MenuScreen() {
  const beginMatch = useAppStore((s) => s.beginMatch);
  const goto = useAppStore((s) => s.goto);
  const lastResult = useAppStore((s) => s.lastResult);
  const tab = useAppStore((s) => s.menuTab);
  const setTab = useAppStore((s) => s.setMenuTab);
  const [simOpen, setSimOpen] = useState(false);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onTabKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const next = TABS[(TABS.findIndex((t) => t.id === tab) + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length]!;
    setTab(next.id);
    tabRefs.current[next.id]?.focus();
  };

  return (
    <main className="screen">
      <div className="menu">
        <section className="menu-left" aria-label="Game menu">
          <img className="title" src="/assets/ui/title_pirate_battle.png" alt="Pirate Battle" />
          <div className="menu-actions">
            <Button onClick={beginMatch}>Play</Button>
            <Button variant="secondary" onClick={() => goto('options')}>
              Options
            </Button>
          </div>
          {lastResult && (
            <div className="last-result" data-testid="last-result">
              Last match: <strong>{lastResult.score}</strong> pts &middot; {END_REASON_LABEL[lastResult.endReason]}{' '}
              <button type="button" className="link-btn" onClick={() => goto('result')}>
                View
              </button>
            </div>
          )}
          <ControlsHelp />
        </section>

        <section className="panel menu-right" aria-label="Leaderboards">
          <div className="panel-body">
            <div className="tabs" role="tablist" aria-label="Leaderboards" onKeyDown={onTabKey}>
              {TABS.map((t) => (
                <button
                  key={t.id}
                  ref={(el) => {
                    tabRefs.current[t.id] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`tab-${t.id}`}
                  className="tab"
                  aria-selected={tab === t.id}
                  aria-controls={`panel-${t.id}`}
                  tabIndex={tab === t.id ? 0 : -1}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {tab === 'ranking' ? <RankingPanel /> : <HistoryPanel />}
            <div className="menu-footer">
              <span />
              <button type="button" className="link-btn" onClick={() => setSimOpen(true)}>
                Network simulator
              </button>
            </div>
          </div>
        </section>
      </div>
      {simOpen && <NetworkSimulator onClose={() => setSimOpen(false)} />}
    </main>
  );
}
