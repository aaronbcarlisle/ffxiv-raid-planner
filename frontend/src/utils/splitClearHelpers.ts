import type { ConfidenceLevel, DraftChangeSummary } from './splitClearSuggestionService';
import type { SplitLootTarget, SplitRunSlot } from '../types';

// ── Tone system ────────────────────────────────────────────────────────────────

export type SplitTone = 'success' | 'suggested' | 'warning' | 'danger' | 'info' | 'neutral';

export const TONE_CHIP_CLASS: Record<SplitTone, string> = {
  success: 'bg-status-success/15 text-status-success border border-status-success/30',
  suggested: 'bg-accent/15 text-accent border border-accent/30',
  warning: 'bg-status-warning/15 text-status-warning border border-status-warning/30',
  danger: 'bg-status-error/15 text-status-error border border-status-error/30',
  info: 'bg-status-info/15 text-status-info border border-status-info/30',
  neutral: 'bg-surface-elevated text-text-muted border border-border-subtle',
};

// ── Confidence ─────────────────────────────────────────────────────────────────

export function getConfidenceTone(confidence: ConfidenceLevel): SplitTone {
  if (confidence === 'high') return 'success';
  if (confidence === 'medium') return 'warning';
  return 'warning'; // missing data is expected setup work, not a critical error
}

export function formatConfidenceLabel(confidence: ConfidenceLevel): string {
  const labels: Record<ConfidenceLevel, string> = {
    high: 'High confidence',
    medium: 'Medium confidence',
    low: 'Needs review',
  };
  return labels[confidence];
}

// ── Loot / run formatting ──────────────────────────────────────────────────────

export function formatLootTarget(target: SplitLootTarget): string {
  if (target === 'funnel_main') return 'Funnel to main';
  if (target === 'funnel_job') return 'Funnel to specific job';
  return 'Normal loot';
}

export function formatRunSlot(slot: SplitRunSlot): string {
  if (slot === 'main') return 'Main';
  if (slot === 'alt') return 'Alt';
  return 'Unset';
}

export function getRunSlotTone(slot: SplitRunSlot): SplitTone {
  if (slot === 'main') return 'info';
  if (slot === 'alt') return 'suggested';
  return 'warning';
}

// ── Change summary ─────────────────────────────────────────────────────────────

export function formatChangeSummary(summary: DraftChangeSummary): string {
  if (summary.totalAffected === 0) return 'No changes detected.';
  const parts: string[] = [];
  if (summary.runAssignments > 0)
    parts.push(`${summary.runAssignments} run assignment${summary.runAssignments !== 1 ? 's' : ''}`);
  if (summary.lootTargetsChanged > 0)
    parts.push(`${summary.lootTargetsChanged} loot target${summary.lootTargetsChanged !== 1 ? 's' : ''}`);
  if (summary.characterNamesSet > 0)
    parts.push(`${summary.characterNamesSet} character name${summary.characterNamesSet !== 1 ? 's' : ''}`);
  return `Updates ${summary.totalAffected} player${summary.totalAffected !== 1 ? 's' : ''}: ${parts.join(', ')}.`;
}

// ── Time formatting ────────────────────────────────────────────────────────────

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)}h ago`;
}
