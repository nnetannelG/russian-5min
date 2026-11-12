import { similarity } from './text';

type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

function ctor(): (new () => Recognition) | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function sttSupported(): boolean {
  return !!ctor();
}

export type ListenError = 'denied' | 'network' | 'silence' | 'unsupported' | 'other';

export interface ListenResult {
  /** Best-matching thing the recognizer heard. */
  heard: string;
  score: number;
}

export interface ListenHandle {
  stop(): void;
  result: Promise<ListenResult>;
}

/** Listens for one Russian phrase and scores it against the expected text. */
export function listen(expected: string, onInterim?: (text: string) => void): ListenHandle {
  const C = ctor();
  if (!C) return { stop() {}, result: Promise.reject<ListenResult>('unsupported' satisfies ListenError) };

  const rec = new C();
  rec.lang = 'ru-RU';
  rec.interimResults = true;
  rec.maxAlternatives = 4;
  rec.continuous = false;

  const result = new Promise<ListenResult>((resolve, reject) => {
    let best: ListenResult | null = null;
    let failed: ListenError | null = null;

    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (!r.isFinal) {
          onInterim?.(r[0].transcript);
          continue;
        }
        for (let j = 0; j < r.length; j++) {
          const heard: string = r[j].transcript;
          const score = similarity(expected, heard);
          if (!best || score > best.score) best = { heard, score };
        }
      }
    };
    rec.onerror = (e: any) => {
      const code: string = e?.error ?? '';
      if (code === 'not-allowed' || code === 'service-not-allowed') failed = 'denied';
      else if (code === 'network') failed = 'network';
      else if (code === 'no-speech' || code === 'aborted') failed = 'silence';
      else failed = 'other';
    };
    rec.onend = () => {
      if (best) resolve(best);
      else reject(failed ?? ('silence' satisfies ListenError));
    };
  });

  try {
    rec.start();
  } catch {
    return { stop() {}, result: Promise.reject<ListenResult>('other' satisfies ListenError) };
  }
  return { stop: () => rec.stop(), result };
}

export const PASS_SCORE = 0.8;
export const CLOSE_SCORE = 0.55;
