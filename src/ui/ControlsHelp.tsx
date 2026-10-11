export function ControlsHelp() {
  return (
    <section className="controls-panel" aria-labelledby="controls-title">
      <h2 id="controls-title">Controls</h2>
      <dl>
        <dt>Sail</dt>
        <dd>
          <span className="kbd">W</span> or <span className="kbd">&uarr;</span>
        </dd>
        <dt>Turn</dt>
        <dd>
          <span className="kbd">A</span>/<span className="kbd">D</span> or <span className="kbd">&larr;</span>/
          <span className="kbd">&rarr;</span>
        </dd>
        <dt>Fire ahead</dt>
        <dd>
          <span className="kbd">Space</span>
        </dd>
        <dt>Broadside</dt>
        <dd>
          <span className="kbd">Q</span> left, <span className="kbd">E</span> right
        </dd>
        <dt>Pause</dt>
        <dd>
          <span className="kbd">Esc</span> or <span className="kbd">P</span>
        </dd>
        <dt>Touch</dt>
        <dd>On-screen buttons appear on touch devices.</dd>
      </dl>
    </section>
  );
}
