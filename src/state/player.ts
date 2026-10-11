import { newId, readJson, STORAGE_KEYS, writeJson } from './storage';

export interface PlayerIdentity {
  id: string;
  name: string;
}

let cached: PlayerIdentity | null = null;

/** The local player's stable identity (generated once, kept in localStorage). */
export function getPlayer(): PlayerIdentity {
  if (cached) return cached;
  const stored = readJson<PlayerIdentity | null>(STORAGE_KEYS.player, null);
  if (stored?.id) {
    cached = stored;
    return stored;
  }
  cached = { id: `player-${newId()}`, name: 'You' };
  writeJson(STORAGE_KEYS.player, cached);
  return cached;
}
