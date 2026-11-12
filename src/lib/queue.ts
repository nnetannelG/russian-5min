import { isLearning, State, type CardState } from './srs';

export type PickKind = 'learn' | 'review' | 'new' | 'ahead' | 'extra';

export interface Pick {
  kind: PickKind;
  id: string;
}

export interface QueueCtx {
  now: number;
  cards: Record<string, CardState>;
  /** Next word that could be introduced, if any are left. */
  nextNewId: string | undefined;
  /** Ids shown most recently, newest last. */
  recent: string[];
  /** Exercises shown since the last introduction. */
  sinceNew: number;
  /** Share of correct answers over the recent window (0..1). */
  accuracy: number;
  newToday: number;
}

export const LIMITS = {
  maxLearning: 5,
  newPerDay: 20,
  reviewBacklog: 15,
  minAccuracy: 0.7,
  /** A new word may jump ahead of waiting reviews once this many exercises passed. */
  newEvery: 4,
  aheadWindow: 20 * 60_000,
};

/**
 * Chooses what the endless stream shows next. Priority:
 * learning steps that are due, an occasional new word, due reviews, new words,
 * learning steps a little early, then free practice of the weakest words.
 */
export function pickNext(ctx: QueueCtx, rnd: () => number = Math.random): Pick | null {
  const { now, cards, recent, nextNewId } = ctx;
  const shownWithin = (id: string, n: number) => recent.slice(-n).includes(id);
  const entries = Object.entries(cards);

  const learning = entries.filter(([, c]) => isLearning(c)).sort((a, b) => a[1].due - b[1].due);
  const reviewsDue = entries
    .filter(([, c]) => c.state === State.Review && c.due <= now)
    .sort((a, b) => a[1].due - b[1].due);

  const canNew =
    nextNewId !== undefined &&
    learning.length < LIMITS.maxLearning &&
    ctx.accuracy >= LIMITS.minAccuracy &&
    reviewsDue.length < LIMITS.reviewBacklog &&
    ctx.newToday < LIMITS.newPerDay;

  const learnDue = learning.find(([id, c]) => c.due <= now && !shownWithin(id, 2));
  if (learnDue) return { kind: 'learn', id: learnDue[0] };

  if (canNew && ctx.sinceNew >= LIMITS.newEvery) return { kind: 'new', id: nextNewId! };

  const review = reviewsDue.find(([id]) => !shownWithin(id, 2));
  if (review) return { kind: 'review', id: review[0] };

  if (canNew && ctx.sinceNew >= 2) return { kind: 'new', id: nextNewId! };

  const ahead = learning.find(([id, c]) => c.due - now <= LIMITS.aheadWindow && !shownWithin(id, 1));
  if (ahead) return { kind: 'ahead', id: ahead[0] };

  if (canNew) return { kind: 'new', id: nextNewId! };

  const weakest = entries
    .filter(([id, c]) => !isLearning(c) && !shownWithin(id, 5))
    .sort((a, b) => a[1].stability - b[1].stability)
    .slice(0, 30);
  if (weakest.length) return { kind: 'extra', id: weakest[Math.floor(rnd() * weakest.length)][0] };

  const anyLearning = learning.find(([id]) => !shownWithin(id, 1));
  if (anyLearning) return { kind: 'ahead', id: anyLearning[0] };

  if (nextNewId !== undefined) return { kind: 'new', id: nextNewId };

  const any = entries.find(([id]) => !shownWithin(id, 1)) ?? entries[0];
  return any ? { kind: 'extra', id: any[0] } : null;
}
