import { collectProper } from '../lib/exercises';
import type { AppState, CustomWord } from '../lib/store';
import { parseDialogues, parseTips, parseWords, type Dialogue, type Tip, type Word } from './parse';
import dialoguesRaw from './dialogues.txt?raw';
import tipsRaw from './tips.txt?raw';

const files = import.meta.glob('./words/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

function loadWords(): Word[] {
  const out: Word[] = [];
  for (const name of Object.keys(files).sort()) out.push(...parseWords(files[name], out.length + 1));
  return out;
}

export const WORDS: Word[] = loadWords();
export const TIPS: Tip[] = parseTips(tipsRaw);
export const DIALOGUES: Dialogue[] = parseDialogues(dialoguesRaw);
export const TIP_BY_ID = new Map(TIPS.map((t) => [t.id, t]));
export const PROPER = collectProper(WORDS);
export const TOTAL_WORDS = WORDS.length;

function customToWord(c: CustomWord): Word {
  return { id: c.id, rank: 0, ru: c.ru, he: c.he, en: c.en, pos: 'x', tags: [], custom: true };
}

let cache: { custom: CustomWord[]; overrides: Record<string, string>; words: Word[]; byId: Map<string, Word> } | null =
  null;

/** Built-in words plus the learner's own, with personal translation fixes applied. */
export function allWords(state: Pick<AppState, 'custom' | 'overrides'>): { words: Word[]; byId: Map<string, Word> } {
  if (cache && cache.custom === state.custom && cache.overrides === state.overrides) return cache;
  const builtIn = WORDS.map((w) => (state.overrides[w.id] ? { ...w, he: state.overrides[w.id] } : w));
  const words = [...state.custom.map(customToWord), ...builtIn];
  cache = { custom: state.custom, overrides: state.overrides, words, byId: new Map(words.map((w) => [w.id, w])) };
  return cache;
}

/** Words that may be introduced, in order: own words first, then by frequency. */
export function nextNewWord(state: AppState): Word | undefined {
  const { words } = allWords(state);
  return words.find((w) => !state.cards[w.id] && (state.settings.showSwear || !w.tags.includes('swear')));
}
