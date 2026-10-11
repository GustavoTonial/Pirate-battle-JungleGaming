export type ShipKind = 'player' | 'chaser' | 'shooter';
export type EndReason = 'time' | 'death';
export type MatchStatus = 'ready' | 'running' | 'paused' | 'ended';
export type Owner = 'player' | 'enemy';

export interface Ship {
  id: number;
  kind: ShipKind;
  x: number;
  y: number;
  /** Radians, 0 = +x (east), increasing clockwise on screen. */
  heading: number;
  speed: number;
  health: number;
  maxHealth: number;
  radius: number;
  alive: boolean;
  /** Seconds remaining until each weapon can fire again. */
  cdFront: number;
  cdLeft: number;
  cdRight: number;
  /** Seconds of damage flash remaining (visual only). */
  hitFlash: number;
}

export interface Projectile {
  id: number;
  owner: Owner;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  traveled: number;
  range: number;
  alive: boolean;
}

export type SimEvent =
  | { type: 'shot'; x: number; y: number; heading: number; owner: Owner; weapon: 'front' | 'side' }
  | { type: 'hit'; x: number; y: number; target: ShipKind | 'island' }
  | { type: 'explosion'; x: number; y: number; kind: ShipKind }
  | { type: 'playerDamaged' }
  | { type: 'ended'; reason: EndReason };

/** Held-state of the player's controls (merged from keyboard and touch). */
export interface InputState {
  forward: boolean;
  left: boolean;
  right: boolean;
  fireFront: boolean;
  fireLeft: boolean;
  fireRight: boolean;
}

export type InputAction = keyof InputState;

export interface MatchResult {
  matchId: string;
  score: number;
  /** Effective active gameplay time. */
  durationMs: number;
  endReason: EndReason;
  config: { sessionTimeSec: number; enemySpawnTimeSec: number };
  endedAt: string;
}

export interface HudSnapshot {
  status: MatchStatus;
  score: number;
  health: number;
  maxHealth: number;
  /** Whole seconds remaining (ceil). */
  timeLeftSec: number;
}
