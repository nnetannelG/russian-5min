import { describe, expect, it } from 'vitest';
import { parseWords } from '../data/parse';
import { chooseType, collectProper, makeExercise, pickDistractors, type ExerciseEnv } from './exercises';
import { normalize, tokenize } from './text';

const words = parseWords(
  [
    'ма́ма|אמא|mom|nf|Ма́ма до́ма?|אמא בבית?|Is mom home?',
    'па́па|אבא|dad|nm|Па́па на рабо́те сего́дня.|אבא בעבודה היום.|Dad is at work today.',
    'брат|אח|brother|nm|Э́то мой брат Са́ша.|זה אחי סשה.|This is my brother Sasha.',
    'сестра́|אחות|sister|nf|У меня́ есть сестра́.|יש לי אחות.|I have a sister.',
    'знать|לדעת|to know|v|Я не зна́ю Са́шу.|אני לא מכיר את סשה.|I do not know Sasha.',
    'ду́мать|לחשוב|to think|v|Я ду́маю, что да.|אני חושב שכן.|I think so.',
    'до́ма|בבית|at home|d|Ты до́ма?|אתה בבית?|Are you home?',
    'дом|בית|house|nm|Э́то наш но́вый дом.|זה הבית החדש שלנו.|This is our new house.',
  ].join('\n'),
);
const env: ExerciseEnv = { quiet: false, pool: words, proper: collectProper(words) };
const papa = words[1];

describe('chooseType', () => {
  it('climbs the ladder', () => {
    expect(chooseType(0, papa, false).type).toBe('intro');
    expect(chooseType(1, papa, false)).toEqual({ type: 'mcq', variant: 'ru-he' });
    expect(chooseType(2, papa, false)).toEqual({ type: 'mcq', variant: 'he-ru' });
    expect(chooseType(3, papa, false).type).toBe('listen');
    expect(chooseType(4, papa, false).type).toBe('build');
    expect(chooseType(5, papa, false).type).toBe('speak');
  });
  it('never asks to listen or speak in quiet mode', () => {
    for (let stage = 0; stage < 30; stage++) {
      expect(['listen', 'speak']).not.toContain(chooseType(stage, papa, true).type);
    }
  });
  it('skips sentence building for short or missing sentences', () => {
    expect(chooseType(4, words[0], false).type).toBe('flash');
    expect(chooseType(4, { ...papa, sentence: undefined }, false).type).toBe('flash');
  });
});

describe('makeExercise', () => {
  it('multiple choice has exactly one correct, all distinct options', () => {
    for (const dir of [1, 2]) {
      for (let i = 0; i < 20; i++) {
        const ex = makeExercise(papa, dir, 'review', env);
        if (ex.type !== 'mcq') throw new Error('expected mcq');
        expect(ex.options).toHaveLength(4);
        expect(ex.options.filter((o) => o.correct)).toHaveLength(1);
        expect(new Set(ex.options.map((o) => o.text)).size).toBe(4);
        expect(ex.options.find((o) => o.correct)!.text).toBe(dir === 1 ? 'אבא' : 'па́па');
      }
    }
  });
  it('prefers distractors of the same part of speech', () => {
    const d = pickDistractors(papa, words, 2, Math.random);
    expect(d.every((w) => w.pos.startsWith('n'))).toBe(true);
  });
  it('sentence tiles contain the answer plus two extras', () => {
    const ex = makeExercise(papa, 4, 'review', env);
    if (ex.type !== 'build') throw new Error('expected build');
    expect(ex.answer.map(normalize)).toEqual(tokenize(papa.sentence!.ru).map(normalize));
    expect(ex.tiles).toHaveLength(ex.answer.length + 2);
    for (const t of ex.answer) expect(ex.tiles).toContain(t);
  });
  it('lowercases the first tile unless it is a name or Я', () => {
    const first = (i: number) => {
      const ex = makeExercise(words[i], 4, 'review', env);
      if (ex.type !== 'build') throw new Error('expected build');
      return ex.answer[0];
    };
    expect(first(1)).toBe('па́па');
    expect(first(4)).toBe('Я');
    expect(env.proper.has('саша')).toBe(true);
  });
  it('listening to a sentence offers three translations', () => {
    const ex = makeExercise(papa, 8, 'review', env);
    if (ex.type !== 'listen') throw new Error('expected listen');
    expect(ex.unit).toBe('sentence');
    expect(ex.options).toHaveLength(3);
    expect(ex.options.filter((o) => o.correct)).toHaveLength(1);
  });
  it('free practice varies the exercise type', () => {
    const types = new Set<string>();
    for (let i = 0; i < 60; i++) types.add(makeExercise(papa, 3, 'extra', env).type);
    expect(types.size).toBeGreaterThanOrEqual(4);
    expect(types.has('intro')).toBe(false);
  });
  it('speaks the sentence when it is short enough', () => {
    const ex = makeExercise(papa, 5, 'review', env);
    if (ex.type !== 'speak') throw new Error('expected speak');
    expect(ex.text).toBe(papa.sentence!.ru);
  });
});
