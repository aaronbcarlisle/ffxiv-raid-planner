/**
 * SuggestionFarmCard — a single catalog-item suggestion in the Suggested Farms tab.
 *
 * Shows team summary, player preview rows, and "Make Active Farm" / "Copy Plan" actions.
 * Receives pre-fetched suggestion data — no lazy fetching needed here.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle, Search, ChevronDown,
} from 'lucide-react';
import { XivIcon } from '../ui/XivIcon';
import { Button } from '../primitives/Button';
import type { StaticCollectionSuggestion, MemberSuggestionEntry } from '../../stores/collectionIntentStore';
import type { CollectionGoalCreate, CollectionGoalType, CollectionContentType } from '../../stores/collectionGoalStore';
import {
  getCollectionSourceTypeLabel,
} from '../../utils/collectionBadgeConfig';
import {
  getLocalizedDutyNameByText,
  getLocalizedRewardNameByText,
  resolveUiLocale,
} from '../../gamedata/mount-farm-i18n';

// ── Helpers ───────────────────────────────────────────────────────────────────

const CONTENT_TYPE_LABELS: Record<string, { label: string; colorClass: string }> = {
  extreme:          { label: 'EX',        colorClass: 'bg-status-warning/20 text-status-warning border-status-warning/40' },
  savage:           { label: 'Savage',     colorClass: 'bg-status-error/20 text-status-error border-status-error/40' },
  ultimate:         { label: 'Ultimate',   colorClass: 'bg-purple-500/20 text-purple-400 border-purple-500/40' },
  criterion:        { label: 'Criterion',  colorClass: 'bg-status-info/20 text-status-info border-status-info/40' },
  chaotic_alliance: { label: 'Chaotic',   colorClass: 'bg-accent/20 text-accent border-accent/40' },
  field_operation:  { label: 'Field Op',  colorClass: 'bg-text-muted/20 text-text-muted border-text-muted/40' },
};

const CATEGORY_TO_GOAL_TYPE: Record<string, CollectionGoalType> = {
  mount:       'mount',
  orchestrion: 'orchestrion',
  minion:      'minion',
  weapon:      'weapon',
  glam:        'glam',
};

const VALID_CONTENT_TYPES = new Set<CollectionContentType>([
  'extreme', 'savage', 'ultimate', 'criterion', 'chaotic_alliance', 'field_operation', 'custom',
]);

function categoryToGoalType(cat: string | null): CollectionGoalType {
  return CATEGORY_TO_GOAL_TYPE[cat ?? ''] ?? 'custom_reward';
}

function sourceTypeToContentType(st: string | null): CollectionContentType | null {
  if (!st || !VALID_CONTENT_TYPES.has(st as CollectionContentType)) return null;
  return st as CollectionContentType;
}

const MAX_PREVIEW = 4;

function intentLabel(m: MemberSuggestionEntry, isJapanese: boolean): string {
  if (m.ownershipState === 'have') return isJapanese ? '所持' : 'Owned';
  if (m.intent === 'hunting') return isJapanese ? '希望' : 'Hunting';
  if (m.intent === 'interested') return isJapanese ? '興味あり' : 'Interested';
  if (m.intent === 'pass' || m.intent === 'hidden') return isJapanese ? 'パス' : 'Pass';
  if (m.ownershipState === 'missing') return isJapanese ? '未所持' : 'Missing';
  return isJapanese ? '不明' : 'Unknown';
}

function intentColor(m: MemberSuggestionEntry): string {
  if (m.ownershipState === 'have') return 'text-status-success';
  if (m.intent === 'hunting') return 'text-status-info';
  if (m.intent === 'interested') return 'text-status-warning';
  if (m.intent === 'pass' || m.intent === 'hidden') return 'text-text-muted';
  if (m.ownershipState === 'missing') return 'text-status-warning';
  return 'text-text-muted opacity-60';
}

function buildCopyText(s: StaticCollectionSuggestion, locale: string): string {
  const isJapanese = locale.startsWith('ja');
  const rewardName = getLocalizedRewardNameByText(s.catalogItemName, locale) || s.catalogItemName;
  const dutyName = getLocalizedDutyNameByText(s.sourceDutyName, locale) || s.sourceDutyName;
  const hunting = s.members.filter(m => m.intent === 'hunting').map(m => m.displayName ?? m.userId);
  const interested = s.members.filter(m => m.intent === 'interested').map(m => m.displayName ?? m.userId);
  const canBuy = s.members.filter(m => m.canBuy && m.ownershipState !== 'have').map(m => m.displayName ?? m.userId);
  const have = s.members.filter(m => m.ownershipState === 'have').map(m => m.displayName ?? m.userId);

  const lines = [isJapanese ? `**${rewardName}** 周回案` : `**${rewardName}** farm suggestion`];
  if (dutyName) lines.push(`${isJapanese ? '対象' : 'Source'}: ${dutyName}`);
  lines.push('');
  if (hunting.length) lines.push(isJapanese ? `🔍 **希望 (${hunting.length}):** ${hunting.join(', ')}` : `🔍 **Hunting (${hunting.length}):** ${hunting.join(', ')}`);
  if (interested.length) lines.push(isJapanese ? `⭐ **興味あり (${interested.length}):** ${interested.join(', ')}` : `⭐ **Interested (${interested.length}):** ${interested.join(', ')}`);
  if (canBuy.length) lines.push(isJapanese ? `💰 **今すぐ交換可能:** ${canBuy.join(', ')}` : `💰 **Can buy now:** ${canBuy.join(', ')}`);
  if (have.length) lines.push(isJapanese ? `✅ **所持 (${have.length}):** ${have.join(', ')}` : `✅ **Have (${have.length}):** ${have.join(', ')}`);
  return lines.join('\n');
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TeamSummaryBar({ members }: { members: MemberSuggestionEntry[] }) {
  const { i18n } = useTranslation();
  const uiLocale = resolveUiLocale(i18n.resolvedLanguage);
  const isJapanese = uiLocale.startsWith('ja');
  const hunting   = members.filter(m => m.intent === 'hunting' && m.ownershipState !== 'have').length;
  const interested = members.filter(m => m.intent === 'interested' && m.ownershipState !== 'have').length;
  const have      = members.filter(m => m.ownershipState === 'have').length;
  const canBuy    = members.filter(m => m.canBuy && m.ownershipState !== 'have').length;
  const unknown   = members.filter(m => m.ownershipState === 'unknown' && !m.intent).length;

  const stats = [
    { icon: <XivIcon name="goals" size={10} />, label: isJapanese ? '所持' : 'Owned', value: have, color: 'text-status-success' },
    { icon: <Search size={10} />, label: isJapanese ? '希望' : 'Hunting', value: hunting, color: 'text-status-info' },
    { icon: <XivIcon name="earthlyStar" size={10} />, label: isJapanese ? '興味' : 'Interested', value: interested, color: 'text-status-warning' },
    { icon: <XivIcon name="gil" size={10} />, label: isJapanese ? '交換可' : 'Can buy', value: canBuy, color: 'text-amber-400' },
    { icon: <AlertCircle size={10} />, label: isJapanese ? '不明' : 'Unknown', value: unknown, color: 'text-text-muted opacity-50' },
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

// ── Main component ────────────────────────────────────────────────────────────

interface SuggestionFarmCardProps {
  suggestion: StaticCollectionSuggestion;
  canManage: boolean;
  onMakeActiveFarm: (data: CollectionGoalCreate) => void;
  onViewGoal?: (goalId: string) => void;
  onCopyPlan: (text: string) => void;
}

export function SuggestionFarmCard({
  suggestion: s,
  canManage,
  onMakeActiveFarm,
  onViewGoal,
  onCopyPlan,
}: SuggestionFarmCardProps) {
  const { i18n } = useTranslation();
  const uiLocale = resolveUiLocale(i18n.resolvedLanguage);
  const isJapanese = uiLocale.startsWith('ja');
  const [expanded, setExpanded] = useState(false);

  const contentTypeCfg = CONTENT_TYPE_LABELS[s.sourceType ?? ''];
  const rewardName = getLocalizedRewardNameByText(s.catalogItemName, uiLocale) || s.catalogItemName;
  const dutyName = getLocalizedDutyNameByText(s.sourceDutyName, uiLocale) || s.sourceDutyName;

  // Filter out pass/hidden from preview
  const visibleMembers = s.members.filter(m => m.intent !== 'hidden');
  const previewMembers = visibleMembers.slice(0, MAX_PREVIEW);
  const hiddenCount = visibleMembers.length - MAX_PREVIEW;

  const hasGoal = !!s.staticGoalId;

  function handleMakeActiveFarm() {
    onMakeActiveFarm({
      goalType: categoryToGoalType(s.catalogItemCategory),
      contentType: sourceTypeToContentType(s.sourceType),
      title: s.catalogItemName,
      status: 'wanted',
      summary: s.reasonSummary,
      catalogItemId: s.catalogItemId,
    });
  }

  return (
    <div className="border border-border-default rounded-xl overflow-hidden bg-surface-card">
      {/* ── Header ── */}
      <button
        type="button"
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-surface-hover/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {contentTypeCfg && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${contentTypeCfg.colorClass}`}>
                {getCollectionSourceTypeLabel(s.sourceType, uiLocale) || contentTypeCfg.label}
              </span>
            )}
            <span className="text-sm font-semibold text-text-primary truncate">
              {rewardName}
            </span>
          </div>
          {dutyName && (
            <p className="text-[11px] text-text-muted mt-0.5 truncate">{dutyName}</p>
          )}
          <div className="mt-1.5">
            <TeamSummaryBar members={s.members} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
          {hasGoal && (
            <span className="text-[10px] text-accent font-medium bg-accent/10 px-2 py-0.5 rounded-full border border-accent/30">
              {isJapanese ? 'アクティブ' : 'Active'}
            </span>
          )}
          <ChevronDown
            size={14}
            className={`text-text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className="border-t border-border-subtle/50 px-4 py-3 flex flex-col gap-3 bg-surface-raised/20">
          {/* Player preview */}
          <div className="flex flex-col gap-1.5">
            {previewMembers.map(m => (
              <div key={m.userId} className="flex items-center gap-2 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  m.ownershipState === 'have' ? 'bg-status-success' :
                  m.intent === 'hunting' ? 'bg-status-info' :
                  m.intent === 'interested' ? 'bg-status-warning' :
                  'bg-text-muted opacity-40'
                }`} />
                <span className="flex-1 text-text-primary truncate">
                  {m.displayName ?? m.userId}
                </span>
                <span className={`flex-shrink-0 ${intentColor(m)}`}>
                  {intentLabel(m, isJapanese)}
                </span>
                {m.tokenCount != null && m.ownershipState !== 'have' && (
                  <span className={`flex-shrink-0 text-[10px] ${m.canBuy ? 'text-amber-400 font-medium' : 'text-text-muted'}`}>
                    {m.tokenCount}{m.canBuy ? ' ✓' : ''}
                  </span>
                )}
                {m.ownershipState === 'unknown' && !m.intent && (
                  <XivIcon name="handshake" size={10} className="opacity-40 flex-shrink-0" />
                )}
              </div>
            ))}
            {hiddenCount > 0 && (
              <p className="text-[10px] text-text-muted opacity-60 pl-3.5">
                {isJapanese ? `他${hiddenCount}人` : `+${hiddenCount} more member${hiddenCount > 1 ? 's' : ''}`}
              </p>
            )}
          </div>

          {/* Reason summary */}
          {s.reasonSummary && s.reasonSummary !== 'No strong signals' && (
            <p className="text-[10px] text-text-muted italic opacity-80">{s.reasonSummary}</p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border-subtle/30">
            {hasGoal ? (
              onViewGoal && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onViewGoal(s.staticGoalId!)}
                  className="flex items-center gap-1"
                >
                  <XivIcon name="goals" size={12} /> {isJapanese ? '周回を見る' : 'View Farm'}
                </Button>
              )
            ) : (
              canManage && (
                <Button
                  size="sm"
                  onClick={handleMakeActiveFarm}
                  className="flex items-center gap-1"
                >
                  <XivIcon name="goals" size={12} /> {isJapanese ? 'アクティブ周回にする' : 'Make Active Farm'}
                </Button>
              )
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onCopyPlan(buildCopyText(s, uiLocale))}
              className="flex items-center gap-1 text-text-secondary"
            >
              <XivIcon name="party" size={12} /> {isJapanese ? 'プランをコピー' : 'Copy Plan'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
