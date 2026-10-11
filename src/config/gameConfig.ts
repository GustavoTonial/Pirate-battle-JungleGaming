/**
 * Central, typed gameplay configuration.
 * Balance changes happen here; systems read values from the config snapshot they receive.
 * Units: pixels (world space), seconds, radians.
 */

export interface UserOptions {
  /** Active gameplay time of a match, in seconds. */
  sessionTimeSec: number;
  /** Interval between enemy spawns, in seconds. */
  enemySpawnTimeSec: number;
}

/** Documented limits enforced by the Options screen and by `validateOptions`. */
export const OPTION_LIMITS = {
  sessionTimeSec: { min: 60, max: 180, step: 1 },
  enemySpawnTimeSec: { min: 0.5, max: 10, step: 0.5 },
} as const;

export const DEFAULT_OPTIONS: UserOptions = { sessionTimeSec: 90, enemySpawnTimeSec: 2.5 };

export interface ProjectileSpec {
  damage: number;
  speed: number;
  /** Max travel distance before the projectile expires. */
  range: number;
  radius: number;
}

export interface WeaponSpec {
  cooldownSec: number;
  projectile: ProjectileSpec;
}

export interface IslandSpec {
  id: string;
  sprite: 'grass' | 'sand' | 'rock-a' | 'rock-b' | 'rock-c';
  x: number;
  y: number;
  /** Collision circle radius (islands block ships and projectiles). */
  radius: number;
}

export interface ShipSpec {
  maxHealth: number;
  /** Max forward speed. */
  speed: number;
  /** Speed change per second. */
  acceleration: number;
  /** Max rotation speed (rad/s). */
  turnSpeed: number;
  radius: number;
}

export interface GameConfig {
  session: { durationSec: number };
  arena: { width: number; height: number; islands: IslandSpec[] };
  player: ShipSpec & {
    start: { x: number; y: number; heading: number };
    front: WeaponSpec;
    side: WeaponSpec & { projectileCount: number; spacing: number };
  };
  spawn: {
    intervalSec: number;
    /** Relative probability of each enemy type (after the guaranteed opening pair). */
    weights: { chaser: number; shooter: number };
    minDistanceFromPlayer: number;
    edgeMargin: number;
    maxAlive: number;
  };
  chaser: ShipSpec & { contactDamage: number };
  shooter: ShipSpec & {
    /** Starts shooting when the player is within this distance. */
    attackRange: number;
    /** Stops approaching at this distance. */
    preferredRange: number;
    /** Max angle error (rad) between heading and target to fire. */
    aimTolerance: number;
    weapon: WeaponSpec;
  };
  effects: { hitFlashSec: number; shakeSec: number; shakePx: number };
}

export const BASE_GAME_CONFIG: GameConfig = {
  session: { durationSec: DEFAULT_OPTIONS.sessionTimeSec },
  arena: {
    width: 1280,
    height: 720,
    islands: [
      { id: 'grass', sprite: 'grass', x: 400, y: 380, radius: 108 },
      { id: 'sand', sprite: 'sand', x: 930, y: 200, radius: 84 },
      { id: 'rock-a', sprite: 'rock-a', x: 700, y: 585, radius: 22 },
      { id: 'rock-b', sprite: 'rock-b', x: 1130, y: 500, radius: 26 },
      { id: 'rock-c', sprite: 'rock-c', x: 640, y: 130, radius: 20 },
    ],
  },
  player: {
    maxHealth: 10,
    speed: 190,
    acceleration: 240,
    turnSpeed: 2.3,
    radius: 20,
    start: { x: 760, y: 380, heading: 0 },
    front: { cooldownSec: 0.35, projectile: { damage: 1, speed: 560, range: 520, radius: 5 } },
    side: {
      cooldownSec: 1.1,
      projectileCount: 3,
      spacing: 16,
      projectile: { damage: 1, speed: 460, range: 340, radius: 5 },
    },
  },
  spawn: {
    intervalSec: DEFAULT_OPTIONS.enemySpawnTimeSec,
    weights: { chaser: 0.5, shooter: 0.5 },
    minDistanceFromPlayer: 380,
    edgeMargin: 40,
    maxAlive: 10,
  },
  chaser: { maxHealth: 2, speed: 150, acceleration: 200, turnSpeed: 1.9, radius: 18, contactDamage: 3 },
  shooter: {
    maxHealth: 3,
    speed: 105,
    acceleration: 160,
    turnSpeed: 1.6,
    radius: 20,
    attackRange: 360,
    preferredRange: 260,
    aimTolerance: 0.2,
    weapon: { cooldownSec: 1.6, projectile: { damage: 1, speed: 330, range: 440, radius: 5 } },
  },
  effects: { hitFlashSec: 0.14, shakeSec: 0.2, shakePx: 5 },
};

export type OptionsErrors = Partial<Record<keyof UserOptions, string>>;

export function validateOptions(input: Partial<Record<keyof UserOptions, unknown>>): OptionsErrors {
  const errors: OptionsErrors = {};
  const s = Number(input.sessionTimeSec);
  const e = Number(input.enemySpawnTimeSec);
  const L = OPTION_LIMITS;
  if (input.sessionTimeSec === '' || !Number.isFinite(s) || !Number.isInteger(s)) {
    errors.sessionTimeSec = 'Enter a whole number of seconds.';
  } else if (s < L.sessionTimeSec.min || s > L.sessionTimeSec.max) {
    errors.sessionTimeSec = `Must be between ${L.sessionTimeSec.min} and ${L.sessionTimeSec.max} seconds.`;
  }
  if (input.enemySpawnTimeSec === '' || !Number.isFinite(e)) {
    errors.enemySpawnTimeSec = 'Enter a number of seconds.';
  } else if (e <= 0) {
    errors.enemySpawnTimeSec = 'Must be greater than zero.';
  } else if (e < L.enemySpawnTimeSec.min || e > L.enemySpawnTimeSec.max) {
    errors.enemySpawnTimeSec = `Must be between ${L.enemySpawnTimeSec.min} and ${L.enemySpawnTimeSec.max} seconds.`;
  }
  return errors;
}

/** Builds the immutable snapshot used by one match. Later option changes never affect it. */
export function buildGameConfig(options: UserOptions): GameConfig {
  const snapshot = structuredClone(BASE_GAME_CONFIG);
  snapshot.session.durationSec = options.sessionTimeSec;
  snapshot.spawn.intervalSec = options.enemySpawnTimeSec;
  return deepFreeze(snapshot);
}

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === 'object') {
    Object.values(obj as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(obj);
  }
  return obj;
}
