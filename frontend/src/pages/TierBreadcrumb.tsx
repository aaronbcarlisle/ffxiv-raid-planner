/**
 * TierBreadcrumb (F6a, Task 9) — the `› [TierSelector] [⋮]` fragment of the v2 TopBar.
 *
 * Lives in `pages/` ON PURPOSE: it composes a Ring 0 feature (`TierSelector`,
 * `components/static-group`) and the page-level GroupActions context into the
 * chrome. `components/layout/TopBar` is the Shell layer, which the F4 ring
 * boundaries forbid from importing Ring 0 — so the TopBar reuses this from the
 * `pages/` composition layer (Shell → page is allowed; page is boundary-exempt).
 * This keeps the new v2 shell components boundary-clean (no new suppressions),
 * while still REUSING the legacy `TierSelector` as-is via its `onTierChange`
 * prop — `TierSelector` itself is untouched (byte-for-byte for the legacy route).
 *
 * Rendered inside `<GroupActionModals>` (via TopBar), so `useGroupActions()`
 * resolves to the shared chrome handlers.
 */

import { useMemo } from 'react';
import { Plus, Copy, Trash2 } from 'lucide-react';
import { useTierStore } from '../stores/tierStore';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import { useStaticPermissions } from '../hooks/useStaticPermissions';
import { useGroupActions } from './groupActionsContext';
import { TierSelector } from '../components/static-group';
import { TierActionsMenu } from '../components/ui';
import { RAID_TIERS } from '../gamedata';

export function TierBreadcrumb() {
  const currentGroup = useStaticGroupStore((s) => s.currentGroup);
  const tiers = useTierStore((s) => s.tiers);
  const currentTier = useTierStore((s) => s.currentTier);
  const { canEdit } = useStaticPermissions();
  const { onTierChange, onNewTier, onRollover, onDeleteTier } = useGroupActions();

  // Tiers still available to create (drives the New/Rollover disabled state) —
  // same derivation the legacy Header uses.
  const availableTiers = useMemo(() => {
    const existingTierIds = tiers.map((t) => t.tierId);
    return RAID_TIERS.filter((t) => !existingTierIds.includes(t.id));
  }, [tiers]);

  // Tier kebab actions — wired to the shared GroupActions context handlers
  // (the same handlers the legacy Header reaches via HEADER_EVENTS).
  const tierActions = useMemo(() => [
    {
      id: 'new-tier',
      label: 'Create New Tier',
      icon: <Plus className="w-4 h-4" />,
      shortcut: 'Alt+Shift+N',
      disabled: availableTiers.length === 0,
      tooltip: availableTiers.length === 0 ? 'All tiers have been created' : undefined,
      onClick: () => onNewTier(),
    },
    {
      id: 'rollover',
      label: 'Copy to New Tier',
      icon: <Copy className="w-4 h-4" />,
      shortcut: 'Alt+Shift+R',
      disabled: !currentTier || availableTiers.length === 0,
      tooltip: !currentTier ? 'Create a tier first' : availableTiers.length === 0 ? 'All tiers have been created' : undefined,
      onClick: () => onRollover(),
    },
    {
      id: 'delete-tier',
      label: 'Delete Tier',
      icon: <Trash2 className="w-4 h-4" />,
      danger: true,
      disabled: !currentTier || tiers.length <= 1,
      tooltip: !currentTier ? 'No tier to delete' : tiers.length <= 1 ? 'Cannot delete the last tier' : undefined,
      onClick: () => onDeleteTier(),
    },
  // Depend on the arrays themselves (identity), not just their lengths, so the
  // memo recomputes when tiers change with the same count (e.g. switching statics
  // with the same number of tiers but different tier IDs). (Fix 4, PR #163)
  ], [availableTiers, currentTier, tiers, onNewTier, onRollover, onDeleteTier]);

  if (!currentGroup || tiers.length === 0) return null;

  return (
    <div className="flex items-center gap-1 min-w-0">
      <span className="text-text-muted text-lg" aria-hidden>›</span>
      <TierSelector
        tiers={tiers}
        currentTierId={currentTier?.tierId}
        onTierChange={onTierChange}
      />
      {canEdit && tierActions.length > 0 && (
        <TierActionsMenu actions={tierActions} />
      )}
    </div>
  );
}
