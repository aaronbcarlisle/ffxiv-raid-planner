import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Play, ShoppingCart, X } from 'lucide-react';
import { XivIcon } from '../ui/XivIcon';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { Select } from '../ui/Select';
import { Checkbox } from '../ui/Checkbox';
import { Label } from '../ui/Label';
import type { PlayerGoal, CollectionSuggestion } from '../../stores/playerProfileStore';
import { COLLECTION_GOAL_TYPES, usePlayerProfileStore } from '../../stores/playerProfileStore';
import {
  EXPANSIONS,
  MOUNT_FARM_TRIALS,
  getCurrencyLabel,
  getRewardLabel,
  getTrialById,
  getTrialsByExpansion,
  hasCurrencyTracking,
  type Expansion,
  type MountFarmTrial,
} from '../../gamedata';
import {
  FarmCatalogSummary,
  FarmCurrencyProgress,
  FarmStatusBadge,
} from '../mount-farms/FarmProgress';
import {
  getFarmExchangeCost,
  type FarmTrackingStatus,
} from '../mount-farms/farmProgressUtils';
import { toast } from '../../stores/toastStore';
import { GameIcon } from '../ui/GameIcon';
import {
  getCollectionExpansionLabel,
} from '../../utils/collectionBadgeConfig';
import {
  getLocalizedTrialRewardName,
  resolveUiLocale,
} from '../../gamedata/mount-farm-i18n';

const DISMISSED_KEY = 'dismissed-collection-suggestions';

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>): void {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
}

interface CollectionsTabProps {
  goals: PlayerGoal[];
  suggestions: CollectionSuggestion[];
}

interface PlayerFarmItem {
  trial: MountFarmTrial;
  goal: PlayerGoal | null;
  suggestion: CollectionSuggestion | null;
  currentCount: number;
  owned: boolean;
  wanted: boolean;
  status: FarmTrackingStatus;
  canBuy: boolean;
  source: string;
}

type CatalogFilter = Expansion | 'ultimate' | 'special';

function getCatalogFilters(locale: string): { value: CatalogFilter; label: string }[] {
  const isJapanese = locale.startsWith('ja');
  return [
    ...EXPANSIONS.map((exp) => ({
      value: exp.id,
      label: getCollectionExpansionLabel(exp.id, locale) || exp.name,
    })),
    { value: 'ultimate', label: isJapanese ? '絶 / レア報酬' : 'Ultimate / Rare rewards' },
    { value: 'special', label: isJapanese ? '特殊' : 'Special' },
  ];
}

function trialForGoal(goal: PlayerGoal): MountFarmTrial | undefined {
  if (goal.sourceContent) {
    const byId = getTrialById(goal.sourceContent);
    if (byId) return byId;
    return MOUNT_FARM_TRIALS.find((trial) =>
      trial.dutyName === goal.sourceContent || trial.sourceContent === goal.sourceContent
    );
  }
  return undefined;
}

function statusFor(goal: PlayerGoal | null, suggestion: CollectionSuggestion | null): FarmTrackingStatus {
  if (suggestion?.hasMount || goal?.status === 'completed') return 'completed';
  if (goal?.status === 'active') return 'farming';
  if (goal && goal.status !== 'abandoned') return 'wanted';
  return 'not_tracking';
}

function buildFarmItem(
  trial: MountFarmTrial,
  goal: PlayerGoal | null,
  suggestion: CollectionSuggestion | null,
): PlayerFarmItem {
  const exchangeCost = getFarmExchangeCost(trial);
  const currentCount = suggestion?.currentCount ?? goal?.currentCount ?? 0;
  const status = statusFor(goal, suggestion);
  const owned = status === 'completed';
  const wanted = !!goal && goal.status !== 'abandoned';

  return {
    trial,
    goal,
    suggestion,
    currentCount,
    owned,
    wanted,
    status,
    canBuy: !owned && hasCurrencyTracking(trial) && exchangeCost > 0 && currentCount >= exchangeCost,
    source: suggestion?.source ?? (goal ? 'Manual' : 'Not set'),
  };
}

function goalStatusForFarmStatus(status: FarmTrackingStatus): string {
  switch (status) {
    case 'completed': return 'completed';
    case 'farming': return 'active';
    case 'wanted': return 'paused';
    default: return 'abandoned';
  }
}

export function CollectionsTab({ goals, suggestions }: CollectionsTabProps) {
  const { i18n } = useTranslation();
  const uiLocale = resolveUiLocale(i18n.resolvedLanguage);
  const isJapanese = uiLocale.startsWith('ja');
  const { createGoal, updateGoal, fetchCollectionSuggestions } = usePlayerProfileStore();
  const [selectedCatalogFilter, setSelectedCatalogFilter] = useState<CatalogFilter>('DT');
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(loadDismissed);
  const catalogFilters = useMemo(() => getCatalogFilters(uiLocale), [uiLocale]);
  const collectionGoals = goals.filter((g) => COLLECTION_GOAL_TYPES.includes(g.goalType as never));
  const visibleSuggestions = suggestions.filter((s) => !dismissedSuggestions.has(s.trialId));

  const farmItems = useMemo(() => {
    const items = new Map<string, PlayerFarmItem>();

    for (const suggestion of visibleSuggestions) {
      const trial = getTrialById(suggestion.trialId);
      if (!trial) continue;
      items.set(trial.id, buildFarmItem(trial, null, suggestion));
    }

    for (const goal of collectionGoals) {
      const trial = trialForGoal(goal);
      if (!trial) continue;
      const existing = items.get(trial.id);
      items.set(trial.id, buildFarmItem(trial, goal, existing?.suggestion ?? null));
    }

    return [...items.values()];
  }, [collectionGoals, visibleSuggestions]);

  const catalogItems = useMemo(() => {
    const tracked = new Map(farmItems.map((item) => [item.trial.id, item]));
    const trials = selectedCatalogFilter === 'ultimate'
      ? MOUNT_FARM_TRIALS.filter((trial) => trial.contentType === 'ultimate' || trial.category === 'ultimate')
      : selectedCatalogFilter === 'special'
        ? MOUNT_FARM_TRIALS.filter((trial) =>
          trial.category === 'special' ||
          trial.category === 'collaboration' ||
          trial.contentType === 'collaboration'
        )
        : getTrialsByExpansion(selectedCatalogFilter);

    return trials.map((trial) => tracked.get(trial.id) ?? buildFarmItem(trial, null, null));
  }, [farmItems, selectedCatalogFilter]);

  const readyToBuy = farmItems.filter((item) => item.canBuy);
  const activeFarms = farmItems.filter((item) => item.status === 'farming' && !item.canBuy);
  const wantedFarms = farmItems.filter((item) => item.status === 'wanted');
  const completedFarms = farmItems.filter((item) => item.status === 'completed');
  const wantedCount = farmItems.filter((item) => item.wanted && item.status !== 'completed').length;

  const setFarmStatus = useCallback(async (item: PlayerFarmItem, nextStatus: FarmTrackingStatus) => {
    const goalStatus = goalStatusForFarmStatus(nextStatus);
    const exchangeCost = getFarmExchangeCost(item.trial);

    try {
      if (item.goal) {
        await updateGoal(item.goal.id, {
          status: goalStatus,
          currentCount: item.currentCount,
          targetCount: exchangeCost > 0 ? exchangeCost : undefined,
        });
      } else if (nextStatus !== 'not_tracking') {
        await createGoal({
          title: isJapanese ? `${getLocalizedTrialRewardName(item.trial, uiLocale)}周回` : `${getRewardLabel(item.trial)} farm`,
          goalType: 'mount_farm',
          sourceContent: item.trial.id,
          sourceItem: getCurrencyLabel(item.trial),
          targetCount: exchangeCost > 0 ? exchangeCost : undefined,
          currentCount: item.currentCount,
          status: goalStatus,
        });
      }
      toast.success(
        nextStatus === 'completed'
          ? (isJapanese ? `「${getLocalizedTrialRewardName(item.trial, uiLocale)}」を取得済みにしました` : `Marked ${getRewardLabel(item.trial)} owned`)
          : nextStatus === 'farming'
            ? (isJapanese ? `「${getLocalizedTrialRewardName(item.trial, uiLocale)}」を周回中にしました` : `Marked ${getRewardLabel(item.trial)} farming`)
            : nextStatus === 'wanted'
              ? (isJapanese ? `「${getLocalizedTrialRewardName(item.trial, uiLocale)}」を希望にしました` : `Marked ${getRewardLabel(item.trial)} wanted`)
              : (isJapanese ? `「${getLocalizedTrialRewardName(item.trial, uiLocale)}」の追跡を停止しました` : `Stopped tracking ${getRewardLabel(item.trial)}`)
      );
      fetchCollectionSuggestions();
    } catch {
      toast.error(isJapanese ? '周回目標の更新に失敗しました' : 'Failed to update collection farm');
    }
  }, [createGoal, fetchCollectionSuggestions, isJapanese, uiLocale, updateGoal]);

  const handleDismiss = useCallback((trialId: string) => {
    setDismissedSuggestions((prev) => {
      const next = new Set(prev).add(trialId);
      saveDismissed(next);
      return next;
    });
  }, []);

  return (
    <div className="space-y-5">
      {/* Header with stats and expansion filter */}
      <section className="rounded-lg border border-border-default bg-surface-raised p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="font-display text-base font-semibold text-text-primary">{isJapanese ? '報酬周回' : 'Reward farms'}</h3>
            <p className="mt-1 max-w-3xl text-sm text-text-secondary">
              {isJapanese ? '固定のマウント周回と同じカタログで、マウントやトークン報酬を追跡できます。' : 'Track mounts, tokens, and rewards using the same catalog as Static Mount Farms.'}
            </p>
          </div>
          <Badge variant="info" size="sm">{isJapanese ? '固定のマウント周回と同じカタログ' : 'Same catalog as Static Mount Farms'}</Badge>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <SummaryMetric label={isJapanese ? '所持' : 'Owned'} value={completedFarms.length} tone="success" />
          <SummaryMetric label={isJapanese ? '希望' : 'Wanted'} value={wantedCount} tone="accent" />
          <SummaryMetric label={isJapanese ? '交換可' : 'Can buy'} value={readyToBuy.length} tone="warning" />
          <SummaryMetric label={isJapanese ? '周回中' : 'Farming'} value={activeFarms.length} tone="primary" />
        </div>
        <CatalogFilterControls
          locale={uiLocale}
          filters={catalogFilters}
          selected={selectedCatalogFilter}
          onChange={setSelectedCatalogFilter}
        />
        <p className="mt-3 rounded-lg border border-border-subtle bg-surface-elevated/50 px-3 py-2 text-xs text-text-tertiary">
          {isJapanese ? '共有した「希望」と「周回中」は、今後の固定周回マッチングに使われます。' : 'Static farm matching will use your Wanted and Farming rewards later.'}
        </p>
      </section>

      {/* Ready to buy — urgent, show first if any */}
      <FarmSection
        title={isJapanese ? '今すぐ交換可能' : 'Ready to buy'}
        description={isJapanese ? '必要な通貨がそろっている報酬です。' : 'You have enough currency for these rewards.'}
        items={readyToBuy}
        onSetStatus={setFarmStatus}
      />

      {/* Suggestions from static farms */}
      {visibleSuggestions.length > 0 && (
        <section className="rounded-lg border border-accent/20 bg-accent/5 p-4">
          <h3 className="font-display text-sm font-semibold text-text-primary">{isJapanese ? '固定周回からの提案' : 'Suggested from static farms'}</h3>
          <p className="mt-1 text-xs text-text-tertiary">
            {isJapanese ? '固定で共有されている報酬や通貨数から見つかった候補です。個人用の周回進捗として残せます。' : 'Your static farm data found these rewards or currency counts. Keep them here as your own farm progress.'}
          </p>
          <div className="mt-3 space-y-2">
            {visibleSuggestions.map((suggestion) => {
              const trial = getTrialById(suggestion.trialId);
              if (!trial) return null;
              const item = buildFarmItem(trial, null, suggestion);
              return (
                <FarmCollectionRow
                  key={suggestion.trialId}
                  item={item}
                  onSetStatus={setFarmStatus}
                  onDismiss={() => handleDismiss(suggestion.trialId)}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Browse rewards — primary catalog view, now prominent */}
      <section className="rounded-lg border border-border-default bg-surface-raised p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="font-display text-sm font-semibold text-text-primary">{isJapanese ? '報酬カタログ' : 'Browse rewards'}</h3>
            <p className="mt-1 text-xs text-text-tertiary">
              {isJapanese ? '報酬を「希望」「周回中」「所持」で管理できます。タスクは Goals に残ります。' : 'Mark rewards as Wanted, Farming, or Owned. Tasks stay in Goals.'}
            </p>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {catalogItems.map((item) => (
            <FarmCollectionRow
              key={item.trial.id}
              item={item}
              onSetStatus={setFarmStatus}
            />
          ))}
        </div>
      </section>

      {farmItems.length === 0 && visibleSuggestions.length === 0 && (
        <div className="text-center rounded-lg border border-border-default bg-surface-raised px-4 py-10">
          <div className="mb-3 text-accent"><GameIcon name="trophy" size="xl" /></div>
          <h3 className="font-display text-lg font-semibold text-text-primary">{isJapanese ? 'まだ周回を追跡していません' : 'No tracked farms yet'}</h3>
          <p className="mx-auto mt-1 max-w-lg text-sm text-text-secondary">
            {isJapanese ? '上のカタログから報酬を選んで、「希望」「周回中」「所持」を設定してください。' : 'Pick rewards from the catalog above to mark them as Wanted, Farming, or Owned.'}
          </p>
        </div>
      )}

      {/* Tracking sections — below browse */}
      <FarmSection
        title={isJapanese ? '現在周回中' : 'Farming now'}
        description={isJapanese ? '今まさに集めている報酬です。周回中にすると希望状態も維持されます。' : 'Rewards you are actively farming. Farming also keeps them Wanted.'}
        items={activeFarms}
        onSetStatus={setFarmStatus}
      />

      <FarmSection
        title={isJapanese ? '後でほしいもの' : 'Wanted later'}
        description={isJapanese ? 'いつか欲しいが、今は周回していない報酬です。' : 'Rewards you want eventually, but are not farming right now.'}
        items={wantedFarms}
        onSetStatus={setFarmStatus}
      />

      {completedFarms.length > 0 && (
        <section className="rounded-lg border border-border-default bg-surface-raised p-4 opacity-80">
          <h3 className="font-display text-sm font-semibold text-text-primary">{isJapanese ? '所持済み / 完了' : 'Owned / completed'}</h3>
          <div className="mt-3 space-y-2">
            {completedFarms.map((item) => (
              <FarmCollectionRow
                key={item.trial.id}
                item={item}
                onSetStatus={setFarmStatus}
                compact
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CatalogFilterControls({
  locale,
  filters,
  selected,
  onChange,
}: {
  locale: string;
  filters: { value: CatalogFilter; label: string }[];
  selected: CatalogFilter;
  onChange: (filter: CatalogFilter) => void;
}) {
  const isJapanese = locale.startsWith('ja');
  return (
    <div className="mt-4 rounded-lg border border-border-subtle bg-surface-elevated/50 p-3">
      <Label className="mb-2 block text-xs font-medium text-text-tertiary">{isJapanese ? '拡張パック' : 'Expansion'}</Label>
      <div className="sm:hidden">
        <Select
          value={selected}
          onChange={(value) => onChange(value as CatalogFilter)}
          options={filters}
          className="w-full"
        />
      </div>
      <div className="hidden flex-wrap gap-2 sm:flex">
        {filters.map((filter) => (
          /* design-system-ignore: Segmented filter chip needs compact selected styling */
          <button
            key={filter.value}
            type="button"
            onClick={() => onChange(filter.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              selected === filter.value
                ? 'border-accent/50 bg-accent/15 text-accent'
                : 'border-border-default bg-surface-elevated text-text-secondary hover:border-accent/30 hover:text-accent'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SummaryMetric({ label, value, tone }: {
  label: string;
  value: number;
  tone: 'success' | 'accent' | 'warning' | 'primary';
}) {
  const color = {
    success: 'text-status-success',
    accent: 'text-accent',
    warning: 'text-status-warning',
    primary: 'text-text-primary',
  }[tone];

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-elevated/70 px-3 py-2">
      <p className="text-xs text-text-tertiary">{label}</p>
      <p className={`font-display text-xl ${color}`}>{value}</p>
    </div>
  );
}

function FarmSection({
  title,
  description,
  items,
  onSetStatus,
}: {
  title: string;
  description: string;
  items: PlayerFarmItem[];
  onSetStatus: (item: PlayerFarmItem, status: FarmTrackingStatus) => Promise<void>;
}) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-lg border border-border-default bg-surface-raised p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-semibold text-text-primary">{title}</h3>
          <p className="mt-1 text-xs text-text-tertiary">{description}</p>
        </div>
        <Badge variant={items.length > 0 ? 'info' : 'default'} size="sm">{items.length}</Badge>
      </div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <FarmCollectionRow key={item.trial.id} item={item} onSetStatus={onSetStatus} />
        ))}
      </div>
    </section>
  );
}

function FarmCollectionRow({
  item,
  onSetStatus,
  onDismiss,
  compact = false,
}: {
  item: PlayerFarmItem;
  onSetStatus: (item: PlayerFarmItem, status: FarmTrackingStatus) => Promise<void>;
  onDismiss?: () => void;
  compact?: boolean;
}) {
  const { i18n } = useTranslation();
  const uiLocale = resolveUiLocale(i18n.resolvedLanguage);
  const isJapanese = uiLocale.startsWith('ja');
  const rewardName = getLocalizedTrialRewardName(item.trial, uiLocale);
  const sourceLabel = item.source === 'Manual'
    ? (isJapanese ? '手動' : 'Manual')
    : item.source === 'Not set'
      ? (isJapanese ? '未設定' : 'Not set')
      : item.source;
  return (
    <div className={`rounded-lg border border-border-subtle bg-surface-elevated/60 px-3 ${compact ? 'py-2' : 'py-3'}`}>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_250px] lg:items-center">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-1 rounded-lg border border-border-subtle bg-surface-raised p-1.5 text-accent">
            {item.canBuy ? <ShoppingCart className="h-4 w-4" /> : item.owned ? <Check className="h-4 w-4" /> : <XivIcon name="crystal" size={16} />}
          </div>
          <FarmCatalogSummary trial={item.trial} />
        </div>

        <div className="min-w-0">
          <FarmCurrencyProgress trial={item.trial} currentCount={item.currentCount} />
          <div className="mt-1 flex flex-wrap gap-1">
            <FarmStatusBadge status={item.status} canBuy={item.canBuy} />
            {item.source !== 'Not set' && <Badge variant="default" size="sm">{sourceLabel}</Badge>}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
          <Checkbox
            checked={item.owned}
            onChange={() => onSetStatus(item, item.owned ? 'wanted' : 'completed')}
            label={isJapanese ? '所持' : 'Owned'}
            color="teal"
            aria-label={isJapanese ? `${rewardName}を所持済みにする` : `Mark ${getRewardLabel(item.trial)} owned`}
            className="items-center text-xs"
          />
          <Checkbox
            checked={item.wanted}
            onChange={() => onSetStatus(item, item.wanted ? 'not_tracking' : 'wanted')}
            label={isJapanese ? '希望' : 'Want'}
            color="teal"
            aria-label={isJapanese ? `${rewardName}を希望にする` : `Mark ${getRewardLabel(item.trial)} wanted`}
            className="items-center text-xs"
          />
          <Button
            size="sm"
            variant={item.status === 'farming' ? 'primary' : 'secondary'}
            onClick={() => onSetStatus(item, item.status === 'farming' ? 'wanted' : 'farming')}
          >
            <Play className="h-3.5 w-3.5" />
            {isJapanese ? '周回中' : 'Farming'}
          </Button>
          {onDismiss && (
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              <X className="h-3.5 w-3.5" />
              {isJapanese ? '閉じる' : 'Dismiss'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
