import { useState } from 'react';
import { JobIcon } from '../ui/JobIcon';
import { Badge } from '../primitives/Badge';
import { IconButton } from '../primitives/IconButton';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Button } from '../primitives/Button';
import { useModal } from '../../hooks/useModal';
import { PriorityBadge } from './PriorityBadge';
import { ReadinessBadge } from './ReadinessBadge';
import { SourceBadge } from './SourceBadge';
import { getFreshness, freshnessColor } from './freshness';
import type { GearSnapshot, GearSlotData, PlayerJobProfile } from '../../stores/playerProfileStore';
import { usePlayerProfileStore } from '../../stores/playerProfileStore';
import { useSharedBisStore } from '../../stores/sharedBisStore';
import { getJobDisplayName } from '../../gamedata/jobs';
import { toast } from '../../stores/toastStore';
import { formatGearActivity, getJobGearState, getBiSCompareStatus } from './jobGearUtils';

interface JobProfileCardProps {
  jobProfile: PlayerJobProfile;
  resolvedSnapshot?: GearSnapshot | null;
  onEdit: (jobProfile: PlayerJobProfile) => void;
  onManageBiS?: (jobProfileId: string) => void;
}

const SLOT_LABELS: Record<string, string> = {
  weapon: 'Weapon',
  head: 'Head',
  body: 'Body',
  hands: 'Hands',
  legs: 'Legs',
  feet: 'Feet',
  earring: 'Earring',
  necklace: 'Necklace',
  bracelet: 'Bracelet',
  ring1: 'Ring 1',
  ring2: 'Ring 2',
};

function GearSlotCompactRow({ slot }: { slot: GearSlotData }) {
  const itemName = slot.equippedItemName || 'Empty';
  const itemLevel = slot.equippedItemLevel || slot.itemLevel || 0;

  return (
    <div className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)_44px] items-center gap-2 rounded-md bg-surface-elevated/60 px-2 py-1.5 text-xs">
      <span className="truncate text-text-tertiary">{SLOT_LABELS[slot.slot] ?? slot.slot}</span>
      <span className={`min-w-0 truncate ${itemName === 'Empty' ? 'text-text-tertiary italic' : 'text-text-secondary'}`}>
        {itemName}
      </span>
      <span className="text-right font-mono text-text-muted">{itemLevel || '-'}</span>
    </div>
  );
}

const PURPOSE_LABELS: Record<string, string> = {
  savage: 'Savage', ultimate: 'Ultimate', prog: 'Prog',
  farm: 'Farm', speed: 'Speed', comfort: 'Comfort', custom: 'Custom',
  savage_prog: 'Savage Prog', savage_reclear: 'Reclear',
  week1: 'Week 1', alt_job: 'Alt Job', parse: 'Parse',
};

export function JobProfileCard({ jobProfile, resolvedSnapshot, onEdit, onManageBiS }: JobProfileCardProps) {
  const { deleteJobProfile } = usePlayerProfileStore();
  const bisStore = useSharedBisStore();
  const deleteModal = useModal();
  const [expanded, setExpanded] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteJobProfile(jobProfile.id);
      toast.success(`Removed ${jobProfile.job} profile`);
    } catch {
      toast.error('Failed to remove job profile');
    }
  };

  const snapshot = resolvedSnapshot ?? jobProfile.gearSnapshot;
  // Read from sharedBisStore (live, post-modal) and fall back to embedded profile data on first load
  const storeTargets = bisStore.getTargets('player_job_profile', jobProfile.id);
  const bisTargets = storeTargets.length > 0 ? storeTargets : (jobProfile.bisTargets ?? []);
  const activeBisTarget = bisTargets.find((t) => t.isActive) ?? null;
  const bisTargetCount = bisTargets.length;
  const compareStatus = getBiSCompareStatus(snapshot, activeBisTarget);
  const freshness = snapshot ? getFreshness(snapshot.syncedAt) : 'none';
  const isStale = freshness === 'stale' || freshness === 'old';
  const gearState = getJobGearState(jobProfile, snapshot);

  return (
    <div className={`min-w-0 overflow-hidden bg-surface-raised rounded-lg border transition-colors hover:border-border-hover ${
      jobProfile.priority === 'main' ? 'border-accent/30 ring-1 ring-accent/10' : 'border-border-default'
    } p-4`}>
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <JobIcon job={jobProfile.job} size="lg" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex min-w-0 items-center gap-2 flex-wrap">
            <span className={`min-w-0 truncate font-display font-semibold text-text-primary ${jobProfile.priority === 'main' ? 'text-lg' : ''}`}>
              {getJobDisplayName(jobProfile.job)}
            </span>
            <span className="text-text-tertiary text-sm">{jobProfile.job}</span>
            <PriorityBadge priority={jobProfile.priority} />
            {jobProfile.readiness === 'needs_gear' ? (
              <Badge
                variant="warning"
                size="sm"
                title={snapshot ? 'Gear is saved. Mark this ready when the job meets your target.' : undefined}
              >
                {snapshot ? 'Needs review' : 'Missing gear'}
              </Badge>
            ) : jobProfile.readiness === 'unknown' && snapshot ? null : (
              <ReadinessBadge readiness={jobProfile.readiness} />
            )}
          </div>

          {/* Saved gear summary */}
          {snapshot ? (
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2 text-sm">
              <Badge variant="info" size="sm">iLv {snapshot.avgItemLevel}</Badge>
              <SourceBadge source={snapshot.source} />
              <span className={`text-xs ${freshnessColor(freshness)}`}>
                {formatGearActivity(snapshot)}
              </span>
              {isStale && (
                <Badge variant="warning" size="sm">Stale</Badge>
              )}
            </div>
          ) : (
            <div className="mt-1.5 inline-flex text-xs text-text-tertiary">
              No gear saved for this job yet.
            </div>
          )}

          {/* Only show gear context box for non-plugin sources or when there's no snapshot */}
          {(snapshot?.source !== 'plugin') && (
            <div className="mt-2 rounded-md border border-border-subtle bg-surface-elevated/50 px-2 py-1.5 text-xs text-text-secondary">
              {gearState}
            </div>
          )}

          {/* BiS target summary */}
          <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs text-text-tertiary">
            {activeBisTarget ? (
              <>
                <span className="font-medium text-text-secondary">{activeBisTarget.name}</span>
                <span className="rounded bg-surface-elevated/80 px-1.5 py-0.5 text-text-tertiary">
                  {PURPOSE_LABELS[activeBisTarget.purpose] ?? activeBisTarget.purpose}
                </span>
                {activeBisTarget.itemLevel != null && (
                  <span className="text-accent font-mono">iLv {activeBisTarget.itemLevel}</span>
                )}
                {compareStatus === 'on_target' && (
                  <span className="rounded bg-status-success/10 px-1.5 py-0.5 text-status-success font-medium">On target</span>
                )}
                {compareStatus === 'missing_pieces' && (
                  <span className="rounded bg-status-warning/10 px-1.5 py-0.5 text-status-warning font-medium">Missing pieces</span>
                )}
                {bisTargetCount > 1 && (
                  <span className="text-text-muted">+{bisTargetCount - 1} more</span>
                )}
              </>
            ) : (
              <span>No BiS target set</span>
            )}
          </div>

          {jobProfile.notes && (
            <div className="mt-1.5 text-sm text-text-secondary italic">
              {jobProfile.notes}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <IconButton
            icon="✎"
            aria-label="Edit job profile"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(jobProfile)}
          />
          <IconButton
            icon="×"
            aria-label="Remove job profile"
            variant="ghost"
            size="sm"
            onClick={deleteModal.open}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Hide gear' : 'Show gear'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(jobProfile)}>
          Edit job
        </Button>
        {onManageBiS && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onManageBiS(jobProfile.id)}
            data-testid={`manage-bis-${jobProfile.id}`}
          >
            BiS targets
          </Button>
        )}
      </div>

      {expanded && (
        <div className="mt-3 space-y-1.5" data-testid={`gear-slots-${jobProfile.job}`}>
          {snapshot?.gear?.length ? (
            snapshot.gear.map((slot) => <GearSlotCompactRow key={slot.slot} slot={slot} />)
          ) : (
            <div className="rounded-md border border-border-subtle bg-surface-elevated/60 px-3 py-2 text-sm text-text-tertiary">
              No gear saved for {jobProfile.job}.
            </div>
          )}
        </div>
      )}

      {deleteModal.isOpen && (
        <ConfirmModal
          isOpen={deleteModal.isOpen}
          title="Remove Job Profile"
          message={`Remove your ${getJobDisplayName(jobProfile.job)} profile?`}
          confirmLabel="Remove"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={deleteModal.close}
        />
      )}
    </div>
  );
}
