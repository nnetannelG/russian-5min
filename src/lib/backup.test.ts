import { describe, expect, it, vi } from 'vitest';
import { applyBackup, buildBackup, pullBackup, pushBackup, shouldBackup } from './backup';
import { introduce } from './srs';
import { initialState, type AppState } from './store';

vi.mock('idb-keyval', () => ({ get: vi.fn(), set: vi.fn() }));

const gh = { owner: 'me', repo: 'backup', token: 'secret-token' };

function sample(): AppState {
  const s = initialState(0);
  return {
    ...s,
    cards: { привет: introduce(1000) },
    stats: { ...s.stats, xp: 420 },
    settings: { ...s.settings, gh, onboarded: true },
    backup: { ...s.backup, dirty: true },
  };
}

function res(status: number, body: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => String(body),
  } as Response;
}

const asFetch = (f: unknown) => f as typeof fetch;

describe('backup', () => {
  it('never writes the token into the backup and round-trips progress', () => {
    const json = buildBackup(sample(), 5);
    expect(json).not.toContain('secret-token');
    const fresh = { ...initialState(0), settings: { ...initialState(0).settings, gh } };
    const restored = applyBackup(fresh, json);
    expect(restored.stats.xp).toBe(420);
    expect(Object.keys(restored.cards)).toEqual(['привет']);
    expect(restored.settings.gh.token).toBe('secret-token');
  });

  it('rejects files that are not backups', () => {
    expect(() => applyBackup(initialState(0), '{"hello":1}')).toThrow();
  });

  it('backs up once a day, only when configured, online and changed', () => {
    const s = sample();
    const day = '2026-03-02';
    expect(shouldBackup(s, day, true)).toBe(true);
    expect(shouldBackup(s, day, false)).toBe(false);
    expect(shouldBackup({ ...s, backup: { ...s.backup, lastDay: day } }, day, true)).toBe(false);
    expect(shouldBackup({ ...s, backup: { ...s.backup, dirty: false } }, day, true)).toBe(false);
    expect(shouldBackup({ ...s, backup: { ...s.backup, lastDay: day, pending: true } }, day, true)).toBe(true);
    const noToken = { ...s, settings: { ...s.settings, gh: { ...gh, token: '' } } };
    expect(shouldBackup(noToken, day, true)).toBe(false);
  });

  it('creates the file on first push and updates it with the sha afterwards', async () => {
    const first = vi.fn().mockResolvedValueOnce(res(404)).mockResolvedValueOnce(res(201));
    await pushBackup(gh, '{"a":"שלום"}', '2026-03-02', asFetch(first));
    const put1 = JSON.parse(first.mock.calls[1][1].body);
    expect(first.mock.calls[1][0]).toBe('https://api.github.com/repos/me/backup/contents/backup.json');
    expect(first.mock.calls[1][1].headers.Authorization).toBe('Bearer secret-token');
    expect(put1.sha).toBeUndefined();
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(put1.content), (c) => c.charCodeAt(0)));
    expect(decoded).toBe('{"a":"שלום"}');

    const second = vi.fn().mockResolvedValueOnce(res(200, { sha: 'abc' })).mockResolvedValueOnce(res(200));
    await pushBackup(gh, '{}', '2026-03-03', asFetch(second));
    expect(JSON.parse(second.mock.calls[1][1].body).sha).toBe('abc');
  });

  it('reports failures so the app can retry later', async () => {
    const denied = vi.fn().mockResolvedValueOnce(res(404)).mockResolvedValueOnce(res(403));
    await expect(pushBackup(gh, '{}', 'd', asFetch(denied))).rejects.toThrow();
    const badToken = vi.fn().mockResolvedValueOnce(res(401));
    await expect(pushBackup(gh, '{}', 'd', asFetch(badToken))).rejects.toThrow();
    const offline = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(pushBackup(gh, '{}', 'd', asFetch(offline))).rejects.toThrow();
  });

  it('pulls the raw backup', async () => {
    const f = vi.fn().mockResolvedValueOnce(res(200, 'DATA'));
    expect(await pullBackup(gh, asFetch(f))).toBe('DATA');
    const missing = vi.fn().mockResolvedValueOnce(res(404));
    await expect(pullBackup(gh, asFetch(missing))).rejects.toThrow();
  });
});
