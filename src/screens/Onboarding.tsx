import { useState } from 'react';
import { Icon, Ru, say } from '../components/ui';
import { sttSupported } from '../lib/stt';
import { update } from '../lib/store';
import { TOTAL_WORDS } from '../data';

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [played, setPlayed] = useState(false);
  const [mic, setMic] = useState<'unknown' | 'ok' | 'denied'>('unknown');

  const finish = () => update((s) => ({ ...s, settings: { ...s.settings, onboarded: true } }), { touchBackup: false });

  const askMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMic('ok');
    } catch {
      setMic('denied');
    }
  };

  return (
    <div className="screen onboarding">
      <div className="dots">
        {[0, 1, 2].map((i) => (
          <span key={i} className={i === step ? 'dot-on' : ''} />
        ))}
      </div>

      {step === 0 && (
        <div className="ob-body">
          <div className="ob-hero">
            <Ru text="Приве́т!" />
          </div>
          <h1>רוסית בחמש דקות</h1>
          <p>{TOTAL_WORDS.toLocaleString('he')} המילים והביטויים שמכסים את רוב השיחות היומיומיות, במנות קטנות. נכנסים כשיש רגע פנוי, עונים על כמה תרגילים ויוצאים. הכול נשמר.</p>
          <ul className="ob-list">
            <li>האפליקציה זוכרת מה קשה לך ומחזירה את זה בדיוק בזמן</li>
            <li>כל מילה מגיעה עם משפט אמיתי מהחיים</li>
            <li>מדברים בקול כבר מהיום הראשון</li>
          </ul>
        </div>
      )}

      {step === 1 && (
        <div className="ob-body">
          <div className="ob-icon">
            <Icon name="volume" size={48} />
          </div>
          <h1>בדיקת קול</h1>
          <p>האפליקציה מקריאה כל מילה ברוסית. הקש על הכפתור ובדוק שאתה שומע <Ru text="Приве́т, как дела́?" /> במבטא רוסי.</p>
          <button
            type="button"
            className="btn solid"
            onClick={() => {
              say('Приве́т, как дела́?');
              setPlayed(true);
            }}
          >
            השמע
          </button>
          {played && (
            <p className="muted">
              לא שומע, או שזה נשמע מוזר? בהגדרות הטלפון: ניהול כללי ← שפה וקלט ← המרת טקסט לדיבור, בחר במנוע של Google והורד את נתוני הקול הרוסי. אפשר לבדוק שוב
              בכל רגע בהגדרות האפליקציה.
            </p>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="ob-body">
          <div className="ob-icon">
            <Icon name="mic" size={48} />
          </div>
          <h1>תרגול דיבור</h1>
          {sttSupported() ? (
            <>
              <p>בתרגילי הדיבור אתה חוזר על משפט בקול והאפליקציה בודקת אם הוא נשמע נכון. בשביל זה צריך הרשאה למיקרופון וחיבור לרשת.</p>
              {mic === 'unknown' && (
                <button type="button" className="btn solid" onClick={askMic}>
                  אפשר מיקרופון
                </button>
              )}
              {mic === 'ok' && <p className="ok-text">המיקרופון מוכן.</p>}
              {mic === 'denied' && <p className="muted">בלי מיקרופון תוכל עדיין לומר בקול ולסמן לבד אם הצלחת. אפשר לאשר מאוחר יותר בהגדרות האתר בכרום.</p>}
            </>
          ) : (
            <p>הדפדפן הזה לא תומך בזיהוי דיבור, אז בתרגילי הדיבור תאמר בקול ותסמן לבד אם הצלחת. בכרום באנדרואיד הזיהוי עובד.</p>
          )}
          <p className="muted">באוטובוס או בתור? מתג "אני באוטובוס" במסך הבית מכבה דיבור, האזנה וצלילים.</p>
        </div>
      )}

      <div className="ob-actions">
        <button type="button" className="btn primary big" onClick={() => (step < 2 ? setStep(step + 1) : finish())}>
          {step < 2 ? 'הלאה' : 'מתחילים'}
        </button>
        {step > 0 && (
          <button type="button" className="btn ghost" onClick={() => setStep(step - 1)}>
            חזרה
          </button>
        )}
      </div>
    </div>
  );
}
