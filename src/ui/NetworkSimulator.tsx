import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { getScenario, resetScenario, SCENARIOS, setScenario } from '@/mocks/scenarios';
import { mockDb } from '@/mocks/db';
import { pendingStore } from '@/api/pendingStore';
import { Button } from './Button';

/** Lets reviewers pick a network scenario and restore the initial mock state (works in the published build). */
export function NetworkSimulator({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState(getScenario().id);
  const [note, setNote] = useState('');
  const scenario = SCENARIOS.find((s) => s.id === current);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);

  const change = (id: string) => {
    setScenario(id);
    setCurrent(id);
    setNote('Scenario applied. Reopen a tab or use Try again to see it.');
    void queryClient.invalidateQueries();
  };

  const reset = () => {
    mockDb.reset();
    resetScenario();
    for (const r of pendingStore.list()) pendingStore.remove(r.matchId);
    setCurrent(getScenario().id);
    setNote('Mock data and scenario restored to their initial state.');
    queryClient.clear();
    void queryClient.invalidateQueries();
  };

  return (
    <dialog ref={ref} className="modal" aria-labelledby="sim-title" onClose={onClose} onCancel={onClose}>
      <div className="panel">
        <h2 id="sim-title">Network simulator</h2>
        <div className="field">
          <label htmlFor="scenario">Scenario</label>
          <select id="scenario" className="sim-select" value={current} onChange={(e) => change(e.target.value)}>
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <p className="hint" id="scenario-desc">{scenario?.description}</p>
        </div>
        <p role="status" className="hint">{note}</p>
        <div className="actions">
          <Button small variant="secondary" onClick={reset}>
            Reset data
          </Button>
          <Button small onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </dialog>
  );
}
