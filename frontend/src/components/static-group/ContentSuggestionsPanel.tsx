/**
 * ContentSuggestionsPanel — member-proposed content and voting for static groups.
 *
 * All members can suggest and vote. Leads/owners can manage status (close/reject/delete)
 * and promote suggestions to static objective goals.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown, ChevronUp, Plus, Trash2, TrendingUp, X,
} from 'lucide-react';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { IconButton } from '../primitives/IconButton';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Spinner } from '../ui/Spinner';
import { Select } from '../ui/Select';
import { useModal } from '../../hooks/useModal';
import {
  useContentSuggestionStore,
  type ContentSuggestion,
} from '../../stores/contentSuggestionStore';
import { toast } from '../../stores/toastStore';
import { SuggestContentModal } from './SuggestContentModal';
import { PromoteToGoalModal } from './PromoteToGoalModal';

// ─── Constants ───────────────────────────────────────────────────────────────

function isJapaneseLanguage(language?: string): boolean {
  return (language ?? '').toLowerCase().startsWith('ja');
}

function getVoteOptions(isJapanese: boolean) {
  return [
    { value: 'must_have', label: isJapanese ? '必須' : 'Must Have', color: 'text-status-success' },
    { value: 'want', label: isJapanese ? '希望' : 'Want', color: 'text-accent' },
    { value: 'willing', label: isJapanese ? '前向き' : 'Willing', color: 'text-text-secondary' },
    { value: 'not_interested', label: isJapanese ? '興味なし' : 'Not Interested', color: 'text-text-muted' },
    { value: 'avoid', label: isJapanese ? '避けたい' : 'Avoid', color: 'text-status-error' },
  ];
}

function getStatusOptions(isJapanese: boolean) {
  return [
    { value: '', label: isJapanese ? 'すべて' : 'All' },
    { value: 'open', label: isJapanese ? '受付中' : 'Open' },
    { value: 'promoted', label: isJapanese ? '昇格済み' : 'Promoted' },
    { value: 'closed', label: isJapanese ? 'クローズ' : 'Closed' },
    { value: 'rejected', label: isJapanese ? '却下' : 'Rejected' },
  ];
}

function getCategoryLabel(category: string, isJapanese: boolean): string {
  if (!isJapanese) {
    return {
      ultimate_clear: 'Ultimate — Clear',
      ultimate_farm: 'Ultimate — Farm',
      savage_bis: 'Savage — BiS',
      savage_mount: 'Savage — Mount',
      savage_achievement: 'Savage — Achievement',
      savage_alt_jobs: 'Savage — Alt Jobs',
      criterion_title: 'Criterion — Title',
      gil_farm: 'Gil Farm',
      loot_farm: 'Loot Farm',
      mount_farm: 'Mount Farm',
      custom: 'Custom',
    }[category] ?? category;
  }
  return {
    ultimate_clear: '絶クリア',
    ultimate_farm: '絶周回',
    savage_bis: '零式BiS',
    savage_mount: '零式マウント',
    savage_achievement: '零式アチーブメント',
    savage_alt_jobs: '零式サブジョブ',
    criterion_title: '異聞称号',
    gil_farm: 'ギル稼ぎ',
    loot_farm: '戦利品周回',
    mount_farm: 'マウント周回',
    custom: 'カスタム',
  }[category] ?? category;
}

function getStatusLabel(status: string, isJapanese: boolean): string {
  if (!isJapanese) {
    return {
      open: 'Open',
      promoted: 'Promoted',
      closed: 'Closed',
      rejected: 'Rejected',
    }[status] ?? status;
  }
  return {
    open: '受付中',
    promoted: '昇格済み',
    closed: 'クローズ',
    rejected: '却下',
  }[status] ?? status;
}

const STATUS_BADGE: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  open:     'info',
  promoted: 'success',
  closed:   'default',
  rejected: 'error',
};

// ─── Vote Bar ────────────────────────────────────────────────────────────────

function VoteBar({ suggestion, groupId }: { suggestion: ContentSuggestion; groupId: string }) {
  const { i18n } = useTranslation();
  const isJapanese = isJapaneseLanguage(i18n.resolvedLanguage);
  const { upsertVote, deleteVote } = useContentSuggestionStore();
  const [working, setWorking] = useState(false);
  const voteOptions = getVoteOptions(isJapanese);

  const handleVote = async (vote: string) => {
    if (working) return;
    setWorking(true);
    try {
      if (suggestion.currentUserVote === vote) {
        await deleteVote(groupId, suggestion.id);
      } else {
        await upsertVote(groupId, suggestion.id, vote);
      }
    } catch {
      toast.error(isJapanese ? '投票の保存に失敗しました' : 'Failed to save vote');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="flex items-center gap-1 flex-wrap mt-2">
      {voteOptions.map(({ value, label, color }) => {
        const isActive = suggestion.currentUserVote === value;
        const count = suggestion.voteSummary[value as keyof typeof suggestion.voteSummary] as number;
        return (
          /* design-system-ignore: compact vote pill button */
          <button
            key={value}
            type="button"
            onClick={() => handleVote(value)}
            disabled={working}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
              isActive
                ? 'bg-accent/15 border-accent/40 text-accent font-semibold'
                : 'bg-surface-raised border-border-default hover:border-accent/30 text-text-secondary'
            } ${working ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span className={isActive ? 'text-accent' : color}>{label}</span>
            {count > 0 && (
              <span className={`font-mono ${isActive ? 'text-accent' : 'text-text-muted'}`}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Suggestion Row ──────────────────────────────────────────────────────────

interface SuggestionRowProps {
  suggestion: ContentSuggestion;
  groupId: string;
  canManage: boolean;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onPromote: (suggestion: ContentSuggestion) => void;
}

function SuggestionRow({
  suggestion,
  groupId,
  canManage,
  onDelete,
  onStatusChange,
  onPromote,
}: SuggestionRowProps) {
  const { i18n } = useTranslation();
  const isJapanese = isJapaneseLanguage(i18n.resolvedLanguage);
  const [expanded, setExpanded] = useState(false);
  const { total, conflictCount } = suggestion.voteSummary;

  return (
    <div className="bg-surface-raised rounded-lg border border-border-default overflow-hidden">
      {/* Header row */}
      <div className="flex items-start gap-3 px-3 py-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <Badge variant="default" size="sm">
              {getCategoryLabel(suggestion.category, isJapanese)}
            </Badge>
            <Badge variant={STATUS_BADGE[suggestion.status] ?? 'default'} size="sm">
              {getStatusLabel(suggestion.status, isJapanese)}
            </Badge>
            {conflictCount > 0 && (
              <span className="text-[10px] text-status-warning font-medium">
                {isJapanese ? `競合 ${conflictCount}件` : `${conflictCount} conflict${conflictCount !== 1 ? 's' : ''}`}
              </span>
            )}
          </div>

          <p className="text-sm font-medium text-text-primary">{suggestion.title}</p>

          <p className="text-xs text-text-muted mt-0.5">
            {isJapanese ? '提案者' : 'Suggested by'} {suggestion.suggestedByDisplayName ?? (isJapanese ? 'メンバー' : 'a member')}
            {total > 0 && (
              <span className="ml-1">{isJapanese ? `・${total}票` : `· ${total} vote${total !== 1 ? 's' : ''}`}</span>
            )}
          </p>

          {/* Vote bar for open suggestions */}
          {suggestion.status === 'open' && (
            <>
              <VoteBar suggestion={suggestion} groupId={groupId} />
              <p className="text-[10px] text-text-muted mt-1">
                {isJapanese ? 'メンバーの関心度です。まだ公式マッチングには使われません。' : 'Member interest · not used for official matching yet'}
              </p>
            </>
          )}

          {/* Promoted note */}
          {suggestion.status === 'promoted' && (
            <p className="text-xs text-status-success mt-1">
              {isJapanese ? '昇格済み・目標マッチングに使用中' : 'Promoted · now used in goal matching'}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {suggestion.description && (
            <IconButton
              icon={expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              aria-label={expanded ? (isJapanese ? '詳細を閉じる' : 'Collapse details') : (isJapanese ? '詳細を開く' : 'Expand details')}
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            />
          )}
          {canManage && suggestion.status === 'open' && (
            <IconButton
              icon={<TrendingUp className="w-3.5 h-3.5" />}
              aria-label={isJapanese ? '目標に昇格' : 'Promote to goal'}
              variant="ghost"
              size="sm"
              onClick={() => onPromote(suggestion)}
            />
          )}
          {canManage && suggestion.status === 'open' && (
            <IconButton
              icon={<X className="w-3.5 h-3.5" />}
              aria-label={isJapanese ? '提案をクローズ' : 'Close suggestion'}
              variant="ghost"
              size="sm"
              onClick={() => onStatusChange(suggestion.id, 'closed')}
            />
          )}
          {canManage && (
            <IconButton
              icon={<Trash2 className="w-3.5 h-3.5" />}
              aria-label={isJapanese ? '提案を削除' : 'Delete suggestion'}
              variant="ghost"
              size="sm"
              onClick={() => onDelete(suggestion.id)}
            />
          )}
        </div>
      </div>

      {/* Description */}
      {expanded && suggestion.description && (
        <div className="px-3 pb-2.5 pt-0">
          <p className="text-xs text-text-secondary border-t border-border-default pt-2">
            {suggestion.description}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────────

interface ContentSuggestionsPanelProps {
  groupId: string;
  canManage: boolean;
}

export function ContentSuggestionsPanel({ groupId, canManage }: ContentSuggestionsPanelProps) {
  const { i18n } = useTranslation();
  const isJapanese = isJapaneseLanguage(i18n.resolvedLanguage);
  const {
    suggestions,
    loading,
    error,
    fetchSuggestions,
    createSuggestion,
    updateSuggestion,
    deleteSuggestion,
    promoteToGoal,
  } = useContentSuggestionStore();

  const [statusFilter, setStatusFilter] = useState('open');
  const suggestModal = useModal();
  const deleteModal = useModal();
  const promoteModal = useModal();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<ContentSuggestion | null>(null);
  const statusOptions = getStatusOptions(isJapanese);

  useEffect(() => {
    fetchSuggestions(groupId);
  }, [groupId, fetchSuggestions]);

  const filtered = statusFilter
    ? suggestions.filter((s) => s.status === statusFilter)
    : suggestions;

  const handleCreate = async (data: { category: string; title: string; description?: string }) => {
    await createSuggestion(groupId, data);
    toast.success(isJapanese ? '提案を送信しました' : 'Suggestion submitted');
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateSuggestion(groupId, id, { status });
      toast.success(isJapanese ? `提案を${getStatusLabel(status, true)}にしました` : `Suggestion ${status}`);
    } catch {
      toast.error(isJapanese ? '提案の更新に失敗しました' : 'Failed to update suggestion');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteId) return;
    try {
      await deleteSuggestion(groupId, pendingDeleteId);
      toast.success(isJapanese ? '提案を削除しました' : 'Suggestion removed');
    } catch {
      toast.error(isJapanese ? '提案の削除に失敗しました' : 'Failed to remove suggestion');
    } finally {
      setPendingDeleteId(null);
      deleteModal.close();
    }
  };

  const handlePromote = async (data: { priority: string; title?: string; description?: string }) => {
    if (!pendingPromotion) return;
    await promoteToGoal(groupId, pendingPromotion.id, data);
    toast.success(isJapanese ? '固定目標に昇格しました' : 'Promoted to static objective goal');
    setPendingPromotion(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{isJapanese ? 'コンテンツ提案' : 'Content Suggestions'}</h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            {canManage
              ? (isJapanese ? '提案でメンバーの関心度を集められます。昇格すると、マッチングや公開募集に使う正式な固定目標になります。' : 'Suggestions collect member interest. Promote a suggestion to make it an official static goal used for matching and discovery.')
              : (isJapanese ? '遊びたいコンテンツを提案して投票できます。人気の提案はリーダーが正式な固定目標へ昇格できます。' : 'Suggest content and vote to show interest. Leads can promote popular suggestions into official static goals.')}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={suggestModal.open}
        >
          {isJapanese ? '提案する' : 'Suggest'}
        </Button>
      </div>

      {/* Status filter */}
      <div className="w-36">
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={statusOptions}
        />
      </div>

      {/* Loading / error */}
      {loading && suggestions.length === 0 && (
        <div className="flex justify-center py-6"><Spinner /></div>
      )}
      {error && (
        <div className="text-sm text-status-error bg-status-error/10 rounded px-3 py-2">{error}</div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <p className="text-sm text-text-tertiary italic py-4 text-center">
          {statusFilter === 'open'
            ? (isJapanese ? '受付中の提案はまだありません。最初の提案をしてみましょう。' : 'No open suggestions. Be the first to suggest something!')
            : (isJapanese ? `${getStatusLabel(statusFilter, true)}の提案はありません。` : `No ${statusFilter} suggestions.`)}
        </p>
      )}

      {/* List */}
      <div className="space-y-2">
        {filtered.map((suggestion) => (
          <SuggestionRow
            key={suggestion.id}
            suggestion={suggestion}
            groupId={groupId}
            canManage={canManage}
            onDelete={(id) => {
              setPendingDeleteId(id);
              deleteModal.open();
            }}
            onStatusChange={handleStatusChange}
            onPromote={(s) => {
              setPendingPromotion(s);
              promoteModal.open();
            }}
          />
        ))}
      </div>

      {/* Modals */}
      {suggestModal.isOpen && (
        <SuggestContentModal
          onSave={handleCreate}
          onClose={suggestModal.close}
        />
      )}

      {promoteModal.isOpen && pendingPromotion && (
        <PromoteToGoalModal
          suggestion={pendingPromotion}
          onPromote={handlePromote}
          onClose={() => {
            setPendingPromotion(null);
            promoteModal.close();
          }}
        />
      )}

      {deleteModal.isOpen && (
        <ConfirmModal
          isOpen={deleteModal.isOpen}
          title={isJapanese ? '提案を削除' : 'Remove Suggestion'}
          message={isJapanese ? 'この提案を削除しますか？この操作は取り消せません。' : 'Remove this suggestion? This cannot be undone.'}
          confirmLabel={isJapanese ? '削除' : 'Remove'}
          variant="danger"
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            setPendingDeleteId(null);
            deleteModal.close();
          }}
        />
      )}
    </div>
  );
}
