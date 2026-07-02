/**
 * Preference-gated tab memory. All navigational tab persistence routes through
 * here so a single user preference (`tabPersistence`) governs remember-vs-reset
 * site-wide. In `'reset'` mode, reads return the default and writes are no-ops
 * (so stale values don't accumulate).
 */
import { useAuthStore } from '../stores/authStore';

function mode(): 'remember' | 'reset' {
  return useAuthStore.getState().user?.tabPersistence ?? 'remember';
}

/** Scope a base key per static (or any scope): `tabKey('group-view-tab', shareCode)`. */
export function tabKey(base: string, scope?: string): string {
  return scope ? `${base}:${scope}` : base;
}

export function recallTab<T extends string>(key: string, valid: readonly T[], fallback: T): T {
  if (mode() === 'reset') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw && (valid as readonly string[]).includes(raw)) return raw as T;
  } catch { /* ignore */ }
  return fallback;
}

export function rememberTab(key: string, value: string): void {
  if (mode() === 'reset') return;
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}
