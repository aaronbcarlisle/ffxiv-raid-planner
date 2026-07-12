/**
 * TryNewUiBanner — the legacy shell's opt-in entry to the v2 UI (Phase R §5).
 * Rendered by the legacy Header on group routes; self-gates on the resolved
 * shell + a persisted dismissal. The Header's group-route gate is still
 * required — off group routes the resolver defaults to legacy and the banner
 * would show.
 */
import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { Button, IconButton } from '../primitives';
import { analytics } from '../../services/analytics';
import { useResolvedShell } from '../../lib/shellPreference';
import { useShellToggle } from '../../hooks/useShellToggle';

const DISMISS_KEY = 'ui-shell-banner-dismissed';

function readDismissed(): boolean {
  try { return localStorage.getItem(DISMISS_KEY) === 'true'; } catch { return false; }
}

export function TryNewUiBanner() {
  const resolvedShell = useResolvedShell();
  const toggle = useShellToggle('legacy-banner');
  const [dismissed, setDismissed] = useState(readDismissed);

  if (resolvedShell !== 'legacy' || dismissed) return null;

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 pl-2.5 pr-1 py-1">
      <Sparkles size={14} className="text-accent flex-shrink-0" aria-hidden />
      <Button variant="ghost" size="sm" onClick={() => toggle('v2')}>
        Try the new UI
      </Button>
      <IconButton
        icon={<X size={13} />}
        aria-label="Dismiss new UI banner"
        size="sm"
        variant="ghost"
        onClick={() => {
          try { localStorage.setItem(DISMISS_KEY, 'true'); } catch { /* session-only */ }
          analytics.track('navigation', 'ui_shell_banner_dismiss', {});
          setDismissed(true);
        }}
      />
    </div>
  );
}
