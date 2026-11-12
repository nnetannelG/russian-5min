import type { AppState } from './store';

export interface GitHubTarget {
  owner: string;
  repo: string;
  token: string;
}

export const BACKUP_FILE = 'backup.json';

type FetchLike = typeof fetch;

/** Everything worth restoring. The access token never leaves the device. */
export function buildBackup(state: AppState, now: number): string {
  const { settings, ...rest } = state;
  const safeSettings = { ...settings, gh: { ...settings.gh, token: '' } };
  return JSON.stringify({ app: 'russian-5min', savedAt: now, state: { ...rest, settings: safeSettings } });
}

/** Parses a backup and keeps this device's own GitHub connection and backup bookkeeping. */
export function applyBackup(current: AppState, json: string): AppState {
  const data = JSON.parse(json);
  if (data?.app !== 'russian-5min' || !data.state?.cards || !data.state?.stats) {
    throw new Error('זה לא קובץ גיבוי של האפליקציה');
  }
  const restored = data.state as AppState;
  return {
    ...current,
    ...restored,
    settings: { ...current.settings, ...restored.settings, gh: current.settings.gh, onboarded: true },
    backup: current.backup,
  };
}

export function isConfigured(gh: GitHubTarget): boolean {
  return !!(gh.owner.trim() && gh.repo.trim() && gh.token.trim());
}

/** Back up at most once a day, and only when something changed or a previous try failed. */
export function shouldBackup(state: AppState, today: string, online: boolean): boolean {
  if (!online || !isConfigured(state.settings.gh)) return false;
  if (state.backup.pending) return true;
  return state.backup.dirty && state.backup.lastDay !== today;
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function api(gh: GitHubTarget): string {
  return `https://api.github.com/repos/${encodeURIComponent(gh.owner.trim())}/${encodeURIComponent(gh.repo.trim())}/contents/${BACKUP_FILE}`;
}

function headers(gh: GitHubTarget, accept = 'application/vnd.github+json'): Record<string, string> {
  return { Authorization: `Bearer ${gh.token.trim()}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28' };
}

function explain(status: number): string {
  if (status === 401) return 'הטוקן לא תקין או שפג תוקפו';
  if (status === 403) return 'לטוקן אין הרשאת כתיבה לריפו (Contents: Read and write)';
  if (status === 404) return 'הריפו לא נמצא, או שלטוקן אין גישה אליו';
  return `GitHub החזיר שגיאה ${status}`;
}

export async function pushBackup(gh: GitHubTarget, json: string, today: string, f: FetchLike = fetch): Promise<void> {
  const url = api(gh);
  const existing = await f(url, { headers: headers(gh), cache: 'no-store' });
  let sha: string | undefined;
  if (existing.ok) sha = (await existing.json()).sha;
  else if (existing.status !== 404) throw new Error(explain(existing.status));

  const res = await f(url, {
    method: 'PUT',
    headers: { ...headers(gh), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `backup ${today}`, content: toBase64(json), sha }),
  });
  if (!res.ok) throw new Error(explain(res.status));
}

export async function pullBackup(gh: GitHubTarget, f: FetchLike = fetch): Promise<string> {
  const res = await f(api(gh), { headers: headers(gh, 'application/vnd.github.raw+json'), cache: 'no-store' });
  if (res.status === 404) throw new Error('עוד אין גיבוי בריפו הזה');
  if (!res.ok) throw new Error(explain(res.status));
  return res.text();
}
