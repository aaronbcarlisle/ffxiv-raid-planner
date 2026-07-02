import { ChevronRight, ClipboardCopy, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { XivIcon } from '../ui/XivIcon';
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
  mount: <XivIcon name="goals" size={16} />,
  token: <XivIcon name="earthlyStar" size={16} />,
  minion: <XivIcon name="earthlyStar" size={16} />,
  orchestrion: <XivIcon name="orchestrion" size={16} />,
  glam: <XivIcon name="earthlyStar" size={16} />,
  custom_reward: <XivIcon name="loot" size={16} />,
  weapon: <XivIcon name="earthlyStar" size={16} />,
  weapon_coffer: <XivIcon name="loot" size={16} />,
  title: <XivIcon name="earthlyStar" size={16} />,
  clear_count: <XivIcon name="earthlyStar" size={16} />,
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
  const { i18n } = useTranslation();
  const isJapanese = (i18n.resolvedLanguage ?? '').toLowerCase().startsWith('ja');
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
              {isJapanese
                ? (goal.status === 'wanted' ? '希望' : goal.status === 'farming' ? '周回中' : goal.status === 'scheduled' ? '予定済み' : goal.status === 'complete' ? '完了' : goal.status)
                : goal.status}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-text-secondary flex-wrap">
            <span className="flex items-center gap-1">
              {GOAL_TYPE_ICONS[goal.goalType]}
              {isJapanese
                ? (goal.goalType === 'mount' ? 'マウント' : goal.goalType === 'token' ? 'トークン' : goal.goalType === 'minion' ? 'ミニオン' : goal.goalType === 'orchestrion' ? 'オーケストリオン譜' : goal.goalType === 'glam' ? 'ミラプリ' : goal.goalType === 'custom_reward' ? 'カスタム' : goal.goalType === 'weapon' ? '武器' : goal.goalType === 'weapon_coffer' ? '武器コファー' : goal.goalType === 'title' ? '称号' : goal.goalType === 'clear_count' ? 'クリア数' : GOAL_TYPE_LABELS[goal.goalType])
                : GOAL_TYPE_LABELS[goal.goalType]}
            </span>
            {goal.contentType && (
              <>
                <span className="text-border-default">·</span>
                <span className="capitalize">{isJapanese
                  ? (goal.contentType === 'extreme' ? '極' : goal.contentType === 'savage' ? '零式' : goal.contentType === 'ultimate' ? '絶' : goal.contentType === 'criterion' ? '異聞' : goal.contentType === 'chaotic_alliance' ? 'カオティック' : goal.contentType === 'field_operation' ? 'フィールド' : goal.contentType.replace(/_/g, ' '))
                  : goal.contentType.replace(/_/g, ' ')}</span>
              </>
            )}
            {goal.priorityMode && (
              <>
                <span className="text-border-default">·</span>
                <span>{isJapanese
                  ? (goal.priorityMode === 'everyone_gets_one' ? '全員1つずつ' : goal.priorityMode === 'priority_order' ? '優先度順' : goal.priorityMode === 'free_roll' ? 'フリーロール' : goal.priorityMode === 'desired_only' ? '希望者のみ' : 'カスタム')
                  : PRIORITY_MODE_LABELS[goal.priorityMode]}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Ownership counts */}
      {summary && summary.total > 0 && (
        <div className="flex items-center gap-3 text-xs">
          {needCount > 0 && (
            <Tooltip content={isJapanese ? 'これを必要としているプレイヤー' : 'Players who need this'}>
              <span className="flex items-center gap-1 text-status-error font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-status-error" />
                {isJapanese ? `${needCount}人必要` : `${needCount} need`}
              </span>
            </Tooltip>
          )}
          {wantCount > 0 && (
            <Tooltip content={isJapanese ? 'これを希望しているプレイヤー' : 'Players who want this'}>
              <span className="flex items-center gap-1 text-status-warning font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-status-warning" />
                {isJapanese ? `${wantCount}人希望` : `${wantCount} want`}
              </span>
            </Tooltip>
          )}
          {haveCount > 0 && (
            <Tooltip content={isJapanese ? 'これをすでに持っているプレイヤー' : 'Players who already have this'}>
              <span className="flex items-center gap-1 text-status-success font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
                {isJapanese ? `${haveCount}人所持` : `${haveCount} have`}
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
                  <XivIcon name="gil" size={11} />
                  {goal.tokenName}: {tokenCount ?? '?'} / {goal.tokenCost}
                </span>
                {canBuy && (
                  <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-semibold">
                    {isJapanese ? '交換可' : 'Can buy'}
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
          <span className="text-text-muted">{isJapanese ? '次の優先: ' : 'Next priority: '}</span>
          <span className="text-text-primary font-medium">{nextRecipient.displayName ?? (isJapanese ? '不明' : 'Unknown')}</span>
          {nextRecipient.tokenCount != null && (
            <span className="ml-2 text-text-muted">({nextRecipient.tokenCount}{isJapanese ? '個' : ' tokens'})</span>
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
          {isJapanese ? '詳細' : 'View'} <ChevronRight size={14} />
        </Button>
        {!isComplete && (
          <Button variant="ghost" size="sm" onClick={() => onLogDrop(goal)} className="flex items-center gap-1">
            <Plus size={14} /> {isJapanese ? 'ドロップ記録' : 'Log Drop'}
          </Button>
        )}
        <div className="ml-auto">
          <Tooltip content={isJapanese ? '周回プランをコピー' : 'Copy farm plan to clipboard'}>
            <IconButton
              icon={<ClipboardCopy size={14} />}
              aria-label={isJapanese ? '周回プランをコピー' : 'Copy farm plan'}
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
