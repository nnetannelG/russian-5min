import { describe, expect, it } from 'vitest';
import { LIMITS, pickNext, type QueueCtx } from './queue';
import { introduce, Rating, review, type CardState } from './srs';

const T0 = Date.UTC(2026, 0, 1, 10);
const DAY = 86_400_000;

function ctx(over: Partial<QueueCtx>): QueueCtx {
  return { now: T0, cards: {}, nextNewId: 'new', recent: [], sinceNew: Infinity, accuracy: 1, newToday: 0, ...over };
}

/** A word that graduated to long-term review `daysAgo` days before T0. */
function graduated(daysAgo: number): CardState {
  const start = T0 - daysAgo * DAY;
  let c = introduce(start);
  c = review(c, Rating.Good, c.due);
  return review(c, Rating.Good, c.due);
}

describe('pickNext', () => {
  it('introduces a word when nothing exists yet', () => {
    expect(pickNext(ctx({}))).toEqual({ kind: 'new', id: 'new' });
  });

  it('returns null when there is nothing at all', () => {
    expect(pickNext(ctx({ nextNewId: undefined }))).toBeNull();
  });

  it('puts a due learning step before reviews and new words', () => {
    const cards = { learn: introduce(T0 - 120_000), rev: graduated(30) };
    expect(pickNext(ctx({ cards }))).toEqual({ kind: 'learn', id: 'learn' });
  });

  it('shows due reviews before new words, but lets a new word in every few exercises', () => {
    const cards = { a: graduated(30), b: graduated(31) };
    expect(pickNext(ctx({ cards, sinceNew: 1 }))?.kind).toBe('review');
    expect(pickNext(ctx({ cards, sinceNew: LIMITS.newEvery }))).toEqual({ kind: 'new', id: 'new' });
  });

  it('does not repeat the word that was just shown', () => {
    const cards = { a: graduated(30), b: graduated(31) };
    const first = pickNext(ctx({ cards, sinceNew: 0 }))!;
    const second = pickNext(ctx({ cards, sinceNew: 1, recent: [first.id] }))!;
    expect(second.id).not.toBe(first.id);
  });

  it('holds back new words when accuracy drops', () => {
    const cards = { a: introduce(T0 - 10_000) };
    expect(pickNext(ctx({ cards, accuracy: 0.6, recent: [] }))).toEqual({ kind: 'ahead', id: 'a' });
  });

  it('holds back new words when the review backlog is large', () => {
    const cards: Record<string, CardState> = {};
    for (let i = 0; i < LIMITS.reviewBacklog; i++) cards[`r${i}`] = graduated(30 + i);
    expect(pickNext(ctx({ cards, sinceNew: 99 }))?.kind).toBe('review');
  });

  it('holds back new words when too many are still being learned', () => {
    const cards: Record<string, CardState> = {};
    for (let i = 0; i < LIMITS.maxLearning; i++) cards[`l${i}`] = introduce(T0 - 1000 * i);
    const p = pickNext(ctx({ cards, recent: ['l0'] }))!;
    expect(p.kind).toBe('ahead');
    expect(p.id).not.toBe('l0');
  });

  it('respects the daily cap by practising weak words instead', () => {
    const cards = { a: graduated(0.01), b: graduated(0.02) };
    const p = pickNext(ctx({ cards, newToday: LIMITS.newPerDay }))!;
    expect(p.kind).toBe('extra');
  });

  it('still offers a new word past the cap if there is nothing else to do', () => {
    expect(pickNext(ctx({ newToday: LIMITS.newPerDay }))).toEqual({ kind: 'new', id: 'new' });
  });

  it('runs a first session: every word is introduced, quizzed twice and graduates', () => {
    const cards: Record<string, CardState> = {};
    const ids = Array.from({ length: 8 }, (_, i) => `w${i}`);
    const recent: string[] = [];
    let sinceNew = Infinity;
    let now = T0;
    const quizzes: Record<string, number> = {};
    for (let step = 0; step < 40; step++) {
      const nextNewId = ids.find((id) => !cards[id]);
      const p = pickNext({ now, cards, nextNewId, recent, sinceNew, accuracy: 1, newToday: 0 }, () => 0)!;
      expect(p.id).not.toBe(recent[recent.length - 1]);
      if (p.kind === 'new') {
        cards[p.id] = introduce(now);
        sinceNew = 0;
      } else {
        if (p.kind !== 'extra') {
          cards[p.id] = review(cards[p.id], Rating.Good, now);
          quizzes[p.id] = (quizzes[p.id] ?? 0) + 1;
        }
        sinceNew++;
      }
      recent.push(p.id);
      now += 12_000;
    }
    expect(Object.keys(cards)).toHaveLength(8);
    for (const id of ids) expect(quizzes[id]).toBe(2);
  });
});
