/**
 * SourceFarmCard — one card per source/duty, showing ALL rewards from that farm.
 *
 * Replaces CatalogFarmRow's per-reward layout with a source-first grouping so
 * the raid lead sees: "The Windward Wilds (Extreme) → Mount + Music + Minion"
 * in a single scannable card, not three disconnected rows.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  ChevronDown, ChevronRight, PlusCircle, Coins,
  Loader2, Sword, Music2, Rabbit, Shield, Gem, Copy, Check,
} from 'lucide-react';
import { Button } from '../primitives/Button';
import { Badge } from '../primitives/Badge';
import type { BadgeVariant } from '../primitives/Badge';
import type { CatalogItem, CollectionGoal, ParticipantState } from '../../stores/collectionGoalStore';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import { TrackFromCatalogModal } from './TrackFromCatalogModal';
import type { SourceFarmGroup } from '../../utils/collectionSourceGrouping';

// ── Config ────────────────────────────────────────────────────────────────────

const SOURCE_TYPE_CONFIG: Record<string, { label: string; variant: BadgeVariant; border: string }> = {
  extreme:  { label: 'EX',       variant: 'warning', border: 'border-l-status-warning' },
  savage:   { label: 'Savage',   variant: 'error',   border: 'border-l-status-error'   },
  ultimate: { label: 'Ultimate', variant: 'info',    border: 'border-l-status-info'    },
  criterion:{ label: 'Criterion',variant: 'info',    border: 'border-l-status-info'    },
};

const EXPANSION_LABELS: Record<string, string> = {
  arr: 'ARR', hw: 'HW', sb: 'SB', shb: 'ShB', ew: 'EW', dt: 'DT',
};

const CATEGORY_CONFIG: Record<string, { icon: typeof Sword; label: string; colorClass: string }> = {
  mount:      { icon: Sword,   label: 'Mount',   colorClass: 'text-status-warning'  },
  orchestrion:{ icon: Music2,  label: 'Music',   colorClass: 'text-status-info'     },
  minion:     { icon: Rabbit,  label: 'Minion',  colorClass: 'text-status-success'  },
  weapon:     { icon: Shield,  label: 'Weapon',  colorClass: 'text-role-melee'      },
  other:      { icon: Gem,     label: 'Rare',    colorClass: 'text-text-secondary'  },
};

const STATE_DOT: Record<ParticipantState, string> = {
  need: 'bg-status-error',
  want: 'bg-status-warning',
  have: 'bg-status-success',
  pass: 'bg-text-muted',
};

const STATE_TEXT: Record<ParticipantState, string> = {
  need: 'text-status-error',
  want: 'text-status-warning',
  have: 'text-status-success',
  pass: 'text-text-muted',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function RewardChip({ item, existingGoal, groupId, trackDisabled }: {
  item: CatalogItem;
  existingGoal?: CollectionGoal;
  groupId: string;
  trackDisabled?: boolean;
}) {
  const [trackOpen, setTrackOpen] = useState(false);
  const catCfg = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.other;
  const Icon = catCfg.icon;
  const isTracked = Boolean(existingGoal);

  return (
    <>
      <div className="flex items-center gap-2 py-1 group/chip">
        <Icon size={13} className={`flex-shrink-0 ${catCfg.colorClass} opacity-70`} />
        <span className={`text-xs font-semibold uppercase tracking-wide ${catCfg.colorClass} opacity-60 w-14 flex-shrink-0`}>
          {catCfg.label}
        </span>
        <span className="text-sm text-text-primary flex-1 min-w-0 truncate">{item.name}</span>
        {isTracked ? (
          <Badge variant="success" size="sm" className="flex-shrink-0">Tracking</Badge>
        ) : trackDisabled ? null : (
          <Button
            size="sm"
            variant="ghost"
            onClick={e => { e.stopPropagation(); setTrackOpen(true); }}
            className="flex items-center gap-1 flex-shrink-0 text-accent hover:bg-accent/10 opacity-0 group-hover/chip:opacity-100 transition-opacity"
          >
            <PlusCircle size={12} /> Track
          </Button>
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

function MemberRow({ participant }: { participant: { id: string; displayName: string | null; state: ParticipantState; tokenCount: number | null } }) {
  const cfg = { dot: STATE_DOT[participant.state], text: STATE_TEXT[participant.state] };
  const faded = participant.state === 'have' || participant.state === 'pass';
  return (
    <div className="flex items-center gap-2 text-xs py-0.5">
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      <span className={`flex-1 min-w-0 truncate ${faded ? 'text-text-muted line-through opacity-60' : 'text-text-primary font-medium'}`}>
        {participant.displayName ?? 'Unknown'}
      </span>
      <span className={`font-semibold ${cfg.text}`}>
        {participant.state === 'need' ? 'Need' : participant.state === 'want' ? 'Want' : participant.state === 'have' ? 'Have' : 'Pass'}
      </span>
      {participant.tokenCount != null && participant.tokenCount > 0 && (
        <span className="text-text-muted opacity-70 tabular-nums">{participant.tokenCount}×</span>
      )}
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

interface SourceFarmCardProps {
  group: SourceFarmGroup;
  groupId: string;
  goalsByItemId: Record<string, CollectionGoal>;
  trackDisabled?: boolean;
}

export function SourceFarmCard({ group, groupId, goalsByItemId, trackDisabled = false }: SourceFarmCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const { participants, participantsLoading, fetchParticipants } = useCollectionGoalStore();

  // Collect tracked goals in this group
  const trackedGoals = group.rewards
    .map(r => goalsByItemId[r.id])
    .filter(Boolean) as CollectionGoal[];

  const isAnyTracked = trackedGoals.length > 0;

  // Aggregate participant summary across all tracked goals in this group
  const aggregateSummary = trackedGoals.reduce(
    (acc, g) => {
      if (!g.participantSummary) return acc;
      return {
        need:    acc.need    + g.participantSummary.need,
        want:    acc.want    + g.participantSummary.want,
        have:    acc.have    + g.participantSummary.have,
        passing: acc.passing + g.participantSummary.passing,
        total:   Math.max(acc.total, g.participantSummary.total),
      };
    },
    { need: 0, want: 0, have: 0, passing: 0, total: 0 },
  );

  // Fetch participants for all tracked goals when expanded
  useEffect(() => {
    if (!expanded) return;
    for (const goal of trackedGoals) {
      if (!participants[goal.id] && !participantsLoading[goal.id]) {
        fetchParticipants(groupId, goal.id);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, groupId]);

  // Build member table: all unique members across tracked goals
  const memberData = trackedGoals.flatMap(goal => {
    const ps = participants[goal.id];
    if (!ps) return [];
    const rewardName = group.rewards.find(r => r.id === goal.catalogItemId)?.name ?? goal.title;
    return ps.map(p => ({ ...p, rewardName }));
  });

  // For each member show their WORST state across all rewards (need > want > have > pass)
  const STATE_RANK: Record<ParticipantState, number> = { need: 0, want: 1, have: 2, pass: 3 };
  const memberMap = new Map<string, typeof memberData[0]>();
  for (const m of memberData) {
    const existing = memberMap.get(m.id);
    if (!existing || STATE_RANK[m.state] < STATE_RANK[existing.state]) {
      memberMap.set(m.id, m);
    }
  }
  const members = Array.from(memberMap.values()).sort(
    (a, b) => STATE_RANK[a.state] - STATE_RANK[b.state],
  );

  const isLoadingAny = trackedGoals.some(g => participantsLoading[g.id]);

  // Copy farm plan text
  const handleCopyPlan = useCallback(async () => {
    const lines = [
      `Farm Plan: ${group.sourceDutyName}`,
      '',
      'Rewards:',
      ...group.rewards.map(r => {
        const cat = CATEGORY_CONFIG[r.category]?.label ?? r.category;
        return `  ${cat}: ${r.name}`;
      }),
    ];
    if (group.tokenName && group.tokenCost) {
      lines.push(`Currency: ${group.tokenCost}× ${group.tokenName}`);
    }
    if (members.length > 0) {
      lines.push('');
      lines.push('Static:');
      const needs = members.filter(m => m.state === 'need');
      const wants = members.filter(m => m.state === 'want');
      if (needs.length) lines.push(`  Need: ${needs.map(m => m.displayName).join(', ')}`);
      if (wants.length) lines.push(`  Want: ${wants.map(m => m.displayName).join(', ')}`);
    }
    await navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [group, members]);

  const srcCfg = group.sourceType ? SOURCE_TYPE_CONFIG[group.sourceType] : null;
  const borderClass = srcCfg?.border ?? 'border-l-border-default';

  return (
    <div
      className={`rounded-xl border border-border-subtle overflow-hidden transition-all border-l-4 ${borderClass} ${
        isAnyTracked ? 'bg-accent/5' : 'bg-surface-card'
      }`}
    >
      {/* ── Header row ────────────────────────────────────────────────────── */}
      {/* design-system-ignore: expandable source card requires specific layout */}
      <button
        type="button"
        className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-surface-hover/40 transition-colors"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
      >
        <span className="text-text-muted flex-shrink-0 mt-0.5">
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </span>

        {/* Source name + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-text-primary leading-tight">{group.sourceDutyName}</span>
            {srcCfg && (
              <Badge variant={srcCfg.variant} size="sm">{srcCfg.label}</Badge>
            )}
            {group.expansion && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted opacity-60">
                {EXPANSION_LABELS[group.expansion] ?? group.expansion.toUpperCase()}
              </span>
            )}
          </div>

          {/* Reward category pills — compact summary */}
          {!expanded && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {group.rewards.map(r => {
                const catCfg = CATEGORY_CONFIG[r.category] ?? CATEGORY_CONFIG.other;
                const Icon = catCfg.icon;
                const tracked = Boolean(goalsByItemId[r.id]);
                return (
                  <span
                    key={r.id}
                    className={`flex items-center gap-1 text-xs ${catCfg.colorClass} ${tracked ? 'font-semibold' : 'opacity-60'}`}
                    title={r.name}
                  >
                    <Icon size={11} />
                    <span className="truncate max-w-[140px]">{r.name}</span>
                    {tracked && <span className="w-1.5 h-1.5 rounded-full bg-status-success flex-shrink-0" />}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Right side: token info + participant summary + copy */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Token cost */}
          {group.tokenName && group.tokenCost && (
            <div className="hidden sm:flex items-center gap-1 text-xs text-text-secondary whitespace-nowrap">
              <Coins size={11} className="text-amber-400" />
              {group.tokenCost}×
            </div>
          )}

          {/* Participant summary dots (tracked only) */}
          {isAnyTracked && aggregateSummary.total > 0 && (
            <div className="hidden sm:flex items-center gap-2 text-xs">
              {aggregateSummary.need > 0 && (
                <span className="flex items-center gap-1 text-status-error font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-error" />
                  {aggregateSummary.need}
                </span>
              )}
              {aggregateSummary.want > 0 && (
                <span className="flex items-center gap-1 text-status-warning font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-warning" />
                  {aggregateSummary.want}
                </span>
              )}
              {aggregateSummary.have > 0 && (
                <span className="flex items-center gap-1 text-status-success font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
                  {aggregateSummary.have}
                </span>
              )}
            </div>
          )}
        </div>
      </button>

      {/* ── Expanded body ─────────────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-border-subtle/50">
          {/* All rewards from this source */}
          <div className="px-4 pt-3 pb-2">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Rewards</p>
            <div className="flex flex-col divide-y divide-border-subtle/30">
              {group.rewards.map(r => (
                <RewardChip
                  key={r.id}
                  item={r}
                  existingGoal={goalsByItemId[r.id]}
                  groupId={groupId}
                  trackDisabled={trackDisabled}
                />
              ))}
            </div>
          </div>

          {/* Token / exchange info */}
          {group.tokenName && group.tokenCost && (
            <div className="px-4 pb-3">
              <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                <Coins size={12} className="text-amber-400" />
                <span className="font-semibold">{group.tokenCost}×</span>
                <span>{group.tokenName}</span>
              </div>
            </div>
          )}

          {/* Member progress (tracked goals only) */}
          {isAnyTracked && (
            <div className="border-t border-border-subtle/40 px-4 py-3">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">
                Static Members
              </p>
              {isLoadingAny ? (
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <Loader2 size={12} className="animate-spin" />
                  Loading…
                </div>
              ) : members.length > 0 ? (
                <div className="flex flex-col">
                  {members.map(m => <MemberRow key={m.id} participant={m} />)}
                </div>
              ) : (
                <p className="text-xs text-text-muted opacity-60">No members have set their state yet.</p>
              )}
            </div>
          )}

          {/* Footer: meta + copy plan */}
          <div className="border-t border-border-subtle/40 px-4 py-2 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-text-muted flex-wrap">
              {group.sourceDutyName && <span>{group.sourceDutyName}</span>}
              {group.patch && (
                <>
                  <span className="opacity-40">·</span>
                  <span>Patch {group.patch}</span>
                </>
              )}
              {group.expansion && (
                <>
                  <span className="opacity-40">·</span>
                  <span>{EXPANSION_LABELS[group.expansion] ?? group.expansion}</span>
                </>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyPlan}
              className="flex items-center gap-1 text-text-muted hover:text-text-primary text-xs"
            >
              {copied ? <Check size={12} className="text-status-success" /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy plan'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
