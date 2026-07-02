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
import { useTranslation } from 'react-i18next';
import { Target, ChevronRight, AlertCircle } from 'lucide-react';
import { XivIcon } from '../ui/XivIcon';
import { Button } from '../primitives/Button';
import { Skeleton } from '../ui/Skeleton';
import { useObjectiveCommandStore } from '../../stores/objectiveCommandStore';
import type { ObjectiveCommandCard } from '../../stores/objectiveCommandStore';
import type { PageMode } from '../../types';

// ── Priority badge styles ─────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  const { t } = useTranslation();
  const styles: Record<string, string> = {
    required: 'bg-status-error/15 text-status-error border border-status-error/30',
    preferred: 'bg-status-warning/15 text-status-warning border border-status-warning/30',
    optional: 'bg-surface-elevated text-text-muted border border-border-subtle',
  };
  const cls = styles[priority] ?? styles.optional;
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${cls}`}
    >
      {t(`objectivePriority.${priority}`, { defaultValue: priority })}
    </span>
  );
}

// ── Individual objective card ─────────────────────────────────────────────────

interface ObjectiveCardProps {
  card: ObjectiveCommandCard;
  onNavigate: (tab: PageMode, subTab?: string) => void;
}

function ObjectiveCard({ card, onNavigate }: ObjectiveCardProps) {
  const { t, i18n } = useTranslation();
  const { rosterReadiness, goalAlignment, bisReadiness, linkedCollectionGoal, nextSession } = card;
  const uiLocale = i18n.resolvedLanguage === 'ja' ? 'ja-JP' : 'en-US';

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

  const categoryLabel = t(`objectiveCategory.${card.category}`, { defaultValue: card.category });

  return (
    <div className="border-border-subtle bg-surface-card overflow-hidden rounded-xl border">
      {/* Card header */}
      <div className="flex items-start gap-2 px-3 pt-3 pb-2">
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
            <PriorityBadge priority={card.priority} />
            <span className="bg-accent/10 text-accent inline-flex flex-shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-medium">
              {categoryLabel}
            </span>
          </div>
          <p className="text-text-primary mt-0.5 truncate text-sm leading-tight font-bold">
            {card.title}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="text-text-secondary flex flex-wrap items-center gap-3 px-3 pb-2 text-[11px]">
        {/* Roster readiness */}
        <span className="flex items-center gap-1">
          <XivIcon name="party" size={12} className="flex-shrink-0" />
          <span>
            {t('overview.objectiveRoster')}{' '}
            <span
              className={
                rosterReadiness.ready < rosterReadiness.total
                  ? 'text-status-warning font-semibold'
                  : 'text-status-success font-semibold'
              }
            >
              {rosterReadiness.ready}/{rosterReadiness.total}
            </span>
          </span>
        </span>

        {/* Goal alignment */}
        <span className="flex items-center gap-1">
          <Target className="text-text-muted h-3 w-3 flex-shrink-0" />
          <span>
            {t('overview.objectiveGoals')}{' '}
            <span className="text-status-success font-semibold">
              {t('overview.objectiveAligned', { count: goalAlignment.aligned })}
            </span>
            {goalAlignment.conflicts > 0 && (
              <span className="text-status-error font-semibold">
                {' '}
                · {t('overview.objectiveConflicts', { count: goalAlignment.conflicts })}
              </span>
            )}
            {goalAlignment.partial > 0 && goalAlignment.conflicts === 0 && (
              <span className="text-text-muted">
                {' '}
                · {t('overview.objectivePartial', { count: goalAlignment.partial })}
              </span>
            )}
          </span>
        </span>

        {/* BiS readiness — only when public targets exist */}
        {bisReadiness !== null && (
          <span className="flex items-center gap-1">
            <XivIcon name="sword" size={12} className="flex-shrink-0" />
            <span>
              {t('overview.objectiveBis')}{' '}
              <span
                className={
                  bisReadiness.missing > 2
                    ? 'text-status-error font-semibold'
                    : 'text-status-success font-semibold'
                }
              >
                {bisReadiness.ready}/{bisReadiness.ready + bisReadiness.missing}
              </span>
            </span>
          </span>
        )}

        {/* Linked collection goal */}
        {linkedCollectionGoal && (
          <span className="text-text-muted flex items-center gap-1">
            <span className="max-w-[120px] truncate">{linkedCollectionGoal.title}</span>
            {linkedCollectionGoal.target != null && (
              <span className="text-text-secondary font-semibold">
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
            <span className="font-medium">{t('overview.objectiveNext')}:</span> {nextSession.title}{' '}
            <span className="text-text-muted">
              {new Date(nextSession.date).toLocaleDateString(uiLocale, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </span>
        ) : (
          <span className="text-text-muted italic">{t('overview.noSessionsScheduled')}</span>
        )}
      </div>

      {/* CTA footer */}
      <div className="border-border-subtle flex items-center justify-between gap-2 border-t px-3 py-2">
        <div className="text-text-muted flex items-center gap-1.5 text-[11px]">
          {card.nextActionTarget === null ? (
            <span className="text-status-success flex items-center gap-1 font-semibold">
              <XivIcon name="crystal" size={12} />
              {card.nextAction}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <AlertCircle className="text-accent h-3 w-3 flex-shrink-0" />
              <span className="text-text-secondary">{card.nextAction}</span>
            </span>
          )}
        </div>
        {card.nextActionTarget !== null && (
          <Button
            variant="accent-subtle"
            size="sm"
            onClick={handleCta}
            rightIcon={<ChevronRight className="h-3 w-3" />}
            className="min-h-0 px-2 py-1 text-[11px]"
          >
            {t('common.go')}
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
  const { t } = useTranslation();
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
      <div className="border-border-subtle bg-surface-card rounded-xl border px-3 py-4 text-center">
        <p className="text-text-muted text-xs">{t('goalsPage.loadFailed')}</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div
        data-testid="objective-command-empty"
        className="border-border-subtle bg-surface-card rounded-xl border px-3 py-5 text-center"
      >
        <Target className="text-text-muted mx-auto mb-1.5 h-5 w-5 opacity-40" />
        <p className="text-text-secondary mb-0.5 text-xs font-medium">
          {t('goalsPage.noObjectives')}
        </p>
        <p className="text-text-muted text-[11px]">{t('overview.objectiveCommandEmptyDesc')}</p>
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
