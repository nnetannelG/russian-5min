import { describe, expect, it } from 'vitest';
import { introduce, isDue, isLearned, isLearning, markKnown, Rating, review, State, FIRST_QUIZ_DELAY } from './srs';

const T0 = Date.UTC(2026, 0, 1, 10);

describe('srs', () => {
  it('a new word is quizzed a minute later and graduates after two good answers', () => {
    let c = introduce(T0);
    expect(isLearning(c)).toBe(true);
    expect(isDue(c, T0)).toBe(false);
    expect(isDue(c, T0 + FIRST_QUIZ_DELAY)).toBe(true);

    c = review(c, Rating.Good, T0 + 90_000);
    expect(c.state).toBe(State.Learning);
    expect(c.stage).toBe(2);
    expect(isLearned(c)).toBe(false);

    c = review(c, Rating.Good, c.due);
    expect(c.state).toBe(State.Review);
    expect(isLearned(c)).toBe(true);
    expect(c.due - c.last_review!).toBeGreaterThan(20 * 3_600_000);
  });

  it('intervals grow with success and a miss sends the word back', () => {
    let c = introduce(T0);
    c = review(c, Rating.Good, c.due);
    c = review(c, Rating.Good, c.due);
    const first = c.scheduled_days;
    c = review(c, Rating.Good, c.due);
    expect(c.scheduled_days).toBeGreaterThan(first);

    const stage = c.stage;
    c = review(c, Rating.Again, c.due);
    expect(c.state).toBe(State.Relearning);
    expect(c.stage).toBe(stage - 1);
    expect(c.lapses).toBe(1);
    expect(isLearned(c)).toBe(true);
  });

  it('known words start as mature reviews', () => {
    const c = markKnown(T0);
    expect(isLearned(c)).toBe(true);
    expect(isDue(c, T0 + 86_400_000)).toBe(false);
    expect(review(c, Rating.Good, c.due).scheduled_days).toBeGreaterThan(45);
  });
});
