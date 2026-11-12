import type { Sentence, Word } from '../data/parse';
import type { ExerciseType } from './gamification';
import type { PickKind } from './queue';
import { normalize, shuffle, stripStress, tokenize } from './text';

export interface Option {
  key: string;
  text: string;
  correct: boolean;
}

interface Base {
  uid: string;
  kind: PickKind;
  word: Word;
}

export type Exercise = Base &
  (
    | { type: 'intro' }
    | { type: 'mcq'; dir: 'ru-he' | 'he-ru'; options: Option[] }
    | { type: 'listen'; unit: 'word' | 'sentence'; audio: string; options: Option[] }
    | { type: 'build'; sentence: Sentence; tiles: string[]; answer: string[] }
    | { type: 'speak'; text: string; he: string }
    | { type: 'flash' }
  );

export interface ExerciseEnv {
  quiet: boolean;
  /** Words to draw wrong answers from (already met, or close in rank). */
  pool: Word[];
  /** Normalized tokens that keep their capital letter (names, Я). */
  proper: Set<string>;
  rnd?: () => number;
}

let counter = 0;

function hasBuildableSentence(w: Word): boolean {
  return !!w.sentence && tokenize(w.sentence.ru).length >= 3;
}

/** Exercise type for a word that has climbed `stage` steps of the ladder. */
export function chooseType(stage: number, word: Word, quiet: boolean): { type: ExerciseType; variant?: string } {
  const buildable = hasBuildableSentence(word);
  const speak = quiet ? 'flash' : 'speak';
  if (stage <= 0) return { type: 'intro' };
  if (stage === 1) return { type: 'mcq', variant: 'ru-he' };
  if (stage === 2) return { type: 'mcq', variant: 'he-ru' };
  if (stage === 3) return quiet ? { type: 'mcq', variant: 'ru-he' } : { type: 'listen', variant: 'word' };
  if (stage === 4) return { type: buildable ? 'build' : 'flash' };
  if (stage === 5) return { type: speak };
  const cycle: { type: ExerciseType; variant?: string }[] = [
    { type: 'flash' },
    { type: buildable ? 'build' : 'flash' },
    quiet ? { type: 'flash' } : { type: 'listen', variant: 'sentence' },
    { type: speak },
    { type: 'mcq', variant: 'he-ru' },
  ];
  return cycle[(stage - 6) % cycle.length];
}

function posClass(w: Word): string {
  return w.pos[0] ?? 'x';
}

export function pickDistractors(word: Word, pool: Word[], n: number, rnd: () => number): Word[] {
  const seenHe = new Set([word.he]);
  const seenRu = new Set([word.id]);
  const out: Word[] = [];
  const take = (cands: Word[]) => {
    for (const c of shuffle(cands, rnd)) {
      if (out.length >= n) return;
      if (seenHe.has(c.he) || seenRu.has(c.id)) continue;
      seenHe.add(c.he);
      seenRu.add(c.id);
      out.push(c);
    }
  };
  take(pool.filter((w) => posClass(w) === posClass(word)));
  take(pool);
  return out;
}

function wordOptions(word: Word, dir: 'ru-he' | 'he-ru', env: ExerciseEnv, rnd: () => number): Option[] {
  const text = (w: Word) => (dir === 'ru-he' ? w.he : w.ru);
  const wrong = pickDistractors(word, env.pool, 3, rnd).map((w) => ({ key: w.id, text: text(w), correct: false }));
  return shuffle([{ key: word.id, text: text(word), correct: true }, ...wrong], rnd);
}

function sentenceOptions(word: Word, env: ExerciseEnv, rnd: () => number): Option[] | null {
  const others = shuffle(
    env.pool.filter((w) => w.id !== word.id && w.sentence && w.sentence.he !== word.sentence!.he),
    rnd,
  ).slice(0, 2);
  if (others.length < 2) return null;
  return shuffle(
    [
      { key: word.id, text: word.sentence!.he, correct: true },
      ...others.map((w) => ({ key: w.id, text: w.sentence!.he, correct: false })),
    ],
    rnd,
  );
}

function tileText(token: string, index: number, proper: Set<string>): string {
  if (index > 0) return token;
  return proper.has(normalize(token)) ? token : token.toLowerCase();
}

function buildTiles(word: Word, env: ExerciseEnv, rnd: () => number): { tiles: string[]; answer: string[] } {
  const answer = tokenize(word.sentence!.ru).map((t, i) => tileText(t, i, env.proper));
  const used = new Set(answer.map(normalize));
  const extras: string[] = [];
  for (const w of shuffle(env.pool, rnd)) {
    if (extras.length >= 2) break;
    const cand = stripStress(w.ru).includes(' ') ? null : w.ru;
    if (!cand || used.has(normalize(cand))) continue;
    used.add(normalize(cand));
    extras.push(cand);
  }
  return { tiles: shuffle([...answer, ...extras], rnd), answer };
}

export function makeExercise(word: Word, stage: number, kind: PickKind, env: ExerciseEnv): Exercise {
  const rnd = env.rnd ?? Math.random;
  const base: Base = { uid: `${word.id}#${++counter}`, kind, word };
  // Free practice is not tied to the ladder: any of the harder exercise types, for variety.
  const choice = chooseType(kind === 'extra' ? 6 + Math.floor(rnd() * 5) : stage, word, env.quiet);

  switch (choice.type) {
    case 'intro':
      return { ...base, type: 'intro' };
    case 'mcq': {
      const dir = choice.variant as 'ru-he' | 'he-ru';
      return { ...base, type: 'mcq', dir, options: wordOptions(word, dir, env, rnd) };
    }
    case 'listen': {
      if (choice.variant === 'sentence' && word.sentence) {
        const options = sentenceOptions(word, env, rnd);
        if (options) return { ...base, type: 'listen', unit: 'sentence', audio: word.sentence.ru, options };
      }
      return { ...base, type: 'listen', unit: 'word', audio: word.ru, options: wordOptions(word, 'ru-he', env, rnd) };
    }
    case 'build':
      return { ...base, type: 'build', sentence: word.sentence!, ...buildTiles(word, env, rnd) };
    case 'speak': {
      const s = word.sentence;
      const useSentence = !!s && tokenize(s.ru).length <= 7;
      return { ...base, type: 'speak', text: useSentence ? s!.ru : word.ru, he: useSentence ? s!.he : word.he };
    }
    default:
      return { ...base, type: 'flash' };
  }
}

/** Replacement when the learner skips a speaking exercise. */
export function flashFor(ex: Exercise): Exercise {
  return { uid: `${ex.word.id}#${++counter}`, kind: ex.kind, word: ex.word, type: 'flash' };
}

export type BuildVerdict = 'correct' | 'order' | 'wrong';

/** Exact match is correct; the right words in another order is accepted as "order". */
export function checkBuild(chosen: string[], answer: string[]): BuildVerdict {
  const a = chosen.map(normalize);
  const b = answer.map(normalize);
  if (a.join(' ') === b.join(' ')) return 'correct';
  if (a.length === b.length && a.slice().sort().join(' ') === b.slice().sort().join(' ')) return 'order';
  return 'wrong';
}

/** Capitalized tokens that are not sentence-initial, i.e. real proper nouns. */
export function collectProper(words: Word[]): Set<string> {
  const proper = new Set<string>(['я']);
  for (const w of words) {
    const lemma = stripStress(w.ru);
    if (lemma[0] !== lemma[0].toLowerCase() && !lemma.includes(' ')) proper.add(normalize(lemma));
    if (!w.sentence) continue;
    const parts = w.sentence.ru.split(/(?<=[.!?…])\s+/);
    for (const part of parts) {
      tokenize(part)
        .slice(1)
        .forEach((t) => {
          const plain = stripStress(t);
          if (plain[0] !== plain[0].toLowerCase()) proper.add(normalize(plain));
        });
    }
  }
  return proper;
}
