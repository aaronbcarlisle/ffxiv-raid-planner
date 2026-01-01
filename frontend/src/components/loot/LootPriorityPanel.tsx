import type { SnapshotPlayer, StaticSettings, GearSlot } from '../../types';
import type { FloorNumber } from '../../gamedata/loot-tables';
import { FLOOR_LOOT_TABLES } from '../../gamedata/loot-tables';
import { GEAR_SLOT_NAMES } from '../../types';
import {
  getPriorityForItem,
  getPriorityForRing,
  getPriorityForUpgradeMaterial,
  type PriorityEntry,
} from '../../utils/priority';
import { getRoleColor } from '../../gamedata';

interface LootPriorityPanelProps {
  players: SnapshotPlayer[];
  settings: StaticSettings;
  selectedFloor: FloorNumber;
  floorName: string; // e.g., "M5S"
}

function PriorityList({
  entries,
  maxShown = 3,
}: {
  entries: PriorityEntry[];
  maxShown?: number;
}) {
  if (entries.length === 0) {
    return (
      <div className="text-status-success text-sm py-1">No one needs</div>
    );
  }

  return (
    <div className="space-y-1">
      {entries.slice(0, maxShown).map((entry, index) => {
        const roleColor = getRoleColor(entry.player.role as any);
        const isFirst = index === 0;

        return (
          <div
            key={entry.player.id}
            className={`flex items-center justify-between px-2 py-1 rounded text-sm ${
              isFirst ? 'bg-accent/20' : ''
            }`}
          >
            <span
              className={isFirst ? 'text-accent font-medium' : 'text-text-secondary'}
            >
              {index + 1}. {entry.player.name}
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${roleColor}30`, color: roleColor }}
            >
              {entry.score}
            </span>
          </div>
        );
      })}
      {entries.length > maxShown && (
        <div className="text-text-muted text-xs px-2">
          +{entries.length - maxShown} more
        </div>
      )}
    </div>
  );
}

export function LootPriorityPanel({
  players,
  settings,
  selectedFloor,
  floorName,
}: LootPriorityPanelProps) {
  const lootTable = FLOOR_LOOT_TABLES[selectedFloor];

  // Get gear drops for this floor, but handle ring specially
  const gearItems: Array<{ slot: GearSlot | 'ring'; label: string }> =
    lootTable.gearDrops.map((slot) => {
      // Consolidate ring1 to just "ring" display
      if (slot === 'ring1') {
        return { slot: 'ring' as const, label: 'Ring' };
      }
      return { slot, label: GEAR_SLOT_NAMES[slot] };
    });

  // Get priority entries for each item
  const itemPriorities = gearItems.map((item) => {
    const entries =
      item.slot === 'ring'
        ? getPriorityForRing(players, settings)
        : getPriorityForItem(players, item.slot, settings);
    return { ...item, entries };
  });

  // Get upgrade materials for this floor
  const materialPriorities = lootTable.upgradeMaterials.map((material) => ({
    material,
    label: material.charAt(0).toUpperCase() + material.slice(1),
    entries: getPriorityForUpgradeMaterial(players, material, settings),
  }));

  return (
    <div className="bg-surface-card border border-border-default rounded-lg p-4">
      <h3 className="font-display text-lg text-accent mb-4">
        {floorName} Loot Priority
      </h3>

      {/* Gear drops grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {itemPriorities.map(({ slot, label, entries }) => (
          <div
            key={slot}
            className="bg-surface-base rounded-lg p-3"
          >
            <div className="text-text-primary font-medium text-sm mb-2 border-b border-border-default pb-2">
              {label}
            </div>
            <PriorityList entries={entries} />
          </div>
        ))}
      </div>

      {/* Upgrade materials (if any for this floor) */}
      {materialPriorities.length > 0 && (
        <>
          <div className="border-t border-border-default pt-4 mt-4">
            <h4 className="text-text-secondary text-sm mb-3">Upgrade Materials</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {materialPriorities.map(({ material, label, entries }) => (
                <div
                  key={material}
                  className="bg-surface-base rounded-lg p-3"
                >
                  <div className="text-text-primary font-medium text-sm mb-2 border-b border-border-default pb-2">
                    {label}
                  </div>
                  <PriorityList entries={entries} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Special materials (informational only) */}
      {lootTable.specialMaterials && lootTable.specialMaterials.length > 0 && (
        <div className="border-t border-border-default pt-4 mt-4">
          <h4 className="text-text-secondary text-sm mb-3">Special Materials</h4>
          <div className="flex flex-wrap gap-2">
            {lootTable.specialMaterials.map((material) => (
              <div
                key={material}
                className="bg-surface-base border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary"
              >
                {material}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
