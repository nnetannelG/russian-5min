import type { ReactNode } from 'react';
import { swap } from '../lib/router';
import { sfx } from '../lib/sfx';
import { getState } from '../lib/store';
import { stressSegments } from '../lib/text';
import { speak } from '../lib/tts';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/** Russian text, left-to-right, with the stressed vowel highlighted. */
export function Ru({ text, className }: { text: string; className?: string }) {
  return (
    <span lang="ru" dir="ltr" className={cx('ru', className)}>
      {stressSegments(text).map((s, i) =>
        s.stressed ? (
          <span key={i} className="st">
            {s.text}
          </span>
        ) : (
          s.text
        ),
      )}
    </span>
  );
}

export function say(text: string, rate?: number): Promise<void> {
  return speak(text, rate ?? getState().settings.rate);
}

const PATHS: Record<string, ReactNode> = {
  home: <path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />,
  chat: <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />,
  book: (
    <>
      <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
      <path d="M5 17a3 3 0 0 1 3-3h11" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </>
  ),
  volume: (
    <>
      <path d="M4 10v4h3.5L12 18V6L7.5 10z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" />
    </>
  ),
  slow: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l-3 2" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  back: <path d="m10 6 6 6-6 6" />,
  flame: <path d="M12 3c1 3.5 5 5.2 5 10a5 5 0 0 1-10 0c0-2 1-3.2 2-4 .2 1.6 1 2.4 1.8 2.6C10.200 9 10.500 6 12 3z" />,
  snow: <path d="M12 3v18M4.2 7.500l15.600 9M19.800 7.500l-15.600 9M12 7 9.500 4.800M12 7l2.500-2.200M12 17l-2.500 2.200M12 17l2.500 2.200" />,
  mute: (
    <>
      <path d="M4 10v4h3.5L12 18V6L7.5 10z" />
      <path d="m16 9.500 5 5M21 9.500l-5 5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.500" />
      <path d="m16 16 4.500 4.500" />
    </>
  ),
  bulb: (
    <>
      <path d="M9 17h6M10 20.500h4" />
      <path d="M12 3.500a6 6 0 0 0-3.500 10.900c.500.400.500 1 .500 1.600h6c0-.600 0-1.200.500-1.600A6 6 0 0 0 12 3.500z" />
    </>
  ),
  star: <path d="m12 3.500 2.600 5.400 5.900.800-4.300 4.100 1 5.900L12 16.900l-5.200 2.800 1-5.900-4.300-4.100 5.900-.800z" />,
  cloud: <path d="M7 18.500a4.500 4.500 0 0 1-.500-9 6 6 0 0 1 11.600 1.600A3.700 3.700 0 0 1 17.500 18.500z" />,
};

export function Icon({ name, size = 24 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

export function SpeakButton({ text, rate, size = 22, label = 'השמע' }: { text: string; rate?: number; size?: number; label?: string }) {
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        say(text, rate);
      }}
    >
      <Icon name="volume" size={size} />
    </button>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={cx('toggle', on && 'on')}
      onClick={() => {
        sfx.tap();
        onChange(!on);
      }}
    >
      <span className="knob" />
    </button>
  );
}

const TABS = [
  { path: '', icon: 'home', label: 'בית' },
  { path: 'dialogues', icon: 'chat', label: 'שיחות' },
  { path: 'dict', icon: 'book', label: 'מילון' },
  { path: 'settings', icon: 'gear', label: 'הגדרות' },
];

export function TabBar({ active }: { active: string }) {
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <button key={t.path} type="button" className={cx('tab', active === t.path && 'active')} onClick={() => swap(t.path)}>
          <Icon name={t.icon} />
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

export function Header({ title, onBack, children }: { title: string; onBack?: () => void; children?: ReactNode }) {
  return (
    <header className="header">
      {onBack && (
        <button type="button" className="icon-btn" aria-label="חזרה" onClick={onBack}>
          <Icon name="back" />
        </button>
      )}
      <h1>{title}</h1>
      <div className="header-end">{children}</div>
    </header>
  );
}

export const POS_LABEL: Record<string, string> = {
  nm: 'שם עצם · זכר',
  nf: 'שם עצם · נקבה',
  nn: 'שם עצם · סתמי',
  np: 'שם עצם · רבים',
  v: 'פועל',
  a: 'שם תואר',
  d: 'תואר הפועל',
  p: 'כינוי',
  r: 'מילת יחס',
  c: 'מילת חיבור',
  m: 'מספר',
  x: 'ביטוי',
};

export const TAG_LABEL: Record<string, string> = {
  slang: 'סלנג',
  polite: 'מנומס',
  aff: 'חיבה',
  swear: 'קללה קלה',
};
