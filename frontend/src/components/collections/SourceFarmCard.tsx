/**
 * SourceFarmCard — one card per source/duty, showing ALL rewards from that farm.
 *
 * Replaces CatalogFarmRow's per-reward layout with a source-first grouping so
 * the raid lead sees: "The Windward Wilds (Extreme) → Mount + Music + Minion"
 * in a single scannable card, not three disconnected rows.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  ChevronDown, PlusCircle, Coins,
  Loader2, Copy, Check, Zap,
} from 'lucide-react';
import { Button } from '../primitives/Button';
import { Badge } from '../primitives/Badge';
import type { CatalogItem, CollectionGoal, ParticipantSource, ParticipantState } from '../../stores/collectionGoalStore';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import { useCollectionIntentStore } from '../../stores/collectionIntentStore';
import { SmartSuggestionsPanel } from './SmartSuggestionsPanel';
import { TrackFromCatalogModal } from './TrackFromCatalogModal';
import type { SourceFarmGroup } from '../../utils/collectionSourceGrouping';
import {
  SOURCE_TYPE_BADGE,
  CATEGORY_BADGE as CATEGORY_BADGE_CONFIG,
  expansionLabel,
  expansionShortLabel,
} from '../../utils/collectionBadgeConfig';

// ── Config ────────────────────────────────────────────────────────────────────

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
  const catCfg = CATEGORY_BADGE_CONFIG[item.category] ?? CATEGORY_BADGE_CONFIG.other;
  const isTracked = Boolean(existingGoal);

  return (
    <>
      <div className="flex items-center gap-2.5 py-1.5 group/chip">
        {/* Colored category badge pill */}
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-widest flex-shrink-0 ${catCfg.colorClass} ${catCfg.bgClass} ${catCfg.borderClass}`}>
          {catCfg.label}
        </span>
        <span className="text-sm text-text-primary flex-1 min-w-0 truncate">{item.name}</span>
        {item.category === 'mount' && (
          item.gameMountId != null
            ? <Zap size={11} className="flex-shrink-0 text-status-info opacity-50" title="Plugin ready — ownership detected automatically" />
            : <Zap size={11} className="flex-shrink-0 text-text-muted opacity-25" title="Manual only — no game ID yet" />
        )}
        {isTracked ? (
          <Badge variant="success" size="sm" className="flex-shrink-0">Tracking</Badge>
        ) : trackDisabled ? null : (
          <Button
            size="sm"
            variant="ghost"
            onClick={e => { e.stopPropagation(); setTrackOpen(true); }}
            className="flex items-center gap-1 flex-shrink-0 text-accent hover:bg-accent/10 opacity-30 group-hover/chip:opacity-100 transition-opacity"
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

const SOURCE_BADGE: Partial<Record<ParticipantSource, { label: string; cls: string }>> = {
  plugin:     { label: 'Plugin', cls: 'bg-status-info/15 text-status-info' },
  player_hub: { label: 'Hub',    cls: 'bg-status-success/15 text-status-success' },
};

function MemberRow({ participant }: { participant: { id: string; displayName: string | null; state: ParticipantState; tokenCount: number | null; source?: ParticipantSource } }) {
  const cfg = { dot: STATE_DOT[participant.state], text: STATE_TEXT[participant.state] };
  const faded = participant.state === 'have' || participant.state === 'pass';
  const sourceBadge = participant.source ? SOURCE_BADGE[participant.source] : undefined;
  return (
    <div className="flex items-center gap-2 text-xs py-0.5">
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      <span className={`flex-1 min-w-0 truncate ${faded ? 'text-text-muted line-through opacity-60' : 'text-text-primary font-medium'}`}>
        {participant.displayName ?? 'Unknown'}
      </span>
      {sourceBadge && (
        <span className={`text-[10px] font-medium px-1 py-0.5 rounded ${sourceBadge.cls}`}>
          {sourceBadge.label}
        </span>
      )}
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
  const { suggestions, fetchSuggestions } = useCollectionIntentStore();

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

  // Fetch participants + suggestions for all tracked goals when expanded
  useEffect(() => {
    if (!expanded) return;
    for (const goal of trackedGoals) {
      if (!participants[goal.id] && !participantsLoading[goal.id]) {
        fetchParticipants(groupId, goal.id);
      }
    }
    if (isAnyTracked) {
      fetchSuggestions(groupId);
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
        const cat = CATEGORY_BADGE_CONFIG[r.category]?.label ?? r.category;
        return `  ${cat}: ${r.name}`;
      }),
    ];
    if (group.tokenName && group.tokenCost) {
      const perWeapon = group.sourceType === 'ultimate' ? ' per weapon' : '';
      lines.push(`Currency: ${group.tokenCost}× ${group.tokenName}${perWeapon}`);
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

  const srcCfg = group.sourceType ? SOURCE_TYPE_BADGE[group.sourceType] : null;
  const borderClass = srcCfg?.leftBorderClass ?? 'border-l-border-default';

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-colors duration-150 border-l-4 ${borderClass} ${
        isAnyTracked ? 'bg-accent/5 border-accent/25' : 'bg-surface-card border-border-subtle'
      }`}
    >
      {/* ── Header row ────────────────────────────────────────────────────── */}
      {/* design-system-ignore: expandable source card requires specific layout */}
      <button
        type="button"
        className="w-full text-left flex items-start gap-3 px-4 py-4 hover:bg-surface-hover/40 transition-colors"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
      >
        {/* Source name + badges */}
        <div className="flex-1 min-w-0">
          {/* Row 1: source type badge + expansion + reward count pill */}
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            {srcCfg && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${srcCfg.colorClass}`}>
                {srcCfg.label}
              </span>
            )}
            {group.expansion && (
              <span className="text-[10px] font-medium text-text-muted opacity-70 flex-shrink-0">
                <span className="hidden sm:inline">{expansionLabel(group.expansion)}</span>
                <span className="sm:hidden">{expansionShortLabel(group.expansion)}</span>
              </span>
            )}
            <span className="text-[9px] font-medium bg-surface-raised text-text-muted border border-border-subtle/60 px-1.5 py-0.5 rounded-full flex-shrink-0 ml-auto tabular-nums">
              {group.rewards.length}
            </span>
          </div>

          {/* Row 2: duty name */}
          <span className="text-base font-bold text-text-primary leading-snug block truncate">{group.sourceDutyName}</span>

          {/* Row 3: reward category pills (collapsed only) */}
          {!expanded && (
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {group.rewards.map(r => {
                const catCfg = CATEGORY_BADGE_CONFIG[r.category] ?? CATEGORY_BADGE_CONFIG.other;
                const tracked = Boolean(goalsByItemId[r.id]);
                return (
                  <span
                    key={r.id}
                    className={`flex items-center gap-1.5 text-xs ${tracked ? '' : 'opacity-55'}`}
                    title={r.name}
                  >
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-widest flex-shrink-0 ${catCfg.colorClass} ${catCfg.bgClass} ${catCfg.borderClass}`}>
                      {catCfg.label}
                    </span>
                    <span className="truncate max-w-[130px] sm:max-w-[180px] text-text-secondary text-[11px]">{r.name}</span>
                    {tracked && <span className="w-1.5 h-1.5 rounded-full bg-status-success flex-shrink-0" />}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Right side: token pill + participant dots + chevron */}
        <div className="flex items-center gap-2.5 flex-shrink-0 mt-0.5">
          {/* Token cost pill */}
          {group.tokenName && group.tokenCost && (
            <div className="hidden sm:flex items-center gap-1 text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded-md whitespace-nowrap">
              <Coins size={10} />
              {group.tokenCost}×
              {group.sourceType === 'ultimate' && <span className="opacity-70 ml-0.5">/ weapon</span>}
            </div>
          )}

          {/* Participant summary dots (tracked only) */}
          {isAnyTracked && aggregateSummary.total > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs">
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

          {/* Chevron — rotates on expand */}
          <ChevronDown
            size={15}
            className={`text-text-muted transition-transform duration-200 flex-shrink-0 ${expanded ? '' : '-rotate-90'}`}
          />
        </div>
      </button>

      {/* ── Expanded body — CSS grid animation ───────────────────────────── */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-in-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
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
                {group.sourceType === 'ultimate' && (
                  <span className="opacity-60">per weapon</span>
                )}
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
                <p className="text-xs text-text-muted opacity-60">No members have shared their Player Hub preferences with this static yet.</p>
              )}
            </div>
          )}

          {/* Smart Suggestions — shown only when tracked and suggestions are loaded */}
          {isAnyTracked && (() => {
            const groupSuggestions = suggestions[groupId] ?? [];
            // Find the best-scored suggestion whose catalogItemId is one of this group's rewards
            const rewardIds = new Set(group.rewards.map(r => r.id));
            const match = groupSuggestions
              .filter(s => rewardIds.has(s.catalogItemId))
              .sort((a, b) => b.suggestedFarmScore - a.suggestedFarmScore)[0];
            return match ? <SmartSuggestionsPanel suggestion={match} /> : null;
          })()}

          {/* Footer: patch · expansion + copy plan */}
          <div className="border-t border-border-subtle/40 px-4 py-2 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-text-muted flex-wrap">
              {group.patch && <span>Patch {group.patch}</span>}
              {group.patch && group.expansion && <span className="opacity-40">·</span>}
              {group.expansion && (
                <>
                  <span className="hidden sm:inline">{expansionLabel(group.expansion)}</span>
                  <span className="sm:hidden">{expansionShortLabel(group.expansion)}</span>
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
        </div>
      </div>
    </div>
  );
}
