/**
 * useStaticNavMemory — recent-statics MRU + per-static tab-memory writes.
 *
 * Promoted verbatim from GroupView.tsx (the legacy chrome), which previously
 * ran these two effects on its own — meaning neither "recently accessed
 * statics" nor per-static tab memory updated while browsing in the v2 shell
 * (NewShell never ran them). This hook is now the single source of both
 * behaviors; both GroupView and NewShell call it.
 *
 * Both effects key on the passed `shareCode` argument (the route param). The
 * original two effects keyed on two different things — the first on the raw
 * `shareCode` route param, the second on `currentGroup?.shareCode` — but those
 * are the same value in practice: `fetchGroupByShareCode` fetches the group BY
 * that exact code, so `currentGroup.shareCode === shareCode` once loaded.
 * Using the single passed argument for both is behavior-preserving.
 */

import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TRANSIENT_NAV_PARAMS } from '../lib/navPreferences';

export function useStaticNavMemory(shareCode: string | undefined): void {
  const [searchParams] = useSearchParams();

  // Track recently accessed statics in localStorage
  useEffect(() => {
    if (!shareCode) return;
    try {
      const MAX_RECENT = 10;
      const saved = localStorage.getItem('recent-statics');
      const recent: string[] = saved ? JSON.parse(saved) : [];
      const filtered = recent.filter(code => code !== shareCode);
      const updated = [shareCode, ...filtered].slice(0, MAX_RECENT);
      localStorage.setItem('recent-statics', JSON.stringify(updated));
    } catch {
      // Ignore localStorage errors
    }
  }, [shareCode]);

  // Persist this static's navigation state (tab + sub-tabs, minus transient
  // params) so the context switcher can restore it when the user enables
  // "remember tab per static". Keyed by share code — the unit it navigates by.
  // When that preference is OFF, the switcher instead carries the current tab
  // across, and when it's ON it reads this. Either way no forced reset here.
  useEffect(() => {
    if (!shareCode) return;
    try {
      const params = new URLSearchParams(searchParams);
      TRANSIENT_NAV_PARAMS.forEach(k => params.delete(k));
      localStorage.setItem(`static-nav-${shareCode}`, params.toString());
    } catch {
      // Ignore localStorage errors
    }
  }, [searchParams, shareCode]);
}
