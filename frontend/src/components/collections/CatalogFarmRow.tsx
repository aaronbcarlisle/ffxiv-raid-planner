import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, PlusCircle, Loader2 } from 'lucide-react';
import { XivIcon } from '../ui/XivIcon';
import { Button } from '../primitives/Button';
import { Badge } from '../primitives/Badge';
import type { BadgeVariant } from '../primitives/Badge';
import type { CatalogItem, CollectionGoal, ParticipantState } from '../../stores/collectionGoalStore';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import { TrackFromCatalogModal } from './TrackFromCatalogModal';

interface CatalogFarmRowProps {
  item: CatalogItem;
  groupId: string;
  existingGoal?: CollectionGoal;
  myTokenCount?: number;
  trackDisabled?: boolean;
}

const EXPANSION_LABELS: Record<string, string> = {
  arr: 'A Realm Reborn', hw: 'Heavensward', sb: 'Stormblood',
  shb: 'Shadowbringers', ew: 'Endwalker', dt: 'Dawntrail',
};

const SOURCE_TYPE_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
  extreme:  { label: 'Extreme',  variant: 'warning' },
  savage:   { label: 'Savage',   variant: 'error'   },
  ultimate: { label: 'Ultimate', variant: 'info'    },
};

const STATE_CONFIG: Record<ParticipantState, { label: string; dotClass: string; textClass: string }> = {
  need: { label: 'Need', dotClass: 'bg-status-error',   textClass: 'text-status-error'   },
  want: { label: 'Want', dotClass: 'bg-status-warning', textClass: 'text-status-warning' },
  have: { label: 'Have', dotClass: 'bg-status-success', textClass: 'text-status-success' },
  pass: { label: 'Pass', dotClass: 'bg-text-muted',     textClass: 'text-text-muted'     },
};

function StatePill({ state, tokenCount }: { state: ParticipantState; tokenCount: number | null }) {
  const cfg = STATE_CONFIG[state];
  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium ${cfg.textClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dotClass}`} />
      {cfg.label}
      {tokenCount != null && tokenCount > 0 && (
        <span className="text-text-muted font-normal opacity-70">{tokenCount}×</span>
      )}
    </span>
  );
}

export function CatalogFarmRow({ item, groupId, existingGoal, myTokenCount, trackDisabled = false }: CatalogFarmRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [trackOpen, setTrackOpen] = useState(false);

  const { participants, participantsLoading, fetchParticipants } = useCollectionGoalStore();
  const goalId = existingGoal?.id;
  const goalParticipants = goalId ? (participants[goalId] ?? null) : null;
  const isLoadingParticipants = goalId ? (participantsLoading[goalId] ?? false) : false;

  useEffect(() => {
    if (expanded && goalId && goalParticipants === null && !isLoadingParticipants) {
      fetchParticipants(groupId, goalId);
    }
  }, [expanded, goalId, groupId, goalParticipants, isLoadingParticipants, fetchParticipants]);

  const isTracked = Boolean(existingGoal);
  const canBuy = item.tokenCost != null && myTokenCount != null && myTokenCount >= item.tokenCost;
  const tokenProgressPercent =
    item.tokenCost != null && myTokenCount != null
      ? Math.min(100, Math.round((myTokenCount / item.tokenCost) * 100))
      : null;

  const sourceConfig = item.sourceType ? SOURCE_TYPE_CONFIG[item.sourceType] : null;
  const isRareDrop = !item.tokenCost && item.sourceType !== 'ultimate';
  const summary = existingGoal?.participantSummary;

  return (
    <>
      <div
        className={`rounded-xl border overflow-hidden transition-all ${
          isTracked
            ? 'bg-accent/5 border-accent/25'
            : 'bg-surface-card border-border-subtle'
        }`}
      >
        {/* ── Summary row ─────────────────────────────────────────────── */}
        {/* design-system-ignore: expandable catalog row requires specific layout */}
        <button
          type="button"
          className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-surface-hover/60 transition-colors"
          onClick={() => setExpanded(e => !e)}
          aria-expanded={expanded}
        >
          <span className="text-text-muted flex-shrink-0">
            {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </span>

          {/* Item name + source type badge */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-text-primary leading-tight">{item.name}</span>
              {sourceConfig && (
                <Badge variant={sourceConfig.variant} size="sm">{sourceConfig.label}</Badge>
              )}
            </div>
            {item.sourceDutyName && (
              <p className="text-xs text-text-muted mt-0.5 truncate">{item.sourceDutyName}</p>
            )}
          </div>

          {/* Token cost OR rare-drop pill */}
          {item.tokenCost != null && item.tokenName ? (
            <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
              <XivIcon name="gil" size={12} />
              <span className="text-xs text-text-secondary whitespace-nowrap">
                {item.tokenCost}× {item.tokenName}
              </span>
              {canBuy && <Badge variant="success" size="sm">Can buy</Badge>}
            </div>
          ) : isRareDrop ? (
            <Badge variant="default" size="sm" className="hidden sm:inline-flex flex-shrink-0">
              Rare drop
            </Badge>
          ) : null}

          {/* Participant summary pills (tracked items only) */}
          {summary && summary.total > 0 && (
            <div className="hidden sm:flex items-center gap-2 text-xs flex-shrink-0">
              {summary.need > 0 && (
                <span className="flex items-center gap-1 text-status-error font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-error" />
                  {summary.need}
                </span>
              )}
              {summary.want > 0 && (
                <span className="flex items-center gap-1 text-status-warning font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-warning" />
                  {summary.want}
                </span>
              )}
              {summary.have > 0 && (
                <span className="flex items-center gap-1 text-status-success font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
                  {summary.have}
                </span>
              )}
            </div>
          )}

          {/* Track / Tracking */}
          {isTracked ? (
            <Badge variant="success" size="sm" className="flex-shrink-0">Tracking</Badge>
          ) : trackDisabled ? (
            <span className="text-xs text-text-muted opacity-40 flex-shrink-0">Unavailable</span>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={e => { e.stopPropagation(); setTrackOpen(true); }}
              className="flex items-center gap-1 flex-shrink-0 text-accent hover:bg-accent/10"
            >
              <PlusCircle size={13} /> Track
            </Button>
          )}
        </button>

        {/* ── Expanded panel ───────────────────────────────────────────── */}
        {expanded && (
          <div className="border-t border-border-subtle/60">
            {/* Token progress bar */}
            {item.tokenCost != null && item.tokenName && myTokenCount != null && (
              <div className="px-4 pt-3 pb-1">
                <div className="flex justify-between text-xs text-text-secondary mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <XivIcon name="gil" size={11} />
                    {myTokenCount} / {item.tokenCost} {item.tokenName}
                  </span>
                  <span className={canBuy ? 'text-status-success font-semibold' : 'text-text-muted'}>
                    {canBuy ? 'Ready to exchange' : `${tokenProgressPercent}%`}
                  </span>
                </div>
                <div className="h-1.5 bg-surface-base rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${canBuy ? 'bg-status-success' : 'bg-accent'}`}
                    style={{ width: `${tokenProgressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Member table (tracked items) */}
            {isTracked && (
              <div className="px-4 py-3">
                {isLoadingParticipants ? (
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <Loader2 size={12} className="animate-spin" />
                    Loading static members…
                  </div>
                ) : goalParticipants && goalParticipants.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-2">
                      Static members
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {goalParticipants.map(p => (
                        <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                          <span
                            className={
                              p.state === 'have'
                                ? 'text-text-muted line-through text-xs'
                                : p.state === 'pass'
                                ? 'text-text-muted text-xs opacity-60'
                                : 'text-text-primary text-sm font-medium'
                            }
                          >
                            {p.displayName ?? 'Unknown'}
                          </span>
                          <StatePill state={p.state} tokenCount={p.tokenCount} />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  existingGoal?.participantSummary && existingGoal.participantSummary.total > 0 ? (
                    // Summary-only fallback (participants not yet fetched)
                    <div className="flex items-center gap-3 text-xs">
                      {existingGoal.participantSummary.need > 0 && (
                        <span className="flex items-center gap-1.5 text-status-error font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-status-error" />
                          {existingGoal.participantSummary.need} need
                        </span>
                      )}
                      {existingGoal.participantSummary.want > 0 && (
                        <span className="flex items-center gap-1.5 text-status-warning font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-status-warning" />
                          {existingGoal.participantSummary.want} want
                        </span>
                      )}
                      {existingGoal.participantSummary.have > 0 && (
                        <span className="flex items-center gap-1.5 text-status-success font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
                          {existingGoal.participantSummary.have} have
                        </span>
                      )}
                    </div>
                  ) : null
                )}

                {/* Goal note */}
                {existingGoal?.summary && (
                  <p className="mt-2 text-xs text-text-secondary italic">{existingGoal.summary}</p>
                )}
              </div>
            )}

            {/* Source + meta footer */}
            <div className="px-4 py-2 flex items-center gap-1.5 text-xs text-text-muted border-t border-border-subtle/40 flex-wrap">
              {item.sourceText && <span>{item.sourceText}</span>}
              {item.patch && (
                <>
                  <span className="opacity-40">·</span>
                  <span>Patch {item.patch}</span>
                </>
              )}
              {item.expansion && (
                <>
                  <span className="opacity-40">·</span>
                  <span>{EXPANSION_LABELS[item.expansion] ?? item.expansion}</span>
                </>
              )}
              {item.rarityOwnedPercent != null && (
                <>
                  <span className="opacity-40">·</span>
                  <span>{item.rarityOwnedPercent.toFixed(1)}% of players own this</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {trackOpen && (
        <TrackFromCatalogModal
          isOpen={trackOpen}
          onClose={() => setTrackOpen(false)}
          item={item}
          groupId={groupId}
        />
      )}
    </>
  );
}
