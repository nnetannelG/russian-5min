import { stripStress } from './text';

const synth: SpeechSynthesis | undefined = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
let voices: SpeechSynthesisVoice[] = [];

function refresh() {
  voices = synth?.getVoices() ?? [];
}

if (synth) {
  refresh();
  synth.addEventListener?.('voiceschanged', refresh);
}

function russianVoice(): SpeechSynthesisVoice | undefined {
  const ru = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('ru'));
  return ru.find((v) => /google/i.test(v.name)) ?? ru.find((v) => v.localService) ?? ru[0];
}

export function ttsSupported(): boolean {
  return !!synth;
}

/** null = the browser has not reported its voices yet. */
export function hasRussianVoice(): boolean | null {
  if (!synth) return false;
  refresh();
  if (!voices.length) return null;
  return !!russianVoice();
}

export function stopSpeaking(): void {
  synth?.cancel();
}

/** Speaks Russian text. Stress marks are removed so the engine reads the plain word. */
export function speak(text: string, rate = 0.9): Promise<void> {
  return new Promise((resolve) => {
    if (!synth) return resolve();
    synth.cancel();
    const u = new SpeechSynthesisUtterance(stripStress(text));
    u.lang = 'ru-RU';
    const v = russianVoice();
    if (v) u.voice = v;
    u.rate = rate;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    synth.speak(u);
  });
}
