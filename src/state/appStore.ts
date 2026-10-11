import { create } from 'zustand';
import { DEFAULT_OPTIONS, OPTION_LIMITS, validateOptions, type UserOptions } from '@/config/gameConfig';
import type { HudSnapshot, MatchResult } from '@/game/types';
import { readJson, STORAGE_KEYS, writeJson } from './storage';

export type Screen = 'menu' | 'options' | 'loading' | 'match' | 'result';
export type MenuTab = 'ranking' | 'history';

interface AppState {
  screen: Screen;
  menuTab: MenuTab;
  options: UserOptions;
  /** Result of the last completed match (persisted). */
  lastResult: MatchResult | null;
  /** Latest HUD snapshot; written a few times per second at most, never per frame. */
  hud: HudSnapshot | null;
  /** Changes for every new match so the match screen remounts with a fresh session. */
  matchKey: number;
  /** Configuration snapshot for the running match (taken when it starts). */
  activeOptions: UserOptions;
  goto: (screen: Screen) => void;
  setMenuTab: (tab: MenuTab) => void;
  saveOptions: (options: UserOptions) => void;
  beginMatch: () => void;
  setHud: (hud: HudSnapshot | null) => void;
  finishMatch: (result: MatchResult) => void;
}

function loadOptions(): UserOptions {
  const stored = readJson<Partial<UserOptions>>(STORAGE_KEYS.options, {});
  const merged = { ...DEFAULT_OPTIONS, ...stored };
  return Object.keys(validateOptions(merged)).length === 0 ? merged : { ...DEFAULT_OPTIONS };
}

export const useAppStore = create<AppState>((set, get) => ({
  screen: 'menu',
  menuTab: 'ranking',
  options: loadOptions(),
  lastResult: readJson<MatchResult | null>(STORAGE_KEYS.lastResult, null),
  hud: null,
  matchKey: 0,
  activeOptions: loadOptions(),
  goto: (screen) => set({ screen }),
  setMenuTab: (menuTab) => set({ menuTab }),
  saveOptions: (options) => {
    writeJson(STORAGE_KEYS.options, options);
    set({ options });
  },
  /** Starts a new match with a snapshot of the options current *now*. */
  beginMatch: () => set((s) => ({ screen: 'loading', hud: null, matchKey: s.matchKey + 1, activeOptions: { ...s.options } })),
  setHud: (hud) => set({ hud }),
  finishMatch: (result) => {
    writeJson(STORAGE_KEYS.lastResult, result);
    set({ lastResult: result });
  },
}));

export { OPTION_LIMITS };
