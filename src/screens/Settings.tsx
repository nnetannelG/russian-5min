import { useRef, useState } from 'react';
import { Header, say, TabBar, Toggle } from '../components/ui';
import { TOTAL_WORDS } from '../data';
import { isConfigured } from '../lib/backup';
import { initialState, replaceState, update, useStore, type Settings as SettingsT } from '../lib/store';
import { exportToFile, importFromFile, restoreFromGitHub, runBackup } from '../lib/sync';
import { hasRussianVoice } from '../lib/tts';

function setSetting<K extends keyof SettingsT>(key: K, value: SettingsT[K]) {
  update((s) => ({ ...s, settings: { ...s.settings, [key]: value } }), { touchBackup: false });
}

function when(ts: number | null): string {
  if (!ts) return 'עוד לא בוצע גיבוי';
  return 'גיבוי אחרון: ' + new Date(ts).toLocaleString('he-IL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

export function Settings() {
  const settings = useStore((s) => s.settings);
  const backup = useStore((s) => s.backup);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const configured = isConfigured(settings.gh);

  const setGh = (patch: Partial<SettingsT['gh']>) => setSetting('gh', { ...settings.gh, ...patch });

  const act = async (name: string, fn: () => Promise<string>) => {
    setBusy(name);
    setNote(null);
    try {
      setNote({ ok: true, text: await fn() });
    } catch (e) {
      setNote({ ok: false, text: e instanceof TypeError ? 'אין חיבור לרשת' : e instanceof Error ? e.message : 'משהו השתבש' });
    }
    setBusy('');
  };

  const voice = hasRussianVoice();

  return (
    <div className="screen">
      <Header title="הגדרות" />
      <div className="scroll settings">
        <h2>צליל ודיבור</h2>
        <div className="card rows">
          <div className="set-row">
            <div>
              <div className="row-title">מצב שקט</div>
              <div className="row-sub">בלי דיבור, האזנה וצלילים</div>
            </div>
            <Toggle on={settings.quiet} label="מצב שקט" onChange={(v) => setSetting('quiet', v)} />
          </div>
          <div className="set-row">
            <div className="row-title">צלילי משוב</div>
            <Toggle on={settings.sound} label="צלילים" onChange={(v) => setSetting('sound', v)} />
          </div>
          <div className="set-row">
            <div className="row-title">רטט</div>
            <Toggle on={settings.haptics} label="רטט" onChange={(v) => setSetting('haptics', v)} />
          </div>
          <div className="set-row column">
            <div className="row-title">מהירות הדיבור</div>
            <div className="slider-row">
              <span>לאט</span>
              <input
                type="range"
                min={0.6}
                max={1.1}
                step={0.05}
                value={settings.rate}
                onChange={(e) => setSetting('rate', Number(e.target.value))}
                onPointerUp={() => say('Приве́т! Как дела́?')}
              />
              <span>מהר</span>
            </div>
          </div>
          <div className="set-row">
            <div>
              <div className="row-title">קול רוסי</div>
              <div className="row-sub">
                {voice === false
                  ? 'לא נמצא קול רוסי במכשיר. בהגדרות הטלפון: ניהול כללי ← המרת טקסט לדיבור ← הורד רוסית.'
                  : 'הקש כדי לבדוק שהמילים נשמעות ברוסית'}
              </div>
            </div>
            <button type="button" className="btn solid small" onClick={() => say('Здра́вствуйте! Меня́ хорошо́ слы́шно?')}>
              בדיקה
            </button>
          </div>
        </div>

        <h2>תוכן</h2>
        <div className="card rows">
          <div className="set-row">
            <div>
              <div className="row-title">קללות קלות</div>
              <div className="row-sub">מילים כמו блин, כדי להבין כששומעים</div>
            </div>
            <Toggle on={settings.showSwear} label="קללות קלות" onChange={(v) => setSetting('showSwear', v)} />
          </div>
        </div>

        <h2>גיבוי אוטומטי ל-GitHub</h2>
        <div className="card rows">
          <p className="row-sub pad">
            פעם ביום ההתקדמות נשמרת לריפו פרטי שלך. צור ב-GitHub טוקן מסוג Fine-grained עם גישה לריפו הגיבוי בלבד (Contents: Read and write) והדבק אותו כאן.
            הטוקן נשמר רק בטלפון הזה.
          </p>
          <label className="field">
            <span>שם המשתמש ב-GitHub</span>
            <input dir="ltr" value={settings.gh.owner} onChange={(e) => setGh({ owner: e.target.value })} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          </label>
          <label className="field">
            <span>שם הריפו</span>
            <input dir="ltr" value={settings.gh.repo} onChange={(e) => setGh({ repo: e.target.value })} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          </label>
          <label className="field">
            <span>טוקן גישה</span>
            <input dir="ltr" type="password" value={settings.gh.token} onChange={(e) => setGh({ token: e.target.value })} autoComplete="off" />
          </label>
          <div className="row-sub pad">
            {when(backup.lastAt)}
            {backup.error && <span className="error-inline"> · ניסיון אחרון נכשל: {backup.error}</span>}
          </div>
          <div className="grades two">
            <button
              type="button"
              className="grade hard"
              disabled={!configured || !!busy}
              onClick={() => (confirmRestore ? (setConfirmRestore(false), act('restore', async () => (await restoreFromGitHub(), 'ההתקדמות שוחזרה מהגיבוי'))) : setConfirmRestore(true))}
            >
              {busy === 'restore' ? 'משחזר...' : confirmRestore ? 'לחץ שוב לאישור' : 'שחזר מהגיבוי'}
            </button>
            <button
              type="button"
              className="grade good"
              disabled={!configured || !!busy}
              onClick={() =>
                act('push', async () => {
                  if (!(await runBackup(true))) throw new Error(backupError());
                  return 'הגיבוי נשמר ב-GitHub';
                })
              }
            >
              {busy === 'push' ? 'מגבה...' : 'גבה עכשיו'}
            </button>
          </div>
          {confirmRestore && <p className="row-sub pad">השחזור יחליף את ההתקדמות שבטלפון במה ששמור בגיבוי.</p>}
        </div>

        <h2>גיבוי לקובץ</h2>
        <div className="card rows">
          <div className="grades two">
            <button type="button" className="grade hard" onClick={() => file.current?.click()}>
              ייבוא מקובץ
            </button>
            <button type="button" className="grade good" onClick={exportToFile}>
              ייצוא לקובץ
            </button>
          </div>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) act('import', async () => (await importFromFile(f), 'ההתקדמות יובאה מהקובץ'));
            }}
          />
        </div>

        {note && <div className={note.ok ? 'note ok' : 'note bad'}>{note.text}</div>}

        <h2>איפוס</h2>
        <div className="card rows">
          <button
            type="button"
            className="btn ghost danger"
            onClick={() => {
              if (!confirmReset) return setConfirmReset(true);
              const fresh = initialState(Date.now());
              replaceState({ ...fresh, settings: { ...settings, onboarded: true } });
              setConfirmReset(false);
              setNote({ ok: true, text: 'ההתקדמות אופסה' });
            }}
          >
            {confirmReset ? 'בטוח? לחץ שוב כדי למחוק את כל ההתקדמות' : 'מחיקת כל ההתקדמות'}
          </button>
        </div>

        <h2>אודות</h2>
        <div className="card rows about">
          <p>
            Пять минут · גרסה {__APP_VERSION__} · {TOTAL_WORDS} מילים
          </p>
          <p>
            השיטה: המילים הנפוצות ביותר בשפה המדוברת, חזרה מרווחת (FSRS), שליפה אקטיבית, משפטים בהקשר ודיבור בקול מהיום הראשון.
          </p>
          <p>סימוני ההטעמה אומתו מול מאגר OpenRussian (CC BY-SA 4.0). תזמון החזרות: ts-fsrs. גופן: Rubik.</p>
        </div>
      </div>
      <TabBar active="settings" />
    </div>
  );
}

function backupError(): string {
  return 'הגיבוי נכשל. בדוק את שם המשתמש, שם הריפו והטוקן.';
}
