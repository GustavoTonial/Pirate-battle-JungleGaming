import { useRef, useState, type FormEvent } from 'react';
import { OPTION_LIMITS, validateOptions, type UserOptions } from '@/config/gameConfig';
import { useAppStore } from '@/state/appStore';
import { Button } from './Button';

export function OptionsScreen() {
  const options = useAppStore((s) => s.options);
  const saveOptions = useAppStore((s) => s.saveOptions);
  const goto = useAppStore((s) => s.goto);
  const [session, setSession] = useState(String(options.sessionTimeSec));
  const [spawn, setSpawn] = useState(String(options.enemySpawnTimeSec));
  const [errors, setErrors] = useState<ReturnType<typeof validateOptions>>({});
  const [saved, setSaved] = useState(false);
  const sessionRef = useRef<HTMLInputElement>(null);
  const spawnRef = useRef<HTMLInputElement>(null);
  const L = OPTION_LIMITS;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validateOptions({ sessionTimeSec: session.trim(), enemySpawnTimeSec: spawn.trim() });
    setErrors(errs);
    setSaved(false);
    if (errs.sessionTimeSec) return sessionRef.current?.focus();
    if (errs.enemySpawnTimeSec) return spawnRef.current?.focus();
    const next: UserOptions = { sessionTimeSec: Number(session), enemySpawnTimeSec: Number(spawn) };
    saveOptions(next);
    setSaved(true);
  };

  return (
    <main className="screen">
      <form className="panel card" onSubmit={submit} noValidate aria-labelledby="options-title">
        <h1 id="options-title">Options</h1>

        <div className="field">
          <label htmlFor="session">Game session time (seconds)</label>
          <input
            ref={sessionRef}
            id="session"
            name="session"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={session}
            onChange={(e) => {
              setSession(e.target.value);
              setSaved(false);
            }}
            aria-invalid={!!errors.sessionTimeSec}
            aria-describedby={`session-hint${errors.sessionTimeSec ? ' session-error' : ''}`}
          />
          <div className="hint" id="session-hint">
            Whole seconds, {L.sessionTimeSec.min} to {L.sessionTimeSec.max}.
          </div>
          {errors.sessionTimeSec && (
            <div className="error" id="session-error" role="alert">
              {errors.sessionTimeSec}
            </div>
          )}
        </div>

        <div className="field">
          <label htmlFor="spawn">Enemy spawn time (seconds)</label>
          <input
            ref={spawnRef}
            id="spawn"
            name="spawn"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={spawn}
            onChange={(e) => {
              setSpawn(e.target.value);
              setSaved(false);
            }}
            aria-invalid={!!errors.enemySpawnTimeSec}
            aria-describedby={`spawn-hint${errors.enemySpawnTimeSec ? ' spawn-error' : ''}`}
          />
          <div className="hint" id="spawn-hint">
            A new enemy appears every this many seconds, {L.enemySpawnTimeSec.min} to {L.enemySpawnTimeSec.max}.
          </div>
          {errors.enemySpawnTimeSec && (
            <div className="error" id="spawn-error" role="alert">
              {errors.enemySpawnTimeSec}
            </div>
          )}
        </div>

        <div className="saved-note" role="status">
          {saved ? 'Options saved.' : ''}
        </div>

        <div className="actions">
          <Button type="submit">Save</Button>
          <Button variant="secondary" onClick={() => goto('menu')}>
            Back
          </Button>
        </div>
      </form>
    </main>
  );
}
