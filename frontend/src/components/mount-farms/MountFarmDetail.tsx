import { useCallback } from 'react';
import { Check, ShoppingCart, X, Plug, PenLine, HelpCircle } from 'lucide-react';
import type { MountFarmTrial } from '../../gamedata';
import { getCurrencyLabelPlural, getExchangeSummary, getRewardLabel, getRewardNoun, hasCurrencyTracking } from '../../gamedata';
import type { TrialSummary, MemberProgress, DataSource } from '../../stores/mountFarmStore';
import { useMountFarmStore } from '../../stores/mountFarmStore';
import { Checkbox } from '../ui/Checkbox';
import { NumberInput } from '../ui/NumberInput';
import { Tooltip } from '../primitives/Tooltip';
import { toast } from '../../stores/toastStore';
import { FarmCurrencyProgress } from './FarmProgress';

interface MountFarmDetailProps {
  trial: MountFarmTrial;
  summary: TrialSummary | null;
  currentUserId: string | null;
  groupId: string;
  canManage: boolean;
  onRefresh: () => void;
}

// Standardized source badge wording
const SOURCE_LABELS: Record<DataSource, { label: string; detail: string }> = {
  plugin: { label: 'Plugin', detail: 'Auto-imported from Dalamud plugin' },
  tomestone: { label: 'Tomestone', detail: 'Imported from Tomestone' },
  manual: { label: 'Manual', detail: 'Entered manually' },
  unknown: { label: '', detail: '' },
};

function SourceBadge({ source, syncedAt }: { source: DataSource; syncedAt?: string | null }) {
  if (source === 'unknown') return null;

  const cfg = SOURCE_LABELS[source];
  const timeStr = syncedAt ? new Date(syncedAt).toLocaleDateString() : null;
  const detail = timeStr ? `${cfg.detail} on ${timeStr}` : cfg.detail;

  if (source === 'manual') {
    return (
      <Tooltip content={detail}>
        <span className="inline-flex items-center text-text-tertiary">
          <PenLine className="w-3 h-3" />
        </span>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={detail}>
      <span className="inline-flex items-center gap-0.5 text-blue-400">
        <Plug className="w-3 h-3" />
      </span>
    </Tooltip>
  );
}

export function MountFarmDetail({
  trial,
  summary,
  currentUserId,
  groupId,
  canManage,
}: MountFarmDetailProps) {
  const { updateProgress, isSaving } = useMountFarmStore();
  const members = summary?.memberProgress ?? [];

  const handleToggleMount = useCallback(async (member: MemberProgress) => {
    const canEdit = canManage || member.userId === currentUserId;
    if (!canEdit) return;
    try { await updateProgress(groupId, { trialId: trial.id, userId: member.userId, hasMount: !member.hasMount }); }
    catch { toast.error('Failed to update reward status'); }
  }, [canManage, currentUserId, groupId, trial.id, updateProgress]);

  const handleToggleWants = useCallback(async (member: MemberProgress) => {
    const canEdit = canManage || member.userId === currentUserId;
    if (!canEdit) return;
    try { await updateProgress(groupId, { trialId: trial.id, userId: member.userId, wantsMount: !member.wantsMount }); }
    catch { toast.error('Failed to update preference'); }
  }, [canManage, currentUserId, groupId, trial.id, updateProgress]);

  const handleTotemChange = useCallback(async (member: MemberProgress, value: number) => {
    const canEdit = canManage || member.userId === currentUserId;
    if (!canEdit) return;
    try { await updateProgress(groupId, { trialId: trial.id, userId: member.userId, totemCount: value }); }
    catch { toast.error('Failed to update totem count'); }
  }, [canManage, currentUserId, groupId, trial.id, updateProgress]);

  if (members.length === 0) {
    return (
      <div className="px-4 pb-4 text-sm text-text-secondary">
        No member data yet. Members can start tracking their progress below.
      </div>
    );
  }

  const hasTotemTracking = hasCurrencyTracking(trial);

  return (
    <div className="border-t border-border-default">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-text-tertiary border-b border-border-default">
              <th className="text-left px-4 py-2 font-medium">Member</th>
              <th className="text-center px-2 py-2 font-medium w-16">Reward</th>
              <th className="text-center px-2 py-2 font-medium w-16">Wants</th>
              <th className="text-center px-2 py-2 font-medium w-44">
                <Tooltip content={hasTotemTracking ? getExchangeSummary(trial) : 'No currency exchange for this trial'}>
                  <span className="inline-flex items-center gap-1">
                    Progress
                    {!hasTotemTracking && <HelpCircle className="w-3 h-3" />}
                  </span>
                </Tooltip>
              </th>
              <th className="text-center px-2 py-2 font-medium w-20">Status</th>
            </tr>
          </thead>
          <tbody>
            {members.map(member => {
              const canEdit = canManage || member.userId === currentUserId;
              const isCurrentUser = member.userId === currentUserId;
              const exchangeCost = trial.exchangeCost ?? trial.totemTarget;
              const canBuyMount = !member.hasMount && exchangeCost > 0 && member.totemCount >= exchangeCost;

              return (
                <MemberRow
                  key={member.userId}
                  member={member}
                  trial={trial}
                  canEdit={canEdit}
                  isCurrentUser={isCurrentUser}
                  canBuyMount={canBuyMount}
                  hasTotemTracking={!!hasTotemTracking}
                  isSaving={isSaving}
                  onToggleMount={handleToggleMount}
                  onToggleWants={handleToggleWants}
                  onTotemChange={handleTotemChange}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface MemberRowProps {
  member: MemberProgress;
  trial: MountFarmTrial;
  canEdit: boolean;
  isCurrentUser: boolean;
  canBuyMount: boolean;
  hasTotemTracking: boolean;
  isSaving: boolean;
  onToggleMount: (member: MemberProgress) => void;
  onToggleWants: (member: MemberProgress) => void;
  onTotemChange: (member: MemberProgress, value: number) => void;
}

function MemberRow({
  member, trial, canEdit, isCurrentUser, canBuyMount, hasTotemTracking, isSaving,
  onToggleMount, onToggleWants, onTotemChange,
}: MemberRowProps) {
  const displayTotem = member.totemCount;
  const rewardNoun = getRewardNoun(trial);

  // Determine the "effective source" to show one badge
  const effectiveSource = member.ownershipSource !== 'unknown' ? member.ownershipSource : member.totemSource;
  const hasOverride = member.lastManualOverrideAt && effectiveSource !== 'manual';

  return (
    <tr className={`border-b border-border-default/50 ${isCurrentUser ? 'bg-accent/5' : ''} ${member.hasMount ? 'opacity-60' : ''}`}>
      {/* Member name + source */}
      <td className="px-4 py-2">
        <div className="flex items-center gap-1.5">
          <span className={`font-medium ${isCurrentUser ? 'text-accent' : 'text-text-primary'}`}>
            {member.displayName}
          </span>
          {isCurrentUser && <span className="text-[10px] text-accent/60 font-medium uppercase">you</span>}
          <SourceBadge source={effectiveSource} syncedAt={member.lastPluginSyncAt ?? member.updatedAt} />
          {hasOverride && (
            <Tooltip content={`Manual correction on ${new Date(member.lastManualOverrideAt!).toLocaleDateString()}`}>
              <span className="text-text-tertiary"><PenLine className="w-3 h-3" /></span>
            </Tooltip>
          )}
        </div>
      </td>

      {/* Has reward */}
      <td className="text-center px-2 py-2">
        <div className="flex justify-center">
          <Checkbox checked={member.hasMount} onChange={() => onToggleMount(member)} disabled={!canEdit || isSaving} aria-label={`${member.displayName} has ${rewardNoun}`} color="teal" />
        </div>
      </td>

      {/* Wants reward */}
      <td className="text-center px-2 py-2">
        {member.hasMount ? (
          <span className="text-text-tertiary">&mdash;</span>
        ) : (
          <div className="flex justify-center">
            <Checkbox checked={member.wantsMount} onChange={() => onToggleWants(member)} disabled={!canEdit || isSaving} aria-label={`${member.displayName} wants ${rewardNoun}`} color="teal" />
          </div>
        )}
      </td>

      {/* Currency count */}
      <td className="px-2 py-2">
        {member.hasMount ? (
          <div className="text-center text-text-tertiary">&mdash;</div>
        ) : hasTotemTracking ? (
          <div className="flex min-w-[156px] flex-col items-center gap-1.5">
            <div className="w-[96px]">
              <NumberInput value={displayTotem} onChange={(val) => onTotemChange(member, val ?? 0)} min={0} max={999} disabled={!canEdit || isSaving} size="sm" aria-label={`${member.displayName} currency count`} />
            </div>
            <div className="w-full max-w-[132px]">
              <FarmCurrencyProgress
                trial={trial}
                currentCount={displayTotem}
                className="text-center"
                showKindLabel
              />
            </div>
          </div>
        ) : (
          <Tooltip content={getExchangeSummary(trial)}>
            <div className="text-center text-text-tertiary text-xs">No currency</div>
          </Tooltip>
        )}
      </td>

      {/* Status */}
      <td className="text-center px-2 py-2">
        {member.hasMount ? (
          <span className="inline-flex items-center gap-1 text-status-success">
            <Check className="w-3.5 h-3.5" /><span className="text-xs">Obtained</span>
          </span>
        ) : canBuyMount && trial.exchangeStatus === 'not_yet_available' ? (
          <Tooltip content={getExchangeSummary(trial)}>
            <span className="inline-flex items-center gap-1 text-text-tertiary">
              <ShoppingCart className="w-3.5 h-3.5" /><span className="text-xs">Pending</span>
            </span>
          </Tooltip>
        ) : canBuyMount ? (
          <Tooltip content={`Has ${member.totemCount} ${getCurrencyLabelPlural(trial)} — enough for ${getRewardLabel(trial)}`}>
            <span className="inline-flex items-center gap-1 text-amber-400">
              <ShoppingCart className="w-3.5 h-3.5" /><span className="text-xs">Ready</span>
            </span>
          </Tooltip>
        ) : member.wantsMount ? (
          <span className="text-xs text-text-secondary">Farming</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-text-tertiary">
            <X className="w-3.5 h-3.5" /><span className="text-xs">Skip</span>
          </span>
        )}
      </td>
    </tr>
  );
}
