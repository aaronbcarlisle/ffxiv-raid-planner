import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { BiSTargetManagerModal } from '../bis/BiSTargetManagerModal';
import { useBisTargetStore } from '../../stores/bisTargetStore';

interface BiSTargetPanelProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  /** roster_member_job ownerId — the SnapshotPlayer / RosterMemberJob id */
  playerId: string;
  job: string;
  canEdit: boolean;
}

/**
 * Roster BiS target panel — wraps BiSTargetManagerModal for the roster_member_job context.
 *
 * Shows a migration notice when the player still has localStorage-only BiS data from
 * the old bisTargetStore. Data is NOT automatically migrated; the user is asked to
 * re-add their targets via the new backend-persisted system.
 */
export function BiSTargetPanel({ isOpen, onClose, groupId, playerId, job, canEdit }: BiSTargetPanelProps) {
  const localTargets = useBisTargetStore((s) => s.getTargets(groupId, playerId, job));
  const hasLegacyData = useMemo(() => localTargets.length > 0, [localTargets.length]);

  if (!isOpen) return null;

  return (
    <>
      {hasLegacyData && (
        <div className="fixed top-4 left-1/2 z-[9999] -translate-x-1/2 max-w-sm w-full rounded-lg border border-status-warning/40 bg-status-warning/10 px-4 py-3 text-sm text-status-warning shadow-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p className="font-medium">Local targets found</p>
              <p className="text-xs text-text-secondary mt-0.5">
                {localTargets.length} BiS target{localTargets.length !== 1 ? 's' : ''} for {job} are saved only in this browser.
                Please re-add them here to sync across devices.
              </p>
            </div>
          </div>
        </div>
      )}
      <BiSTargetManagerModal
        ownerType="roster_member_job"
        ownerId={playerId}
        groupId={groupId}
        job={job}
        canEdit={canEdit}
        onClose={onClose}
      />
    </>
  );
}
