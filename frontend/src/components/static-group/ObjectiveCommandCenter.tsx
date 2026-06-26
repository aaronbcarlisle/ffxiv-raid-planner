/**
 * ObjectiveCommandCenter — per-objective dashboard cards on the Static Overview.
 *
 * Each card aggregates roster readiness, goal alignment (public goals only),
 * BiS status (public targets only), linked collection goals, the next session,
 * and a suggested next action with a deep-link target.
 *
 * Privacy: all aggregation happens server-side. Private player goals and
 * private BiS targets are never included in the API response.
 */

import { useEffect } from 'react';
import {
  Target,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { XivIcon } from '../ui/XivIcon';
import { Button } from '../primitives/Button';
import { Skeleton } from '../ui/Skeleton';
import { useObjectiveCommandStore } from '../../stores/objectiveCommandStore';
import type { ObjectiveCommandCard } from '../../stores/objectiveCommandStore';
import type { PageMode } from '../../types';

// ── Category display labels ───────────────────────────────────────────────────

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

// ── Priority badge styles ─────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    required: 'bg-status-error/15 text-status-error border border-status-error/30',
    preferred: 'bg-status-warning/15 text-status-warning border border-status-warning/30',
    optional: 'bg-surface-elevated text-text-muted border border-border-subtle',
  };
  const labels: Record<string, string> = {
    required: 'Required',
    preferred: 'Preferred',
    optional: 'Optional',
  };
  const cls = styles[priority] ?? styles.optional;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide flex-shrink-0 ${cls}`}>
      {labels[priority] ?? priority}
    </span>
  );
}

// ── Individual objective card ─────────────────────────────────────────────────

interface ObjectiveCardProps {
  card: ObjectiveCommandCard;
  onNavigate: (tab: PageMode, subTab?: string) => void;
}

function ObjectiveCard({ card, onNavigate }: ObjectiveCardProps) {
  const { rosterReadiness, goalAlignment, bisReadiness, linkedCollectionGoal, nextSession } = card;

  function handleCta() {
    switch (card.nextActionTarget) {
      case 'roster':
        onNavigate('roster');
        break;
      case 'applicants':
        onNavigate('roster');
        break;
      case 'schedule':
        onNavigate('schedule');
        break;
      case 'collection':
        onNavigate('goals', 'farms');
        break;
      case 'bis':
        onNavigate('roster');
        break;
      default:
        onNavigate('schedule');
    }
  }

  const categoryLabel = CATEGORY_LABELS[card.category] ?? card.category;

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-card overflow-hidden">
      {/* Card header */}
      <div className="flex items-start gap-2 px-3 pt-3 pb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <PriorityBadge priority={card.priority} />
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent/10 text-accent flex-shrink-0">
              {categoryLabel}
            </span>
          </div>
          <p className="text-sm font-bold text-text-primary leading-tight truncate mt-0.5">
            {card.title}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 px-3 pb-2 text-[11px] text-text-secondary flex-wrap">
        {/* Roster readiness */}
        <span className="flex items-center gap-1">
          <XivIcon name="party" size={12} className="flex-shrink-0" />
          <span>
            Roster{' '}
            <span className={rosterReadiness.ready < rosterReadiness.total ? 'text-status-warning font-semibold' : 'text-status-success font-semibold'}>
              {rosterReadiness.ready}/{rosterReadiness.total}
            </span>
          </span>
        </span>

        {/* Goal alignment */}
        <span className="flex items-center gap-1">
          <Target className="w-3 h-3 text-text-muted flex-shrink-0" />
          <span>
            Goals{' '}
            <span className="text-status-success font-semibold">{goalAlignment.aligned} aligned</span>
            {goalAlignment.conflicts > 0 && (
              <span className="text-status-error font-semibold"> · {goalAlignment.conflicts} conflict{goalAlignment.conflicts !== 1 ? 's' : ''}</span>
            )}
            {goalAlignment.partial > 0 && goalAlignment.conflicts === 0 && (
              <span className="text-text-muted"> · {goalAlignment.partial} partial</span>
            )}
          </span>
        </span>

        {/* BiS readiness — only when public targets exist */}
        {bisReadiness !== null && (
          <span className="flex items-center gap-1">
            <XivIcon name="sword" size={12} className="flex-shrink-0" />
            <span>
              BiS{' '}
              <span className={bisReadiness.missing > 2 ? 'text-status-error font-semibold' : 'text-status-success font-semibold'}>
                {bisReadiness.ready}/{bisReadiness.ready + bisReadiness.missing}
              </span>
            </span>
          </span>
        )}

        {/* Linked collection goal */}
        {linkedCollectionGoal && (
          <span className="flex items-center gap-1 text-text-muted">
            <span className="truncate max-w-[120px]">{linkedCollectionGoal.title}</span>
            {linkedCollectionGoal.target != null && (
              <span className="font-semibold text-text-secondary">
                {linkedCollectionGoal.progress ?? 0}/{linkedCollectionGoal.target}
              </span>
            )}
          </span>
        )}
      </div>

      {/* Next session / schedule row */}
      <div className="flex items-center gap-1.5 px-3 pb-2.5 text-[11px]">
        <XivIcon name="schedule" size={12} className="flex-shrink-0" />
        {nextSession ? (
          <span className="text-text-secondary">
            <span className="font-medium">Next:</span>{' '}
            {nextSession.title}{' '}
            <span className="text-text-muted">
              {new Date(nextSession.date).toLocaleDateString(undefined, {
                weekday: 'short', month: 'short', day: 'numeric',
              })}
            </span>
          </span>
        ) : (
          <span className="text-text-muted italic">No session scheduled</span>
        )}
      </div>

      {/* CTA footer */}
      <div className="border-t border-border-subtle px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
          {card.nextActionTarget === null ? (
            <span className="text-status-success font-semibold flex items-center gap-1">
              <XivIcon name="crystal" size={12} />
              {card.nextAction}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-accent flex-shrink-0" />
              <span className="text-text-secondary">{card.nextAction}</span>
            </span>
          )}
        </div>
        {card.nextActionTarget !== null && (
          <Button
            variant="accent-subtle"
            size="sm"
            onClick={handleCta}
            rightIcon={<ChevronRight className="w-3 h-3" />}
            className="text-[11px] px-2 py-1 min-h-0"
          >
            Go
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface ObjectiveCommandCenterProps {
  groupId: string;
  isMember: boolean;
  onNavigate: (tab: PageMode, subTab?: string) => void;
}

export function ObjectiveCommandCenter({
  groupId,
  isMember,
  onNavigate,
}: ObjectiveCommandCenterProps) {
  const { cards, loading, error, fetchCards } = useObjectiveCommandStore();

  useEffect(() => {
    if (!isMember) return;
    fetchCards(groupId);
  }, [groupId, isMember, fetchCards]);

  if (!isMember) return null;

  if (loading && cards.length === 0) {
    return (
      <div data-testid="objective-command-loading" className="space-y-2">
        {[1, 2].map((n) => (
          <Skeleton key={n} className="h-[120px] rounded-xl" />
        ))}
      </div>
    );
  }

  if (error && cards.length === 0) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface-card px-3 py-4 text-center">
        <p className="text-xs text-text-muted">Couldn&apos;t load objective data.</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div
        data-testid="objective-command-empty"
        className="rounded-xl border border-border-subtle bg-surface-card px-3 py-5 text-center"
      >
        <Target className="w-5 h-5 text-text-muted mx-auto mb-1.5 opacity-40" />
        <p className="text-xs font-medium text-text-secondary mb-0.5">No objectives set</p>
        <p className="text-[11px] text-text-muted">
          Add one in Goals &amp; Farms to get actionable suggestions here.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="objective-command-cards" className="space-y-2.5">
      {cards.map((card) => (
        <ObjectiveCard key={card.id} card={card} onNavigate={onNavigate} />
      ))}
    </div>
  );
}
