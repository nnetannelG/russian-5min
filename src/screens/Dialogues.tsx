import { useEffect, useMemo, useRef, useState } from 'react';
import { cx, Header, Icon, Ru, say, SpeakButton, TabBar } from '../components/ui';
import { DIALOGUES } from '../data';
import type { DialogueOption } from '../data/parse';
import { applyAnswer, DIALOGUE_XP } from '../lib/gamification';
import { back, go } from '../lib/router';
import { sfx } from '../lib/sfx';
import { isLearned } from '../lib/srs';
import { update, useStore } from '../lib/store';
import { dayKey, shuffle } from '../lib/text';
import { stopSpeaking } from '../lib/tts';

function useLearnedCount(): number {
  const cards = useStore((s) => s.cards);
  return useMemo(() => Object.values(cards).filter(isLearned).length, [cards]);
}

export function Dialogues() {
  const done = useStore((s) => s.stats.dialogues);
  const learned = useLearnedCount();
  return (
    <div className="screen">
      <Header title="שיחות" />
      <p className="lead">מצבים אמיתיים מהחיים. שיחות חדשות נפתחות ככל שלומדים יותר מילים.</p>
      <div className="list scroll">
        {DIALOGUES.map((d) => {
          const open = learned >= d.unlockAt;
          return (
            <button key={d.id} type="button" className={cx('list-row', !open && 'locked')} disabled={!open} onClick={() => go(`dialogue/${d.id}`)}>
              <div className="row-icon">
                <Icon name={open ? (done.includes(d.id) ? 'check' : 'chat') : 'lock'} size={20} />
              </div>
              <div className="row-text">
                <div className="row-title">{d.title}</div>
                <div className="row-sub">{open ? `${d.turns.length} שורות` : `נפתח אחרי ${d.unlockAt} מילים (יש לך ${learned})`}</div>
              </div>
            </button>
          );
        })}
      </div>
      <TabBar active="dialogues" />
    </div>
  );
}

export function DialoguePlayer({ id }: { id: string }) {
  const dialogue = DIALOGUES.find((d) => d.id === id);
  const quiet = useStore((s) => s.settings.quiet);
  const [step, setStep] = useState(0);
  const [wrong, setWrong] = useState<string[]>([]);
  const [showHe, setShowHe] = useState<Set<number>>(new Set());
  const [mistakes, setMistakes] = useState(0);
  const end = useRef<HTMLDivElement>(null);
  const awarded = useRef(false);

  const turn = dialogue?.turns[step];
  const finished = !!dialogue && step >= dialogue.turns.length;
  // Everything said so far, plus their line that is being spoken right now.
  const bubbles = dialogue ? dialogue.turns.slice(0, turn?.who === 'them' ? step + 1 : step) : [];
  const options = useMemo(() => (turn?.who === 'me' ? shuffle(turn.options ?? []) : []), [turn]);

  // Their lines appear by themselves, are read aloud, and then the conversation moves on.
  useEffect(() => {
    if (!turn || turn.who !== 'them') return;
    let cancelled = false;
    const proceed = () => !cancelled && setStep((s) => s + 1);
    if (quiet) {
      const t = setTimeout(proceed, 900);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }
    say(turn.ru).then(() => setTimeout(proceed, 350));
    return () => {
      cancelled = true;
    };
  }, [step]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [step, wrong]);

  useEffect(() => () => stopSpeaking(), []);

  useEffect(() => {
    if (!finished || !dialogue || awarded.current) return;
    awarded.current = true;
    sfx.levelUp();
    update((s) => {
      const first = !s.stats.dialogues.includes(dialogue.id);
      const stats = applyAnswer(s.stats, { correct: true, xp: first ? DIALOGUE_XP : 10, scored: false }, dayKey(Date.now()));
      return { ...s, stats: { ...stats, dialogues: first ? [...stats.dialogues, dialogue.id] : stats.dialogues } };
    });
  }, [finished]);

  if (!dialogue) {
    return (
      <div className="screen">
        <Header title="שיחה" onBack={() => back('dialogues')} />
        <p className="lead">השיחה לא נמצאה.</p>
      </div>
    );
  }

  const choose = (o: DialogueOption) => {
    if (!o.ok) {
      sfx.wrong();
      setMistakes((m) => m + 1);
      setWrong((w) => [...w, o.ru]);
      return;
    }
    sfx.correct();
    setWrong([]);
    if (!quiet) say(o.ru).then(() => setStep((s) => s + 1));
    else setStep((s) => s + 1);
  };

  const restart = () => {
    awarded.current = false;
    setWrong([]);
    setMistakes(0);
    setShowHe(new Set());
    setStep(0);
  };

  const toggleHe = (i: number) =>
    setShowHe((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className="screen dialogue">
      <Header title={dialogue.title} onBack={() => back('dialogues')} />
      <div className="chat scroll">
        {bubbles.map((b, i) => (
          <div key={i} className={cx('bubble', b.who)} onClick={() => toggleHe(i)}>
            <div className="bubble-ru">
              <Ru text={b.ru} />
              {!quiet && <SpeakButton text={b.ru} size={18} />}
            </div>
            {b.who === 'me' || showHe.has(i) ? <div className="bubble-he">{b.he}</div> : <div className="bubble-hint">הקש לתרגום</div>}
          </div>
        ))}
        {finished && (
          <div className="card done-card">
            <div className="overlay-big">{mistakes === 0 ? 'שיחה מושלמת' : 'סיימת את השיחה'}</div>
            <div className="muted">{mistakes === 0 ? 'בלי אף טעות' : mistakes === 1 ? 'טעות אחת בדרך. שווה לנסות שוב' : `${mistakes} טעויות בדרך. שווה לנסות שוב`}</div>
          </div>
        )}
        <div ref={end} />
      </div>
      <div className="chat-actions">
        {turn?.who === 'me' && (
          <>
            <div className="eyebrow">מה תענה?</div>
            {options.map((o) => {
              const isWrong = wrong.includes(o.ru);
              return (
                <button key={o.ru} type="button" className={cx('option', 'reply', isWrong && 'wrong')} disabled={isWrong} onClick={() => choose(o)}>
                  <Ru text={o.ru} />
                  {isWrong && <span className="reply-he">{o.he}</span>}
                </button>
              );
            })}
          </>
        )}
        {finished && (
          <div className="grades two">
            <button type="button" className="grade hard" onClick={restart}>
              שוב
            </button>
            <button type="button" className="grade good" onClick={() => back('dialogues')}>
              סיום
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
