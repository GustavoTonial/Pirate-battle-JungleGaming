import { useEffect, useState, type PointerEvent } from 'react';
import type { InputAction } from '@/game/types';
import type { InputController } from '@/input/InputController';

const ui = (name: string) => `/assets/ui/${name}.png`;

export function useTouchControlsVisible(): boolean {
  const [visible, setVisible] = useState(
    () => new URLSearchParams(window.location.search).get('touch') === '1' || window.matchMedia('(pointer: coarse)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const on = () => setVisible(mq.matches || new URLSearchParams(window.location.search).get('touch') === '1');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return visible;
}

interface HoldProps {
  action: InputAction;
  label: string;
  icon: string;
  input: InputController;
}

/** A button that is "held" while a pointer is down. Each button tracks its own pointer, so multi-touch works. */
function HoldButton({ action, label, icon, input }: HoldProps) {
  const [down, setDown] = useState(false);
  const press = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic pointers (tests) cannot be captured; the button still works */
    }
    input.setTouch(action, true);
    setDown(true);
  };
  const release = () => {
    input.setTouch(action, false);
    setDown(false);
  };
  return (
    <button
      type="button"
      className="round"
      data-testid={`touch-${action}`}
      data-down={down}
      aria-label={label}
      tabIndex={-1}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      <img src={ui(icon)} alt="" />
    </button>
  );
}

export function TouchControls({ input }: { input: InputController }) {
  return (
    <div className="touch" role="group" aria-label="Touch controls">
      <div className="touch-cluster">
        <HoldButton action="left" label="Turn left" icon="icon_turn_left" input={input} />
        <HoldButton action="right" label="Turn right" icon="icon_turn_right" input={input} />
        <HoldButton action="forward" label="Sail forward" icon="icon_forward" input={input} />
      </div>
      <div className="touch-cluster">
        <HoldButton action="fireLeft" label="Fire left broadside" icon="icon_fire_left" input={input} />
        <HoldButton action="fireFront" label="Fire ahead" icon="icon_fire_front" input={input} />
        <HoldButton action="fireRight" label="Fire right broadside" icon="icon_fire_right" input={input} />
      </div>
    </div>
  );
}
