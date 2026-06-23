import { Trophy, Music, Package, Star, ChevronRight, ClipboardCopy, Plus, Coins } from 'lucide-react';
import { Button } from '../primitives/Button';
import { IconButton } from '../primitives/IconButton';
import { Tooltip } from '../primitives/Tooltip';
import type { CollectionGoal, CollectionGoalType, CollectionPriorityMode, ParticipantStateEntry } from '../../stores/collectionGoalStore';

const GOAL_TYPE_LABELS: Record<CollectionGoalType, string> = {
  mount: 'Mount',
  token: 'Token',
  minion: 'Minion',
  orchestrion: 'Music',
  glam: 'Glamour',
  custom_reward: 'Custom',
  weapon: 'Weapon',
  weapon_coffer: 'Weapon Coffer',
  title: 'Title',
  clear_count: 'Clear Count',
};

const GOAL_TYPE_ICONS: Record<CollectionGoalType, React.ReactNode> = {
  mount: <Trophy size={16} />,
  token: <Star size={16} />,
  minion: <Star size={16} />,
  orchestrion: <Music size={16} />,
  glam: <Star size={16} />,
  custom_reward: <Package size={16} />,
  weapon: <Star size={16} />,
  weapon_coffer: <Package size={16} />,
  title: <Star size={16} />,
  clear_count: <Star size={16} />,
};

const PRIORITY_MODE_LABELS: Record<CollectionPriorityMode, string> = {
  everyone_gets_one: 'Everyone gets one',
  priority_order: 'Priority order',
  free_roll: 'Free roll',
  desired_only: 'Desired only',
  custom: 'Custom',
};

const STATUS_COLORS: Record<string, string> = {
  wanted: 'text-text-secondary bg-surface-raised',
  farming: 'text-accent bg-accent/10',
  scheduled: 'text-role-healer bg-role-healer/10',
  complete: 'text-text-muted bg-surface-raised',
};

interface RewardGoalCardProps {
  goal: CollectionGoal;
  participants: ParticipantStateEntry[];
  onView: (goal: CollectionGoal) => void;
  onLogDrop: (goal: CollectionGoal) => void;
  onCopyPlan: (goal: CollectionGoal) => void;
  canManage: boolean;
}

export function RewardGoalCard({ goal, participants, onView, onLogDrop, onCopyPlan, canManage: _canManage }: RewardGoalCardProps) {
  const summary = goal.participantSummary;
  const needCount = summary?.need ?? 0;
  const wantCount = summary?.want ?? 0;
  const haveCount = summary?.have ?? 0;

  const nextRecipient = participants
    .filter((p) => p.state === 'need' && p.priorityRank != null)
    .sort((a, b) => (a.priorityRank ?? 999) - (b.priorityRank ?? 999))[0];

  const isComplete = goal.status === 'complete';

  return (
    <div
      className={`bg-surface-raised border border-border-default rounded-xl p-4 flex flex-col gap-3 transition-opacity ${isComplete ? 'opacity-60' : ''}`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
          {GOAL_TYPE_ICONS[goal.goalType]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-text-primary truncate">{goal.title}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[goal.status] ?? STATUS_COLORS.wanted}`}>
              {goal.status}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-text-secondary flex-wrap">
            <span className="flex items-center gap-1">
              {GOAL_TYPE_ICONS[goal.goalType]}
              {GOAL_TYPE_LABELS[goal.goalType]}
            </span>
            {goal.contentType && (
              <>
                <span className="text-border-default">·</span>
                <span className="capitalize">{goal.contentType.replace(/_/g, ' ')}</span>
              </>
            )}
            {goal.priorityMode && (
              <>
                <span className="text-border-default">·</span>
                <span>{PRIORITY_MODE_LABELS[goal.priorityMode]}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Ownership counts */}
      {summary && summary.total > 0 && (
        <div className="flex items-center gap-3 text-xs">
          {needCount > 0 && (
            <Tooltip content="Players who need this">
              <span className="flex items-center gap-1 text-status-error font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-status-error" />
                {needCount} need
              </span>
            </Tooltip>
          )}
          {wantCount > 0 && (
            <Tooltip content="Players who want this">
              <span className="flex items-center gap-1 text-status-warning font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-status-warning" />
                {wantCount} want
              </span>
            </Tooltip>
          )}
          {haveCount > 0 && (
            <Tooltip content="Players who already have this">
              <span className="flex items-center gap-1 text-status-success font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
                {haveCount} have
              </span>
            </Tooltip>
          )}
        </div>
      )}

      {/* Token progress bar */}
      {goal.tokenCost != null && goal.tokenName && (
        (() => {
          const myEntry = participants.find((p) => p.userId === goal.createdById); // approximate — replaced by currentUserId when available
          const tokenCount = myEntry?.tokenCount ?? null;
          const canBuy = tokenCount != null && tokenCount >= goal.tokenCost;
          const pct = tokenCount != null ? Math.min(100, Math.round((tokenCount / goal.tokenCost!) * 100)) : null;
          return (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-text-secondary">
                  <Coins size={11} className="text-amber-400" />
                  {goal.tokenName}: {tokenCount ?? '?'} / {goal.tokenCost}
                </span>
                {canBuy && (
                  <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-semibold">
                    Can buy
                  </span>
                )}
              </div>
              {pct != null && (
                <div className="h-1 bg-surface-base rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${canBuy ? 'bg-green-500' : 'bg-accent'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          );
        })()
      )}

      {/* Next priority recipient */}
      {nextRecipient && !isComplete && (
        <div className="text-xs text-text-secondary bg-surface-base rounded-lg px-3 py-2">
          <span className="text-text-muted">Next priority: </span>
          <span className="text-text-primary font-medium">{nextRecipient.displayName ?? 'Unknown'}</span>
          {nextRecipient.tokenCount != null && (
            <span className="ml-2 text-text-muted">({nextRecipient.tokenCount} tokens)</span>
          )}
        </div>
      )}

      {/* Note */}
      {goal.summary && (
        <p className="text-xs text-text-secondary line-clamp-2">{goal.summary}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-border-default">
        <Button variant="ghost" size="sm" onClick={() => onView(goal)} className="flex items-center gap-1">
          View <ChevronRight size={14} />
        </Button>
        {!isComplete && (
          <Button variant="ghost" size="sm" onClick={() => onLogDrop(goal)} className="flex items-center gap-1">
            <Plus size={14} /> Log Drop
          </Button>
        )}
        <div className="ml-auto">
          <Tooltip content="Copy farm plan to clipboard">
            <IconButton
              icon={<ClipboardCopy size={14} />}
              aria-label="Copy farm plan"
              variant="ghost"
              size="sm"
              onClick={() => onCopyPlan(goal)}
            />
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
