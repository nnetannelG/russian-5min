import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from 'ts-fsrs';

export { Rating, State };
export type { Grade };

/** Serializable scheduling state of one word. */
export interface CardState {
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: State;
  last_review?: number;
  /** How far up the exercise ladder the word has climbed. */
  stage: number;
  introducedAt: number;
}

const scheduler = fsrs(
  generatorParameters({ enable_fuzz: true, enable_short_term: true, request_retention: 0.9, maximum_interval: 365 }),
);

/** Delay between first meeting a word and its first quiz. */
export const FIRST_QUIZ_DELAY = 60_000;
const DAY = 86_400_000;

function toFsrs(c: CardState): Card {
  return {
    due: new Date(c.due),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.last_review ? new Date(c.last_review) : undefined,
  };
}

function fromFsrs(card: Card, rest: Pick<CardState, 'stage' | 'introducedAt'>): CardState {
  return {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review?.getTime(),
    ...rest,
  };
}

/** A word that was just introduced; its first quiz comes a minute later. */
export function introduce(now: number): CardState {
  const c = fromFsrs(createEmptyCard(new Date(now)), { stage: 1, introducedAt: now });
  c.due = now + FIRST_QUIZ_DELAY;
  return c;
}

/** A word the learner says they already know: starts as a mature review card. */
export function markKnown(now: number): CardState {
  return {
    due: now + 45 * DAY,
    stability: 45,
    difficulty: 4,
    elapsed_days: 0,
    scheduled_days: 45,
    learning_steps: 0,
    reps: 1,
    lapses: 0,
    state: State.Review,
    last_review: now,
    stage: 6,
    introducedAt: now,
  };
}

export function review(card: CardState, grade: Grade, now: number): CardState {
  const next = scheduler.next(toFsrs(card), new Date(now), grade).card;
  const stage = grade === Rating.Again ? Math.max(1, card.stage - 1) : card.stage + 1;
  return fromFsrs(next, { stage, introducedAt: card.introducedAt });
}

/** Still in short-term steps (minutes), not yet a days-apart review. */
export function isLearning(c: CardState): boolean {
  return c.state !== State.Review;
}

/** Has graduated to long-term review at least once. */
export function isLearned(c: CardState): boolean {
  return c.state === State.Review || c.state === State.Relearning;
}

export function isDue(c: CardState, now: number): boolean {
  return c.due <= now;
}
