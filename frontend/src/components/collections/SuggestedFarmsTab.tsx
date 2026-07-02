/**
 * SuggestedFarmsTab — "Suggested Farms" default view inside CollectionsHub.
 *
 * Shows smart farm suggestions from roster Player Hub intent, plugin-synced
 * ownership facts, and active static goals. Grouped by source duty name.
 * Player Hub intent drives the candidate list — no CollectionGoals required.
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Lightbulb, RefreshCw } from 'lucide-react';
import { Button } from '../primitives/Button';
import { Skeleton } from '../ui/Skeleton';
import { DutyFarmCard } from './DutyFarmCard';
import { useCollectionIntentStore } from '../../stores/collectionIntentStore';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import { toast } from '../../stores/toastStore';
import type { CollectionGoal, CollectionGoalFromSuggestion } from '../../stores/collectionGoalStore';
import { Info } from 'lucide-react';

interface SuggestedFarmsTabProps {
  groupId: string;
  canManage: boolean;
  onViewGoal: (goal: CollectionGoal) => void;
  onGoalCreated?: (goal: CollectionGoal) => void;
}

export function SuggestedFarmsTab({ groupId, canManage, onViewGoal, onGoalCreated }: SuggestedFarmsTabProps) {
  const { i18n } = useTranslation();
  const isJapanese = (i18n.resolvedLanguage ?? '').toLowerCase().startsWith('ja');
  const { suggestions, suggestionsLoading, fetchSuggestions } = useCollectionIntentStore();
  const { goals, createGoalFromSuggestion } = useCollectionGoalStore();

  const loading = suggestionsLoading[groupId] ?? false;
  const list = suggestions[groupId] ?? null;

  useEffect(() => {
    // Only fetch if we don't have data yet
    if (list === null) {
      fetchSuggestions(groupId);
    }
  }, [groupId, list, fetchSuggestions]);

  function handleRefresh() {
    // Force re-fetch by bypassing the loading guard
    fetchSuggestions(groupId);
  }

  async function handleMakeActiveFarm(catalogItemId: string) {
    const data: CollectionGoalFromSuggestion = { catalogItemId };
    try {
      const goal = await createGoalFromSuggestion(groupId, data);
      toast.success(isJapanese ? `「${goal.title}」をアクティブ周回に追加しました。参加状況も読み込み済みです。` : `"${goal.title}" added as active farm. Participant states preloaded.`);
      // Refresh suggestions so the card shows "Active" badge
      fetchSuggestions(groupId);
      // Let parent switch to Active Farms tab and open the new goal
      onGoalCreated?.(goal);
    } catch {
      toast.error(isJapanese ? '周回目標の作成に失敗しました。' : 'Failed to create farm goal.');
    }
  }

  function handleCopyPlan(text: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success(isJapanese ? '周回プランをクリップボードにコピーしました。' : 'Farm plan copied to clipboard!'),
      () => toast.error(isJapanese ? 'クリップボードへのコピーに失敗しました。' : 'Failed to copy to clipboard.'),
    );
  }

  function handleViewGoal(goalId: string) {
    const goal = goals.find(g => g.id === goalId);
    if (goal) onViewGoal(goal);
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading && list === null) {
    return (
      <div className="flex flex-col gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  // ── Empty — no suggestions ───────────────────────────────────────────────────
  if (!loading && (!list || list.length === 0)) {
    return (
      <div className="text-center py-16 text-text-muted flex flex-col items-center gap-3">
        <Lightbulb size={36} className="opacity-30" />
        <div>
          <p className="font-medium text-text-secondary">{isJapanese ? 'まだ提案がありません' : 'No suggestions yet'}</p>
          <p className="text-sm mt-1 max-w-sm mx-auto">
            {isJapanese
              ? 'ロスターのメンバーがプレイヤーハブで「希望」や「興味あり」を共有すると、ここに提案が表示されます。'
              : 'Suggestions appear when roster members share Hunting or Interested preferences via their Player Hub (visibility set to "Shared with statics" or higher).'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleRefresh} className="flex items-center gap-1.5 mt-2">
          <RefreshCw size={13} /> {isJapanese ? '更新' : 'Refresh'}
        </Button>
      </div>
    );
  }

  // ── Group by source duty ─────────────────────────────────────────────────────
  const grouped = new Map<string, typeof list>();
  for (const s of (list ?? [])) {
    const key = s.sourceDutyName ?? '— No source —';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(s);
  }

  // Sort groups: duties with active goals first, then by highest score within group
  const sortedGroups = [...grouped.entries()].sort(([, a], [, b]) => {
    const aHasGoal = a.some(s => s.staticGoalId);
    const bHasGoal = b.some(s => s.staticGoalId);
    if (aHasGoal !== bHasGoal) return bHasGoal ? 1 : -1;
    const aMax = Math.max(...a.map(s => s.suggestedFarmScore));
    const bMax = Math.max(...b.map(s => s.suggestedFarmScore));
    return bMax - aMax;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header strip */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <AlertCircle size={12} className="opacity-60" />
          <span>
            {isJapanese
              ? 'この固定と共有されたプレイヤーハブ設定をもとに表示しています。メンバーがプラグイン同期するとスコアも更新されます。'
              : 'Based on Player Hub preferences shared with this static. Scores update when members sync their plugin.'}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleRefresh} className="flex items-center gap-1 text-xs">
          <RefreshCw size={12} /> {isJapanese ? '更新' : 'Refresh'}
        </Button>
      </div>

      {/* Privacy note — shown when there are results */}
      <div className="flex items-start gap-2 rounded-lg border border-border-subtle bg-surface-raised/40 px-3 py-2 text-[11px] text-text-muted">
        <Info size={12} className="flex-shrink-0 mt-0.5 opacity-60" />
        <span>
          {isJapanese ? (
            <>
              <strong className="text-text-secondary font-medium">固定と共有</strong> または{' '}
              <strong className="text-text-secondary font-medium">プロフィールで公開</strong> にした設定だけがここに表示されます。
              非公開の設定は表示されません。
            </>
          ) : (
            <>
              Only preferences shared as <strong className="text-text-secondary font-medium">Shared with statics</strong> or{' '}
              <strong className="text-text-secondary font-medium">Public on dossier</strong> appear here.
              Private choices stay private.
            </>
          )}
        </span>
      </div>

      {/* Duty groups — one DutyFarmCard per source duty */}
      {sortedGroups.map(([dutyName, items]) => (
        <DutyFarmCard
          key={dutyName}
          dutyName={dutyName}
          suggestions={items}
          canManage={canManage}
          onMakeActiveFarm={handleMakeActiveFarm}
          onViewGoal={handleViewGoal}
          onCopyPlan={handleCopyPlan}
        />
      ))}
    </div>
  );
}
