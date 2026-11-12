import { describe, expect, it } from 'vitest';
import { accuracy, applyAnswer, DAILY_GOAL, displayStreak, emptyStats, levelFor, levelProgress, levelStart, xpFor, type Stats } from './gamification';

function doDay(s: Stats, day: string, n = DAILY_GOAL): Stats {
  for (let i = 0; i < n; i++) s = applyAnswer(s, { correct: true, xp: 10, scored: true }, day);
  return s;
}

describe('streak', () => {
  it('starts when the daily goal is reached', () => {
    let s = doDay(emptyStats('2026-03-01'), '2026-03-01', DAILY_GOAL - 1);
    expect(s.streak).toBe(0);
    s = doDay(s, '2026-03-01', 1);
    expect(s.streak).toBe(1);
    s = doDay(s, '2026-03-01', 10);
    expect(s.streak).toBe(1);
  });
  it('grows on consecutive days and resets counters each day', () => {
    let s = doDay(emptyStats('2026-03-01'), '2026-03-01');
    s = { ...s, newToday: 7 };
    s = doDay(s, '2026-03-02');
    expect(s.streak).toBe(2);
    expect(s.todayCount).toBe(DAILY_GOAL);
    expect(s.newToday).toBe(0);
  });
  it('freezes one missed day, then needs a week before the next freeze', () => {
    let s = doDay(emptyStats('2026-03-01'), '2026-03-01');
    expect(displayStreak(s, '2026-03-03')).toEqual({ days: 1, frozen: true });
    s = doDay(s, '2026-03-03');
    expect(s.streak).toBe(2);
    expect(displayStreak(s, '2026-03-05')).toEqual({ days: 0, frozen: false });
    s = doDay(s, '2026-03-05');
    expect(s.streak).toBe(1);
  });
  it('is lost after two missed days', () => {
    let s = doDay(emptyStats('2026-03-01'), '2026-03-01');
    expect(displayStreak(s, '2026-03-04').days).toBe(0);
    s = doDay(s, '2026-03-04');
    expect(s.streak).toBe(1);
  });
});

describe('xp and levels', () => {
  it('rewards harder exercises and combos, not mistakes', () => {
    expect(xpFor('build', true, 0)).toBeGreaterThan(xpFor('mcq', true, 0));
    expect(xpFor('mcq', true, 9)).toBe(xpFor('mcq', true, 5));
    expect(xpFor('mcq', false, 5)).toBe(1);
  });
  it('maps xp to levels', () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(levelStart(4))).toBe(4);
    expect(levelFor(levelStart(4) - 1)).toBe(3);
    const p = levelProgress(levelStart(3) + 20);
    expect(p).toEqual({ level: 3, into: 20, span: levelStart(4) - levelStart(3) });
  });
  it('tracks recent accuracy only for scored answers', () => {
    let s = emptyStats('2026-03-01');
    for (let i = 0; i < 10; i++) s = applyAnswer(s, { correct: i % 2 === 0, xp: 1, scored: true }, '2026-03-01');
    s = applyAnswer(s, { correct: true, xp: 3, scored: false }, '2026-03-01');
    expect(s.recent.length).toBe(10);
    expect(accuracy(s)).toBe(0.5);
  });
});
