/**
 * BiSSourceFixBanner - Banner prompting to fix miscategorized BiS sources
 *
 * Displays a warning banner when gear slots have BiS sources that don't match
 * the detected item type (e.g., crafted item marked as raid, base tome marked as augmented tome).
 *
 * Auto-hides when all slots are correctly categorized.
 */

import { memo, useMemo, useState } from 'react';
import { Button, Tooltip } from '../primitives';
import { RefreshCw } from 'lucide-react';
import type { GearSlotStatus, GearSource } from '../../types';
import { getMiscategorizedSlots } from '../../utils/bisSourceDetection';
import { canEditGear, type MemberRole } from '../../utils/permissions';
import type { SnapshotPlayer } from '../../types';
import { toast } from '../../stores/toastStore';

export interface BiSSourceFixBannerProps {
  gear: GearSlotStatus[];
  player: SnapshotPlayer;
  userRole: MemberRole | null | undefined;
  currentUserId: string | null;
  isAdminAccess: boolean;
  onFixAllSources: (fixes: Array<{ slot: string; bisSource: GearSource }>) => void;
}

export const BiSSourceFixBanner = memo(function BiSSourceFixBanner({
  gear,
  player,
  userRole,
  currentUserId,
  isAdminAccess,
  onFixAllSources,
}: BiSSourceFixBannerProps) {
  const [isFixing, setIsFixing] = useState(false);

  // Check permission to edit gear
  const gearPermission = canEditGear(userRole, player, currentUserId ?? undefined, isAdminAccess);

  // Find all miscategorized slots
  const miscategorizedSlots = useMemo(() => getMiscategorizedSlots(gear), [gear]);

  // Don't show if no permission or no slots to fix
  if (!gearPermission.allowed || miscategorizedSlots.length === 0) {
    return null;
  }

  const handleFixAll = async () => {
    const fixes = miscategorizedSlots.map(({ slot, correctSource }) => ({
      slot,
      bisSource: correctSource,
    }));

    setIsFixing(true);
    try {
      await Promise.resolve(onFixAllSources(fixes));
      toast.success(`Updated ${fixes.length} BiS source${fixes.length > 1 ? 's' : ''}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to update BiS sources: ${message}`);
    } finally {
      setIsFixing(false);
    }
  };

  const slotCount = miscategorizedSlots.length;
  const message = slotCount === 1
    ? '1 slot needs BiS source update'
    : `${slotCount} slots need BiS source updates`;

  return (
    <div
      className="mx-3 mb-2 px-3 py-2 rounded-lg border-l-4 flex items-center justify-between gap-3 bg-status-warning/10 border-status-warning"
      role="status"
      aria-label={`BiS source fix needed: ${message}`}
    >
      <span className="text-sm text-status-warning">{message}</span>
      <Tooltip content="Automatically fix BiS source categories for detected items">
        <Button
          size="sm"
          variant="warning"
          leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isFixing ? 'animate-spin' : ''}`} />}
          disabled={isFixing}
          onClick={(e) => {
            e.stopPropagation();
            handleFixAll();
          }}
        >
          {isFixing ? 'Updating...' : 'Update BiS Source'}
        </Button>
      </Tooltip>
    </div>
  );
});
