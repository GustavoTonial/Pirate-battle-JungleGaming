import { setupWorker } from 'msw/browser';
import { handlers, resetMockRandomness } from './handlers';
import { mockDb } from './db';
import { getScenario, resetScenario, setScenario } from './scenarios';

export interface MockControls {
  setScenario: (id: string) => void;
  getScenario: () => string;
  /** Restores the initial state: scenario "success", no stored matches, no pending records. */
  reset: () => void;
  db: () => unknown;
}

declare global {
  interface Window {
    __PB_MOCK__?: MockControls;
  }
}

/**
 * Starts MSW in the browser (development, tests and the published build).
 * `?scenario=<id>` selects a scenario; `?mockReset=1` wipes mock state; `?mockSeed=<n>` seeds latency.
 */
export async function startMocks(): Promise<void> {
  const q = new URLSearchParams(window.location.search);
  if (q.get('mockReset') === '1') {
    mockDb.reset();
    resetScenario();
    localStorage.removeItem('pb.pending.v1');
  }
  const scenario = q.get('scenario');
  if (scenario) setScenario(scenario);
  resetMockRandomness(Number(q.get('mockSeed') ?? 42));

  window.__PB_MOCK__ = {
    setScenario,
    getScenario: () => getScenario().id,
    reset: () => {
      mockDb.reset();
      resetScenario();
      localStorage.removeItem('pb.pending.v1');
    },
    db: () => mockDb.all(),
  };

  const worker = setupWorker(...handlers);
  try {
    await worker.start({
      onUnhandledRequest: 'bypass',
      quiet: true,
      serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    });
  } catch (e) {
    console.warn('[mocks] Service worker could not start; ranking/history will show their error state.', e);
  }
}
