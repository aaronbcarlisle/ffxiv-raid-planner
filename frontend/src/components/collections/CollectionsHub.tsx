import { useEffect, useState } from 'react';
import { Plus, Trophy, Music, Package, LayoutGrid } from 'lucide-react';
import { Button } from '../primitives/Button';
import { RewardGoalCard } from './RewardGoalCard';
import { RewardGoalModal } from './RewardGoalModal';
import { RewardGoalDetailModal } from './RewardGoalDetailModal';
import { LogDropModal } from './LogDropModal';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import type { CollectionGoal, CollectionGoalType, ParticipantStateEntry } from '../../stores/collectionGoalStore';
import { useToastStore } from '../../stores/toastStore';
import { Skeleton } from '../ui/Skeleton';

type HubView = 'all' | 'mount' | 'orchestrion' | 'other';

const HUB_VIEWS: { id: HubView; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'All', icon: <LayoutGrid size={14} /> },
  { id: 'mount', label: 'Mounts', icon: <Trophy size={14} /> },
  { id: 'orchestrion', label: 'Music', icon: <Music size={14} /> },
  { id: 'other', label: 'Other', icon: <Package size={14} /> },
];

const MOUNT_TYPES: CollectionGoalType[] = ['mount'];
const MUSIC_TYPES: CollectionGoalType[] = ['orchestrion'];
const OTHER_TYPES: CollectionGoalType[] = ['minion', 'glam', 'title', 'weapon', 'weapon_coffer', 'token', 'custom_reward', 'clear_count'];

function filterByView(goals: CollectionGoal[], view: HubView): CollectionGoal[] {
  if (view === 'all') return goals;
  if (view === 'mount') return goals.filter((g) => MOUNT_TYPES.includes(g.goalType));
  if (view === 'orchestrion') return goals.filter((g) => MUSIC_TYPES.includes(g.goalType));
  return goals.filter((g) => OTHER_TYPES.includes(g.goalType));
}

function buildDiscordPlan(goal: CollectionGoal, participants: ParticipantStateEntry[]): string {
  const needing = participants.filter((p) => p.state === 'need').sort((a, b) => (a.priorityRank ?? 999) - (b.priorityRank ?? 999));
  const wanting = participants.filter((p) => p.state === 'want');
  const having = participants.filter((p) => p.state === 'have');

  const lines: string[] = [`**${goal.title}** farm plan`];
  if (goal.priorityMode) {
    const modeLabels: Record<string, string> = {
      everyone_gets_one: 'Everyone gets one',
      priority_order: 'Priority order',
      free_roll: 'Free roll',
      desired_only: 'Desired only',
      custom: 'Custom',
    };
    lines.push(`Mode: ${modeLabels[goal.priorityMode] ?? goal.priorityMode}`);
  }
  lines.push('');
  if (needing.length) lines.push(`🎯 **Need (${needing.length}):** ${needing.map((p) => p.displayName ?? p.userId).join(', ')}`);
  if (wanting.length) lines.push(`⭐ **Want (${wanting.length}):** ${wanting.map((p) => p.displayName ?? p.userId).join(', ')}`);
  if (having.length) lines.push(`✅ **Have (${having.length}):** ${having.map((p) => p.displayName ?? p.userId).join(', ')}`);
  if (goal.note) lines.push(`\n📝 ${goal.note}`);
  return lines.join('\n');
}

interface CollectionsHubProps {
  groupId: string;
  currentUserId: string;
  canManage: boolean;
}

export function CollectionsHub({ groupId, currentUserId, canManage }: CollectionsHubProps) {
  const { goals, isLoading, participants, fetchGoals, fetchParticipants } = useCollectionGoalStore();
  const addToast = useToastStore((s) => s.addToast);

  const [view, setView] = useState<HubView>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editGoal, setEditGoal] = useState<CollectionGoal | null>(null);
  const [viewGoal, setViewGoal] = useState<CollectionGoal | null>(null);
  const [logDropGoal, setLogDropGoal] = useState<CollectionGoal | null>(null);

  useEffect(() => {
    fetchGoals(groupId);
  }, [groupId, fetchGoals]);

  // Pre-load participants for all active goals (needed for next-priority display)
  useEffect(() => {
    const activeGoals = goals.filter((g) => g.status !== 'complete' && g.status === 'farming');
    for (const goal of activeGoals) {
      if (!participants[goal.id]) {
        fetchParticipants(groupId, goal.id);
      }
    }
  }, [goals, groupId, fetchParticipants, participants]);

  const displayedGoals = filterByView(goals, view);
  const activeGoals = displayedGoals.filter((g) => g.status !== 'complete');
  const completedGoals = displayedGoals.filter((g) => g.status === 'complete');

  function handleCopyPlan(goal: CollectionGoal) {
    const parts = participants[goal.id] ?? [];
    const text = buildDiscordPlan(goal, parts);
    navigator.clipboard.writeText(text).then(
      () => addToast({ type: 'success', message: 'Farm plan copied to clipboard!' }),
      () => addToast({ type: 'error', message: 'Failed to copy to clipboard' }),
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-surface-raised rounded-lg p-1">
          {HUB_VIEWS.map((v) => (
            /* design-system-ignore: filter tab toggle */
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                ${view === v.id ? 'bg-accent/20 text-accent' : 'text-text-secondary hover:text-text-primary'}`}
            >
              {v.icon}
              {v.label}
              {v.id !== 'all' && (
                <span className="text-xs text-text-muted ml-0.5">
                  ({filterByView(goals.filter((g) => g.status !== 'complete'), v.id).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {canManage && (
          <Button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5">
            <Plus size={16} /> Add Goal
          </Button>
        )}
      </div>

      {/* Stats strip */}
      {goals.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Active farms', value: goals.filter((g) => g.status === 'farming').length, accent: true },
            { label: 'Still needed', value: goals.reduce((n, g) => n + (g.participantSummary?.need ?? 0), 0), accent: false },
            { label: 'Completed goals', value: goals.filter((g) => g.status === 'complete').length, accent: false },
            { label: 'Drops this run', value: 0, accent: false },
          ].map(({ label, value, accent }) => (
            <div key={label} className="bg-surface-raised border border-border-default rounded-xl p-3 text-center">
              <div className={`text-2xl font-bold ${accent ? 'text-accent' : 'text-text-primary'}`}>{value}</div>
              <div className="text-xs text-text-muted mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Goal grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : activeGoals.length === 0 && completedGoals.length === 0 ? (
        <div className="text-center py-16 text-text-muted">
          <Trophy size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No collection goals yet.</p>
          {canManage && (
            <p className="text-sm mt-1">
              Add your first goal — mounts, music, rare drops, anything your static is farming.
            </p>
          )}
          {canManage && (
            <Button className="mt-4" onClick={() => setShowCreate(true)}>
              <Plus size={16} className="mr-1.5" /> Add first goal
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {activeGoals.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
                Active ({activeGoals.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeGoals.map((goal) => (
                  <RewardGoalCard
                    key={goal.id}
                    goal={goal}
                    participants={participants[goal.id] ?? []}
                    onView={setViewGoal}
                    onLogDrop={setLogDropGoal}
                    onCopyPlan={handleCopyPlan}
                    canManage={canManage}
                  />
                ))}
              </div>
            </div>
          )}

          {completedGoals.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
                Completed ({completedGoals.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedGoals.map((goal) => (
                  <RewardGoalCard
                    key={goal.id}
                    goal={goal}
                    participants={participants[goal.id] ?? []}
                    onView={setViewGoal}
                    onLogDrop={setLogDropGoal}
                    onCopyPlan={handleCopyPlan}
                    canManage={canManage}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <RewardGoalModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        groupId={groupId}
        editGoal={null}
      />

      {editGoal && (
        <RewardGoalModal
          isOpen={!!editGoal}
          onClose={() => setEditGoal(null)}
          groupId={groupId}
          editGoal={editGoal}
        />
      )}

      {viewGoal && (
        <RewardGoalDetailModal
          isOpen={!!viewGoal}
          onClose={() => setViewGoal(null)}
          goal={viewGoal}
          groupId={groupId}
          currentUserId={currentUserId}
          canManage={canManage}
          onEdit={(g) => {
            setViewGoal(null);
            setEditGoal(g);
          }}
        />
      )}

      {logDropGoal && (
        <LogDropModal
          isOpen={!!logDropGoal}
          onClose={() => setLogDropGoal(null)}
          goal={logDropGoal}
          groupId={groupId}
          participants={participants[logDropGoal.id] ?? []}
        />
      )}
    </div>
  );
}
