import type { IslandSpec } from '@/config/gameConfig';
import { TAU, angleDiff, clamp, normalizeAngle } from './math';
import type { Ship } from './types';

/** Rotates `ship.heading` toward `target`, limited by `turnSpeed * dt`. */
export function steerToward(ship: Ship, target: number, turnSpeed: number, dt: number): void {
  const maxTurn = turnSpeed * dt;
  ship.heading = normalizeAngle(ship.heading + clamp(angleDiff(target, ship.heading), -maxTurn, maxTurn));
}

/** Moves `speed` toward `target` with a bounded acceleration. */
export function approachSpeed(ship: Ship, target: number, accel: number, dt: number): void {
  const d = target - ship.speed;
  ship.speed += clamp(d, -accel * dt, accel * dt);
}

/**
 * Whisker-style island avoidance. If the straight path toward `desired` intersects an
 * (inflated) island within `lookahead`, bend the heading away from the island's center,
 * more strongly the closer the threat is. `maxDist` limits the check to the distance to
 * the actual target so islands *behind* the target are ignored.
 */
export function avoidIslands(
  ship: Ship,
  desired: number,
  islands: readonly IslandSpec[],
  lookahead: number,
  maxDist: number,
): number {
  const dx = Math.cos(desired);
  const dy = Math.sin(desired);
  let bestUrgency = 0;
  let bestSign = 0;
  for (const isl of islands) {
    const rx = isl.x - ship.x;
    const ry = isl.y - ship.y;
    const along = rx * dx + ry * dy;
    if (along < 0 || along > Math.min(lookahead + isl.radius, maxDist + isl.radius)) continue;
    const cross = rx * dy - ry * dx;
    const clearance = isl.radius + ship.radius + 16;
    if (Math.abs(cross) >= clearance) continue;
    const urgency = 1 - clamp((along - isl.radius) / lookahead, 0, 1) * 0.8;
    if (urgency > bestUrgency) {
      bestUrgency = urgency;
      bestSign = Math.abs(cross) < 1 ? (ship.id % 2 === 0 ? 1 : -1) : Math.sign(cross);
    }
  }
  if (bestUrgency === 0) return desired;
  return normalizeAngle(desired + bestSign * bestUrgency * (TAU / 4) * 0.95);
}
