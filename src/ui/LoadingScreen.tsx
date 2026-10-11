import { useEffect, useState } from 'react';
import { loadGameTextures } from '@/render/assets';
import { useAppStore } from '@/state/appStore';
import { Button } from './Button';

export function LoadingScreen() {
  const goto = useAppStore((s) => s.goto);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setProgress(0);
    loadGameTextures((p) => !cancelled && setProgress(p))
      .then(() => !cancelled && goto('match'))
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'The game assets could not be loaded.');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, goto]);

  return (
    <main className="screen">
      <div className="panel card loading">
        {error ? (
          <div role="alert">
            <h1>Couldn&rsquo;t load the game</h1>
            <p>{error} Check your connection and try again.</p>
            <div className="actions">
              <Button onClick={() => setAttempt((a) => a + 1)}>Try again</Button>
              <Button variant="secondary" onClick={() => goto('menu')}>
                Main Menu
              </Button>
            </div>
          </div>
        ) : (
          <div role="status" aria-live="polite">
            <h1>Loading&hellip;</h1>
            <div className="progress" role="progressbar" aria-label="Loading game assets" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
              <div style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <span className="sr-only">{Math.round(progress * 100)} percent loaded</span>
          </div>
        )}
      </div>
    </main>
  );
}
