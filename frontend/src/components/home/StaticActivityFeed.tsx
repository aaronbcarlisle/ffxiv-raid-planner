/**
 * StaticActivityFeed (ring0 `home/`)
 *
 * "Recent activity" Home card (spec §5.12): privacy-filtered loot/material/mount
 * activity rows for the static this week. Each row is a source badge + text +
 * relative timestamp, matching the legacy `RecentActivityModule` row shape;
 * empty → `EmptyStateInvite`.
 *
 * Boundary discipline (ring0): reads stores (`mountFarmStore` + `authStore` —
 * ring0→store is allowed) and the not-ring-typed `utils/staticActivity` derivation,
 * and composes shared `ui/` components. It NEVER imports a ring1/ring3 component —
 * notably it reads the mount-farm *store*, not a `components/mount-farms/*` (ring3).
 *
 * The privacy model lives entirely in `deriveActivityItems` (manual = named,
 * plugin = anonymized "A member…", system = aggregate; visibility filter; honors
 * `user.activityDisplayMode`). This component only renders the result.
 */

import { Activity, Plug, Sparkles, Target, Trophy, type LucideIcon } from 'lucide-react';
import { CardShell } from '../ui/CardShell';
import { EmptyStateInvite } from '../ui/EmptyStateInvite';
import { useMountFarmStore } from '../../stores/mountFarmStore';
import { useAuthStore } from '../../stores/authStore';
import { deriveActivityItems, type StaticActivityItem } from '../../utils/staticActivity';

/** Source badge per activity icon — token-clean tints (no raw color). */
const ICON_BADGE: Record<StaticActivityItem['icon'], { Icon: LucideIcon; className: string }> = {
  mount: { Icon: Trophy, className: 'bg-status-warning/15 text-status-warning' },
  currency: { Icon: Target, className: 'bg-status-info/15 text-status-info' },
  plugin: { Icon: Plug, className: 'bg-accent/15 text-accent' },
  tracking: { Icon: Sparkles, className: 'bg-membership-lead/15 text-membership-lead' },
};

export function StaticActivityFeed() {
  const data = useMountFarmStore((s) => s.data);
  const user = useAuthStore((s) => s.user);

  const items = data ? deriveActivityItems(data, user?.id, user?.activityDisplayMode) : [];

  return (
    <CardShell
      title="Recent activity"
      headerRight={<span className="text-xs text-text-tertiary leading-none">this week</span>}
    >
      {items.length === 0 ? (
        <EmptyStateInvite
          icon={<Activity className="h-5 w-5" />}
          title="No activity yet this week"
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border-subtle">
          {items.map((item) => {
            const { Icon, className } = ICON_BADGE[item.icon];
            return (
              <li key={item.key} className="flex items-center gap-2 py-2 first:pt-0 last:pb-0">
                <span
                  className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded ${className}`}
                  aria-hidden="true"
                >
                  <Icon className="h-3 w-3" />
                </span>
                <p className="min-w-0 flex-1 truncate text-xs text-text-primary">{item.label}</p>
                <span className="flex-shrink-0 text-xs text-text-tertiary">{item.time}</span>
              </li>
            );
          })}
        </ul>
      )}
    </CardShell>
  );
}
