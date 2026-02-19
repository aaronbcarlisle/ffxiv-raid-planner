import { Package, Check, Gem } from 'lucide-react';
import { Select, Toggle } from '../../ui';
import { Button } from '../../primitives';
import { FLOOR_LOOT_TABLES, FLOOR_COLORS, UPGRADE_MATERIAL_DISPLAY_NAMES, isSlotAugmentationMaterial, type UpgradeMaterialType } from '../../../gamedata/loot-tables';
import { GEAR_SLOT_NAMES, GEAR_SLOT_ICONS, type GearSlot, type MaterialType } from '../../../types';
import { getEligibleSlotsForAugmentation, needsTomeWeaponAugmentation } from '../../../utils/materialCoordination';
import type { SnapshotPlayer } from '../../../types';
import type { FloorNumber, FloorEntries, SelectOption } from './types';

interface GearStepProps {
  floors: string[];
  selectedFloor: FloorNumber;
  setSelectedFloor: (floor: FloorNumber) => void;
  floorData: Record<FloorNumber, FloorEntries>;
  clearedFloors: Set<FloorNumber>;
  singleFloorMode: boolean;
  mainRosterPlayers: SnapshotPlayer[];
  handleSlotChange: (floorNum: FloorNumber, type: 'gear' | 'materials', slot: string, playerId: string | null) => void;
  handleDidNotDrop: (floorNum: FloorNumber, type: 'gear' | 'materials', slot: string, didNotDrop: boolean) => void;
  handleMaterialPlayerChange: (floorNum: FloorNumber, materialType: string, playerId: string | null) => void;
  handleMaterialSlotChange: (floorNum: FloorNumber, materialType: string, slotValue: string) => void;
  toggleAllNoDrops: (floorNum: FloorNumber) => void;
  toggleFloorCleared: (floorNum: FloorNumber, cleared: boolean) => void;
  getRecipientOptions: (slot: GearSlot) => SelectOption[];
  getMaterialRecipientOptions: (material: UpgradeMaterialType) => SelectOption[];
}

export function GearStep({
  floors,
  selectedFloor,
  setSelectedFloor,
  floorData,
  clearedFloors,
  singleFloorMode,
  mainRosterPlayers,
  handleSlotChange,
  handleDidNotDrop,
  handleMaterialPlayerChange,
  handleMaterialSlotChange,
  toggleAllNoDrops,
  toggleFloorCleared,
  getRecipientOptions,
  getMaterialRecipientOptions,
}: GearStepProps) {
  const currentFloorData = floorData[selectedFloor];
  const currentLootTable = FLOOR_LOOT_TABLES[selectedFloor];
  const currentFloorName = floors[selectedFloor - 1];

  if (!currentLootTable || !currentFloorData) return null;

  return (
    <div className="space-y-4">
      {/* Floor tabs - hidden in single floor mode */}
      {!singleFloorMode && (
        <div className="flex gap-1 p-1 mb-4 rounded-lg bg-surface-elevated">
          {floors.map((name, i) => {
            const floorNum = (i + 1) as FloorNumber;
            const isActive = selectedFloor === floorNum;
            const isCleared = clearedFloors.has(floorNum);
            const floorColor = FLOOR_COLORS[floorNum];

            const floor = floorData[floorNum];
            const gearAssigned = floor ? Object.values(floor.gear).filter((e) => e.playerId && !e.didNotDrop).length : 0;
            const materialsAssigned = floor ? Object.values(floor.materials).filter((e) => e.playerId && !e.didNotDrop).length : 0;
            const itemsAssigned = gearAssigned + materialsAssigned;

            return (
              <div
                key={floorNum}
                role="button"
                tabIndex={0}
                onClick={() => isCleared && setSelectedFloor(floorNum)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && isCleared) {
                    e.preventDefault();
                    setSelectedFloor(floorNum);
                  }
                }}
                className={`
                  flex-1 relative flex items-center px-2 py-2 rounded-md text-sm font-medium transition-colors
                  ${isActive
                    ? `${floorColor.bg} ${floorColor.text} ${floorColor.border} border`
                    : isCleared
                      ? `${floorColor.text} hover:${floorColor.bg} opacity-70 hover:opacity-100 cursor-pointer`
                      : 'text-text-muted opacity-40'
                  }
                `}
              >
                <div
                  role="checkbox"
                  aria-checked={isCleared}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFloorCleared(floorNum, !isCleared);
                  }}
                  className="w-6 h-6 rounded flex-shrink-0 flex items-center justify-center cursor-pointer border-2 transition-colors"
                  style={{
                    backgroundColor: isCleared ? floorColor.hex : 'transparent',
                    borderColor: floorColor.hex,
                  }}
                >
                  {isCleared && (
                    <Check className="w-4 h-4 text-surface-base" strokeWidth={3} />
                  )}
                </div>
                <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {name}
                </span>
                {isCleared && itemsAssigned > 0 && (
                  <span
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center text-surface-base"
                    style={{ backgroundColor: floorColor.hex }}
                  >
                    {itemsAssigned}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Content area - vertical stack */}
      <div className="space-y-4">
        {/* Gear Section Card */}
        <div
          className="rounded-lg border-l-4 bg-surface-elevated"
          style={{ borderLeftColor: FLOOR_COLORS[selectedFloor].hex }}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-text-primary flex items-center gap-2">
                <Package className="w-4 h-4" />
                {singleFloorMode ? '' : `${currentFloorName} - `}Gear
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleAllNoDrops(selectedFloor)}
              >
                {Object.values(currentFloorData.gear).every((e) => e.didNotDrop) &&
                 Object.values(currentFloorData.materials).every((e) => e.didNotDrop)
                  ? 'Restore All'
                  : 'No Drops'}
              </Button>
            </div>

            <div className="divide-y divide-border-subtle">
              {currentLootTable.gearDrops.map((slot) => {
                const entry = currentFloorData.gear[slot];
                if (!entry) return null;
                const slotName = GEAR_SLOT_NAMES[slot as GearSlot] || slot;
                const iconSlot = slot === 'ring1' || slot === 'ring2' ? 'ring' : slot;

                return (
                  <div key={slot} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-24 flex-shrink-0 flex items-center gap-2 ${entry.didNotDrop ? 'opacity-50' : ''}`}>
                        <img
                          alt=""
                          className="w-4 h-4 brightness-[3.0]"
                          src={`/images/gear-slots/white/${iconSlot}.png`}
                        />
                        <span className="text-sm text-text-secondary">{slotName}</span>
                      </div>
                      <div className={`flex-1 min-w-0 ${entry.didNotDrop ? 'opacity-60' : ''}`}>
                        <Select
                          value={entry.playerId || ''}
                          onChange={(v) => handleSlotChange(selectedFloor, 'gear', slot, v || null)}
                          options={getRecipientOptions(slot as GearSlot)}
                          disabled={entry.didNotDrop}
                        />
                      </div>
                      <Toggle
                        checked={!entry.didNotDrop}
                        onChange={(checked) => handleDidNotDrop(selectedFloor, 'gear', slot, !checked)}
                        color={FLOOR_COLORS[selectedFloor].hex}
                        aria-label={`Toggle ${slotName} drop`}
                        size="sm"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Materials Section Card */}
        {Object.keys(currentFloorData.materials).length > 0 && (
          <div
            className="rounded-lg border-l-4 bg-surface-elevated"
            style={{ borderLeftColor: FLOOR_COLORS[selectedFloor].hex }}
          >
            <div className="p-4">
              <h4 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
                <Gem className="w-4 h-4" />
                {singleFloorMode ? '' : `${currentFloorName} - `}Materials
              </h4>

              <div className="divide-y divide-border-subtle">
                {Object.entries(currentFloorData.materials).map(([materialType, entry]) => {
                  const materialName = UPGRADE_MATERIAL_DISPLAY_NAMES[materialType as UpgradeMaterialType] || materialType;
                  const selectedPlayer = mainRosterPlayers.find((p) => p.id === entry.playerId);
                  const isUniversalTomestone = materialType === 'universal_tomestone';

                  const eligibleSlots = selectedPlayer && isSlotAugmentationMaterial(materialType as MaterialType)
                    ? getEligibleSlotsForAugmentation(selectedPlayer, materialType as MaterialType)
                    : [];
                  const canAugmentTomeWeapon = selectedPlayer && materialType === 'solvent'
                    ? needsTomeWeaponAugmentation(selectedPlayer)
                    : false;
                  const hasEligibleOptions = eligibleSlots.length > 0 || canAugmentTomeWeapon;

                  const shortMaterialName = isUniversalTomestone ? 'U. Tome' : materialName;
                  const materialColorClass = materialType === 'twine' ? 'text-material-twine'
                    : materialType === 'glaze' ? 'text-material-glaze'
                    : materialType === 'solvent' ? 'text-material-solvent'
                    : 'text-material-tomestone';

                  return (
                    <div key={materialType} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-20 flex-shrink-0 ${entry.didNotDrop ? 'opacity-50' : ''}`}>
                          <span className={`text-sm font-medium ${materialColorClass}`}>{shortMaterialName}</span>
                        </div>
                        <div className={`flex-1 min-w-0 flex items-center gap-2 ${entry.didNotDrop ? 'opacity-60' : ''}`}>
                          <div className="flex-1 min-w-0">
                            <Select
                              value={entry.playerId || ''}
                              onChange={(v) => handleMaterialPlayerChange(selectedFloor, materialType, v || null)}
                              options={getMaterialRecipientOptions(materialType as UpgradeMaterialType)}
                              disabled={entry.didNotDrop}
                            />
                          </div>
                          {!entry.didNotDrop && entry.playerId && hasEligibleOptions && (eligibleSlots.length > 1 || (eligibleSlots.length > 0 && canAugmentTomeWeapon)) && (
                            <div className="w-32 flex-shrink-0">
                              <Select
                                value={entry.augmentTomeWeapon ? 'tome_weapon' : (entry.selectedSlot || '')}
                                onChange={(val) => handleMaterialSlotChange(selectedFloor, materialType, val)}
                                options={[
                                  ...(canAugmentTomeWeapon ? [{ value: 'tome_weapon', label: 'Tome Weapon', icon: <img alt="" className="w-4 h-4 brightness-[3.0]" src={GEAR_SLOT_ICONS.weapon} /> }] : []),
                                  ...eligibleSlots.map((slot) => ({
                                    value: slot,
                                    label: GEAR_SLOT_NAMES[slot],
                                    icon: <img alt="" className="w-4 h-4 brightness-[3.0]" src={GEAR_SLOT_ICONS[slot]} />,
                                  })),
                                ]}
                              />
                            </div>
                          )}
                        </div>
                        <Toggle
                          checked={!entry.didNotDrop}
                          onChange={(checked) => handleDidNotDrop(selectedFloor, 'materials', materialType, !checked)}
                          color={FLOOR_COLORS[selectedFloor].hex}
                          aria-label={`Toggle ${materialName} drop`}
                          size="sm"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
