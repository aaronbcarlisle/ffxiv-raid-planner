import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, PlusCircle, Loader2 } from 'lucide-react';
import { XivIcon } from '../ui/XivIcon';
import { Button } from '../primitives/Button';
import { Badge } from '../primitives/Badge';
import type { BadgeVariant } from '../primitives/Badge';
import type { CatalogItem, CollectionGoal, ParticipantState } from '../../stores/collectionGoalStore';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import { TrackFromCatalogModal } from './TrackFromCatalogModal';
import {
  getLocalizedCatalogItemName,
  getLocalizedDutyName,
  resolveUiLocale,
} from '../../gamedata/mount-farm-i18n';

interface CatalogFarmRowProps {
  item: CatalogItem;
  groupId: string;
  existingGoal?: CollectionGoal;
  myTokenCount?: number;
  trackDisabled?: boolean;
}

const EXPANSION_LABELS: Record<string, { en: string; ja: string }> = {
  arr: { en: 'A Realm Reborn', ja: '新生エオルゼア' },
  hw: { en: 'Heavensward', ja: '蒼天のイシュガルド' },
  sb: { en: 'Stormblood', ja: '紅蓮のリベレーター' },
  shb: { en: 'Shadowbringers', ja: '漆黒のヴィランズ' },
  ew: { en: 'Endwalker', ja: '暁月のフィナーレ' },
  dt: { en: 'Dawntrail', ja: '黄金のレガシー' },
};

function getSourceTypeConfig(isJapanese: boolean): Record<string, { label: string; variant: BadgeVariant }> {
  return {
    extreme:  { label: isJapanese ? '極' : 'Extreme', variant: 'warning' },
    savage:   { label: isJapanese ? '零式' : 'Savage', variant: 'error' },
    ultimate: { label: isJapanese ? '絶' : 'Ultimate', variant: 'info' },
  };
}

function getStateConfig(isJapanese: boolean): Record<ParticipantState, { label: string; dotClass: string; textClass: string }> {
  return {
    need: { label: isJapanese ? '必要' : 'Need', dotClass: 'bg-status-error', textClass: 'text-status-error' },
    want: { label: isJapanese ? '希望' : 'Want', dotClass: 'bg-status-warning', textClass: 'text-status-warning' },
    have: { label: isJapanese ? '所持' : 'Have', dotClass: 'bg-status-success', textClass: 'text-status-success' },
    pass: { label: isJapanese ? 'パス' : 'Pass', dotClass: 'bg-text-muted', textClass: 'text-text-muted' },
  };
};

function StatePill({
  state,
  tokenCount,
  stateConfig,
}: {
  state: ParticipantState;
  tokenCount: number | null;
  stateConfig: Record<ParticipantState, { label: string; dotClass: string; textClass: string }>;
}) {
  const cfg = stateConfig[state];
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
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [trackOpen, setTrackOpen] = useState(false);
  const uiLocale = resolveUiLocale(i18n.resolvedLanguage);
  const isJapanese = uiLocale.startsWith('ja');
  const sourceTypeConfig = getSourceTypeConfig(isJapanese);
  const stateConfig = getStateConfig(isJapanese);
  const itemName = getLocalizedCatalogItemName(item, uiLocale);
  const dutyName = item.sourceDutyName ? getLocalizedDutyName(item.sourceDutyKey, item.sourceDutyName, uiLocale) : null;

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

  const sourceConfig = item.sourceType ? sourceTypeConfig[item.sourceType] : null;
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
              <span className="font-semibold text-text-primary leading-tight">{itemName}</span>
              {sourceConfig && (
                <Badge variant={sourceConfig.variant} size="sm">{sourceConfig.label}</Badge>
              )}
            </div>
            {dutyName && (
              <p className="text-xs text-text-muted mt-0.5 truncate">{dutyName}</p>
            )}
          </div>

          {/* Token cost OR rare-drop pill */}
          {item.tokenCost != null && item.tokenName ? (
            <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
              <XivIcon name="gil" size={12} />
              <span className="text-xs text-text-secondary whitespace-nowrap">
                {item.tokenCost}× {item.tokenName}
              </span>
              {canBuy && <Badge variant="success" size="sm">{isJapanese ? '交換可' : 'Can buy'}</Badge>}
            </div>
          ) : isRareDrop ? (
            <Badge variant="default" size="sm" className="hidden sm:inline-flex flex-shrink-0">
              {isJapanese ? 'レアドロップ' : 'Rare drop'}
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
            <Badge variant="success" size="sm" className="flex-shrink-0">{isJapanese ? '追跡中' : 'Tracking'}</Badge>
          ) : trackDisabled ? (
            <span className="text-xs text-text-muted opacity-40 flex-shrink-0">{isJapanese ? '利用不可' : 'Unavailable'}</span>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={e => { e.stopPropagation(); setTrackOpen(true); }}
              className="flex items-center gap-1 flex-shrink-0 text-accent hover:bg-accent/10"
            >
              <PlusCircle size={13} /> {isJapanese ? '追跡' : 'Track'}
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
                    {canBuy ? (isJapanese ? '交換可能' : 'Ready to exchange') : `${tokenProgressPercent}%`}
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
                    {isJapanese ? '固定メンバーを読み込み中…' : 'Loading static members…'}
                  </div>
                ) : goalParticipants && goalParticipants.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-2">
                      {isJapanese ? '固定メンバー' : 'Static members'}
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
                            {p.displayName ?? t('common.unknown')}
                          </span>
                          <StatePill state={p.state} tokenCount={p.tokenCount} stateConfig={stateConfig} />
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
                          {existingGoal.participantSummary.need} {isJapanese ? '必要' : 'need'}
                        </span>
                      )}
                      {existingGoal.participantSummary.want > 0 && (
                        <span className="flex items-center gap-1.5 text-status-warning font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-status-warning" />
                          {existingGoal.participantSummary.want} {isJapanese ? '希望' : 'want'}
                        </span>
                      )}
                      {existingGoal.participantSummary.have > 0 && (
                        <span className="flex items-center gap-1.5 text-status-success font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
                          {existingGoal.participantSummary.have} {isJapanese ? '所持' : 'have'}
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
                  <span>{(EXPANSION_LABELS[item.expansion]?.[isJapanese ? 'ja' : 'en']) ?? item.expansion}</span>
                </>
              )}
              {item.rarityOwnedPercent != null && (
                <>
                  <span className="opacity-40">·</span>
                  <span>{isJapanese ? `プレイヤー所持率 ${item.rarityOwnedPercent.toFixed(1)}%` : `${item.rarityOwnedPercent.toFixed(1)}% of players own this`}</span>
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
