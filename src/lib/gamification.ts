import { dayDiff } from './text';

export interface Stats {
  xp: number;
  streak: number;
  /** Last day on which the daily goal was reached. */
  lastDoneDay: string | null;
  /** The missed day that the most recent streak freeze covered. */
  freezeDay: string | null;
  today: string;
  todayCount: number;
  newToday: number;
  /** 1/0 for the last answers, newest last. */
  recent: number[];
  answers: number;
  tipsSeen: string[];
  dialogues: string[];
}

export const DAILY_GOAL = 15;
export const RECENT_WINDOW = 30;
const FREEZE_COOLDOWN_DAYS = 7;

export function emptyStats(today: string): Stats {
  return {
    xp: 0,
    streak: 0,
    lastDoneDay: null,
    freezeDay: null,
    today,
    todayCount: 0,
    newToday: 0,
    recent: [],
    answers: 0,
    tipsSeen: [],
    dialogues: [],
  };
}

/** Resets the per-day counters when the calendar day has changed. */
export function rollDay(s: Stats, today: string): Stats {
  return s.today === today ? s : { ...s, today, todayCount: 0, newToday: 0 };
}

function freezeAvailable(s: Stats, today: string): boolean {
  return !s.freezeDay || dayDiff(s.freezeDay, today) >= FREEZE_COOLDOWN_DAYS;
}

/** Streak as it should be shown right now (0 if it has already been lost). */
export function displayStreak(s: Stats, today: string): { days: number; frozen: boolean } {
  if (!s.lastDoneDay) return { days: 0, frozen: false };
  const gap = dayDiff(s.lastDoneDay, today);
  if (gap <= 1) return { days: s.streak, frozen: false };
  if (gap === 2 && freezeAvailable(s, today)) return { days: s.streak, frozen: true };
  return { days: 0, frozen: false };
}

export interface AnswerInfo {
  correct: boolean;
  xp: number;
  /** Counts toward accuracy tracking (introductions do not). */
  scored: boolean;
}

export function applyAnswer(stats: Stats, a: AnswerInfo, today: string): Stats {
  let s = rollDay(stats, today);
  s = { ...s, xp: s.xp + a.xp, answers: s.answers + 1, todayCount: s.todayCount + 1 };
  if (a.scored) s.recent = [...s.recent, a.correct ? 1 : 0].slice(-RECENT_WINDOW);

  if (s.todayCount >= DAILY_GOAL && s.lastDoneDay !== today) {
    const gap = s.lastDoneDay ? dayDiff(s.lastDoneDay, today) : Infinity;
    if (gap === 1) {
      s.streak += 1;
    } else if (gap === 2 && freezeAvailable(s, today)) {
      s.streak += 1;
      s.freezeDay = today;
    } else {
      s.streak = 1;
    }
    s.lastDoneDay = today;
  }
  return s;
}

export function accuracy(s: Stats): number {
  if (s.recent.length < 8) return 1;
  return s.recent.reduce((a, b) => a + b, 0) / s.recent.length;
}

// ---- XP and levels ----

export type ExerciseType = 'intro' | 'mcq' | 'listen' | 'build' | 'speak' | 'flash';

const BASE_XP: Record<ExerciseType, number> = { intro: 3, mcq: 10, flash: 10, listen: 12, build: 15, speak: 15 };
export const DIALOGUE_XP = 40;

export function xpFor(type: ExerciseType, correct: boolean, combo: number): number {
  if (type === 'intro') return BASE_XP.intro;
  if (!correct) return 1;
  return BASE_XP[type] + Math.min(combo, 5);
}

/** Total XP needed to reach a level (level 1 = 0). */
export function levelStart(level: number): number {
  return 50 * (level - 1) * level;
}

export function levelFor(xp: number): number {
  let l = 1;
  while (levelStart(l + 1) <= xp) l++;
  return l;
}

const TITLES: [number, string, string][] = [
  [1, 'Новичо́к', 'מתחיל'],
  [3, 'Тури́ст', 'תייר'],
  [5, 'Гость', 'אורח'],
  [8, 'Знако́мый', 'מכר'],
  [12, 'Сосе́д', 'שכן'],
  [16, 'Прия́тель', 'חבר'],
  [21, 'Друг', 'חבר קרוב'],
  [27, 'Свой челове́к', 'אחד משלנו'],
  [34, 'Почти́ ру́сский', 'כמעט רוסי'],
  [42, 'Леге́нда', 'אגדה'],
];

export function levelTitle(level: number): { ru: string; he: string } {
  let t = TITLES[0];
  for (const x of TITLES) if (level >= x[0]) t = x;
  return { ru: t[1], he: t[2] };
}

export function levelProgress(xp: number): { level: number; into: number; span: number } {
  const level = levelFor(xp);
  const start = levelStart(level);
  return { level, into: xp - start, span: levelStart(level + 1) - start };
}
