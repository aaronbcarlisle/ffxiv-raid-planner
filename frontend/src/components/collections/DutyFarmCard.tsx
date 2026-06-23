/**
 * DutyFarmCard — one card per source duty in the Suggested Farms tab.
 *
 * Aggregates all catalog items from the same duty into a single card so that
 * "Wings of Ruin Mount + Worqor Orchestrion Roll" appear under one
 * "Worqor Lar Dor (Extreme)" header instead of as separate cards.
 *
 * A member is counted in the aggregate if they want ANY reward from this duty.
 */

import { useState } from 'react';
import {
  AlertCircle, ChevronDown, Coins, Eye, Search, Star, Trophy, Users,
} from 'lucide-react';
import { Button } from '../primitives/Button';
import type { StaticCollectionSuggestion, MemberSuggestionEntry } from '../../stores/collectionIntentStore';
import {
  SOURCE_TYPE_BADGE as CONTENT_TYPE_CONFIG,
  CATEGORY_BADGE,
  expansionLabel,
  expansionShortLabel,
} from '../../utils/collectionBadgeConfig';

/** Build a duty-level copy plan covering all rewards in the card. */
function buildDutyCopyText(dutyName: string, suggestions: StaticCollectionSuggestion[]): string {
  const lines: string[] = ['Tonight\'s Farm Plan', `Source: ${dutyName}`];

  lines.push('Rewards:');
  for (const s of suggestions) {
    const categoryLabel = CATEGORY_BADGE[s.catalogItemCategory ?? '']?.label ?? s.catalogItemCategory ?? 'Reward';
    lines.push(`- ${categoryLabel}: ${s.catalogItemName}`);
  }

  // Aggregate members across all rewards (highest-priority per user)
  const byUser = new Map<string, MemberSuggestionEntry>();
  for (const s of suggestions) {
    for (const m of s.members) {
      const ex = byUser.get(m.userId);
      if (!ex) { byUser.set(m.userId, m); continue; }
      const rank = (e: MemberSuggestionEntry) =>
        e.ownershipState === 'have' ? 4 : e.intent === 'hunting' ? 3 : e.intent === 'interested' ? 2 : e.canBuy ? 1 : 0;
      if (rank(m) > rank(ex)) byUser.set(m.userId, m);
    }
  }
  const members = [...byUser.values()];
  const wantNames = members.filter(m => m.intent === 'hunting' && m.ownershipState !== 'have').map(m => m.displayName ?? m.userId);
  const canBuyNames = members.filter(m => m.canBuy && m.ownershipState !== 'have').map(m => {
    const token = m.tokenCount != null ? ` ${m.tokenCount}` : '';
    return (m.displayName ?? m.userId) + token;
  });

  if (wantNames.length)  lines.push(`Still want: ${wantNames.join(', ')}`);
  if (canBuyNames.length) lines.push(`Can buy: ${canBuyNames.join(', ')}`);
  return lines.join('\n');
}

// ── Aggregate helper ──────────────────────────────────────────────────────────

interface AggregateCounts {
  hunting: number;
  interested: number;
  have: number;
  canBuy: number;
  unknown: number;
}

function aggregateMembers(suggestions: StaticCollectionSuggestion[]): AggregateCounts {
  // A member is only counted once per duty (highest-priority across all rewards)
  const byUser = new Map<string, MemberSuggestionEntry>();
  for (const s of suggestions) {
    for (const m of s.members) {
      const existing = byUser.get(m.userId);
      if (!existing) {
        byUser.set(m.userId, m);
        continue;
      }
      // Prefer "have" > "hunting" > "interested" > others
      const rank = (e: MemberSuggestionEntry) => {
        if (e.ownershipState === 'have') return 4;
        if (e.intent === 'hunting') return 3;
        if (e.intent === 'interested') return 2;
        if (e.ownershipState === 'missing') return 1;
        return 0;
      };
      if (rank(m) > rank(existing)) byUser.set(m.userId, m);
    }
  }
  const members = [...byUser.values()];
  return {
    hunting:    members.filter(m => m.intent === 'hunting' && m.ownershipState !== 'have').length,
    interested: members.filter(m => m.intent === 'interested' && m.ownershipState !== 'have').length,
    have:       members.filter(m => m.ownershipState === 'have').length,
    canBuy:     members.filter(m => m.canBuy && m.ownershipState !== 'have').length,
    unknown:    members.filter(m => m.ownershipState === 'unknown' && !m.intent).length,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MiniTeamBar({ counts }: { counts: AggregateCounts }) {
  const stats = [
    { icon: <Trophy size={10} />,        label: 'Owned',      value: counts.have,      color: 'text-status-success' },
    { icon: <Search size={10} />,        label: 'Hunting',    value: counts.hunting,   color: 'text-status-info' },
    { icon: <Star size={10} />,          label: 'Interested', value: counts.interested, color: 'text-status-warning' },
    { icon: <Coins size={10} />,         label: 'Can buy',    value: counts.canBuy,    color: 'text-amber-400' },
    { icon: <AlertCircle size={10} />,   label: 'Unknown',    value: counts.unknown,   color: 'text-text-muted opacity-50' },
  ].filter(s => s.value > 0);

  if (stats.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2.5">
      {stats.map(s => (
        <div key={s.label} className={`flex items-center gap-1 text-[10px] font-medium ${s.color}`}>
          {s.icon}
          <span>{s.label}: {s.value}</span>
        </div>
      ))}
    </div>
  );
}

function RewardRow({
  suggestion: s,
  canManage,
  onMakeActiveFarm,
  onViewGoal,
}: {
  suggestion: StaticCollectionSuggestion;
  canManage: boolean;
  onMakeActiveFarm: (catalogItemId: string) => void;
  onViewGoal?: (goalId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const catCfg = CATEGORY_BADGE[s.catalogItemCategory ?? ''] ?? null;
  const categoryLabel = catCfg?.label ?? s.catalogItemCategory ?? '';
  const hasGoal = !!s.staticGoalId;

  const visibleMembers = s.members.filter(m => m.intent !== 'hidden');
  const previewMembers = visibleMembers.slice(0, 4);
  const hiddenCount = visibleMembers.length - 4;

  const huntingCount = s.members.filter(m => m.intent === 'hunting' && m.ownershipState !== 'have').length;
  const haveCount = s.members.filter(m => m.ownershipState === 'have').length;

  return (
    <div className="border-t border-border-subtle/40 first:border-0">
      {/* Reward header row */}
      <Button
        variant="ghost"
        className="w-full text-left px-4 py-2.5 flex items-center gap-2 hover:bg-surface-hover/20 transition-colors justify-start rounded-none h-auto"
        onClick={() => setExpanded(e => !e)}
      >
        {categoryLabel && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-widest flex-shrink-0 min-w-[3rem] text-center ${
            catCfg
              ? `${catCfg.colorClass} ${catCfg.bgClass} ${catCfg.borderClass}`
              : 'border-border-subtle bg-surface-raised text-text-muted'
          }`}>
            {categoryLabel}
          </span>
        )}
        <span className="flex-1 text-sm text-text-primary truncate">{s.catalogItemName}</span>
        {/* Mini stats */}
        <div className="flex items-center gap-2 flex-shrink-0 text-[10px] text-text-muted">
          {huntingCount > 0 && <span className="text-status-info">{huntingCount} hunting</span>}
          {haveCount > 0 && <span className="text-status-success">{haveCount} owned</span>}
        </div>
        {hasGoal && (
          <span className="text-[10px] text-accent font-medium bg-accent/10 px-1.5 py-0.5 rounded-full border border-accent/30 flex-shrink-0">
            Active
          </span>
        )}
        <ChevronDown
          size={13}
          className={`text-text-muted transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
        />
      </Button>

      {/* Expanded player list + actions */}
      {expanded && (
        <div className="px-4 pb-3 flex flex-col gap-2 bg-surface-raised/10">
          <div className="flex flex-col gap-1">
            {previewMembers.map(m => (
              <div key={m.userId} className="flex items-center gap-2 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  m.ownershipState === 'have'  ? 'bg-status-success' :
                  m.intent === 'hunting'       ? 'bg-status-info' :
                  m.intent === 'interested'    ? 'bg-status-warning' :
                  'bg-text-muted opacity-40'
                }`} />
                <span className="flex-1 text-text-primary truncate">{m.displayName ?? m.userId}</span>
                <span className={`flex-shrink-0 text-[10px] ${
                  m.ownershipState === 'have' ? 'text-status-success' :
                  m.intent === 'hunting'      ? 'text-status-info' :
                  m.intent === 'interested'   ? 'text-status-warning' :
                  'text-text-muted opacity-60'
                }`}>
                  {m.ownershipState === 'have' ? 'Owned' :
                   m.intent === 'hunting' ? 'Hunting' :
                   m.intent === 'interested' ? 'Interested' :
                   m.ownershipState === 'missing' ? 'Missing' : 'Unknown'}
                </span>
                {m.tokenCount != null && m.ownershipState !== 'have' && (
                  <span className={`flex-shrink-0 text-[10px] ${m.canBuy ? 'text-amber-400 font-medium' : 'text-text-muted'}`}>
                    {m.tokenCount}{m.canBuy ? ' ✓' : ''}
                  </span>
                )}
                {m.ownershipState === 'unknown' && !m.intent && (
                  <Eye size={10} className="text-text-muted opacity-40 flex-shrink-0" />
                )}
              </div>
            ))}
            {hiddenCount > 0 && (
              <p className="text-[10px] text-text-muted opacity-60 pl-3.5">
                +{hiddenCount} more
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1 border-t border-border-subtle/20">
            {hasGoal ? (
              onViewGoal && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onViewGoal(s.staticGoalId!)}
                  className="flex items-center gap-1"
                >
                  <Trophy size={12} /> View Farm
                </Button>
              )
            ) : (
              canManage && (
                <Button
                  size="sm"
                  onClick={() => onMakeActiveFarm(s.catalogItemId)}
                  className="flex items-center gap-1"
                >
                  <Trophy size={12} /> Make Active Farm
                </Button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface DutyFarmCardProps {
  dutyName: string;
  suggestions: StaticCollectionSuggestion[];
  canManage: boolean;
  onMakeActiveFarm: (catalogItemId: string) => void;
  onViewGoal?: (goalId: string) => void;
  onCopyPlan: (text: string) => void;
}

export function DutyFarmCard({
  dutyName,
  suggestions,
  canManage,
  onMakeActiveFarm,
  onViewGoal,
  onCopyPlan,
}: DutyFarmCardProps) {
  const [expanded, setExpanded] = useState(true);

  const first = suggestions[0];
  const sourceType = first?.sourceType ?? null;
  const expansion = first?.expansion ?? null;
  const contentTypeCfg = CONTENT_TYPE_CONFIG[sourceType ?? ''] ?? null;
  const aggregate = aggregateMembers(suggestions);
  const activeCount = suggestions.filter(s => !!s.staticGoalId).length;

  return (
    <div className={`border border-border-default rounded-xl overflow-hidden bg-surface-card border-l-4 ${contentTypeCfg?.leftBorderClass ?? 'border-l-border-default'}`}>
      {/* ── Duty header — two siblings to avoid button-in-button ── */}
      <div className="flex items-stretch">
        {/* eslint-disable-next-line design-system/no-raw-button */}
        <button
          type="button"
          className="flex-1 min-w-0 text-left px-4 py-3 flex items-center gap-3 hover:bg-surface-hover/30 transition-colors"
          onClick={() => setExpanded(e => !e)}
        >
          <div className="flex-1 min-w-0">
            {/* Row 1: content type badge + expansion */}
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              {contentTypeCfg && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${contentTypeCfg.colorClass}`}>
                  {contentTypeCfg.label}
                </span>
              )}
              {expansion && (
                <span className="text-[10px] font-medium text-text-muted flex-shrink-0">
                  <span className="hidden sm:inline">{expansionLabel(expansion)}</span>
                  <span className="sm:hidden">{expansionShortLabel(expansion)}</span>
                </span>
              )}
              {activeCount > 0 && (
                <span className="text-[10px] text-accent font-medium bg-accent/10 px-2 py-0.5 rounded-full border border-accent/30 ml-auto flex-shrink-0">
                  {activeCount > 1 ? `${activeCount} Active` : 'Active'}
                </span>
              )}
            </div>

            {/* Row 2: duty name */}
            <span className="text-sm font-bold text-text-primary truncate block">{dutyName}</span>

            {/* Row 3: reward category chips */}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {suggestions.map(s => {
                const cat = s.catalogItemCategory ?? '';
                const catCfg = CATEGORY_BADGE[cat] ?? null;
                const label = catCfg?.label ?? cat;
                return label ? (
                  <span
                    key={s.catalogItemId}
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-widest ${
                      catCfg
                        ? `${catCfg.colorClass} ${catCfg.bgClass} ${catCfg.borderClass}`
                        : 'bg-surface-raised border-border-subtle text-text-muted'
                    }`}
                  >
                    {label}
                  </span>
                ) : null;
              })}
            </div>

            {/* Row 4: team summary bar */}
            <div className="mt-1.5">
              <MiniTeamBar counts={aggregate} />
            </div>
          </div>

          <ChevronDown
            size={14}
            className={`text-text-muted transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Copy Plan — sibling of the trigger, not nested inside it */}
        <div className="flex items-center px-3 border-l border-border-subtle/30 flex-shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="flex items-center gap-1 text-text-secondary h-6 px-2 text-[11px]"
            onClick={() => onCopyPlan(buildDutyCopyText(dutyName, suggestions))}
          >
            <Users size={11} /> Copy Plan
          </Button>
        </div>
      </div>

      {/* ── Reward rows ── */}
      {expanded && (
        <div>
          {suggestions.map(s => (
            <RewardRow
              key={s.catalogItemId}
              suggestion={s}
              canManage={canManage}
              onMakeActiveFarm={onMakeActiveFarm}
              onViewGoal={onViewGoal}
            />
          ))}
        </div>
      )}
    </div>
  );
}
