import { useSyncExternalStore } from 'react';

function read(): string {
  return decodeURIComponent(location.hash.replace(/^#\/?/, ''));
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

/** Current route as path segments, e.g. ['word', 'привет']. */
export function useRoute(): string[] {
  const path = useSyncExternalStore(subscribe, read);
  return path ? path.split('/') : [];
}

export function go(path: string): void {
  location.hash = '/' + path.split('/').map(encodeURIComponent).join('/');
}

/** Replaces the current entry, so "back" skips it (used for tab switches). */
export function swap(path: string): void {
  const url = '#/' + path.split('/').map(encodeURIComponent).join('/');
  history.replaceState(null, '', url);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function back(fallback = ''): void {
  if (history.length > 1) history.back();
  else swap(fallback);
}
