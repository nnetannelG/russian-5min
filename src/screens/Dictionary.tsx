import { useMemo, useState } from 'react';
import { renderMixed } from '../components/exercises/Exercises';
import { cx, Header, Icon, POS_LABEL, Ru, SpeakButton, TabBar, TAG_LABEL } from '../components/ui';
import { allWords, TIPS, TIP_BY_ID } from '../data';
import { wordId } from '../data/parse';
import { back, go } from '../lib/router';
import { isLearned, markKnown, type CardState } from '../lib/srs';
import { update, useStore } from '../lib/store';
import { normalize } from '../lib/text';

type Filter = 'all' | 'learned' | 'learning' | 'new' | 'mine';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'הכול' },
  { id: 'learning', label: 'בלמידה' },
  { id: 'learned', label: 'נלמדו' },
  { id: 'new', label: 'חדשות' },
  { id: 'mine', label: 'שלי' },
];

function status(c: CardState | undefined): 'new' | 'learning' | 'learned' {
  if (!c) return 'new';
  return isLearned(c) ? 'learned' : 'learning';
}

const STATUS_LABEL = { new: 'עוד לא נלמדה', learning: 'בלמידה', learned: 'נלמדה' };

export function Dictionary() {
  const cards = useStore((s) => s.cards);
  const custom = useStore((s) => s.custom);
  const overrides = useStore((s) => s.overrides);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit] = useState(60);
  const { words } = allWords({ custom, overrides });

  const results = useMemo(() => {
    const nq = normalize(q);
    return words.filter((w) => {
      if (filter === 'mine' ? !w.custom : filter !== 'all' && status(cards[w.id]) !== filter) return false;
      if (!nq) return true;
      return normalize(w.ru).includes(nq) || w.he.includes(q.trim()) || w.en.toLowerCase().includes(nq);
    });
  }, [words, cards, q, filter]);

  return (
    <div className="screen">
      <Header title="מילון">
        <button type="button" className="icon-btn" aria-label="טיפים" onClick={() => go('tips')}>
          <Icon name="bulb" />
        </button>
        <button type="button" className="icon-btn" aria-label="הוסף מילה" onClick={() => go('add')}>
          <Icon name="plus" />
        </button>
      </Header>
      <label className="search">
        <Icon name="search" size={20} />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setLimit(60);
          }}
          placeholder="חיפוש ברוסית, בעברית או באנגלית"
          enterKeyHint="search"
        />
      </label>
      <div className="filters">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className={cx('chip', 'pick', filter === f.id && 'on')} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="list scroll">
        {results.slice(0, limit).map((w) => (
          <button key={w.id} type="button" className="list-row word-row" onClick={() => go(`word/${w.id}`)}>
            <span className={cx('dot', status(cards[w.id]))} />
            <div className="row-text">
              <div className="row-title">
                <Ru text={w.ru} />
              </div>
              <div className="row-sub">{w.he}</div>
            </div>
            {w.rank > 0 && <span className="rank">#{w.rank}</span>}
          </button>
        ))}
        {results.length > limit && (
          <button type="button" className="btn ghost" onClick={() => setLimit((l) => l + 100)}>
            עוד {results.length - limit} מילים
          </button>
        )}
        {results.length === 0 && <p className="lead">{filter === 'mine' ? 'עוד לא הוספת מילים משלך. הקש על + למעלה.' : 'לא נמצאו מילים.'}</p>}
      </div>
      <TabBar active="dict" />
    </div>
  );
}

function nextReview(c: CardState): string {
  const diff = c.due - Date.now();
  if (diff <= 0) return 'מחכה לחזרה עכשיו';
  const min = Math.round(diff / 60_000);
  if (min < 60) return `חזרה בעוד ${min} דקות`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `חזרה בעוד ${hours} שעות`;
  return `חזרה בעוד ${Math.round(hours / 24)} ימים`;
}

export function WordDetail({ id }: { id: string }) {
  const custom = useStore((s) => s.custom);
  const overrides = useStore((s) => s.overrides);
  const card = useStore((s) => s.cards[id]);
  const quiet = useStore((s) => s.settings.quiet);
  const word = allWords({ custom, overrides }).byId.get(id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (!word) {
    return (
      <div className="screen">
        <Header title="מילה" onBack={() => back('dict')} />
        <p className="lead">המילה לא נמצאה.</p>
      </div>
    );
  }
  const st = status(card);
  const tip = word.tip ? TIP_BY_ID.get(word.tip) : undefined;

  const saveHe = () => {
    const he = draft.trim();
    if (he) {
      update((s) =>
        word.custom
          ? { ...s, custom: s.custom.map((c) => (c.id === id ? { ...c, he } : c)) }
          : { ...s, overrides: { ...s.overrides, [id]: he } },
      );
    }
    setEditing(false);
  };
  const setKnown = () => update((s) => ({ ...s, cards: { ...s.cards, [id]: markKnown(Date.now()) } }));
  const reset = () =>
    update((s) => {
      const cards = { ...s.cards };
      delete cards[id];
      return { ...s, cards };
    });
  const remove = () => {
    update((s) => {
      const cards = { ...s.cards };
      delete cards[id];
      return { ...s, cards, custom: s.custom.filter((c) => c.id !== id) };
    });
    back('dict');
  };

  return (
    <div className="screen">
      <Header title={word.custom ? 'מילה שלי' : `מילה #${word.rank}`} onBack={() => back('dict')} />
      <div className="scroll detail">
        <div className="hero-word">
          <Ru text={word.ru} />
          {!quiet && <SpeakButton text={word.ru} size={26} />}
        </div>
        <div className="chips">
          {!word.custom && <span className="chip">{POS_LABEL[word.pos]}</span>}
          {word.tags.map((t) => (
            <span key={t} className={cx('chip', `chip-${t}`)}>
              {TAG_LABEL[t]}
            </span>
          ))}
          <span className={cx('chip', `chip-${st}`)}>{STATUS_LABEL[st]}</span>
        </div>
        {editing ? (
          <div className="edit-row">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
            <button type="button" className="btn solid small" onClick={saveHe}>
              שמור
            </button>
          </div>
        ) : (
          <div className="meaning">{word.he}</div>
        )}
        {word.en && (
          <div className="meaning-en" dir="ltr">
            {word.en}
          </div>
        )}
        {word.sentence && (
          <div className="card example">
            <div className="example-ru">
              <Ru text={word.sentence.ru} />
              {!quiet && <SpeakButton text={word.sentence.ru} />}
            </div>
            <div className="example-he">{word.sentence.he}</div>
            <div className="example-en" dir="ltr">
              {word.sentence.en}
            </div>
          </div>
        )}
        {tip && (
          <div className="tip">
            <div className="tip-title">
              <Icon name="bulb" size={18} />
              {tip.title}
            </div>
            <div className="tip-body">{renderMixed(tip.body)}</div>
          </div>
        )}
        {card && <p className="muted center-text">{nextReview(card)}</p>}
        <div className="detail-actions">
          {!editing && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setDraft(word.he);
                setEditing(true);
              }}
            >
              תיקון התרגום
            </button>
          )}
          {st !== 'learned' && (
            <button type="button" className="btn ghost" onClick={setKnown}>
              אני כבר יודע את המילה
            </button>
          )}
          {card && (
            <button type="button" className="btn ghost" onClick={reset}>
              ללמוד אותה מחדש
            </button>
          )}
          {word.custom && (
            <button type="button" className="btn ghost danger" onClick={remove}>
              מחיקת המילה
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AddWord() {
  const custom = useStore((s) => s.custom);
  const overrides = useStore((s) => s.overrides);
  const [ru, setRu] = useState('');
  const [he, setHe] = useState('');
  const [en, setEn] = useState('');
  const [error, setError] = useState('');

  const save = () => {
    const id = wordId(ru);
    if (!/[а-яё]/i.test(ru)) return setError('כתוב את המילה באותיות רוסיות');
    if (!he.trim()) return setError('חסר תרגום לעברית');
    if (allWords({ custom, overrides }).byId.has(id)) return setError('המילה הזו כבר קיימת במילון');
    update((s) => ({ ...s, custom: [...s.custom, { id, ru: ru.trim(), he: he.trim(), en: en.trim(), added: Date.now() }] }));
    back('dict');
  };

  return (
    <div className="screen">
      <Header title="מילה משלי" onBack={() => back('dict')} />
      <div className="scroll form">
        <p className="lead">שמעת מילה או ביטוי במשפחה? הוסף אותם כאן והם ייכנסו לתרגול כבר בסשן הבא.</p>
        <label className="field">
          <span>ברוסית</span>
          <input lang="ru" dir="ltr" value={ru} onChange={(e) => setRu(e.target.value)} placeholder="Например: молоде́ц" autoCapitalize="none" />
        </label>
        <label className="field">
          <span>בעברית</span>
          <input value={he} onChange={(e) => setHe(e.target.value)} placeholder="כל הכבוד" />
        </label>
        <label className="field">
          <span>באנגלית (לא חובה)</span>
          <input dir="ltr" value={en} onChange={(e) => setEn(e.target.value)} placeholder="well done" />
        </label>
        {error && <div className="error">{error}</div>}
        <button type="button" className="btn primary" onClick={save}>
          הוסף למילון
        </button>
      </div>
    </div>
  );
}

export function Tips() {
  const seen = useStore((s) => s.stats.tipsSeen);
  const [open, setOpen] = useState<string | null>(null);
  const ordered = useMemo(() => [...TIPS].sort((a, b) => Number(seen.includes(b.id)) - Number(seen.includes(a.id))), [seen]);
  return (
    <div className="screen">
      <Header title="טיפים לדקדוק" onBack={() => back('dict')} />
      <p className="lead">הסברים קצרים שמופיעים תוך כדי הלמידה. אפשר לחזור אליהם כאן בכל רגע.</p>
      <div className="list scroll">
        {ordered.map((t) => (
          <button key={t.id} type="button" className={cx('list-row tip-row', open === t.id && 'open')} onClick={() => setOpen(open === t.id ? null : t.id)}>
            <div className="row-text">
              <div className="row-title">
                {renderMixed(t.title)}
                {seen.includes(t.id) && <span className="seen">נלמד</span>}
              </div>
              {open === t.id && <div className="tip-body">{renderMixed(t.body)}</div>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
