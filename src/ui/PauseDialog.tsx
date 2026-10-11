import { useEffect, useRef } from 'react';
import { Button } from './Button';
import { ControlsHelp } from './ControlsHelp';

interface Props {
  open: boolean;
  onResume: () => void;
  onQuit: () => void;
}

/**
 * Native modal <dialog>: the browser traps focus inside it and makes the rest of the page inert.
 * Resuming always needs an explicit action (button or Esc); nothing resumes automatically.
 */
export function PauseDialog({ open, onResume, onQuit }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="pause-title"
      onCancel={(e) => {
        e.preventDefault();
        onResume();
      }}
    >
      <div className="panel">
        <h2 id="pause-title" style={{ textAlign: 'center', color: 'var(--gold)' }}>
          Paused
        </h2>
        <ControlsHelp />
        <div className="actions">
          <Button onClick={onResume} autoFocus>
            Resume
          </Button>
          <Button variant="secondary" onClick={onQuit}>
            Main Menu
          </Button>
        </div>
      </div>
    </dialog>
  );
}
