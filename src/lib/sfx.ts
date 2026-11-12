import { getState } from './store';

let ctx: AudioContext | undefined;

function audio(): AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  const C = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!C) return undefined;
  ctx ??= new C();
  if (ctx!.state === 'suspended') ctx!.resume().catch(() => {});
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.08) {
  const a = audio();
  if (!a) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = a.currentTime + start;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function vibrate(pattern: number | number[]) {
  if (getState().settings.haptics) navigator.vibrate?.(pattern);
}

function sounds(): boolean {
  const s = getState().settings;
  return s.sound && !s.quiet;
}

export const sfx = {
  tap() {
    vibrate(8);
  },
  correct() {
    vibrate(18);
    if (!sounds()) return;
    tone(660, 0, 0.12);
    tone(990, 0.09, 0.18);
  },
  wrong() {
    vibrate([40, 60, 40]);
    if (!sounds()) return;
    tone(220, 0, 0.22, 'triangle', 0.1);
    tone(180, 0.1, 0.25, 'triangle', 0.1);
  },
  levelUp() {
    vibrate([20, 40, 20, 40, 60]);
    if (!sounds()) return;
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.1, 0.25));
  },
};
