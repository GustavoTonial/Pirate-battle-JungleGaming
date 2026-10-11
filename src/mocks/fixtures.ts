import type { MatchConfig, MatchRecord } from '@/api/contracts';
import { createRng } from '@/game/math';
import type { Dataset } from './scenarios';

const NAMES = [
  'Anne Bonny', 'Blackbeard', 'Calico Jack', 'Grace O\u2019Malley', 'Henry Morgan', 'Mary Read', 'Bartholomew',
  'Ching Shih', 'Captain Kidd', 'Stede Bonnet', 'Jean Lafitte', 'Francois Olonnais', 'Sam Bellamy', 'Hornigold',
  'Black Caesar', 'Rachel Wall', 'Edward Low', 'Charles Vane', 'Jack Rackham', 'Salty Pete',
];

const CONFIGS: Array<{ config: MatchConfig; count: Record<Dataset, number> }> = [
  { config: { sessionTimeSec: 90, enemySpawnTimeSec: 2.5 }, count: { default: 45, large: 150 } },
  { config: { sessionTimeSec: 60, enemySpawnTimeSec: 2.5 }, count: { default: 12, large: 12 } },
  { config: { sessionTimeSec: 120, enemySpawnTimeSec: 2.5 }, count: { default: 12, large: 12 } },
  { config: { sessionTimeSec: 90, enemySpawnTimeSec: 1 }, count: { default: 9, large: 9 } },
];

const cache = new Map<Dataset, MatchRecord[]>();

/** Deterministic fixtures for the other players (same output on every run). */
export function getFixtures(dataset: Dataset): MatchRecord[] {
  const hit = cache.get(dataset);
  if (hit) return hit;
  const rng = createRng(20260101);
  const out: MatchRecord[] = [];
  let n = 0;
  for (const { config, count } of CONFIGS) {
    for (let i = 0; i < count[dataset]; i++, n++) {
      const name = NAMES[Math.floor(rng() * NAMES.length)]!;
      const score = Math.floor(rng() * (config.sessionTimeSec / config.enemySpawnTimeSec) * 0.6);
      const died = rng() < 0.4;
      const durationMs = died ? Math.round((20 + rng() * (config.sessionTimeSec - 20)) * 1000) : config.sessionTimeSec * 1000;
      const day = 1 + Math.floor(rng() * 28);
      const minute = Math.floor(rng() * 1440);
      out.push({
        matchId: `fx-match-${String(n).padStart(4, '0')}`,
        playerId: `fx-player-${NAMES.indexOf(name)}`,
        playerName: name,
        playedAt: new Date(Date.UTC(2026, 5, day, 0, minute)).toISOString(),
        score,
        durationMs,
        endReason: died ? 'death' : 'time',
        config,
      });
    }
  }
  cache.set(dataset, out);
  return out;
}
