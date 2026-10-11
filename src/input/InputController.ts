import { createInputState } from '@/game/Simulation';
import type { InputAction, InputState } from '@/game/types';

const ACTIONS: InputAction[] = ['forward', 'left', 'right', 'fireFront', 'fireLeft', 'fireRight'];

/** Keyboard layout. Keys are matched by `KeyboardEvent.code`, so it works on any keyboard layout. */
export const KEY_BINDINGS: Record<string, InputAction> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'fireFront',
  KeyQ: 'fireLeft',
  KeyE: 'fireRight',
};
export const PAUSE_KEYS = new Set(['Escape', 'KeyP']);

/**
 * Merges held-state from keyboard and touch into one `InputState` read by the simulation
 * each step. Holding several actions at once (move + fire) is naturally supported.
 */
export class InputController {
  readonly state: InputState = createInputState();
  private readonly keyboard = createInputState();
  private readonly touch = createInputState();

  setKeyboard(action: InputAction, down: boolean): void {
    this.keyboard[action] = down;
    this.merge();
  }

  setTouch(action: InputAction, down: boolean): void {
    this.touch[action] = down;
    this.merge();
  }

  /** Releases everything (pause, blur, match end) so nothing carries over. */
  clear(): void {
    for (const a of ACTIONS) {
      this.keyboard[a] = false;
      this.touch[a] = false;
    }
    this.merge();
  }

  private merge(): void {
    for (const a of ACTIONS) this.state[a] = this.keyboard[a] || this.touch[a];
  }
}

/**
 * Attaches window key listeners. Game keys are captured (preventDefault) only while
 * `isGameplayActive()` is true, so menus, forms and dialogs keep normal keyboard behavior.
 * Returns a disposer that removes every listener.
 */
export function bindKeyboard(
  input: InputController,
  opts: { isGameplayActive: () => boolean; onPauseKey: () => void },
): () => void {
  const onDown = (e: KeyboardEvent) => {
    if (!opts.isGameplayActive()) return;
    if (PAUSE_KEYS.has(e.code)) {
      if (!e.repeat) opts.onPauseKey();
      e.preventDefault();
      return;
    }
    const action = KEY_BINDINGS[e.code];
    if (!action) return;
    e.preventDefault();
    input.setKeyboard(action, true);
  };
  const onUp = (e: KeyboardEvent) => {
    const action = KEY_BINDINGS[e.code];
    if (action) input.setKeyboard(action, false); // always release, even if gameplay became inactive
  };
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  return () => {
    window.removeEventListener('keydown', onDown);
    window.removeEventListener('keyup', onUp);
  };
}
