import type { GameConfig, ProjectileSpec } from '@/config/gameConfig';
import { approachSpeed, avoidIslands, steerToward } from './ai';
import { angleDiff, clamp, createRng, dist } from './math';
import type {
  EndReason,
  HudSnapshot,
  InputState,
  MatchResult,
  MatchStatus,
  Projectile,
  Ship,
  ShipKind,
  SimEvent,
} from './types';

export const FIXED_STEP = 1 / 60;

export function createInputState(): InputState {
  return { forward: false, left: false, right: false, fireFront: false, fireLeft: false, fireRight: false };
}

export interface SimulationOptions {
  config: Readonly<GameConfig>;
  seed: number;
  matchId: string;
  /** Test-only: disables timed spawns so a scenario can be arranged by hand. */
  disableSpawns?: boolean;
}

/**
 * Pure game rules. No rendering, no DOM, no wall-clock: everything advances through
 * `step(dt)` so results are identical for any frame rate and reproducible with a seed.
 */
export class Simulation {
  readonly config: Readonly<GameConfig>;
  readonly matchId: string;
  readonly ships: Ship[] = [];
  readonly projectiles: Projectile[] = [];
  readonly player: Ship;
  status: MatchStatus = 'ready';
  endReason: EndReason | null = null;
  score = 0;
  /** Active simulated seconds. */
  time = 0;
  private events: SimEvent[] = [];
  private nextId = 1;
  private spawnTimer = 0;
  private spawnCount = 0;
  private readonly rng: () => number;
  private disableSpawns: boolean;

  constructor(opts: SimulationOptions) {
    this.config = opts.config;
    this.matchId = opts.matchId;
    this.rng = createRng(opts.seed);
    this.disableSpawns = opts.disableSpawns ?? false;
    const p = opts.config.player;
    this.player = this.createShip('player', p.start.x, p.start.y, p.start.heading);
  }

  start(): void {
    if (this.status === 'ready') this.status = 'running';
  }
  pause(): void {
    if (this.status === 'running') this.status = 'paused';
  }
  resume(): void {
    if (this.status === 'paused') this.status = 'running';
  }

  drainEvents(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  get timeLeft(): number {
    return Math.max(0, this.config.session.durationSec - this.time);
  }

  hud(): HudSnapshot {
    return {
      status: this.status,
      score: this.score,
      health: Math.max(0, this.player.health),
      maxHealth: this.player.maxHealth,
      timeLeftSec: Math.ceil(this.timeLeft - 1e-9),
    };
  }

  result(): MatchResult | null {
    if (this.status !== 'ended' || !this.endReason) return null;
    const { durationSec } = this.config.session;
    return {
      matchId: this.matchId,
      score: this.score,
      durationMs: Math.round(Math.min(this.time, durationSec) * 1000),
      endReason: this.endReason,
      config: { sessionTimeSec: durationSec, enemySpawnTimeSec: this.config.spawn.intervalSec },
      endedAt: new Date().toISOString(),
    };
  }

  /** Test helper (scenario setup). Spawns an enemy at an exact pose. */
  addEnemy(kind: 'chaser' | 'shooter', x: number, y: number, heading = 0, health?: number): Ship {
    const s = this.createShip(kind, x, y, heading);
    if (health !== undefined) s.health = health;
    return s;
  }

  /** Advances the simulation by `dt` seconds. No-op unless the match is running. */
  step(dt: number, input: Readonly<InputState>): void {
    if (this.status !== 'running') return;
    this.time += dt;

    this.updatePlayer(dt, input);
    this.updateSpawns(dt);
    for (const s of this.ships) {
      if (!s.alive || s.kind === 'player') continue;
      if (s.kind === 'chaser') this.updateChaser(s, dt);
      else this.updateShooter(s, dt);
    }
    this.updateProjectiles(dt);
    this.resolveShipCollisions();
    this.resolveWorldCollisions();
    this.resolveProjectileHits();
    this.resolveChaserContact();
    this.cleanup();

    for (const s of this.ships) s.hitFlash = Math.max(0, s.hitFlash - dt);

    if (this.player.health <= 0) this.end('death');
    else if (this.time >= this.config.session.durationSec - 1e-9) {
      this.time = this.config.session.durationSec;
      this.end('time');
    }
  }

  private end(reason: EndReason): void {
    this.status = 'ended';
    this.endReason = reason;
    this.events.push({ type: 'ended', reason });
  }

  // ---------------------------------------------------------------- creation

  private createShip(kind: ShipKind, x: number, y: number, heading: number): Ship {
    const spec = kind === 'player' ? this.config.player : this.config[kind];
    const ship: Ship = {
      id: this.nextId++,
      kind,
      x,
      y,
      heading,
      speed: 0,
      health: spec.maxHealth,
      maxHealth: spec.maxHealth,
      radius: spec.radius,
      alive: true,
      cdFront: 0,
      cdLeft: 0,
      cdRight: 0,
      hitFlash: 0,
    };
    this.ships.push(ship);
    return ship;
  }

  private spawnProjectile(
    owner: 'player' | 'enemy',
    x: number,
    y: number,
    angle: number,
    spec: ProjectileSpec,
  ): void {
    this.projectiles.push({
      id: this.nextId++,
      owner,
      x,
      y,
      vx: Math.cos(angle) * spec.speed,
      vy: Math.sin(angle) * spec.speed,
      damage: spec.damage,
      radius: spec.radius,
      traveled: 0,
      range: spec.range,
      alive: true,
    });
  }

  // ------------------------------------------------------------------ player

  private updatePlayer(dt: number, input: Readonly<InputState>): void {
    const p = this.player;
    const spec = this.config.player;
    const turn = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    p.heading += turn * spec.turnSpeed * dt;
    approachSpeed(p, input.forward ? spec.speed : 0, spec.acceleration, dt);
    p.x += Math.cos(p.heading) * p.speed * dt;
    p.y += Math.sin(p.heading) * p.speed * dt;

    p.cdFront = Math.max(0, p.cdFront - dt);
    p.cdLeft = Math.max(0, p.cdLeft - dt);
    p.cdRight = Math.max(0, p.cdRight - dt);

    if (input.fireFront && p.cdFront === 0) {
      p.cdFront = spec.front.cooldownSec;
      const d = p.radius + 6;
      this.spawnProjectile(
        'player',
        p.x + Math.cos(p.heading) * d,
        p.y + Math.sin(p.heading) * d,
        p.heading,
        spec.front.projectile,
      );
      this.events.push({ type: 'shot', x: p.x + Math.cos(p.heading) * d, y: p.y + Math.sin(p.heading) * d, heading: p.heading, owner: 'player', weapon: 'front' });
    }
    if (input.fireLeft && p.cdLeft === 0) {
      p.cdLeft = spec.side.cooldownSec;
      this.fireBroadside(p, -1);
    }
    if (input.fireRight && p.cdRight === 0) {
      p.cdRight = spec.side.cooldownSec;
      this.fireBroadside(p, 1);
    }
  }

  /**
   * Three parallel projectiles fired perpendicular to the heading.
   * side: -1 = port (left of the ship), 1 = starboard (right). Heading grows clockwise on screen,
   * so port is `heading - PI/2` and starboard is `heading + PI/2`.
   */
  private fireBroadside(p: Ship, side: -1 | 1): void {
    const { side: w } = this.config.player;
    const fx = Math.cos(p.heading);
    const fy = Math.sin(p.heading);
    const angle = p.heading + (side * Math.PI) / 2;
    const reach = p.radius * 0.9 + 4;
    const half = (w.projectileCount - 1) / 2;
    for (let i = 0; i < w.projectileCount; i++) {
      const along = (i - half) * w.spacing;
      this.spawnProjectile(
        'player',
        p.x + fx * along + Math.cos(angle) * reach,
        p.y + fy * along + Math.sin(angle) * reach,
        angle,
        w.projectile,
      );
    }
    this.events.push({
      type: 'shot',
      x: p.x + Math.cos(angle) * p.radius,
      y: p.y + Math.sin(angle) * p.radius,
      heading: angle,
      owner: 'player',
      weapon: 'side',
    });
  }

  // ------------------------------------------------------------------- spawn

  private updateSpawns(dt: number): void {
    if (this.disableSpawns) return;
    this.spawnTimer += dt;
    const interval = this.config.spawn.intervalSec;
    if (this.spawnTimer + 1e-9 < interval) return;
    const alive = this.ships.filter((s) => s.alive && s.kind !== 'player').length;
    if (alive >= this.config.spawn.maxAlive) {
      this.spawnTimer -= interval;
      return;
    }
    const kind = this.pickKind();
    const pos = this.findSpawnPoint(kind);
    if (!pos) return; // keep the timer charged and retry next step
    this.spawnTimer -= interval;
    this.spawnCount++;
    const heading = Math.atan2(this.player.y - pos.y, this.player.x - pos.x);
    this.createShip(kind, pos.x, pos.y, heading);
  }

  /** The first two spawns are one of each type so both always appear; then weighted random. */
  private pickKind(): 'chaser' | 'shooter' {
    if (this.spawnCount === 0) return 'chaser';
    if (this.spawnCount === 1) return 'shooter';
    const { chaser, shooter } = this.config.spawn.weights;
    return this.rng() * (chaser + shooter) < chaser ? 'chaser' : 'shooter';
  }

  private findSpawnPoint(kind: 'chaser' | 'shooter'): { x: number; y: number } | null {
    const { arena, spawn } = this.config;
    const r = this.config[kind].radius;
    const m = spawn.edgeMargin + r;
    for (let i = 0; i < 40; i++) {
      const x = m + this.rng() * (arena.width - 2 * m);
      const y = m + this.rng() * (arena.height - 2 * m);
      if (dist(x, y, this.player.x, this.player.y) < spawn.minDistanceFromPlayer) continue;
      if (arena.islands.some((isl) => dist(x, y, isl.x, isl.y) < isl.radius + r + 24)) continue;
      if (this.ships.some((s) => s.alive && dist(x, y, s.x, s.y) < s.radius + r + 20)) continue;
      return { x, y };
    }
    return null;
  }

  // ----------------------------------------------------------------- enemies

  private updateChaser(s: Ship, dt: number): void {
    const spec = this.config.chaser;
    const p = this.player;
    const d = dist(s.x, s.y, p.x, p.y);
    const desired = Math.atan2(p.y - s.y, p.x - s.x);
    const target = avoidIslands(s, desired, this.config.arena.islands, 130, d);
    steerToward(s, target, spec.turnSpeed, dt);
    // Slow down when pointing away from the target so it can turn around.
    const align = Math.cos(angleDiff(desired, s.heading));
    approachSpeed(s, spec.speed * clamp(0.35 + align, 0.35, 1), spec.acceleration, dt);
    s.x += Math.cos(s.heading) * s.speed * dt;
    s.y += Math.sin(s.heading) * s.speed * dt;
  }

  private updateShooter(s: Ship, dt: number): void {
    const spec = this.config.shooter;
    const p = this.player;
    const d = dist(s.x, s.y, p.x, p.y);
    const desired = Math.atan2(p.y - s.y, p.x - s.x);
    const approaching = d > spec.preferredRange;
    const target = approaching ? avoidIslands(s, desired, this.config.arena.islands, 130, d) : desired;
    steerToward(s, target, spec.turnSpeed, dt);
    approachSpeed(s, approaching ? spec.speed : 0, spec.acceleration, dt);
    s.x += Math.cos(s.heading) * s.speed * dt;
    s.y += Math.sin(s.heading) * s.speed * dt;

    s.cdFront = Math.max(0, s.cdFront - dt);
    const aimed = Math.abs(angleDiff(desired, s.heading)) <= spec.aimTolerance;
    if (d <= spec.attackRange && aimed && s.cdFront === 0) {
      s.cdFront = spec.weapon.cooldownSec;
      const off = s.radius + 6;
      const x = s.x + Math.cos(s.heading) * off;
      const y = s.y + Math.sin(s.heading) * off;
      this.spawnProjectile('enemy', x, y, s.heading, spec.weapon.projectile);
      this.events.push({ type: 'shot', x, y, heading: s.heading, owner: 'enemy', weapon: 'front' });
    }
  }

  // -------------------------------------------------------------- projectiles

  private updateProjectiles(dt: number): void {
    const { width, height } = this.config.arena;
    for (const b of this.projectiles) {
      if (!b.alive) continue;
      const dx = b.vx * dt;
      const dy = b.vy * dt;
      b.x += dx;
      b.y += dy;
      b.traveled += Math.hypot(dx, dy);
      if (b.traveled >= b.range) b.alive = false;
      else if (b.x < -b.radius || b.y < -b.radius || b.x > width + b.radius || b.y > height + b.radius) b.alive = false;
    }
  }

  // --------------------------------------------------------------- collisions

  private resolveShipCollisions(): void {
    const list = this.ships.filter((s) => s.alive);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        // A chaser touching the player explodes instead of being pushed (see resolveChaserContact).
        if ((a.kind === 'chaser' && b.kind === 'player') || (a.kind === 'player' && b.kind === 'chaser')) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.0001;
        const overlap = a.radius + b.radius - d;
        if (overlap <= 0) continue;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= (nx * overlap) / 2;
        a.y -= (ny * overlap) / 2;
        b.x += (nx * overlap) / 2;
        b.y += (ny * overlap) / 2;
      }
    }
  }

  /** Keeps ships inside the arena and outside islands (push-out along the contact normal). */
  private resolveWorldCollisions(): void {
    const { width, height, islands } = this.config.arena;
    for (const s of this.ships) {
      if (!s.alive) continue;
      for (const isl of islands) {
        const dx = s.x - isl.x;
        const dy = s.y - isl.y;
        const d = Math.hypot(dx, dy) || 0.0001;
        const min = isl.radius + s.radius;
        if (d < min) {
          s.x = isl.x + (dx / d) * min;
          s.y = isl.y + (dy / d) * min;
          // Slide along the island: remove the speed component into it by damping.
          s.speed *= 0.97;
        }
      }
      s.x = clamp(s.x, s.radius, width - s.radius);
      s.y = clamp(s.y, s.radius, height - s.radius);
    }
  }

  private resolveProjectileHits(): void {
    const { islands } = this.config.arena;
    for (const b of this.projectiles) {
      if (!b.alive) continue;
      let blocked = false;
      for (const isl of islands) {
        if (dist(b.x, b.y, isl.x, isl.y) <= isl.radius + b.radius) {
          this.events.push({ type: 'hit', x: b.x, y: b.y, target: 'island' });
          blocked = true;
          break;
        }
      }
      if (blocked) {
        b.alive = false;
        continue;
      }
      for (const s of this.ships) {
        if (!s.alive) continue;
        const friendly = (b.owner === 'player') === (s.kind === 'player');
        if (friendly) continue;
        if (dist(b.x, b.y, s.x, s.y) <= s.radius + b.radius) {
          b.alive = false; // a projectile damages exactly once
          this.damage(s, b.damage, b.owner === 'player');
          this.events.push({ type: 'hit', x: b.x, y: b.y, target: s.kind });
          break;
        }
      }
    }
  }

  private resolveChaserContact(): void {
    const p = this.player;
    for (const s of this.ships) {
      if (!s.alive || s.kind !== 'chaser' || !p.alive) continue;
      if (dist(s.x, s.y, p.x, p.y) <= s.radius + p.radius) {
        this.damage(p, this.config.chaser.contactDamage, false);
        s.health = 0;
        s.alive = false; // self-destruct: no score
        this.events.push({ type: 'explosion', x: s.x, y: s.y, kind: 'chaser' });
      }
    }
  }

  private damage(target: Ship, amount: number, byPlayer: boolean): void {
    if (!target.alive) return;
    target.health = Math.max(0, target.health - amount);
    target.hitFlash = this.config.effects.hitFlashSec;
    if (target.kind === 'player') this.events.push({ type: 'playerDamaged' });
    if (target.health <= 0) {
      target.alive = false;
      this.events.push({ type: 'explosion', x: target.x, y: target.y, kind: target.kind });
      if (target.kind !== 'player' && byPlayer) this.score += 1;
    }
  }

  /** Dead enemies and spent projectiles leave the simulation. */
  private cleanup(): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) if (!this.projectiles[i]!.alive) this.projectiles.splice(i, 1);
    for (let i = this.ships.length - 1; i >= 0; i--) {
      const s = this.ships[i]!;
      if (!s.alive && s.kind !== 'player') this.ships.splice(i, 1);
    }
  }
}
