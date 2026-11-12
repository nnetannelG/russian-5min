/** Combining acute accent used to mark the stressed vowel: приве́т */
export const STRESS = '́';

export function stripStress(s: string): string {
  return s.replaceAll(STRESS, '');
}

/** Canonical form for comparing answers: no stress, no punctuation, ё→е, lowercase. */
export function normalize(s: string): string {
  return stripStress(s)
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/(^|\s)-+|-+(\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Words of a sentence without surrounding punctuation (stress marks kept). */
export function tokenize(s: string): string[] {
  return s
    .split(/\s+/)
    .map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}́]+$/gu, ''))
    .filter((t) => t.length > 0);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** 0..1 similarity between what was expected and what was heard. */
export function similarity(expected: string, heard: string): number {
  const a = normalize(expected);
  const b = normalize(heard);
  if (!a.length && !b.length) return 1;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

/** Splits text into plain and stressed-vowel segments for rendering. */
export function stressSegments(s: string): { text: string; stressed: boolean }[] {
  const out: { text: string; stressed: boolean }[] = [];
  let buf = '';
  const chars = Array.from(s);
  for (let i = 0; i < chars.length; i++) {
    if (chars[i + 1] === STRESS) {
      if (buf) out.push({ text: buf, stressed: false });
      buf = '';
      out.push({ text: chars[i], stressed: true });
      i++;
    } else if (chars[i] !== STRESS) {
      buf += chars[i];
    }
  }
  if (buf) out.push({ text: buf, stressed: false });
  return out;
}

export function countVowels(s: string): number {
  return (s.toLowerCase().match(/[аеёиоуыэюя]/g) ?? []).length;
}

export function shuffle<T>(arr: readonly T[], rnd: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function dayDiff(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}
