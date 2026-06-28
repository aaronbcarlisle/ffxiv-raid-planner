import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Lightbulb } from 'lucide-react';
import { useUrlTabState } from '../../hooks/useUrlTabState';
import { XivIcon } from '../ui/XivIcon';
import { Button } from '../primitives/Button';
import { RewardGoalCard } from './RewardGoalCard';
import { RewardGoalModal } from './RewardGoalModal';
import { RewardGoalDetailModal } from './RewardGoalDetailModal';
import { LogDropModal } from './LogDropModal';
import { CatalogBrowse } from './CatalogBrowse';
import { SuggestedFarmsTab } from './SuggestedFarmsTab';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import type { CollectionGoal, ParticipantStateEntry } from '../../stores/collectionGoalStore';
import { toast } from '../../stores/toastStore';
import { Skeleton } from '../ui/Skeleton';

const HUB_TABS = ['suggested', 'active', 'catalog'] as const;
type HubTab = (typeof HUB_TABS)[number];

function buildDiscordPlan(goal: CollectionGoal, participants: ParticipantStateEntry[]): string {
  const needing = participants
    .filter((p) => p.state === 'need')
    .sort((a, b) => (a.priorityRank ?? 999) - (b.priorityRank ?? 999));
  const wanting = participants.filter((p) => p.state === 'want');
  const having = participants.filter((p) => p.state === 'have');

  const canBuyPeople =
    goal.tokenCost != null
      ? participants.filter((p) => p.state !== 'have' && (p.tokenCount ?? 0) >= (goal.tokenCost ?? Infinity))
      : [];

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
  if (goal.tokenCost && goal.tokenName) {
    lines.push(`Exchange: ${goal.tokenCost}× ${goal.tokenName}`);
  }
  lines.push('');
  if (needing.length)
    lines.push(`🎯 **Need (${needing.length}):** ${needing.map((p) => p.displayName ?? p.userId).join(', ')}`);
  if (wanting.length)
    lines.push(`⭐ **Want (${wanting.length}):** ${wanting.map((p) => p.displayName ?? p.userId).join(', ')}`);
  if (canBuyPeople.length)
    lines.push(`💰 **Can buy now:** ${canBuyPeople.map((p) => p.displayName ?? p.userId).join(', ')}`);
  if (having.length)
    lines.push(`✅ **Have (${having.length}):** ${having.map((p) => p.displayName ?? p.userId).join(', ')}`);
  if (goal.note) lines.push(`\n📝 ${goal.note}`);
  return lines.join('\n');
}

interface CollectionsHubProps {
  groupId: string;
  currentUserId: string;
  canManage: boolean;
}

export function CollectionsHub({ groupId, currentUserId, canManage }: CollectionsHubProps) {
  const { t } = useTranslation();
  const { goals, isLoading, participants, fetchGoals, fetchParticipants } = useCollectionGoalStore();

  const [tab, setTab] = useUrlTabState('farm', HUB_TABS, 'suggested');
  const [showCreate, setShowCreate] = useState(false);
  const [editGoal, setEditGoal] = useState<CollectionGoal | null>(null);
  const [viewGoal, setViewGoal] = useState<CollectionGoal | null>(null);
  const [logDropGoal, setLogDropGoal] = useState<CollectionGoal | null>(null);

  useEffect(() => {
    fetchGoals(groupId);
  }, [groupId, fetchGoals]);

  // Pre-load participants for farming goals
  useEffect(() => {
    const farmingGoals = goals.filter((g) => g.status === 'farming');
    for (const goal of farmingGoals) {
      if (!participants[goal.id]) {
        fetchParticipants(groupId, goal.id);
      }
    }
  }, [goals, groupId, fetchParticipants, participants]);

  const activeGoals = goals.filter((g) => g.status !== 'complete');
  const completedGoals = goals.filter((g) => g.status === 'complete');

  // Build token count map per catalog item from my own participant entries
  const myTokenCounts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const goal of goals) {
      if (!goal.catalogItemId) continue;
      const myEntry = Object.values(participants)
        .flat()
        .find((p) => p.userId === currentUserId && participants[goal.id]?.includes(p));
      if (myEntry?.tokenCount != null) {
        result[goal.catalogItemId] = myEntry.tokenCount;
      }
    }
    return result;
  }, [goals, participants, currentUserId]);

  function handleCopyPlan(goal: CollectionGoal) {
    const parts = participants[goal.id] ?? [];
    const text = buildDiscordPlan(goal, parts);
    navigator.clipboard.writeText(text).then(
      () => toast.success(t('collections.farmPlanCopied')),
      () => toast.error(t('collections.failedToCopyFarmPlan')),
    );
  }

  const tabDef: { id: HubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'suggested', label: t('collections.suggested'),                                   icon: <Lightbulb size={14} /> },
    { id: 'active',    label: t('collections.activeFarms', { count: activeGoals.length }),  icon: <XivIcon name="goals" size={14} /> },
    { id: 'catalog',   label: t('collections.browseCatalog'),                               icon: <XivIcon name="tomestone" size={14} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Tab bar + actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-surface-raised rounded-lg p-1 overflow-x-auto flex-shrink min-w-0">
          {tabDef.map((t) => (
            <Button
              key={t.id}
              variant="ghost"
              size="sm"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                tab === t.id
                  ? 'bg-accent/20 text-accent'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {t.icon}
              {t.label}
            </Button>
          ))}
        </div>

        {canManage && (
          <Button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5">
            <Plus size={16} /> {t('collections.customGoal')}
          </Button>
        )}
      </div>

      {/* Stats strip — only when there are goals */}
      {goals.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t('collections.activeFarmsCount'), value: activeGoals.length, accent: true },
            { label: t('collections.stillNeeded'), value: goals.reduce((n, g) => n + (g.participantSummary?.need ?? 0), 0), accent: false },
            { label: t('collections.completedGoals'), value: completedGoals.length, accent: false },
            {
              label: t('collections.canBuyNow'),
              value: goals.filter((g) => {
                if (!g.tokenCost || !g.catalogItemId) return false;
                const tc = myTokenCounts[g.catalogItemId];
                return tc != null && tc >= g.tokenCost;
              }).length,
              accent: false,
            },
          ].map(({ label, value, accent }) => (
            <div key={label} className="bg-surface-raised border border-border-default rounded-xl p-3 text-center">
              <div className={`text-2xl font-bold ${accent ? 'text-accent' : 'text-text-primary'}`}>{value}</div>
              <div className="text-xs text-text-muted mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tab content */}
      {tab === 'suggested' ? (
        <SuggestedFarmsTab
          groupId={groupId}
          canManage={canManage}
          onViewGoal={setViewGoal}
          onGoalCreated={(goal) => {
            setTab('active');
            setViewGoal(goal);
          }}
        />
      ) : tab === 'catalog' ? (
        <CatalogBrowse
          groupId={groupId}
          activeGoals={activeGoals}
        />
      ) : (
        // Active farms tab
        isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        ) : activeGoals.length === 0 ? (
          <div className="text-center py-16 text-text-muted">
            <XivIcon name="goals" size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">{t('collections.noActiveFarms')}</p>
            <p className="text-sm mt-1">{t('collections.noActiveFarmsDesc')}</p>
            <div className="flex justify-center gap-2 mt-4 flex-wrap">
              <Button onClick={() => setTab('suggested')} className="flex items-center gap-1.5">
                <Lightbulb size={14} /> {t('collections.viewSuggestions')}
              </Button>
              <Button variant="secondary" onClick={() => setTab('catalog')}>{t('collections.browseCatalog')}</Button>
              {canManage && (
                <Button variant="secondary" onClick={() => setShowCreate(true)}>
                  <Plus size={14} className="mr-1" /> {t('collections.customGoal')}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
                {t('collections.activeSection', { count: activeGoals.length })}
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

            {completedGoals.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
                  {t('collections.completedSection', { count: completedGoals.length })}
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
        )
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
