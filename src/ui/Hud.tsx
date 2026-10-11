import { useAppStore } from '@/state/appStore';
import { formatDuration } from './format';

const ui = (name: string) => `/assets/ui/${name}.png`;

/** Score, time and health. Re-renders only when the (throttled) HUD snapshot changes. */
export function Hud({ onPause }: { onPause: () => void }) {
  const hud = useAppStore((s) => s.hud);
  const score = hud?.score ?? 0;
  const timeLeft = hud?.timeLeftSec ?? 0;
  const health = hud?.health ?? 0;
  const max = hud?.maxHealth ?? 1;
  const ratio = Math.max(0, Math.min(1, health / max));
  const fill = ratio > 0.5 ? 'green' : ratio > 0.25 ? 'amber' : 'red';
  // Fill art is clipped on the x axis: the fill rect spans x = 30..226 of the 256-wide frame.
  const clipRight = 100 - ((30 + 196 * ratio) / 256) * 100;

  return (
    <header className="hud">
      <div className="hud-group">
        <div className="counter" aria-hidden="true">
          <img src={ui('icon_score')} alt="" />
          <span data-testid="hud-score">{score}</span>
        </div>
        <div className="counter" aria-hidden="true">
          <img src={ui('icon_time')} alt="" />
          <span data-testid="hud-time">{formatDuration(timeLeft * 1000)}</span>
        </div>
      </div>
      <div className="health" aria-hidden="true">
        <img src={ui('health_frame')} alt="" />
        <img src={ui(`health_fill_${fill}`)} alt="" style={{ clipPath: `inset(0 ${clipRight}% 0 0)` }} />
        <span className="health-label" data-testid="hud-health">{health}/{max}</span>
      </div>
      <button type="button" className="round" onClick={onPause} aria-label="Pause">
        <img src={ui('icon_pause')} alt="" />
      </button>
      {/* Semantic equivalent for assistive tech: no live announcements per frame or per second. */}
      <dl className="sr-only" aria-label="Match status">
        <dt>Score</dt>
        <dd>{score}</dd>
        <dt>Time left</dt>
        <dd>{timeLeft} seconds</dd>
        <dt>Health</dt>
        <dd>{health} of {max}</dd>
      </dl>
    </header>
  );
}
