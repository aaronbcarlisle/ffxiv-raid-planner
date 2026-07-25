/**
 * TopBar (F6a, Task 9) — the v2 shell's top chrome bar.
 *
 *   [StaticPicker] › [TierSelector] [⋮]   [Week n ‹ ›]   ──spacer──   [⌘K][+invite][🔔][☾]│[⚙]
 *
 * Composed from the new conformant `StaticPicker` + the `TierBreadcrumb`
 * composition fragment (which reuses the legacy `TierSelector` as-is; it lives
 * in `pages/` because Shell may not import Ring 0 under the F4 boundaries):
 *   • `StaticPicker`   — new (Task 9), replaces the legacy ContextSwitcher Static segment.
 *   • `TierBreadcrumb` — `› TierSelector [⋮]`, reuses TierSelector via `onTierChange`.
 *   • week indicator   — minimal, reads `currentWeek` from lootTrackingStore.
 *   • affordance cluster — ⌘K palette · invite (permission-gated) · bell · theme ·
 *                        │ divider · settings gear, in that render order.
 *
 * Conformant + boundary-clean by construction: design-system primitives only,
 * semantic tokens, 12px+ text, no raw `<button>`, and no Ring 0 imports. Legacy
 * Header/ContextSwitcher/TierSelector internals are untouched (byte-for-byte).
 */

import { useEffect } from 'react';
import { Command, UserPlus } from 'lucide-react';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { useTierStore } from '../../stores/tierStore';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { useInvitationStore } from '../../stores/invitationStore';
import { useSettingsPanelStore } from '../../stores/settingsPanelStore';
import { toast } from '../../stores/toastStore';
import { useStaticPermissions } from '../../hooks/useStaticPermissions';
import { TierBreadcrumb } from '../../pages/TierBreadcrumb';
import { IconButton, Tooltip } from '../primitives';
import { ThemeToggle } from '../ui/ThemeToggle';
import { StaticPicker } from './StaticPicker';
import { NotificationBell } from './NotificationBell';
import { SettingsGear } from './SettingsGear';

interface TopBarProps {
  /** Open the command palette (Task 11 placeholder — bell, gear, and theme are wired). */
  onOpenPalette: () => void;
  /** Open the notification center (hosted in NewShell, boundary-exempt). */
  onOpenNotifications: () => void;
}

/** Display-only week label. Reads `currentWeek` from the server-authoritative loot
 *  store — never writes it. `currentWeek` is mutated only by `fetchCurrentWeek` /
 *  `startNextWeek` / `revertWeek` (API-persisted); a plain setter does not exist by
 *  design, and silently writing it would corrupt priority math and log-week defaults.
 *  Full week navigation belongs to F6d (the Loot slice / week-clock owner). */
function WeekIndicator() {
  const currentWeek = useLootTrackingStore((s) => s.currentWeek);

  return (
    <div className="hidden md:flex items-center">
      <span className="text-xs font-medium text-text-secondary tabular-nums select-none">
        Week {currentWeek}
      </span>
    </div>
  );
}

export function TopBar({ onOpenPalette, onOpenNotifications }: TopBarProps) {
  const currentGroup = useStaticGroupStore((s) => s.currentGroup);
  const groups = useStaticGroupStore((s) => s.groups);
  const fetchGroups = useStaticGroupStore((s) => s.fetchGroups);
  const tiers = useTierStore((s) => s.tiers);

  const { userRole, isMember, canManageInvitations } = useStaticPermissions();

  const invitations = useInvitationStore((s) => s.invitations);
  const fetchInvitations = useInvitationStore((s) => s.fetchInvitations);

  // Fetch invitations for the invite affordance — mirrors legacy Header.tsx:100-105
  // (canManageInvitations-gated; the legacy isGroupRoute/currentGroup conditions are
  // implied here since TopBar only mounts in group view).
  const currentGroupId = currentGroup?.id;
  useEffect(() => {
    if (canManageInvitations && currentGroupId) {
      fetchInvitations(currentGroupId);
    }
  }, [canManageInvitations, currentGroupId, fetchInvitations]);

  // Fresh-audited port of legacy Header.tsx's handleInviteMembers (Header.tsx:123-150).
  // DELIBERATE DEVIATION: legacy falls back to a document.execCommand('copy') textarea
  // on clipboard failure; v2 drops that fallback and shows toast.error('Failed to copy')
  // instead, per the F6d/F6e clipboard rule (try/catch, success toast only on
  // fulfillment, error toast on rejection).
  const activeInvitation = invitations.find((inv) => inv.isValid);

  const handleInvite = async () => {
    if (!currentGroup) return;

    if (activeInvitation) {
      const url = `${window.location.origin}/invite/${activeInvitation.inviteCode}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Invite link copied!');
      } catch {
        toast.error('Failed to copy');
      }
    } else {
      useSettingsPanelStore.getState().open({
        tab: 'recruitment',
        section: 'invitations',
        highlightCreateInvite: true,
      });
    }
  };

  return (
    <header
      className="sticky top-0 z-40 border-b border-border-default"
      style={{ background: 'var(--color-surface-nav, var(--color-surface-raised))' }}
    >
      <div className="flex items-center gap-2 px-3 sm:px-4 h-14 min-w-0">
        {/* Breadcrumb: static › tier [⋮] */}
        <div className="flex items-center gap-1.5 min-w-0">
          <StaticPicker
            currentGroup={currentGroup}
            groups={groups}
            onFetchGroups={fetchGroups}
            isMember={isMember || groups.length > 0}
            userRole={userRole ?? undefined}
          />
          {/* Tier breadcrumb + week are desktop-only, matching the legacy
              Header's mobile IA (its tier selector is likewise hidden below
              sm): at phone widths the tier block refuses to shrink and
              overlaps the icon cluster (Phase-G mobile-pass finding). Tier
              switching on mobile stays available via Settings. */}
          <div className="hidden sm:flex items-center gap-1.5 min-w-0">
            <TierBreadcrumb />
          </div>
        </div>

        {/* Week indicator (desktop-only, same rationale as the breadcrumb) */}
        {currentGroup && tiers.length > 0 && (
          <div className="hidden sm:flex">
            <WeekIndicator />
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Affordance cluster (Task 10: bell/gear/theme wired; Task 11: ⌘K palette) */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          <Tooltip content="Command palette">
            <IconButton
              aria-label="Command palette"
              icon={<Command className="w-5 h-5" />}
              variant="ghost"
              size="md"
              onClick={onOpenPalette}
            />
          </Tooltip>
          {canManageInvitations && (
            <Tooltip content="Invite members">
              <IconButton
                aria-label="Invite members"
                icon={<UserPlus className="w-5 h-5" />}
                variant="ghost"
                size="md"
                onClick={handleInvite}
              />
            </Tooltip>
          )}
          <NotificationBell onOpen={onOpenNotifications} />
          <ThemeToggle />
          <span className="w-px h-4 bg-border-subtle flex-shrink-0" aria-hidden />
          <SettingsGear />
        </div>
      </div>
    </header>
  );
}
