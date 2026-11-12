import { get, set } from 'idb-keyval';
import { useSyncExternalStore } from 'react';
import { emptyStats, type Stats } from './gamification';
import type { CardState } from './srs';
import { dayKey } from './text';

export interface CustomWord {
  id: string;
  ru: string;
  he: string;
  en: string;
  added: number;
}

export interface Settings {
  sound: boolean;
  haptics: boolean;
  /** Speech rate, 0.6..1.1 */
  rate: number;
  showSwear: boolean;
  quiet: boolean;
  onboarded: boolean;
  gh: { owner: string; repo: string; token: string };
}

export interface BackupInfo {
  lastDay: string | null;
  lastAt: number | null;
  dirty: boolean;
  pending: boolean;
  error: string | null;
}

export interface AppState {
  v: 1;
  cards: Record<string, CardState>;
  custom: CustomWord[];
  /** Personal corrections of Hebrew translations, by word id. */
  overrides: Record<string, string>;
  stats: Stats;
  settings: Settings;
  backup: BackupInfo;
}

const KEY = 'state-v1';

export function initialState(now: number): AppState {
  return {
    v: 1,
    cards: {},
    custom: [],
    overrides: {},
    stats: emptyStats(dayKey(now)),
    settings: {
      sound: true,
      haptics: true,
      rate: 0.9,
      showSwear: true,
      quiet: false,
      onboarded: false,
      gh: { owner: '', repo: '', token: '' },
    },
    backup: { lastDay: null, lastAt: null, dirty: false, pending: false, error: null },
  };
}

/** Fills in fields added by later versions so old saves keep working. */
export function migrate(saved: Partial<AppState> | undefined, now: number): AppState {
  const base = initialState(now);
  if (!saved) return base;
  return {
    ...base,
    ...saved,
    stats: { ...base.stats, ...saved.stats },
    settings: { ...base.settings, ...saved.settings, gh: { ...base.settings.gh, ...saved.settings?.gh } },
    backup: { ...base.backup, ...saved.backup },
  };
}

let state: AppState = initialState(Date.now());
let loaded = false;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function persist() {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  set(KEY, state).catch((e) => console.error('save failed', e));
}

let loading: Promise<void> | null = null;

/** Loads saved progress once; later calls share the same load. */
export function loadState(): Promise<void> {
  return (loading ??= doLoad());
}

async function doLoad(): Promise<void> {
  try {
    state = migrate(await get<AppState>(KEY), Date.now());
  } catch (e) {
    console.error('load failed', e);
  }
  loaded = true;
  navigator.storage?.persist?.().catch(() => {});
  const flush = () => saveTimer && persist();
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
  window.addEventListener('pagehide', flush);
  listeners.forEach((l) => l());
}

export function isLoaded(): boolean {
  return loaded;
}

export function getState(): AppState {
  return state;
}

/** Applies a change and saves it. Learning progress marks the backup as stale. */
export function update(fn: (s: AppState) => AppState, opts: { touchBackup?: boolean } = {}): void {
  const next = fn(state);
  if (next === state) return;
  state = opts.touchBackup === false ? next : { ...next, backup: { ...next.backup, dirty: true } };
  listeners.forEach((l) => l());
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 250);
}

export function replaceState(next: AppState): void {
  state = next;
  listeners.forEach((l) => l());
  persist();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}
