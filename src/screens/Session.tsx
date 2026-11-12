import { useCallback, useEffect, useRef, useState } from 'react';
import { Build, Flash, Intro, Listen, Mcq, Speak, type ExResult } from '../components/exercises/Exercises';
import { cx, Icon, Ru } from '../components/ui';
import { allWords, nextNewWord, PROPER } from '../data';
import type { Word } from '../data/parse';
import { flashFor, makeExercise, type Exercise } from '../lib/exercises';
import { accuracy, applyAnswer, DAILY_GOAL, levelFor, levelTitle, rollDay, xpFor } from '../lib/gamification';
import { pickNext } from '../lib/queue';
import { back } from '../lib/router';
import { sfx } from '../lib/sfx';
import { introduce, Rating, review } from '../lib/srs';
import { getState, update, useStore } from '../lib/store';
import { dayKey } from '../lib/text';
import { stopSpeaking } from '../lib/tts';

interface Feedback {
  correct: boolean;
  xp: number;
}

type Overlay = { kind: 'level'; level: number } | { kind: 'goal'; streak: number } | null;

const PRAISE = ['נכון!', 'יפה!', 'Молоде́ц!', 'Отли́чно!', 'Су́пер!', 'בדיוק!'];

function distractorPool(words: Word[], word: Word, cards: Record<string, unknown>): Word[] {
  const met = words.filter((w) => cards[w.id]);
  if (met.length >= 12) return met;
  const i = Math.max(0, words.indexOf(word));
  return [...new Set([...met, ...words.slice(Math.max(0, i - 20), i + 30)])];
}

export function Session() {
  const quiet = useStore((s) => s.settings.quiet);
  const todayCount = useStore((s) => (s.stats.today === dayKey(Date.now()) ? s.stats.todayCount : 0));
  const [ex, setEx] = useState<Exercise | null>(null);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [empty, setEmpty] = useState(false);
  const [combo, setCombo] = useState(0);
  const [gained, setGained] = useState(0);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [praise, setPraise] = useState(PRAISE[0]);
  const sess = useRef({ recent: [] as string[], sinceNew: Infinity });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const advance = useCallback(() => {
    clearTimeout(timer.current);
    setFb(null);
    for (let attempt = 0; attempt < 5; attempt++) {
      const st = getState();
      const now = Date.now();
      const stats = rollDay(st.stats, dayKey(now));
      const pick = pickNext({
        now,
        cards: st.cards,
        nextNewId: nextNewWord(st)?.id,
        recent: sess.current.recent,
        sinceNew: sess.current.sinceNew,
        accuracy: accuracy(stats),
        newToday: stats.newToday,
      });
      if (!pick) {
        setEx(null);
        setEmpty(true);
        return;
      }
      const { words, byId } = allWords(st);
      const word = byId.get(pick.id);
      if (!word) {
        // A card whose word no longer exists (a deleted personal word): drop it and pick again.
        update((s) => {
          const cards = { ...s.cards };
          delete cards[pick.id];
          return { ...s, cards };
        });
        continue;
      }
      const stage = pick.kind === 'new' ? 0 : st.cards[pick.id].stage;
      setEx(
        makeExercise(word, stage, pick.kind, {
          quiet: st.settings.quiet,
          pool: distractorPool(words, word, st.cards),
          proper: PROPER,
        }),
      );
      return;
    }
  }, []);

  useEffect(() => {
    advance();
    return () => {
      clearTimeout(timer.current);
      stopSpeaking();
    };
  }, [advance]);

  const onResult = (r: ExResult) => {
    if (!ex || fb) return;
    if (r.skipped) {
      stopSpeaking();
      setEx(flashFor(ex));
      return;
    }
    const now = Date.now();
    const today = dayKey(now);
    const before = getState();
    const id = ex.word.id;
    const isIntro = ex.type === 'intro';
    const nextCombo = isIntro ? combo : r.correct ? combo + 1 : 0;
    const xp = xpFor(ex.type, r.correct, nextCombo);

    update((s) => {
      const cards = { ...s.cards };
      let stats = rollDay(s.stats, today);
      if (isIntro) {
        cards[id] = introduce(now);
        const tip = ex.word.tip;
        stats = {
          ...stats,
          newToday: stats.newToday + 1,
          tipsSeen: tip && !stats.tipsSeen.includes(tip) ? [...stats.tipsSeen, tip] : stats.tipsSeen,
        };
      } else if (r.grade !== null && cards[id]) {
        // Free practice only counts against a word when it was missed.
        if (ex.kind !== 'extra' || r.grade === Rating.Again) cards[id] = review(cards[id], r.grade, now);
      }
      stats = applyAnswer(stats, { correct: r.correct, xp, scored: !isIntro }, today);
      return { ...s, cards, stats };
    });

    sess.current.recent = [...sess.current.recent, id].slice(-6);
    sess.current.sinceNew = isIntro ? 0 : sess.current.sinceNew + 1;
    setCombo(nextCombo);
    setGained((g) => g + xp);

    const after = getState().stats;
    if (levelFor(after.xp) > levelFor(before.stats.xp)) {
      sfx.levelUp();
      setOverlay({ kind: 'level', level: levelFor(after.xp) });
    } else if (after.lastDoneDay === today && before.stats.lastDoneDay !== today) {
      setOverlay({ kind: 'goal', streak: after.streak });
    }

    if (isIntro) {
      sfx.tap();
      advance();
      return;
    }
    if (r.correct) sfx.correct();
    else sfx.wrong();
    if (ex.type === 'flash') {
      advance();
      return;
    }
    setPraise(PRAISE[Math.floor(Math.random() * PRAISE.length)]);
    setFb({ correct: r.correct, xp });
    if (r.correct) timer.current = setTimeout(advance, ex.type === 'build' || ex.type === 'speak' ? 1900 : 1100);
  };

  useEffect(() => {
    if (!overlay) return;
    const t = setTimeout(() => setOverlay(null), 2400);
    return () => clearTimeout(t);
  }, [overlay]);

  const toggleQuiet = () => {
    const next = !quiet;
    update((s) => ({ ...s, settings: { ...s.settings, quiet: next } }), { touchBackup: false });
    if (next) {
      stopSpeaking();
      if (ex && !fb && (ex.type === 'listen' || ex.type === 'speak')) setEx(flashFor(ex));
    }
  };

  const props = { quiet, locked: !!fb, onResult };
  const goalPct = Math.min(100, (todayCount / DAILY_GOAL) * 100);
  const sentence = ex && (ex.type === 'build' || ex.type === 'speak' || (ex.type === 'listen' && ex.unit === 'sentence')) ? ex.word.sentence : null;

  return (
    <div className="screen session">
      <div className="session-top">
        <button type="button" className="icon-btn" aria-label="סיום" onClick={() => back()}>
          <Icon name="x" />
        </button>
        <div className="goal-bar" aria-label="התקדמות ליעד היומי">
          <div className={cx('goal-fill', goalPct >= 100 && 'done')} style={{ width: `${goalPct}%` }} />
        </div>
        {combo >= 3 && <div className="combo">×{combo}</div>}
        <div className="xp-pill">+{gained} XP</div>
        <button type="button" className={cx('icon-btn', quiet && 'active')} aria-label="מצב שקט" aria-pressed={quiet} onClick={toggleQuiet}>
          <Icon name={quiet ? 'mute' : 'volume'} />
        </button>
      </div>

      <div className="session-body" key={ex?.uid ?? 'none'}>
        {ex?.type === 'intro' && <Intro ex={ex} {...props} />}
        {ex?.type === 'mcq' && <Mcq ex={ex} {...props} />}
        {ex?.type === 'listen' && <Listen ex={ex} {...props} />}
        {ex?.type === 'build' && <Build ex={ex} {...props} />}
        {ex?.type === 'speak' && <Speak ex={ex} {...props} />}
        {ex?.type === 'flash' && <Flash ex={ex} {...props} />}
        {empty && (
          <div className="ex">
            <div className="ex-main center">
              <div className="hero-he">אין כרגע מה לתרגל</div>
              <p className="muted">הוסף מילים משלך במילון, או חזור מאוחר יותר.</p>
            </div>
          </div>
        )}
      </div>

      {fb && ex && (
        <div className={cx('sheet', fb.correct ? 'ok' : 'bad')} onClick={advance} role="status">
          <div className="sheet-head">
            <Icon name={fb.correct ? 'check' : 'x'} size={22} />
            <span className="sheet-title">{fb.correct ? /[а-я]/i.test(praise) ? <Ru text={praise} /> : praise : 'לא בדיוק'}</span>
            <span className="sheet-xp">+{fb.xp}</span>
          </div>
          <div className="sheet-body">
            {sentence ? (
              <>
                <Ru text={sentence.ru} />
                <span className="sheet-he">{sentence.he}</span>
              </>
            ) : (
              <>
                <Ru text={ex.word.ru} />
                <span className="sheet-he">{ex.word.he}</span>
              </>
            )}
          </div>
          {!fb.correct && (
            <button type="button" className="btn solid" onClick={advance}>
              המשך
            </button>
          )}
        </div>
      )}

      {overlay && (
        <div className="overlay" onClick={() => setOverlay(null)}>
          {overlay.kind === 'level' ? (
            <div className="overlay-card">
              <div className="overlay-icon">
                <Icon name="star" size={44} />
              </div>
              <div className="overlay-big">רמה {overlay.level}</div>
              <Ru text={levelTitle(overlay.level).ru} className="overlay-ru" />
              <div className="muted">{levelTitle(overlay.level).he}</div>
            </div>
          ) : (
            <div className="overlay-card">
              <div className="overlay-icon flame">
                <Icon name="flame" size={44} />
              </div>
              <div className="overlay-big">היעד היומי הושג</div>
              <div className="muted">{overlay.streak === 1 ? 'יום ראשון ברצף' : `${overlay.streak} ימים ברצף`}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
