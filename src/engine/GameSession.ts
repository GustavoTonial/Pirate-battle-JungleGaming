import type { GameConfig } from '@/config/gameConfig';
import { FIXED_STEP, Simulation } from '@/game/Simulation';
import type { HudSnapshot, MatchResult, MatchStatus } from '@/game/types';
import { bindKeyboard, InputController } from '@/input/InputController';
import type { GameTextures } from '@/render/assets';
import { GameRenderer } from '@/render/GameRenderer';
import type { TestMode } from '@/testing/testMode';
import { PerfRecorder } from './PerfRecorder';

export interface SessionParams {
  host: HTMLElement;
  textures: GameTextures;
  config: Readonly<GameConfig>;
  seed: number;
  matchId: string;
  testMode: TestMode;
  onHud: (hud: HudSnapshot) => void;
  onEnded: (result: MatchResult) => void;
}

/** Longest real time folded into the simulation per frame (avoids a spiral after tab stalls). */
const MAX_FRAME_MS = 100;

/**
 * Owns one match: simulation + renderer + input + loop. React creates it on mount and
 * calls `destroy()` on unmount; destroy releases the ticker, listeners and Pixi resources.
 */
export class GameSession {
  readonly input = new InputController();
  readonly perf = new PerfRecorder();
  private accumulator = 0;
  private lastHud: HudSnapshot | null = null;
  private endedNotified = false;
  private destroyed = false;
  private readonly disposers: Array<() => void> = [];

  private constructor(
    readonly sim: Simulation,
    readonly renderer: GameRenderer,
    private readonly params: SessionParams,
  ) {}

  static async create(params: SessionParams, isCancelled: () => boolean): Promise<GameSession | null> {
    const renderer = await GameRenderer.create(params.host, params.textures, params.config, isCancelled, {
      autoStart: !params.testMode.manualClock,
    });
    if (!renderer) return null;
    const sim = new Simulation({
      config: params.config,
      seed: params.seed,
      matchId: params.matchId,
      disableSpawns: params.testMode.noSpawn,
    });
    const session = new GameSession(sim, renderer, params);
    session.init();
    return session;
  }

  private init(): void {
    const { testMode } = this.params;
    this.disposers.push(
      bindKeyboard(this.input, {
        isGameplayActive: () => this.sim.status === 'running',
        onPauseKey: () => this.pause(),
      }),
    );
    // Automatic pause when the player leaves the game.
    const autoPause = () => this.pause();
    const onVisibility = () => document.hidden && this.pause();
    window.addEventListener('blur', autoPause);
    document.addEventListener('visibilitychange', onVisibility);
    this.disposers.push(() => {
      window.removeEventListener('blur', autoPause);
      document.removeEventListener('visibilitychange', onVisibility);
    });

    if (!testMode.manualClock) {
      const tick = (ticker: { deltaMS: number }) => this.advance(ticker.deltaMS);
      this.renderer.app.ticker.add(tick);
      this.disposers.push(() => this.renderer.app.ticker.remove(tick));
    }
    this.frame(0);
  }

  get status(): MatchStatus {
    return this.sim.status;
  }

  start(): void {
    this.sim.start();
    this.frame(0);
  }

  pause(): void {
    if (this.sim.status !== 'running') return;
    this.sim.pause();
    this.input.clear();
    this.accumulator = 0;
    this.emitHud();
  }

  /** Resuming discards any held input and accumulated time: nothing from the pause carries over. */
  resume(): void {
    if (this.sim.status !== 'paused') return;
    this.input.clear();
    this.accumulator = 0;
    this.sim.resume();
    this.emitHud();
  }

  /**
   * Advances the match by `elapsedMs` of real (or test-controlled) time using a fixed
   * timestep, so movement, damage and spawns do not depend on the frame rate.
   */
  advance(elapsedMs: number): void {
    if (this.destroyed) return;
    this.perf.frame(elapsedMs, this.sim);
    let simulated = 0;
    if (this.sim.status === 'running') {
      this.accumulator += Math.min(elapsedMs, MAX_FRAME_MS) / 1000;
      while (this.accumulator >= FIXED_STEP && this.sim.status === 'running') {
        this.sim.step(FIXED_STEP, this.input.state);
        this.accumulator -= FIXED_STEP;
        simulated += FIXED_STEP;
      }
    }
    this.frame(simulated);
    if (this.params.testMode.manualClock) this.renderer.render();
  }

  /** Manual-clock helper for tests: runs `ms` of time in 16.667 ms frames. */
  advanceManual(ms: number): void {
    const frameMs = FIXED_STEP * 1000;
    let left = ms;
    while (left > 0 && !this.destroyed) {
      const chunk = Math.min(frameMs, left);
      this.advance(chunk);
      left -= chunk;
    }
  }

  private frame(simulatedSec: number): void {
    this.renderer.handleEvents(this.sim.drainEvents());
    this.renderer.update(simulatedSec);
    this.renderer.sync(this.sim);
    this.emitHud();
    if (this.sim.status === 'ended' && !this.endedNotified) {
      this.endedNotified = true;
      this.input.clear();
      const result = this.sim.result();
      if (result) this.params.onEnded(result);
    }
  }

  /** Pushes a HUD snapshot only when a visible value changed (not every frame). */
  private emitHud(): void {
    const h = this.sim.hud();
    const p = this.lastHud;
    if (p && p.status === h.status && p.score === h.score && p.health === h.health && p.timeLeftSec === h.timeLeftSec) return;
    this.lastHud = h;
    this.params.onHud(h);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const d of this.disposers.splice(0)) d();
    this.input.clear();
    this.renderer.destroy();
  }
}
