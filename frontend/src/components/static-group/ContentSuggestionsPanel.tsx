/**
 * ContentSuggestionsPanel — member-proposed content and voting for static groups.
 *
 * All members can suggest and vote. Leads/owners can manage status (close/reject/delete)
 * and promote suggestions to static objective goals.
 */

import { useEffect, useRef, useState } from 'react';
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

const VOTE_OPTIONS = [
  { value: 'must_have',     label: 'Must Have',     color: 'text-status-success' },
  { value: 'want',          label: 'Want',          color: 'text-accent' },
  { value: 'willing',       label: 'Willing',       color: 'text-text-secondary' },
  { value: 'not_interested',label: 'Not Interested',color: 'text-text-muted' },
  { value: 'avoid',         label: 'Avoid',         color: 'text-status-error' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'promoted', label: 'Promoted' },
  { value: 'closed', label: 'Closed' },
  { value: 'rejected', label: 'Rejected' },
];

const CATEGORY_LABELS: Record<string, string> = {
  ultimate_clear:     'Ultimate — Clear',
  ultimate_farm:      'Ultimate — Farm',
  savage_bis:         'Savage — BiS',
  savage_mount:       'Savage — Mount',
  savage_achievement: 'Savage — Achievement',
  savage_alt_jobs:    'Savage — Alt Jobs',
  criterion_title:    'Criterion — Title',
  gil_farm:           'Gil Farm',
  loot_farm:          'Loot Farm',
  mount_farm:         'Mount Farm',
  custom:             'Custom',
};

const STATUS_BADGE: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  open:     'info',
  promoted: 'success',
  closed:   'default',
  rejected: 'error',
};

// ─── Vote Bar ────────────────────────────────────────────────────────────────

function VoteBar({ suggestion, groupId }: { suggestion: ContentSuggestion; groupId: string }) {
  const { upsertVote, deleteVote } = useContentSuggestionStore();
  const [working, setWorking] = useState(false);

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
      toast.error('Failed to save vote');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="flex items-center gap-1 flex-wrap mt-2">
      {VOTE_OPTIONS.map(({ value, label, color }) => {
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
  const [expanded, setExpanded] = useState(false);
  const { total, conflictCount } = suggestion.voteSummary;

  return (
    <div className="bg-surface-raised rounded-lg border border-border-default overflow-hidden">
      {/* Header row */}
      <div className="flex items-start gap-3 px-3 py-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <Badge variant="default" size="sm">
              {CATEGORY_LABELS[suggestion.category] ?? suggestion.category}
            </Badge>
            <Badge variant={STATUS_BADGE[suggestion.status] ?? 'default'} size="sm">
              {suggestion.status}
            </Badge>
            {conflictCount > 0 && (
              <span className="text-[10px] text-status-warning font-medium">
                {conflictCount} conflict{conflictCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <p className="text-sm font-medium text-text-primary">{suggestion.title}</p>

          <p className="text-xs text-text-muted mt-0.5">
            Suggested by {suggestion.suggestedByDisplayName ?? 'a member'}
            {total > 0 && (
              <span className="ml-1">· {total} vote{total !== 1 ? 's' : ''}</span>
            )}
          </p>

          {/* Vote bar for open suggestions */}
          {suggestion.status === 'open' && (
            <>
              <VoteBar suggestion={suggestion} groupId={groupId} />
              <p className="text-[10px] text-text-muted mt-1">
                Member interest · not used for official matching yet
              </p>
            </>
          )}

          {/* Promoted note */}
          {suggestion.status === 'promoted' && (
            <p className="text-xs text-status-success mt-1">
              Promoted · now used in goal matching
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {suggestion.description && (
            <IconButton
              icon={expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              aria-label={expanded ? 'Collapse details' : 'Expand details'}
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            />
          )}
          {canManage && suggestion.status === 'open' && (
            <IconButton
              icon={<TrendingUp className="w-3.5 h-3.5" />}
              aria-label="Promote to goal"
              variant="ghost"
              size="sm"
              onClick={() => onPromote(suggestion)}
            />
          )}
          {canManage && suggestion.status === 'open' && (
            <IconButton
              icon={<X className="w-3.5 h-3.5" />}
              aria-label="Close suggestion"
              variant="ghost"
              size="sm"
              onClick={() => onStatusChange(suggestion.id, 'closed')}
            />
          )}
          {canManage && (
            <IconButton
              icon={<Trash2 className="w-3.5 h-3.5" />}
              aria-label="Delete suggestion"
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
  /** Pulse + scroll the "Suggest" button into view (Overview deep-link). */
  highlightSuggest?: boolean;
}

export function ContentSuggestionsPanel({ groupId, canManage, highlightSuggest = false }: ContentSuggestionsPanelProps) {
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

  useEffect(() => {
    fetchSuggestions(groupId);
  }, [groupId, fetchSuggestions]);

  // Deep-link from Overview: scroll the Suggest button into view; the
  // `highlight-pulse` class plays its one-shot accent animation on mount.
  const suggestBtnRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlightSuggest) {
      suggestBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [highlightSuggest]);

  const filtered = statusFilter
    ? suggestions.filter((s) => s.status === statusFilter)
    : suggestions;

  const handleCreate = async (data: { category: string; title: string; description?: string }) => {
    await createSuggestion(groupId, data);
    toast.success('Suggestion submitted');
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateSuggestion(groupId, id, { status });
      toast.success(`Suggestion ${status}`);
    } catch {
      toast.error('Failed to update suggestion');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteId) return;
    try {
      await deleteSuggestion(groupId, pendingDeleteId);
      toast.success('Suggestion removed');
    } catch {
      toast.error('Failed to remove suggestion');
    } finally {
      setPendingDeleteId(null);
      deleteModal.close();
    }
  };

  const handlePromote = async (data: { priority: string; title?: string; description?: string }) => {
    if (!pendingPromotion) return;
    await promoteToGoal(groupId, pendingPromotion.id, data);
    toast.success('Promoted to static objective goal');
    setPendingPromotion(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Content Suggestions</h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            {canManage
              ? 'Suggestions collect member interest. Promote a suggestion to make it an official static goal used for matching and discovery.'
              : 'Suggest content and vote to show interest. Leads can promote popular suggestions into official static goals.'}
          </p>
        </div>
        <div ref={suggestBtnRef} className="flex-shrink-0">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={suggestModal.open}
            className={highlightSuggest ? 'highlight-pulse' : ''}
          >
            Suggest
          </Button>
        </div>
      </div>

      {/* Status filter */}
      <div className="w-36">
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_OPTIONS}
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
            ? 'No open suggestions. Be the first to suggest something!'
            : `No ${statusFilter} suggestions.`}
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
          title="Remove Suggestion"
          message="Remove this suggestion? This cannot be undone."
          confirmLabel="Remove"
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
