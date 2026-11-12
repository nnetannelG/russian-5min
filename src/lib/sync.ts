import { applyBackup, buildBackup, pullBackup, pushBackup, shouldBackup } from './backup';
import { getState, replaceState, update } from './store';
import { dayKey } from './text';

let running = false;

/** Pushes a backup to GitHub. Without `force` it only runs when the daily backup is due. */
export async function runBackup(force = false): Promise<boolean> {
  const snapshot = getState();
  const now = Date.now();
  const today = dayKey(now);
  if (running) return false;
  if (!force && !shouldBackup(snapshot, today, navigator.onLine)) return false;
  running = true;
  try {
    await pushBackup(snapshot.settings.gh, buildBackup(snapshot, now), today);
    update(
      (s) => ({
        ...s,
        backup: {
          lastDay: today,
          lastAt: now,
          // Anything answered while the upload was running still needs a backup.
          dirty: s.cards !== snapshot.cards || s.stats !== snapshot.stats || s.custom !== snapshot.custom,
          pending: false,
          error: null,
        },
      }),
      { touchBackup: false },
    );
    return true;
  } catch (e) {
    const offline = e instanceof TypeError;
    const error = offline ? 'אין חיבור לרשת' : e instanceof Error ? e.message : 'שגיאה לא ידועה';
    update((s) => ({ ...s, backup: { ...s.backup, pending: true, error } }), { touchBackup: false });
    return false;
  } finally {
    running = false;
  }
}

export async function restoreFromGitHub(): Promise<void> {
  const json = await pullBackup(getState().settings.gh);
  replaceState(applyBackup(getState(), json));
}

export function exportToFile(): void {
  const now = Date.now();
  const blob = new Blob([buildBackup(getState(), now)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `russian-5min-${dayKey(now)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function importFromFile(file: File): Promise<void> {
  replaceState(applyBackup(getState(), await file.text()));
}

let autoStarted = false;

/** Retries the daily backup whenever the app comes back or the network returns. */
export function startAutoBackup(): void {
  if (autoStarted) return;
  autoStarted = true;
  const tick = () => void runBackup();
  tick();
  window.addEventListener('online', tick);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && tick());
}
