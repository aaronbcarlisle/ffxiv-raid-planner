/**
 * General Tab — user-level settings (your account, all statics).
 *
 * Currently hosts the navigation tab-persistence control. Available to every
 * signed-in member regardless of role (it's user-scoped, not static config).
 */
import { useAuthStore } from '../../stores/authStore';
import { Toggle } from '../ui';

export function GeneralTab() {
  const user = useAuthStore((s) => s.user);
  const updatePreferences = useAuthStore((s) => s.updatePreferences);
  const resetTabs = user?.tabPersistence === 'reset';

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-6" style={{ scrollbarGutter: 'stable' }}>
      <section>
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Navigation</h3>
        <div className="rounded-xl border border-border-default bg-surface-elevated p-4 flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary">Reset tabs to default</p>
            <p className="text-xs text-text-muted mt-0.5">
              When on, every view opens on its default tab instead of the last one you used.
              Applies across all your statics and devices.
            </p>
          </div>
          <Toggle
            checked={resetTabs}
            onChange={(checked) => updatePreferences({ tabPersistence: checked ? 'reset' : 'remember' })}
            aria-label="Reset tabs to default"
          />
        </div>
      </section>
    </div>
  );
}
