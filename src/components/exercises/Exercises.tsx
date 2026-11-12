import { useEffect, useRef, useState } from 'react';
import { TIP_BY_ID } from '../../data';
import { checkBuild, type Exercise, type Option } from '../../lib/exercises';
import { sfx } from '../../lib/sfx';
import { Rating, type Grade } from '../../lib/srs';
import { CLOSE_SCORE, listen, PASS_SCORE, sttSupported, type ListenError, type ListenHandle } from '../../lib/stt';
import { stopSpeaking } from '../../lib/tts';
import { cx, Icon, POS_LABEL, Ru, say, SpeakButton, TAG_LABEL } from '../ui';

export interface ExResult {
  grade: Grade | null;
  correct: boolean;
  skipped?: boolean;
}

interface Props<T extends Exercise['type']> {
  ex: Extract<Exercise, { type: T }>;
  quiet: boolean;
  /** True once the answer was given and feedback is on screen. */
  locked: boolean;
  onResult: (r: ExResult) => void;
}

function TipBox({ id }: { id: string }) {
  const tip = TIP_BY_ID.get(id);
  if (!tip) return null;
  return (
    <div className="tip">
      <div className="tip-title">
        <Icon name="bulb" size={18} />
        {tip.title}
      </div>
      <div className="tip-body">{renderMixed(tip.body)}</div>
    </div>
  );
}

/** Hebrew text with Russian snippets: each Cyrillic run is rendered as Russian. */
export function renderMixed(text: string) {
  const parts = text.split(/([А-Яа-яЁё́][А-Яа-яЁё́\s,.!?…/-]*[А-Яа-яЁё́.!?…]|[А-Яа-яЁё])/g);
  return parts.map((p, i) => (/[А-Яа-яЁё]/.test(p) ? <Ru key={i} text={p} /> : p));
}

export function Intro({ ex, quiet, onResult }: Props<'intro'>) {
  const w = ex.word;
  useEffect(() => {
    if (!quiet) say(w.ru);
  }, [ex.uid]);
  return (
    <div className="ex">
      <div className="ex-main scroll">
        <div className="eyebrow">מילה חדשה</div>
        <div className="hero-word">
          <Ru text={w.ru} />
          <SpeakButton text={w.ru} size={26} />
        </div>
        <div className="chips">
          <span className="chip">{POS_LABEL[w.pos] ?? 'ביטוי'}</span>
          {w.tags.map((t) => (
            <span key={t} className={cx('chip', `chip-${t}`)}>
              {TAG_LABEL[t]}
            </span>
          ))}
        </div>
        <div className="meaning">{w.he}</div>
        <div className="meaning-en" dir="ltr">
          {w.en}
        </div>
        {w.sentence && (
          <div className="card example">
            <div className="example-ru">
              <Ru text={w.sentence.ru} />
              <SpeakButton text={w.sentence.ru} />
            </div>
            <div className="example-he">{w.sentence.he}</div>
            <div className="example-en" dir="ltr">
              {w.sentence.en}
            </div>
          </div>
        )}
        {w.tip && <TipBox id={w.tip} />}
      </div>
      <div className="ex-footer">
        <button type="button" className="btn primary" onClick={() => onResult({ grade: null, correct: true })}>
          הבנתי
        </button>
      </div>
    </div>
  );
}

function Options({
  options,
  picked,
  russian,
  locked,
  onPick,
}: {
  options: Option[];
  picked: string | null;
  russian: boolean;
  locked: boolean;
  onPick: (o: Option) => void;
}) {
  return (
    <div className="options">
      {options.map((o) => {
        const state = picked === null ? '' : o.correct ? 'right' : o.key === picked ? 'wrong' : 'dim';
        return (
          <button key={o.key} type="button" className={cx('option', state)} disabled={locked || picked !== null} onClick={() => onPick(o)}>
            {russian ? <Ru text={o.text} /> : o.text}
          </button>
        );
      })}
    </div>
  );
}

export function Mcq({ ex, quiet, locked, onResult }: Props<'mcq'>) {
  const [picked, setPicked] = useState<string | null>(null);
  const w = ex.word;
  const ruPrompt = ex.dir === 'ru-he';
  useEffect(() => {
    if (!quiet && ruPrompt) say(w.ru);
  }, [ex.uid]);
  const pick = (o: Option) => {
    setPicked(o.key);
    if (!quiet && !ruPrompt) say(w.ru);
    onResult({ grade: o.correct ? Rating.Good : Rating.Again, correct: o.correct });
  };
  return (
    <div className="ex">
      <div className="ex-main center">
        <div className="eyebrow">{ruPrompt ? 'מה הפירוש?' : 'איך אומרים ברוסית?'}</div>
        {ruPrompt ? (
          <div className="hero-word">
            <Ru text={w.ru} />
            {!quiet && <SpeakButton text={w.ru} size={26} />}
          </div>
        ) : (
          <>
            <div className="hero-he">{w.he}</div>
            <div className="meaning-en" dir="ltr">
              {w.en}
            </div>
          </>
        )}
      </div>
      <Options options={ex.options} picked={picked} russian={!ruPrompt} locked={locked} onPick={pick} />
      <div className="ex-footer" />
    </div>
  );
}

export function Listen({ ex, locked, onResult }: Props<'listen'>) {
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => {
    say(ex.audio);
  }, [ex.uid]);
  const pick = (o: Option) => {
    setPicked(o.key);
    onResult({ grade: o.correct ? Rating.Good : Rating.Again, correct: o.correct });
  };
  return (
    <div className="ex">
      <div className="ex-main center">
        <div className="eyebrow">{ex.unit === 'word' ? 'מה שמעת?' : 'מה נאמר במשפט?'}</div>
        <div className="listen-row">
          <button type="button" className="big-round" aria-label="השמע שוב" onClick={() => say(ex.audio)}>
            <Icon name="volume" size={40} />
          </button>
          <button type="button" className="icon-btn outlined" aria-label="השמע לאט" onClick={() => say(ex.audio, 0.6)}>
            <Icon name="slow" />
          </button>
        </div>
        <div className={cx('reveal', picked !== null && 'shown')}>
          <Ru text={ex.audio} />
        </div>
      </div>
      <Options options={ex.options} picked={picked} russian={false} locked={locked} onPick={pick} />
      <div className="ex-footer" />
    </div>
  );
}

export function Build({ ex, quiet, locked, onResult }: Props<'build'>) {
  // Each tile is addressed by its index so that repeated words stay distinct.
  const [chosen, setChosen] = useState<number[]>([]);
  const [verdict, setVerdict] = useState<'correct' | 'order' | 'wrong' | null>(null);
  const add = (i: number) => {
    if (locked || verdict) return;
    sfx.tap();
    setChosen((c) => [...c, i]);
  };
  const remove = (i: number) => {
    if (locked || verdict) return;
    setChosen((c) => c.filter((x) => x !== i));
  };
  const check = () => {
    const v = checkBuild(
      chosen.map((i) => ex.tiles[i]),
      ex.answer,
    );
    setVerdict(v);
    if (!quiet) say(ex.sentence.ru);
    onResult({ grade: v === 'correct' ? Rating.Good : v === 'order' ? Rating.Hard : Rating.Again, correct: v !== 'wrong' });
  };
  return (
    <div className="ex">
      <div className="ex-main">
        <div className="eyebrow">תרגם לרוסית</div>
        <div className="build-prompt">{ex.sentence.he}</div>
        <div className={cx('build-answer', verdict && `v-${verdict}`)} dir="ltr">
          {chosen.length === 0 && <span className="placeholder">הקש על המילים לפי הסדר</span>}
          {chosen.map((i) => (
            <button key={i} type="button" className="tile" onClick={() => remove(i)}>
              <Ru text={ex.tiles[i]} />
            </button>
          ))}
        </div>
      </div>
      <div className="tile-bank" dir="ltr">
        {ex.tiles.map((t, i) => (
          <button key={i} type="button" className={cx('tile', chosen.includes(i) && 'used')} disabled={chosen.includes(i)} onClick={() => add(i)}>
            <Ru text={t} />
          </button>
        ))}
      </div>
      <div className="ex-footer">
        <button type="button" className="btn primary" disabled={chosen.length < 2 || !!verdict} onClick={check}>
          בדוק
        </button>
      </div>
    </div>
  );
}

export function Flash({ ex, quiet, onResult }: Props<'flash'>) {
  const [shown, setShown] = useState(false);
  const w = ex.word;
  const reveal = () => {
    setShown(true);
    if (!quiet) say(w.ru);
  };
  const grade = (g: Grade) => onResult({ grade: g, correct: g !== Rating.Again });
  return (
    <div className="ex">
      <div className="ex-main center">
        <div className="eyebrow">נסה להיזכר, איך אומרים ברוסית?</div>
        <div className="hero-he">{w.he}</div>
        <div className="meaning-en" dir="ltr">
          {w.en}
        </div>
        <div className={cx('flash-back', shown && 'shown')}>
          <div className="hero-word">
            <Ru text={w.ru} />
            {!quiet && <SpeakButton text={w.ru} size={26} />}
          </div>
          {w.sentence && (
            <div className="card example">
              <div className="example-ru">
                <Ru text={w.sentence.ru} />
                {!quiet && <SpeakButton text={w.sentence.ru} />}
              </div>
              <div className="example-he">{w.sentence.he}</div>
            </div>
          )}
        </div>
      </div>
      <div className="ex-footer">
        {shown ? (
          <div className="grades">
            <button type="button" className="grade again" onClick={() => grade(Rating.Again)}>
              לא זכרתי
            </button>
            <button type="button" className="grade hard" onClick={() => grade(Rating.Hard)}>
              קשה
            </button>
            <button type="button" className="grade good" onClick={() => grade(Rating.Good)}>
              טוב
            </button>
            <button type="button" className="grade easy" onClick={() => grade(Rating.Easy)}>
              קל
            </button>
          </div>
        ) : (
          <button type="button" className="btn primary" onClick={reveal}>
            הצג תשובה
          </button>
        )}
      </div>
    </div>
  );
}

type SpeakPhase = 'idle' | 'listening' | 'retry' | 'manual';

const ERROR_TEXT: Record<ListenError, string> = {
  denied: 'אין הרשאה למיקרופון. אפשר לומר בקול ולסמן לבד.',
  network: 'זיהוי דיבור צריך אינטרנט. אפשר לומר בקול ולסמן לבד.',
  silence: 'לא שמעתי כלום. נסה שוב, קרוב יותר למיקרופון.',
  unsupported: 'הדפדפן לא תומך בזיהוי דיבור. אמור בקול וסמן לבד.',
  other: 'זיהוי הדיבור נכשל. אפשר לומר בקול ולסמן לבד.',
};

export function Speak({ ex, locked, onResult }: Props<'speak'>) {
  const [phase, setPhase] = useState<SpeakPhase>(sttSupported() && navigator.onLine ? 'idle' : 'manual');
  const [heard, setHeard] = useState('');
  const [message, setMessage] = useState(sttSupported() ? '' : ERROR_TEXT.unsupported);
  const tries = useRef(0);
  const handle = useRef<ListenHandle | null>(null);

  useEffect(() => {
    say(ex.text);
    return () => handle.current?.stop();
  }, [ex.uid]);

  const start = async () => {
    stopSpeaking();
    setHeard('');
    setMessage('');
    setPhase('listening');
    tries.current += 1;
    const h = listen(ex.text, setHeard);
    handle.current = h;
    try {
      const r = await h.result;
      setHeard(r.heard);
      if (r.score >= PASS_SCORE) {
        onResult({ grade: tries.current === 1 ? Rating.Good : Rating.Hard, correct: true });
      } else if (tries.current >= 2) {
        onResult({ grade: r.score >= CLOSE_SCORE ? Rating.Hard : Rating.Again, correct: r.score >= CLOSE_SCORE });
      } else {
        setMessage(r.score >= CLOSE_SCORE ? 'כמעט! הקשב שוב ונסה עוד פעם.' : 'זה נשמע אחרת. הקשב שוב ונסה עוד פעם.');
        setPhase('retry');
        say(ex.text, 0.7);
      }
    } catch (e) {
      const err = (typeof e === 'string' ? e : 'other') as ListenError;
      setMessage(ERROR_TEXT[err] ?? ERROR_TEXT.other);
      if (err === 'silence') {
        tries.current -= 1;
        setPhase('idle');
      } else {
        setPhase('manual');
      }
    }
  };

  const listening = phase === 'listening';
  return (
    <div className="ex">
      <div className="ex-main center">
        <div className="eyebrow">הקשב ואמור בקול</div>
        <div className="speak-text">
          <Ru text={ex.text} />
        </div>
        <div className="speak-he">{ex.he}</div>
        <div className="listen-row">
          <button type="button" className="icon-btn outlined" aria-label="השמע" onClick={() => say(ex.text)}>
            <Icon name="volume" />
          </button>
          <button type="button" className="icon-btn outlined" aria-label="השמע לאט" onClick={() => say(ex.text, 0.6)}>
            <Icon name="slow" />
          </button>
        </div>
        {heard && (
          <div className="heard">
            <span>שמעתי:</span> <span lang="ru" dir="ltr">{heard}</span>
          </div>
        )}
        {message && <div className="hint">{message}</div>}
      </div>
      <div className="speak-actions">
        {phase === 'manual' ? (
          <div className="grades two">
            <button type="button" className="grade hard" disabled={locked} onClick={() => onResult({ grade: Rating.Hard, correct: true })}>
              קשה לי
            </button>
            <button type="button" className="grade good" disabled={locked} onClick={() => onResult({ grade: Rating.Good, correct: true })}>
              אמרתי בקול
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={cx('big-round mic', listening && 'live')}
            aria-label={listening ? 'עצור' : 'התחל לדבר'}
            disabled={locked}
            onClick={() => (listening ? handle.current?.stop() : start())}
          >
            <Icon name="mic" size={40} />
          </button>
        )}
        <div className="hint">{listening ? 'מקשיב...' : phase === 'manual' ? '' : 'הקש ודבר'}</div>
      </div>
      <div className="ex-footer">
        <button type="button" className="btn ghost" disabled={locked} onClick={() => onResult({ grade: null, correct: false, skipped: true })}>
          לא עכשיו
        </button>
      </div>
    </div>
  );
}
