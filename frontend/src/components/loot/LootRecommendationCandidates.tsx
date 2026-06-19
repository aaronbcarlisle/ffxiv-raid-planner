/**
 * LootRecommendationCandidates
 *
 * Compact candidate list shown above the recipient selector when logging loot.
 * Clicking a candidate fills in the selector. Shows top 3 by default with
 * an expand option for the full list.
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Sparkles } from 'lucide-react';
import { Button } from '../primitives';
import { JobIcon } from '../ui/JobIcon';
import { Tooltip } from '../primitives';
import type { RankedCandidate, LootRecommendation } from '../../utils/lootRecommendationService';

interface LootRecommendationCandidatesProps {
  recommendation: LootRecommendation;
  selectedPlayerId: string;
  onSelectCandidate: (playerId: string, characterRegistrationId: string | null) => void;
  /** If false, collapse the whole panel (e.g. when slot not yet chosen) */
  visible?: boolean;
}

const CONFIDENCE_COLORS = {
  high: 'border-status-success/40 bg-status-success/5',
  medium: 'border-accent/40 bg-accent/5',
  low: 'border-status-warning/40 bg-status-warning/5',
} as const;

const CONFIDENCE_LABEL_COLORS = {
  high: 'text-status-success',
  medium: 'text-accent',
  low: 'text-status-warning',
} as const;

function RoleBadge({ source, role }: { source: RankedCandidate['source']; role?: string }) {
  if (source === 'player_fallback') {
    return (
      <span className="px-1 py-0.5 rounded text-[9px] font-medium bg-surface-elevated text-text-muted">
        Player
      </span>
    );
  }
  if (role === 'main') {
    return (
      <span className="px-1 py-0.5 rounded text-[9px] font-medium bg-accent/20 text-accent">
        Main
      </span>
    );
  }
  if (role === 'alt') {
    return (
      <span className="px-1 py-0.5 rounded text-[9px] font-medium bg-purple-400/20 text-purple-300">
        Alt
      </span>
    );
  }
  return null;
}

function CandidateRow({
  candidate,
  rank,
  isSelected,
  onClick,
}: {
  candidate: RankedCandidate;
  rank: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const hasWarning = candidate.warnings.length > 0;
  const tooltipContent = [
    ...candidate.reasons.map((r) => `+ ${r}`),
    ...candidate.warnings.map((w) => `⚠ ${w}`),
  ].join('\n');

  return (
    <Tooltip content={tooltipContent || 'No details available'}>
      <button
        type="button"
        onClick={onClick}
        className={`
          w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left transition-colors
          ${isSelected
            ? 'bg-accent/20 ring-1 ring-accent/50'
            : 'hover:bg-surface-elevated'
          }
        `}
      >
        {/* Rank */}
        <span className={`
          flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
          ${rank === 1 ? 'bg-amber-400/30 text-amber-300' : 'bg-surface-elevated text-text-muted'}
        `}>
          {rank}
        </span>

        {/* Job icon */}
        {candidate.job && (
          <span className="flex-shrink-0">
            <JobIcon job={candidate.job} size="sm" />
          </span>
        )}

        {/* Name */}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-text-primary truncate">
            {candidate.characterName ?? candidate.playerName}
          </div>
          {candidate.characterName && (
            <div className="text-[10px] text-text-muted truncate">{candidate.playerName}</div>
          )}
        </div>

        {/* Role badge */}
        <RoleBadge source={candidate.source} role={candidate.reasons.includes('Main character target') ? 'main' : undefined} />

        {/* Warning icon */}
        {hasWarning && (
          <AlertTriangle className="w-3 h-3 text-status-warning flex-shrink-0" />
        )}

        {/* Already received indicator */}
        {candidate.alreadyReceivedRelevantLoot === true && (
          <span className="text-[9px] text-status-error bg-status-error/10 px-1 py-0.5 rounded">
            Received
          </span>
        )}
      </button>
    </Tooltip>
  );
}

export function LootRecommendationCandidates({
  recommendation,
  selectedPlayerId,
  onSelectCandidate,
  visible = true,
}: LootRecommendationCandidatesProps) {
  const [expanded, setExpanded] = useState(false);

  if (!visible || recommendation.rankedCandidates.length === 0) return null;

  const { rankedCandidates, confidence, warnings } = recommendation;
  const shown = expanded ? rankedCandidates : rankedCandidates.slice(0, 3);
  const hasMore = rankedCandidates.length > 3;

  return (
    <div className={`rounded-lg border ${CONFIDENCE_COLORS[confidence]} p-2.5 space-y-1.5`}>
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Sparkles className={`w-3.5 h-3.5 ${CONFIDENCE_LABEL_COLORS[confidence]}`} />
        <span className={`text-xs font-medium ${CONFIDENCE_LABEL_COLORS[confidence]}`}>
          Recommendation
        </span>
        <span className="text-[10px] text-text-muted ml-auto capitalize">{confidence} confidence</span>
      </div>

      {/* Global warnings */}
      {warnings.map((w) => (
        <p key={w} className="text-[10px] text-status-warning flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
          {w}
        </p>
      ))}

      {/* Candidate rows */}
      <div className="space-y-0.5">
        {shown.map((c, i) => (
          <CandidateRow
            key={c.rosterPlayerId}
            candidate={c}
            rank={i + 1}
            isSelected={c.rosterPlayerId === selectedPlayerId}
            onClick={() => onSelectCandidate(c.rosterPlayerId, c.characterRegistrationId)}
          />
        ))}
      </div>

      {/* Show more / less */}
      {hasMore && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((v) => !v)}
          className="w-full text-[10px] h-6"
        >
          {expanded ? (
            <><ChevronUp className="w-3 h-3 mr-1" />Show fewer</>
          ) : (
            <><ChevronDown className="w-3 h-3 mr-1" />Show all {rankedCandidates.length}</>
          )}
        </Button>
      )}
    </div>
  );
}
