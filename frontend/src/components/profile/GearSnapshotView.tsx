import { useEffect } from 'react';
import { JobIcon } from '../ui/JobIcon';
import { Skeleton } from '../ui/Skeleton';
import { GameIcon } from '../ui/GameIcon';
import { Badge } from '../primitives/Badge';
import { SourceBadge } from './SourceBadge';
import { getFreshness, freshnessColor } from './freshness';
import { usePlayerProfileStore } from '../../stores/playerProfileStore';
import type { GearSnapshot, GearSlotData } from '../../stores/playerProfileStore';
import { getJobDisplayName } from '../../gamedata/jobs';
import { formatGearActivity } from './jobGearUtils';

const SLOT_LABELS: Record<string, string> = {
  weapon: 'Weapon',
  head: 'Head',
  body: 'Body',
  hands: 'Hands',
  legs: 'Legs',
  feet: 'Feet',
  earring: 'Earring',
  necklace: 'Necklace',
  bracelet: 'Bracelet',
  ring1: 'Ring 1',
  ring2: 'Ring 2',
};

function GearSlotRow({ slot }: { slot: GearSlotData }) {
  const ilvl = slot.equippedItemLevel || slot.itemLevel || 0;
  const name = slot.equippedItemName;
  const source = slot.currentSource || 'unknown';
  const isEmpty = !name && ilvl === 0;

  return (
    <div className={`grid min-w-0 grid-cols-[72px_20px_minmax(0,1fr)_40px] items-center gap-2 py-1.5 text-sm sm:grid-cols-[80px_20px_minmax(0,1fr)_44px_auto] ${isEmpty ? 'opacity-50' : ''}`}>
      <span className="truncate text-text-tertiary">
        {SLOT_LABELS[slot.slot] ?? slot.slot}
      </span>
      {slot.equippedItemIcon ? (
        <img src={slot.equippedItemIcon} alt="" className="w-5 h-5 rounded flex-shrink-0" />
      ) : (
        <div className="w-5 h-5 rounded bg-surface-elevated flex-shrink-0" />
      )}
      <span className={`flex-1 truncate ${isEmpty ? 'text-text-tertiary italic' : 'text-text-primary'}`}>
        {name || 'Empty'}
      </span>
      <span className="text-right text-text-secondary font-mono text-xs">{ilvl > 0 ? ilvl : '-'}</span>
      {!isEmpty && (
        <Badge className="hidden sm:inline-flex" variant={source === 'savage' ? 'raid' : source === 'tome_up' ? 'augmented' : source === 'tome' ? 'tome' : source === 'crafted' ? 'crafted' : 'default'} size="sm">
          {source}
        </Badge>
      )}
    </div>
  );
}

function SnapshotCard({ snapshot }: { snapshot: GearSnapshot }) {
  const equippedSlots = snapshot.gear.filter((s) => s.equippedItemId || s.equippedItemName);
  const emptySlots = snapshot.gear.length - equippedSlots.length;
  const freshness = getFreshness(snapshot.syncedAt);
  const isStale = freshness === 'stale' || freshness === 'old';

  return (
    <div className={`min-w-0 bg-surface-raised rounded-lg border p-3 sm:p-4 ${isStale ? 'border-status-warning/30' : 'border-border-default'}`}>
      <div className="flex min-w-0 items-center gap-2 sm:gap-3 mb-1 flex-wrap">
        <JobIcon job={snapshot.job} size="lg" />
        <span className="min-w-0 truncate font-display font-semibold text-text-primary">
          {getJobDisplayName(snapshot.job)}
        </span>
        <span className="text-text-tertiary text-sm">{snapshot.job}</span>
        <Badge variant="info" size="sm">iLv {snapshot.avgItemLevel}</Badge>
        <SourceBadge source={snapshot.source} />
        <span className={`text-xs sm:ml-auto ${freshnessColor(freshness)}`}>
          {formatGearActivity(snapshot)}
        </span>
        {isStale && <Badge variant="warning" size="sm">Stale</Badge>}
      </div>
      <div className="flex items-center gap-3 mb-3 text-xs text-text-tertiary">
        <span>{equippedSlots.length}/{snapshot.gear.length} slots equipped</span>
        {emptySlots > 0 && <span className="text-status-warning">{emptySlots} empty</span>}
      </div>
      {equippedSlots.length > 0 ? (
        <div className="divide-y divide-border-default">
          {snapshot.gear.map((slot) => (
            <GearSlotRow key={slot.slot} slot={slot} />
          ))}
        </div>
      ) : (
        <div className="text-text-tertiary text-sm py-2">
          No equipped items recorded. Try syncing gear from your character.
        </div>
      )}
    </div>
  );
}

interface GearSnapshotViewProps {
  characterId: string;
}

export function GearSnapshotView({ characterId }: GearSnapshotViewProps) {
  const { fetchGearSnapshots, gearSnapshots } = usePlayerProfileStore();
  const snapshots = gearSnapshots[characterId];

  useEffect(() => {
    fetchGearSnapshots(characterId);
  }, [characterId, fetchGearSnapshots]);

  if (!snapshots) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div className="bg-surface-raised rounded-lg border border-border-default p-6 text-center">
        <div className="mb-2 text-text-tertiary"><GameIcon name="chest" size="xl" /></div>
        <p className="text-text-secondary text-sm">
          No gear saved yet. Use <strong>Refresh from Lodestone</strong> to fetch your currently equipped gear, or run the plugin sync in game.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {snapshots.map((snapshot) => (
        <SnapshotCard key={snapshot.id} snapshot={snapshot} />
      ))}
    </div>
  );
}
