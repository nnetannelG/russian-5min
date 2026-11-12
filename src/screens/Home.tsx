import { Icon, Ru, TabBar, Toggle } from '../components/ui';
import { TOTAL_WORDS } from '../data';
import { isConfigured } from '../lib/backup';
import { DAILY_GOAL, displayStreak, levelProgress, levelTitle } from '../lib/gamification';
import { go } from '../lib/router';
import { sfx } from '../lib/sfx';
import { isLearned } from '../lib/srs';
import { update, useStore } from '../lib/store';
import { dayKey } from '../lib/text';

export function Home() {
  const stats = useStore((s) => s.stats);
  const cards = useStore((s) => s.cards);
  const quiet = useStore((s) => s.settings.quiet);
  const gh = useStore((s) => s.settings.gh);
  const backup = useStore((s) => s.backup);

  const now = Date.now();
  const today = dayKey(now);
  const list = Object.values(cards);
  const learned = list.filter(isLearned).length;
  const due = list.filter((c) => c.due <= now).length;
  const todayCount = stats.today === today ? stats.todayCount : 0;
  const streak = displayStreak(stats, today);
  const lvl = levelProgress(stats.xp);
  const title = levelTitle(lvl.level);
  const goalDone = todayCount >= DAILY_GOAL;
  const started = list.length > 0;

  return (
    <div className="screen home">
      <div className="home-top">
        <div className={`streak ${streak.days > 0 ? 'lit' : ''}`}>
          <Icon name={streak.frozen ? 'snow' : 'flame'} size={22} />
          <strong>{streak.days}</strong>
          <span>{streak.frozen ? 'הרצף בהקפאה' : streak.days === 1 ? 'יום ברצף' : 'ימים ברצף'}</span>
        </div>
        <div className="brand">
          <Ru text="Пять мину́т" />
        </div>
      </div>

      <section className="card level-card">
        <div className="level-row">
          <div>
            <div className="level-num">רמה {lvl.level}</div>
            <div className="level-title">
              <Ru text={title.ru} /> <span className="muted">· {title.he}</span>
            </div>
          </div>
          <div className="xp-total">{stats.xp.toLocaleString('he')} XP</div>
        </div>
        <div className="bar">
          <div className="bar-fill" style={{ width: `${(lvl.into / lvl.span) * 100}%` }} />
        </div>
        <div className="bar-caption">
          עוד {lvl.span - lvl.into} XP לרמה {lvl.level + 1}
        </div>
      </section>

      <section className="stat-grid">
        <div className="card stat">
          <div className="stat-num">
            {learned}
            <span className="stat-of">/{TOTAL_WORDS}</span>
          </div>
          <div className="stat-label">מילים נלמדו</div>
          <div className="bar thin">
            <div className="bar-fill ok" style={{ width: `${(learned / TOTAL_WORDS) * 100}%` }} />
          </div>
        </div>
        <div className="card stat">
          <div className="stat-num">{due}</div>
          <div className="stat-label">חזרות מחכות</div>
        </div>
        <div className="card stat">
          <div className={`stat-num ${goalDone ? 'ok' : ''}`}>
            {Math.min(todayCount, DAILY_GOAL)}
            <span className="stat-of">/{DAILY_GOAL}</span>
          </div>
          <div className="stat-label">{goalDone ? 'היעד היומי הושג' : 'היעד של היום'}</div>
        </div>
      </section>

      <section className="card row-card">
        <div>
          <div className="row-title">אני באוטובוס</div>
          <div className="row-sub">בלי דיבור, בלי האזנה ובלי צלילים</div>
        </div>
        <Toggle
          on={quiet}
          label="מצב שקט"
          onChange={(v) => update((s) => ({ ...s, settings: { ...s.settings, quiet: v } }), { touchBackup: false })}
        />
      </section>

      {started && !isConfigured(gh) && list.length >= 30 && (
        <button type="button" className="card notice" onClick={() => go('settings')}>
          <Icon name="cloud" size={20} />
          <span>ההתקדמות שמורה רק בטלפון. הגדר גיבוי אוטומטי</span>
        </button>
      )}
      {backup.error && isConfigured(gh) && (
        <button type="button" className="card notice bad" onClick={() => go('settings')}>
          <Icon name="cloud" size={20} />
          <span>הגיבוי האחרון נכשל: {backup.error}</span>
        </button>
      )}

      <div className="home-cta">
        <button
          type="button"
          className="btn primary big"
          onClick={() => {
            sfx.tap();
            go('session');
          }}
        >
          {started ? 'המשך ללמוד' : 'התחל ללמוד'}
        </button>
        <div className="cta-sub">{started ? 'אפשר לצאת בכל רגע, הכול נשמר' : 'חמש דקות. מתחילים מ"היי"'}</div>
      </div>

      <TabBar active="" />
    </div>
  );
}
