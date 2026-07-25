/**
 * TryNewUiBanner — the legacy shell's opt-in entry to the v2 UI (Phase R §5).
 * Rendered by the legacy Header on group routes; self-gates on the resolved
 * shell + a persisted dismissal. The Header's group-route gate is still
 * required — off group routes the resolver defaults to legacy and the banner
 * would show.
 *
 * LAUNCH GATE: admin-only until the v2 nav-coverage Stage-1 criterion is met
 * ("anything reachable from v2 stays in v2" — design/redesign/V2_COVERAGE_PLAN.md).
 * The dual-shell code ships to main dark; admins dogfood v2 in production while
 * regular users (and guests, who could previously see this banner on shared
 * statics) never encounter it. `?shell=v2` remains a deliberate power-user
 * escape hatch. To launch: remove the isAdmin condition and its tests' gate rows.
 */
import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { Button, IconButton } from '../primitives';
import { analytics } from '../../services/analytics';
import { useAuthStore } from '../../stores/authStore';
import { useResolvedShell } from '../../lib/shellPreference';
import { useShellToggle } from '../../hooks/useShellToggle';

const DISMISS_KEY = 'ui-shell-banner-dismissed';

function readDismissed(): boolean {
  try { return localStorage.getItem(DISMISS_KEY) === 'true'; } catch { return false; }
}

export function TryNewUiBanner({ className = '' }: { className?: string }) {
  const isAdmin = useAuthStore((s) => s.user?.isAdmin ?? false);
  const resolvedShell = useResolvedShell();
  const toggle = useShellToggle('legacy-banner');
  const [dismissed, setDismissed] = useState(readDismissed);

  if (!isAdmin || resolvedShell !== 'legacy' || dismissed) return null;

  return (
    <div className={`flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 pl-2.5 pr-1 py-1 ${className}`.trim()}>
      <Sparkles size={14} className="text-accent flex-shrink-0" aria-hidden />
      <Button variant="ghost" size="sm" onClick={() => toggle('v2')}>
        Try the new UI
      </Button>
      {/* ml-auto: on the full-width mobile row the dismiss sits at the right
          edge; in the shrink-wrapped desktop pill it resolves to zero. */}
      <span className="ml-auto">
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
      </span>
    </div>
  );
}
