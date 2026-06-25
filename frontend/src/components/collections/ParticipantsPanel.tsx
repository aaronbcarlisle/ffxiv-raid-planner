import { useEffect } from 'react';
import { User, Loader2 } from 'lucide-react';
import { Button } from '../primitives/Button';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import type { ParticipantState } from '../../stores/collectionGoalStore';
import { Tooltip } from '../primitives/Tooltip';

const STATE_STYLES: Record<ParticipantState, { label: string; dot: string; text: string }> = {
  need: { label: 'Need', dot: 'bg-status-error', text: 'text-status-error' },
  want: { label: 'Want', dot: 'bg-status-warning', text: 'text-status-warning' },
  have: { label: 'Have', dot: 'bg-status-success', text: 'text-status-success' },
  pass: { label: 'Pass', dot: 'bg-text-muted', text: 'text-text-muted' },
};

interface ParticipantsPanelProps {
  groupId: string;
  goalId: string;
  currentUserId: string;
  canManage: boolean;
  onSetMyState?: (state: ParticipantState) => void;
}

export function ParticipantsPanel({ groupId, goalId, currentUserId, canManage: _canManage, onSetMyState }: ParticipantsPanelProps) {
  const { participants, participantsLoading, fetchParticipants } = useCollectionGoalStore();

  useEffect(() => {
    fetchParticipants(groupId, goalId);
  }, [groupId, goalId, fetchParticipants]);

  const list = participants[goalId] ?? [];
  const loading = participantsLoading[goalId] ?? false;

  const grouped: Record<ParticipantState, typeof list> = {
    need: list.filter((p) => p.state === 'need'),
    want: list.filter((p) => p.state === 'want'),
    have: list.filter((p) => p.state === 'have'),
    pass: list.filter((p) => p.state === 'pass'),
  };

  const myEntry = list.find((p) => p.userId === currentUserId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-text-muted">
        <Loader2 size={20} className="animate-spin mr-2" />
        Loading participants…
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div className="py-8 text-center text-text-muted text-sm">
        No one has set their status yet.
        {onSetMyState && (
          <div className="mt-3 flex gap-2 justify-center">
            {(['need', 'want', 'pass'] as const).map((s) => (
              <Button
                key={s}
                variant="ghost"
                size="sm"
                onClick={() => onSetMyState(s)}
                className={STATE_STYLES[s].text}
              >
                {STATE_STYLES[s].label}
              </Button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* My state quick-set */}
      {onSetMyState && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-text-secondary">My status:</span>
          {(['need', 'want', 'have', 'pass'] as const).map((s) => (
            <Button
              key={s}
              variant="ghost"
              size="sm"
              onClick={() => onSetMyState(s)}
              className={myEntry?.state === s ? STATE_STYLES[s].text : ''}
            >
              {STATE_STYLES[s].label}
            </Button>
          ))}
        </div>
      )}

      {/* Groups */}
      {(['need', 'want', 'have', 'pass'] as const).map((state) => {
        const group = grouped[state];
        if (group.length === 0) return null;
        const style = STATE_STYLES[state];
        return (
          <div key={state}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2 h-2 rounded-full ${style.dot}`} />
              <span className={`text-xs font-semibold uppercase tracking-wide ${style.text}`}>
                {style.label} ({group.length})
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {group
                .sort((a, b) => (a.priorityRank ?? 999) - (b.priorityRank ?? 999))
                .map((p) => (
                  <div key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-base">
                    <User size={14} className="text-text-muted flex-shrink-0" />
                    <span className="text-sm text-text-primary flex-1">
                      {p.displayName ?? p.userId}
                      {p.userId === currentUserId && (
                        <span className="ml-1 text-xs text-text-muted">(you)</span>
                      )}
                    </span>
                    {p.priorityRank != null && (
                      <Tooltip content={`Priority rank: ${p.priorityRank}`}>
                        <span className="text-xs text-text-muted font-mono">#{p.priorityRank}</span>
                      </Tooltip>
                    )}
                    {p.tokenCount != null && (
                      <Tooltip content="Current token count">
                        <span className="text-xs text-text-secondary">{p.tokenCount}t</span>
                      </Tooltip>
                    )}
                    {p.source !== 'manual' && (
                      <Tooltip content={`Synced from ${p.source}`}>
                        <span className="text-xs text-accent/70 border border-accent/30 px-1 rounded">
                          {p.source}
                        </span>
                      </Tooltip>
                    )}
                  </div>
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
