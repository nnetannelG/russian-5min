import { stripStress } from '../lib/text';

export type Tag = 'slang' | 'polite' | 'aff' | 'swear';

export interface Sentence {
  ru: string;
  he: string;
  en: string;
}

export interface Word {
  id: string;
  rank: number;
  /** Lemma with a stress mark: приве́т */
  ru: string;
  he: string;
  en: string;
  /** nm nf nn np (nouns by gender) v a d p r c m x */
  pos: string;
  tags: Tag[];
  tip?: string;
  sentence?: Sentence;
  custom?: boolean;
}

export interface Tip {
  id: string;
  title: string;
  body: string;
}

export interface DialogueOption {
  ru: string;
  he: string;
  ok: boolean;
}

export interface DialogueTurn {
  who: 'them' | 'me';
  ru: string;
  he: string;
  /** Present on "me" turns: the right line plus wrong alternatives. */
  options?: DialogueOption[];
}

export interface Dialogue {
  id: string;
  title: string;
  /** Number of learned words needed to open it. */
  unlockAt: number;
  turns: DialogueTurn[];
}

const TAGS: Tag[] = ['slang', 'polite', 'aff', 'swear'];

/** Stable id of a word: its lemma without the stress mark (ё is kept, so всё ≠ все). */
export function wordId(ru: string): string {
  return stripStress(ru).toLowerCase().replace(/\s+/g, ' ').trim();
}

function contentLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//'));
}

/**
 * One word per line:
 *   ru | he | en | pos[,tag][,t:tipId] | sentence ru | sentence he | sentence en
 */
export function parseWords(raw: string, startRank = 1): Word[] {
  const words: Word[] = [];
  for (const line of contentLines(raw)) {
    const f = line.split('|').map((s) => s.trim());
    if (f.length !== 7) throw new Error(`Expected 7 fields, got ${f.length}: ${line}`);
    const [ru, he, en, meta, sRu, sHe, sEn] = f;
    const [pos, ...flags] = meta.split(',').map((s) => s.trim());
    const tags = flags.filter((x): x is Tag => (TAGS as string[]).includes(x));
    const tip = flags.find((x) => x.startsWith('t:'))?.slice(2);
    const unknown = flags.filter((x) => !x.startsWith('t:') && !(TAGS as string[]).includes(x));
    if (unknown.length) throw new Error(`Unknown flag "${unknown[0]}": ${line}`);
    words.push({
      id: wordId(ru),
      rank: startRank + words.length,
      ru,
      he,
      en,
      pos,
      tags,
      tip,
      sentence: sRu ? { ru: sRu, he: sHe, en: sEn } : undefined,
    });
  }
  return words;
}

/** One tip per line: id | title | body */
export function parseTips(raw: string): Tip[] {
  return contentLines(raw).map((line) => {
    const f = line.split('|').map((s) => s.trim());
    if (f.length !== 3) throw new Error(`Expected 3 fields: ${line}`);
    return { id: f[0], title: f[1], body: f[2] };
  });
}

/**
 * Dialogue blocks:
 *   # id | title | unlockAt
 *   > their line | translation
 *   < my (correct) line | translation
 *   x wrong option | translation      (belongs to the preceding "<" line)
 */
export function parseDialogues(raw: string): Dialogue[] {
  const out: Dialogue[] = [];
  let cur: Dialogue | null = null;
  for (const line of contentLines(raw)) {
    const kind = line[0];
    const f = line
      .slice(1)
      .split('|')
      .map((s) => s.trim());
    if (kind === '#') {
      if (f.length !== 3) throw new Error(`Bad dialogue header: ${line}`);
      cur = { id: f[0], title: f[1], unlockAt: Number(f[2]), turns: [] };
      out.push(cur);
      continue;
    }
    if (!cur) throw new Error(`Line before any dialogue header: ${line}`);
    if (f.length !== 2) throw new Error(`Expected "ru | he": ${line}`);
    const [ru, he] = f;
    if (kind === '>') {
      cur.turns.push({ who: 'them', ru, he });
    } else if (kind === '<') {
      cur.turns.push({ who: 'me', ru, he, options: [{ ru, he, ok: true }] });
    } else if (kind === 'x') {
      const last = cur.turns[cur.turns.length - 1];
      if (!last || last.who !== 'me') throw new Error(`Wrong option without a "<" line: ${line}`);
      last.options!.push({ ru, he, ok: false });
    } else {
      throw new Error(`Unknown line type: ${line}`);
    }
  }
  return out;
}
