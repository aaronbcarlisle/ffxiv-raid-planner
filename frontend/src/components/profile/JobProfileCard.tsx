import { JobIcon } from '../ui/JobIcon';
import { Badge } from '../primitives/Badge';
import { IconButton } from '../primitives/IconButton';
import { ConfirmModal } from '../ui/ConfirmModal';
import { useModal } from '../../hooks/useModal';
import { PriorityBadge } from './PriorityBadge';
import { ReadinessBadge } from './ReadinessBadge';
import { SourceBadge } from './SourceBadge';
import { formatSyncAge, getFreshness, freshnessColor } from './freshness';
import type { PlayerJobProfile } from '../../stores/playerProfileStore';
import { usePlayerProfileStore } from '../../stores/playerProfileStore';
import { getJobDisplayName } from '../../gamedata/jobs';
import { toast } from '../../stores/toastStore';

interface JobProfileCardProps {
  jobProfile: PlayerJobProfile;
  onEdit: (jobProfile: PlayerJobProfile) => void;
}

export function JobProfileCard({ jobProfile, onEdit }: JobProfileCardProps) {
  const { deleteJobProfile } = usePlayerProfileStore();
  const deleteModal = useModal();

  const handleDelete = async () => {
    try {
      await deleteJobProfile(jobProfile.id);
      toast.success(`Removed ${jobProfile.job} profile`);
    } catch {
      toast.error('Failed to remove job profile');
    }
  };

  const snapshot = jobProfile.gearSnapshot;
  const isMain = jobProfile.priority === 'main';
  const freshness = snapshot ? getFreshness(snapshot.syncedAt) : 'none';
  const isStale = freshness === 'stale' || freshness === 'old';

  return (
    <div className={`bg-surface-raised rounded-lg border transition-colors hover:border-border-hover ${
      isMain ? 'border-accent/30 ring-1 ring-accent/10' : 'border-border-default'
    } p-4`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <JobIcon job={jobProfile.job} size="lg" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-display font-semibold text-text-primary ${isMain ? 'text-lg' : ''}`}>
              {getJobDisplayName(jobProfile.job)}
            </span>
            <span className="text-text-tertiary text-sm">{jobProfile.job}</span>
            <PriorityBadge priority={jobProfile.priority} />
            <ReadinessBadge readiness={jobProfile.readiness} />
          </div>

          {/* Gear snapshot summary */}
          {snapshot ? (
            <div className="flex items-center gap-2 mt-1.5 text-sm flex-wrap">
              <Badge variant="info" size="sm">iLv {snapshot.avgItemLevel}</Badge>
              <SourceBadge source={snapshot.source} />
              <span className={`text-xs ${freshnessColor(freshness)}`}>
                {formatSyncAge(snapshot.syncedAt)}
              </span>
              {isStale && (
                <Badge variant="warning" size="sm">Stale</Badge>
              )}
            </div>
          ) : (
            <div className="mt-1.5 text-xs text-text-tertiary">
              No gear snapshot — sync from Characters tab
            </div>
          )}

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
