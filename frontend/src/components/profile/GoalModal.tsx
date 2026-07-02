import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../ui/Modal';
import { Button } from '../primitives/Button';
import { Badge } from '../primitives/Badge';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { TextArea } from '../ui/TextArea';
import { Toggle } from '../ui/Toggle';
import { Spinner } from '../ui/Spinner';
import { usePlayerProfileStore } from '../../stores/playerProfileStore';
import type { PlayerGoal } from '../../stores/playerProfileStore';
import { OBJECTIVE_CATEGORY_OPTIONS } from '../../data/goalObjectiveCategories';
import { api } from '../../services/api';
import { toast } from '../../stores/toastStore';
import {
  getLocalizedDutyNameByText,
  getLocalizedRewardNameByText,
  resolveUiLocale,
} from '../../gamedata/mount-farm-i18n';

interface CatalogEntry {
  trialId: string;
  expansion: string;
  dutyName: string;
  sourceContent?: string;
  mountName: string;
  totemName: string | null;
  totemTarget: number;
  exchangeCost?: number;
  exchangeStatus?: 'available' | 'not_yet_available';
  category?: 'standard' | 'collaboration';
}

function isJapaneseLanguage(language?: string): boolean {
  return (language ?? '').toLowerCase().startsWith('ja');
}

function getGoalTypeOptions(isJapanese: boolean) {
  return [
    { value: 'weekly_clear', label: isJapanese ? '週消化' : 'Weekly Clear' },
    { value: 'personal', label: isJapanese ? '個人' : 'Personal' },
    { value: 'gear', label: isJapanese ? '装備' : 'Gear' },
    { value: 'raid', label: isJapanese ? 'レイド' : 'Raid' },
    { value: 'custom', label: isJapanese ? 'カスタム' : 'Custom' },
  ];
}

function getIntentLevelOptions(isJapanese: boolean) {
  return [
    { value: '', label: isJapanese ? '未設定' : 'Not set' },
    { value: 'must_have', label: isJapanese ? '必須' : 'Must Have' },
    { value: 'want', label: isJapanese ? '希望' : 'Want' },
    { value: 'willing', label: isJapanese ? '前向き' : 'Willing' },
    { value: 'not_interested', label: isJapanese ? '興味なし' : 'Not Interested' },
    { value: 'avoid', label: isJapanese ? '避けたい' : 'Avoid' },
  ];
}

// Goal types that can participate in static matching
const INTENT_ELIGIBLE_TYPES = new Set([
  'weekly_clear', 'personal', 'gear', 'raid', 'custom',
]);

function getStatusOptions(isJapanese: boolean) {
  return [
    { value: 'active', label: isJapanese ? '進行中' : 'Active' },
    { value: 'completed', label: isJapanese ? '完了' : 'Completed' },
    { value: 'paused', label: isJapanese ? '一時停止' : 'Paused' },
    { value: 'abandoned', label: isJapanese ? '中止' : 'Abandoned' },
  ];
}

const EXPANSION_ORDER = ['DT', 'EW', 'ShB', 'SB', 'HW', 'ARR'];

interface GoalModalProps {
  existing?: PlayerGoal;
  defaultGoalType?: string;
  onClose: () => void;
}

type ModalMode = 'catalog' | 'custom';

export function GoalModal({ existing, defaultGoalType, onClose }: GoalModalProps) {
  const { i18n } = useTranslation();
  const uiLocale = resolveUiLocale(i18n.resolvedLanguage);
  const isJapanese = isJapaneseLanguage(i18n.resolvedLanguage);
  const { createGoal, updateGoal } = usePlayerProfileStore();
  const isEditing = !!existing;
  const showCatalog = !isEditing && (defaultGoalType === 'mount_farm' || defaultGoalType === 'totem_farm');
  const goalTypeOptions = getGoalTypeOptions(isJapanese);
  const intentLevelOptions = getIntentLevelOptions(isJapanese);
  const statusOptions = getStatusOptions(isJapanese);

  const [mode, setMode] = useState<ModalMode>(showCatalog ? 'catalog' : 'custom');
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [goalType, setGoalType] = useState(existing?.goalType ?? defaultGoalType ?? 'personal');
  const [status, setStatus] = useState(existing?.status ?? 'active');
  const [currentCount, setCurrentCount] = useState(String(existing?.currentCount ?? 0));
  const [targetCount, setTargetCount] = useState(existing?.targetCount != null ? String(existing.targetCount) : '');
  const [sourceContent, setSourceContent] = useState(existing?.sourceContent ?? '');
  const [sourceItem, setSourceItem] = useState(existing?.sourceItem ?? '');
  const [goalMode, setGoalMode] = useState<'task' | 'objective'>(
    existing?.objectiveCategory ? 'objective' : 'task',
  );
  const [objectiveCategory, setObjectiveCategory] = useState<string>(
    existing?.objectiveCategory ?? OBJECTIVE_CATEGORY_OPTIONS[0].value,
  );
  const [intentLevel, setIntentLevel] = useState<string>(existing?.intentLevel ?? '');
  const [isPublic, setIsPublic] = useState(existing?.isPublic ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'catalog' && catalog.length === 0) {
      setLoadingCatalog(true);
      api.get<{ entries: CatalogEntry[] }>('/api/player/mount-farm-catalog')
        .then((data) => setCatalog(data.entries))
        .catch(() => setMode('custom'))
        .finally(() => setLoadingCatalog(false));
    }
  }, [mode, catalog.length]);

  const isCountBased = targetCount !== '' && Number(targetCount) > 0;

  const handleCatalogSelect = async (entry: CatalogEntry) => {
    setSaving(true);
    setError(null);
    try {
      const mountName = getLocalizedRewardNameByText(entry.mountName, uiLocale) || entry.mountName;
      await createGoal({
        title: isJapanese ? `${mountName}マウント` : `${entry.mountName} Mount`,
        goalType: 'mount_farm',
        sourceContent: entry.trialId,
        sourceItem: entry.totemName ?? entry.mountName,
        targetCount: entry.totemTarget,
        currentCount: 0,
        intentLevel: intentLevel || null,
        isPublic,
      });
      toast.success(isJapanese ? `「${mountName}」の周回目標を追加しました` : `Added ${entry.mountName} mount farm`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : (isJapanese ? '目標の作成に失敗しました' : 'Failed to create goal'));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const data: Record<string, unknown> = {
        title: title.trim(),
        goalType: goalMode === 'objective' ? 'personal' : goalType,
        status,
        description: description.trim() || undefined,
        sourceContent: sourceContent.trim() || undefined,
        sourceItem: sourceItem.trim() || undefined,
        currentCount: isCountBased ? Number(currentCount) || 0 : 0,
        targetCount: isCountBased ? Number(targetCount) : undefined,
        intentLevel: intentLevel || null,
        isPublic,
        objectiveCategory: goalMode === 'objective' ? objectiveCategory : null,
      };

      if (isEditing) {
        await updateGoal(existing.id, data);
        toast.success(isJapanese ? '目標を更新しました' : 'Goal updated');
      } else {
        await createGoal(data as Parameters<typeof createGoal>[0]);
        toast.success(isJapanese ? '目標を作成しました' : 'Goal created');
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : (isJapanese ? '保存に失敗しました' : 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const showSourceFields = ['mount_farm', 'totem_farm', 'weekly_clear', 'collection', 'raid'].includes(goalType);

  // Group catalog by expansion
  const groupedCatalog = EXPANSION_ORDER.map((exp) => ({
    expansion: exp,
    entries: catalog.filter((e) => e.expansion === exp),
  })).filter((g) => g.entries.length > 0);

  if (mode === 'catalog' && !isEditing) {
    return (
      <Modal isOpen={true} title={isJapanese ? 'マウント周回目標を追加' : 'Add Mount Farm Goal'} onClose={onClose} className="max-w-lg">
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            {isJapanese ? '追跡したい極コンテンツを選ぶか、カスタム目標を作成してください。' : 'Pick an EX trial to track, or create a custom goal.'}
          </p>

          {loadingCatalog ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-4">
              {groupedCatalog.map(({ expansion, entries }) => (
                <div key={expansion}>
                  <div className="text-xs text-text-tertiary uppercase tracking-wider font-medium mb-1.5 sticky top-0 bg-surface-base py-1">
                    {expansion}
                  </div>
                  <div className="space-y-1">
                    {entries.map((entry) => (
                      (() => {
                        const localizedMountName = getLocalizedRewardNameByText(entry.mountName, uiLocale) || entry.mountName;
                        const localizedDutyName = getLocalizedDutyNameByText(entry.dutyName, uiLocale) || entry.dutyName;
                        return (
                      /* design-system-ignore: Catalog item requires specific clickable card styling */
                      <button
                        key={entry.trialId}
                        type="button"
                        disabled={saving}
                        onClick={() => handleCatalogSelect(entry)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border-default bg-surface-elevated hover:border-accent/40 hover:bg-accent/5 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-text-primary truncate">{localizedMountName}</div>
                          <div className="text-xs text-text-tertiary truncate">{localizedDutyName}</div>
                        </div>
                        <Badge variant={entry.exchangeStatus === 'not_yet_available' ? 'default' : entry.category === 'collaboration' ? 'info' : 'default'} size="sm">
                          {entry.exchangeStatus === 'not_yet_available'
                            ? (isJapanese ? '交換待ち' : 'Exchange pending')
                            : `${entry.exchangeCost ?? entry.totemTarget} ${entry.totemName ?? (isJapanese ? '通貨' : 'currency')}`}
                        </Badge>
                      </button>
                        );
                      })()
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="text-sm text-status-error bg-status-error/10 rounded px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex justify-between items-center pt-2 border-t border-border-default">
            <Button variant="ghost" size="sm" onClick={() => setMode('custom')}>
              {isJapanese ? 'カスタム目標を作る' : 'Custom Goal Instead'}
            </Button>
            <Button variant="ghost" onClick={onClose}>{isJapanese ? 'キャンセル' : 'Cancel'}</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={true}
      title={isEditing ? (isJapanese ? '目標を編集' : 'Edit Task') : (isJapanese ? '新しい目標' : 'New Task')}
      onClose={onClose}
    >
      <div className="space-y-4">
        {/* Goal mode selector */}
        {!isEditing && (
          <div className="flex rounded-lg border border-border-default overflow-hidden text-sm font-medium">
            {/* design-system-ignore: segmented control — no Button primitive covers this style */}
            <button
              type="button"
              onClick={() => setGoalMode('task')}
              className={`flex-1 px-3 py-2 transition-colors ${
                goalMode === 'task'
                  ? 'bg-accent text-accent-contrast'
                  : 'bg-surface-elevated text-text-secondary hover:bg-surface-elevated/80'
              }`}
            >
              {isJapanese ? '個人タスク' : 'Personal Task'}
            </button>
            {/* design-system-ignore: segmented control — no Button primitive covers this style */}
            <button
              type="button"
              onClick={() => setGoalMode('objective')}
              className={`flex-1 px-3 py-2 transition-colors border-l border-border-default ${
                goalMode === 'objective'
                  ? 'bg-accent text-accent-contrast'
                  : 'bg-surface-elevated text-text-secondary hover:bg-surface-elevated/80'
              }`}
            >
              {isJapanese ? '共有目標' : 'Static Goal'}
            </button>
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">{isJapanese ? 'タイトル' : 'Title'}</label> {/* design-system-ignore */}
          <Input
            value={title}
            onChange={setTitle}
            placeholder={isJapanese ? '例：ヴァリガルマンダ周回' : 'e.g., Farm Valigarmanda mount'}
            maxLength={200}
          />
        </div>

        {/* Objective mode: category picker */}
        {goalMode === 'objective' && (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">{isJapanese ? 'カテゴリ' : 'Category'}</label> {/* design-system-ignore */}
            <Select
              value={objectiveCategory}
              onChange={setObjectiveCategory}
              options={OBJECTIVE_CATEGORY_OPTIONS}
            />
          </div>
        )}

        {/* Task mode: goal type (only for new) */}
        {goalMode === 'task' && !isEditing && (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">{isJapanese ? '種類' : 'Type'}</label> {/* design-system-ignore */}
            <Select
              value={goalType}
              onChange={setGoalType}
              options={goalTypeOptions}
            />
          </div>
        )}

        {/* Status (only for editing) */}
        {isEditing && (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">{isJapanese ? 'ステータス' : 'Status'}</label> {/* design-system-ignore */}
            <Select
              value={status}
              onChange={setStatus}
              options={statusOptions}
            />
          </div>
        )}

        {/* Intent level */}
        {(goalMode === 'objective' || INTENT_ELIGIBLE_TYPES.has(goalType)) && (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1"> {/* design-system-ignore */}
              {isJapanese ? 'どのくらい重視しますか？' : 'How strongly do you want this?'}
            </label>
            <Select
              value={intentLevel}
              onChange={setIntentLevel}
              options={intentLevelOptions}
            />
          </div>
        )}

        {/* Share toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border-default bg-surface-elevated px-3 py-2.5">
          <div>
            <div className="text-sm font-medium text-text-primary">{isJapanese ? '固定と共有する' : 'Share with my statics'}</div>
            <div className="text-xs text-text-tertiary">
              {goalMode === 'objective'
                ? (isJapanese ? '共有した目標は Static Finder、参加申請、ロスター調整に使われます。非公開の目標は自分だけに表示されます。' : 'Shared goals are used for Static Finder, applications, and roster alignment. Private goals stay personal.')
                : (isJapanese ? '固定マッチングに使われるのは共有目標のみです。' : 'Only shared goals can be used for static matching.')}
            </div>
          </div>
          <Toggle checked={isPublic} onChange={setIsPublic} size="sm" aria-label={isJapanese ? '固定と目標を共有する' : 'Share goal with statics'} />
        </div>

        {/* Source fields for content-based goals */}
        {showSourceFields && (
          <>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">{isJapanese ? 'コンテンツ / 任務' : 'Content / Duty'}</label> {/* design-system-ignore */}
              <Input
                value={sourceContent}
                onChange={setSourceContent}
                placeholder={isJapanese ? '例：極ヴァリガルマンダ討滅戦' : 'e.g., Worqor Lar Dor (Extreme)'}
                maxLength={200}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">{isJapanese ? '対象アイテム' : 'Target Item'}</label> {/* design-system-ignore */}
              <Input
                value={sourceItem}
                onChange={setSourceItem}
                placeholder={isJapanese ? '例：ヴァリガルマンダのトーテム像' : 'e.g., Valigarmanda Totem'}
                maxLength={200}
              />
            </div>
          </>
        )}

        {/* Count tracking */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">{isJapanese ? '目標数' : 'Target Count'}</label> {/* design-system-ignore */}
            <Input
              value={targetCount}
              onChange={setTargetCount}
              placeholder={isJapanese ? 'チェックだけの目標なら空欄' : 'Leave empty for checkbox goal'}
              type="number"
            />
          </div>
          {isCountBased && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">{isJapanese ? '現在数' : 'Current Count'}</label> {/* design-system-ignore */}
              <Input
                value={currentCount}
                onChange={setCurrentCount}
                placeholder="0"
                type="number"
              />
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">{isJapanese ? 'メモ' : 'Notes'}</label> {/* design-system-ignore */}
          <TextArea
            value={description}
            onChange={setDescription}
            placeholder={isJapanese ? '補足メモ（任意）' : 'Optional notes'}
            maxLength={2000}
            rows={2}
          />
        </div>

        {error && (
          <div className="text-sm text-status-error bg-status-error/10 rounded px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          {showCatalog && !isEditing && (
            <Button variant="ghost" size="sm" onClick={() => setMode('catalog')} className="mr-auto">
              {isJapanese ? 'カタログから選ぶ' : 'Pick from Catalog'}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>{isJapanese ? 'キャンセル' : 'Cancel'}</Button>
          <Button onClick={handleSubmit} disabled={saving || !title.trim()}>
            {saving ? (isJapanese ? '保存中…' : 'Saving…') : isEditing ? (isJapanese ? '変更を保存' : 'Save Changes') : (isJapanese ? '目標を作成' : 'Create Task')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
