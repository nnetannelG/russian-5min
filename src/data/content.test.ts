import { describe, expect, it, vi } from 'vitest';
import { countVowels, STRESS, tokenize } from '../lib/text';
import { DIALOGUES, TIPS, TIP_BY_ID, WORDS } from './index';

vi.mock('idb-keyval', () => ({ get: vi.fn(), set: vi.fn() }));

const POS = new Set(['nm', 'nf', 'nn', 'np', 'v', 'a', 'd', 'p', 'r', 'c', 'm', 'x']);
const CYR = /[а-яё]/i;
const HEB = /[א-ת]/;

/** Every Russian word of two or more syllables must show where the stress falls. */
function stressProblems(text: string): string[] {
  const bad: string[] = [];
  let prev = '';
  for (const token of tokenize(text)) {
    // In "не́ было", "не́ за что" the stress moves onto не and the next word has none.
    const afterStressedNe = prev.toLowerCase() === 'не́';
    prev = token;
    if (afterStressedNe) continue;
    for (const part of token.split('-')) {
      // Unstressed suffixes: что́-нибудь, кто́-либо, всё-таки.
      if (!CYR.test(part) || ['нибудь', 'либо', 'таки'].includes(part)) continue;
      const marks = part.split(STRESS).length - 1;
      const hasYo = /ё/i.test(part);
      if (marks > 1) bad.push(part);
      else if (countVowels(part) >= 2 && marks === 0 && !hasYo) bad.push(part);
      else if (marks === 1 && !/[аеиоуыэюя]́/i.test(part)) bad.push(part);
    }
  }
  return bad;
}

describe('words', () => {
  it('ids are unique', () => {
    const seen = new Map<string, number>();
    const dupes: string[] = [];
    for (const w of WORDS) {
      if (seen.has(w.id)) dupes.push(`${w.id} (#${seen.get(w.id)} and #${w.rank})`);
      seen.set(w.id, w.rank);
    }
    expect(dupes).toEqual([]);
  });

  it('every word is complete', () => {
    const bad: string[] = [];
    for (const w of WORDS) {
      if (!w.ru || !w.he || !w.en) bad.push(`${w.rank} ${w.ru}: missing translation`);
      if (!POS.has(w.pos)) bad.push(`${w.rank} ${w.ru}: bad pos "${w.pos}"`);
      if (!w.sentence?.ru || !w.sentence.he || !w.sentence.en) bad.push(`${w.rank} ${w.ru}: missing sentence`);
      if (w.tip && !TIP_BY_ID.has(w.tip)) bad.push(`${w.rank} ${w.ru}: unknown tip "${w.tip}"`);
      if (CYR.test(w.he) || HEB.test(w.ru) || HEB.test(w.en)) bad.push(`${w.rank} ${w.ru}: mixed scripts`);
      if (w.sentence && (HEB.test(w.sentence.ru) || CYR.test(w.sentence.he) || HEB.test(w.sentence.en))) {
        bad.push(`${w.rank} ${w.ru}: sentence fields swapped`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('stress is marked on every multi-syllable word', () => {
    const bad: string[] = [];
    for (const w of WORDS) {
      for (const p of stressProblems(w.ru)) bad.push(`${w.rank} lemma ${w.ru}: ${p}`);
      for (const p of stressProblems(w.sentence?.ru ?? '')) bad.push(`${w.rank} ${w.ru}: ${p}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('tips', () => {
  it('have unique ids and text', () => {
    expect(new Set(TIPS.map((t) => t.id)).size).toBe(TIPS.length);
    for (const t of TIPS) expect(t.title && t.body).toBeTruthy();
  });
});

describe('dialogues', () => {
  it('are well formed', () => {
    const bad: string[] = [];
    expect(new Set(DIALOGUES.map((d) => d.id)).size).toBe(DIALOGUES.length);
    for (const d of DIALOGUES) {
      if (!Number.isFinite(d.unlockAt)) bad.push(`${d.id}: bad unlockAt`);
      if (d.turns.length < 4) bad.push(`${d.id}: too short`);
      if (!d.turns.some((t) => t.who === 'me')) bad.push(`${d.id}: no turn for the learner`);
      for (const t of d.turns) {
        for (const p of stressProblems(t.ru)) bad.push(`${d.id}: ${p}`);
        if (t.who !== 'me') continue;
        const opts = t.options ?? [];
        if (opts.filter((o) => o.ok).length !== 1) bad.push(`${d.id}: needs exactly one right answer`);
        if (opts.length !== 3) bad.push(`${d.id}: "${t.ru}" needs two wrong options`);
        if (new Set(opts.map((o) => o.ru)).size !== opts.length) bad.push(`${d.id}: duplicate options`);
        for (const o of opts) for (const p of stressProblems(o.ru)) bad.push(`${d.id}: ${p}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
