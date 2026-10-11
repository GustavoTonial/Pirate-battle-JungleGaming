import type { PerfReport } from '@/engine/PerfRecorder';
import type { GameSession } from '@/engine/GameSession';
import type { EndReason, MatchStatus, ShipKind } from '@/game/types';

export interface TestShip {
  id: number;
  kind: ShipKind;
  x: number;
  y: number;
  heading: number;
  speed: number;
  health: number;
  cdFront: number;
  cdLeft: number;
  cdRight: number;
}

export interface TestState {
  status: MatchStatus;
  endReason: EndReason | null;
  time: number;
  timeLeft: number;
  score: number;
  player: TestShip;
  enemies: TestShip[];
  projectiles: Array<{ id: number; owner: 'player' | 'enemy'; x: number; y: number; damage: number }>;
  arena: { width: number; height: number; islands: Array<{ id: string; x: number; y: number; radius: number }> };
  render: { ships: number; projectiles: number; effects: number };
}

export interface ArrangeSpec {
  player?: { x?: number; y?: number; heading?: number; health?: number };
  enemies?: Array<{ kind: 'chaser' | 'shooter'; x: number; y: number; heading?: number; health?: number }>;
}

export interface PBTestApi {
  state(): TestState;
  /** Manual clock only (`&clock=manual`): advances simulated time by `ms`, in 1/60 s frames. */
  advance(ms: number): void;
  /** Scenario setup: removes enemies, then places the given ones and/or moves the player. */
  arrange(spec: ArrangeSpec): void;
  perf(): PerfReport;
  resetPerf(): void;
}

declare global {
  interface Window {
    __PB__?: PBTestApi;
  }
}

const toShip = (s: TestShip): TestShip => ({
  id: s.id, kind: s.kind, x: s.x, y: s.y, heading: s.heading, speed: s.speed,
  health: s.health, cdFront: s.cdFront, cdLeft: s.cdLeft, cdRight: s.cdRight,
});

export function installTestApi(session: GameSession): () => void {
  const { sim } = session;
  const api: PBTestApi = {
    state: () => ({
      status: sim.status,
      endReason: sim.endReason,
      time: sim.time,
      timeLeft: sim.timeLeft,
      score: sim.score,
      player: toShip(sim.player),
      enemies: sim.ships.filter((s) => s.kind !== 'player' && s.alive).map(toShip),
      projectiles: sim.projectiles.map((b) => ({ id: b.id, owner: b.owner, x: b.x, y: b.y, damage: b.damage })),
      arena: {
        width: sim.config.arena.width,
        height: sim.config.arena.height,
        islands: sim.config.arena.islands.map((i) => ({ id: i.id, x: i.x, y: i.y, radius: i.radius })),
      },
      render: session.renderer.stats(),
    }),
    advance: (ms) => session.advanceManual(ms),
    arrange: (spec) => {
      for (const s of sim.ships) if (s.kind !== 'player') s.alive = false;
      for (let i = sim.ships.length - 1; i >= 0; i--) if (sim.ships[i]!.kind !== 'player') sim.ships.splice(i, 1);
      const p = sim.player;
      if (spec.player) {
        p.x = spec.player.x ?? p.x;
        p.y = spec.player.y ?? p.y;
        p.heading = spec.player.heading ?? p.heading;
        p.health = spec.player.health ?? p.health;
      }
      for (const e of spec.enemies ?? []) sim.addEnemy(e.kind, e.x, e.y, e.heading ?? 0, e.health);
      session.advance(0);
    },
    perf: () => session.perf.report(),
    resetPerf: () => session.perf.reset(),
  };
  window.__PB__ = api;
  return () => {
    if (window.__PB__ === api) delete window.__PB__;
  };
}
