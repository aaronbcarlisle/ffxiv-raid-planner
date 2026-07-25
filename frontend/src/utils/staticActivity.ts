/**
 * staticActivity — privacy-filtered "recent activity" derivation for the static.
 *
 * Promoted VERBATIM from `components/static-group/StaticHomeTab.tsx` (the local
 * `deriveActivityItems` + `StaticActivityItem` + the `relativeTime` helper it
 * depends on). The logic is byte-for-byte identical to the legacy copy; only the
 * imports were adjusted and the moved symbols exported. The legacy tab is
 * repointed to import from here so the two never drift (and so the ~145-line
 * derivation is not duplicated — the F2 jscpd fail-on-new gate would flag a
 * copy). `utils/` is not ring-typed, so any ring may import this.
 *
 * Privacy model (do NOT change — load-bearing):
 *   - Manual entries  → actor NAMED (explicit user action)
 *   - Plugin entries  → actor anonymized ("A member …") — personal sync must not leak
 *   - Plugin aggregate → system label, no individual actor
 *   - Only 'static'/'public' visibility rows reach the Overview
 *   - `activityDisplayMode === 'anonymous'` anonymizes the viewer's OWN named rows
 */

import { getTrialById } from '../gamedata';
import type { MountFarmData } from '../stores/mountFarmStore';

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Activity privacy model ───────────────────────────────────────────────────
//
// Visibility rules for Static Overview:
//   'static'  — safe to show to all static members
//   'leaders' — only owner/lead should see (not currently shown in Overview)
//   'private' — personal-only, must NOT appear in Static Overview
//   'public'  — safe for anyone
//
// Actor display rules:
//   'named'     — actor name is shown (explicit manual action)
//   'anonymous' — plugin-sourced: show "A member" to prevent personal sync leakage
//   'system'    — no actor (system/aggregate event)

type ActivityVisibility = 'private' | 'leaders' | 'static' | 'public';
type ActivityActorDisplay = 'named' | 'anonymous' | 'system';

export interface StaticActivityItem {
  key: string;
  actorUserId?: string | null;
  actorDisplayName?: string | null;
  actorDisplay: ActivityActorDisplay;
  visibility: ActivityVisibility;
  type: 'mount_progress' | 'plugin_sync';
  icon: 'mount' | 'currency' | 'tracking' | 'plugin';
  label: string;
  createdAt: string;
  time: string;
}

export function deriveActivityItems(
  data: MountFarmData,
  currentUserId?: string | null,
  activityDisplayMode?: 'named' | 'anonymous' | null,
): StaticActivityItem[] {
  interface FlatEntry {
    key: string;
    createdAt: string;
    icon: StaticActivityItem['icon'];
    label: string;
    actorDisplay: ActivityActorDisplay;
    visibility: ActivityVisibility;
    type: StaticActivityItem['type'];
    actorUserId?: string | null;
    actorDisplayName?: string | null;
  }

  const flat: FlatEntry[] = [];
  let pluginSyncAt: string | null = null;

  for (const trial of data.trials) {
    const trialInfo = getTrialById(trial.trialId);
    const dutyName = trialInfo?.dutyName ?? trial.trialId;
    const mountName = trialInfo?.mountName ?? 'mount';

    for (const mp of trial.memberProgress) {
      if (!mp.updatedAt) continue;

      const ownerPlugin = mp.ownershipSource === 'plugin';
      const totemPlugin = mp.totemSource === 'plugin';
      const isPlugin = ownerPlugin || totemPlugin;

      if (isPlugin) {
        // Aggregate the latest plugin sync timestamp for the system row
        if (mp.lastPluginSyncAt && (!pluginSyncAt || mp.lastPluginSyncAt > pluginSyncAt)) {
          pluginSyncAt = mp.lastPluginSyncAt;
        }
        // Plugin-sourced individual rows: actor name is NOT shown (privacy rule).
        // Personal plugin sync details must not leak onto Static Overview.
        if (mp.hasMount && ownerPlugin) {
          flat.push({
            key: `${trial.trialId}-${mp.userId}-obtained`,
            createdAt: mp.updatedAt,
            icon: 'mount',
            label: `A member obtained ${mountName}`,
            actorDisplay: 'anonymous',
            visibility: 'static',
            type: 'mount_progress',
            actorUserId: null,
            actorDisplayName: null,
          });
        } else if (mp.totemCount > 0 && totemPlugin) {
          flat.push({
            key: `${trial.trialId}-${mp.userId}-currency`,
            createdAt: mp.updatedAt,
            icon: 'currency',
            label: `A member updated collection progress`,
            actorDisplay: 'anonymous',
            visibility: 'static',
            type: 'mount_progress',
            actorUserId: null,
            actorDisplayName: null,
          });
        }
        continue;
      }

      // Manual sources: actor name is shown (explicit user action)
      if (mp.hasMount) {
        flat.push({
          key: `${trial.trialId}-${mp.userId}-obtained`,
          createdAt: mp.updatedAt,
          icon: 'mount',
          label: `${mp.displayName} obtained ${mountName}`,
          actorDisplay: 'named',
          visibility: 'static',
          type: 'mount_progress',
          actorUserId: mp.userId,
          actorDisplayName: mp.displayName,
        });
      } else if (mp.totemCount > 0) {
        flat.push({
          key: `${trial.trialId}-${mp.userId}-currency`,
          createdAt: mp.updatedAt,
          icon: 'currency',
          label: `${mp.displayName} updated ${dutyName} progress`,
          actorDisplay: 'named',
          visibility: 'static',
          type: 'mount_progress',
          actorUserId: mp.userId,
          actorDisplayName: mp.displayName,
        });
      } else if (mp.wantsMount) {
        flat.push({
          key: `${trial.trialId}-${mp.userId}-tracking`,
          createdAt: mp.updatedAt,
          icon: 'tracking',
          label: `${mp.displayName} started tracking ${dutyName}`,
          actorDisplay: 'named',
          visibility: 'static',
          type: 'mount_progress',
          actorUserId: mp.userId,
          actorDisplayName: mp.displayName,
        });
      }
    }
  }

  // System-level aggregate for plugin sync activity — no individual actor
  if (pluginSyncAt) {
    flat.push({
      key: 'plugin-sync',
      createdAt: pluginSyncAt,
      icon: 'plugin',
      label: 'Shared mount data updated',
      actorDisplay: 'system',
      visibility: 'static',
      type: 'plugin_sync',
    });
  }

  // Static Overview only shows 'static' and 'public' visibility items.
  // 'private' (personal plugin sync details) and 'leaders' rows are excluded.
  const visible = flat.filter((f) => f.visibility === 'static' || f.visibility === 'public');
  visible.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return visible.slice(0, 5).map((f) => {
    const shouldAnonymize =
      activityDisplayMode === 'anonymous' &&
      currentUserId &&
      f.actorUserId === currentUserId &&
      f.actorDisplay === 'named';
    return {
      key: f.key,
      actorUserId: shouldAnonymize ? null : f.actorUserId,
      actorDisplayName: shouldAnonymize ? null : f.actorDisplayName,
      actorDisplay: shouldAnonymize ? ('anonymous' as ActivityActorDisplay) : f.actorDisplay,
      visibility: f.visibility,
      type: f.type,
      icon: f.icon,
      label: shouldAnonymize ? f.label.replace(f.actorDisplayName ?? '', 'A member') : f.label,
      createdAt: f.createdAt,
      time: relativeTime(f.createdAt),
    };
  });
}
