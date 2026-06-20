import { useState } from 'react';
import { ChevronDown, ChevronRight, PlusCircle, Coins } from 'lucide-react';
import { Button } from '../primitives/Button';
import type { CatalogItem, CollectionGoal } from '../../stores/collectionGoalStore';
import { TrackFromCatalogModal } from './TrackFromCatalogModal';

interface CatalogFarmRowProps {
  item: CatalogItem;
  groupId: string;
  existingGoal?: CollectionGoal;
  myTokenCount?: number;
}

const EXPANSION_LABELS: Record<string, string> = {
  arr: 'A Realm Reborn',
  hw: 'Heavensward',
  sb: 'Stormblood',
  shb: 'Shadowbringers',
  ew: 'Endwalker',
  dt: 'Dawntrail',
};

export function CatalogFarmRow({ item, groupId, existingGoal, myTokenCount }: CatalogFarmRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [trackOpen, setTrackOpen] = useState(false);

  const isTracked = Boolean(existingGoal);
  const canBuy =
    item.tokenCost != null &&
    myTokenCount != null &&
    myTokenCount >= item.tokenCost;

  const tokenProgressPercent =
    item.tokenCost != null && myTokenCount != null
      ? Math.min(100, Math.round((myTokenCount / item.tokenCost) * 100))
      : null;

  return (
    <>
      <div className="bg-surface-card rounded-xl border border-border-subtle overflow-hidden">
        {/* Summary row */}
        <Button
          variant="ghost"
          className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors rounded-none"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
        >
          <span className="text-text-muted flex-shrink-0">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>

          {/* Item name + duty */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-text-primary truncate">{item.name}</p>
            {item.sourceDutyName && (
              <p className="text-xs text-text-secondary truncate">{item.sourceDutyName}</p>
            )}
          </div>

          {/* Token info */}
          {item.tokenCost != null && item.tokenName ? (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Coins size={13} className="text-amber-400" />
              <span className="text-xs text-text-secondary whitespace-nowrap">
                {item.tokenCost}× {item.tokenName}
              </span>
              {canBuy && (
                <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-semibold">
                  Can buy
                </span>
              )}
            </div>
          ) : item.notes ? (
            <span className="text-xs text-text-muted flex-shrink-0 max-w-[140px] truncate">{item.notes}</span>
          ) : null}

          {/* Tracked badge */}
          {isTracked ? (
            <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full flex-shrink-0">
              Tracking
            </span>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => { e.stopPropagation(); setTrackOpen(true); }}
              className="flex items-center gap-1 flex-shrink-0"
            >
              <PlusCircle size={14} />
              Track
            </Button>
          )}
        </Button>

        {/* Expanded details */}
        {expanded && (
          <div className="px-4 pb-4 pt-1 border-t border-border-subtle flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {item.expansion && (
                <div>
                  <span className="text-text-muted text-xs">Expansion</span>
                  <p className="text-text-primary">{EXPANSION_LABELS[item.expansion] ?? item.expansion}</p>
                </div>
              )}
              {item.patch && (
                <div>
                  <span className="text-text-muted text-xs">Patch</span>
                  <p className="text-text-primary">{item.patch}</p>
                </div>
              )}
              {item.sourceType && (
                <div>
                  <span className="text-text-muted text-xs">Source type</span>
                  <p className="text-text-primary capitalize">{item.sourceType.replace(/_/g, ' ')}</p>
                </div>
              )}
              {item.rarityOwnedPercent != null && (
                <div>
                  <span className="text-text-muted text-xs">Owned by players</span>
                  <p className="text-text-primary">{item.rarityOwnedPercent.toFixed(1)}%</p>
                </div>
              )}
            </div>

            {/* Token progress bar */}
            {item.tokenCost != null && item.tokenName && myTokenCount != null && (
              <div>
                <div className="flex justify-between text-xs text-text-secondary mb-1">
                  <span>Your tokens: {myTokenCount} / {item.tokenCost} {item.tokenName}</span>
                  <span>{tokenProgressPercent}%</span>
                </div>
                <div className="h-1.5 bg-surface-base rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${canBuy ? 'bg-green-500' : 'bg-accent'}`}
                    style={{ width: `${tokenProgressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {isTracked && existingGoal && (
              <div className="mt-1 text-xs text-text-muted">
                <span>Status: </span>
                <span className="capitalize text-text-secondary">{existingGoal.status}</span>
                {existingGoal.participantSummary && (
                  <span className="ml-3">
                    Need: {existingGoal.participantSummary.need} ·
                    Want: {existingGoal.participantSummary.want} ·
                    Have: {existingGoal.participantSummary.have}
                  </span>
                )}
              </div>
            )}
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
