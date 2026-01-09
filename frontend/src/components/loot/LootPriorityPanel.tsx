import { useState, useMemo, useCallback } from 'react';
import type { SnapshotPlayer, StaticSettings, GearSlot, LootLogEntry, MaterialLogEntry, MaterialType } from '../../types';
import type { FloorNumber } from '../../gamedata/loot-tables';
import { FLOOR_LOOT_TABLES, FLOOR_COLORS, getFloorForUpgradeMaterial, UPGRADE_MATERIAL_DISPLAY_NAMES, isSlotAugmentationMaterial } from '../../gamedata/loot-tables';
import { GEAR_SLOT_NAMES } from '../../types';
import {
  getPriorityForItem,
  getPriorityForRing,
  getPriorityForUpgradeMaterial,
  getPriorityForUniversalTomestone,
  type PriorityEntry,
} from '../../utils/priority';
import {
  calculatePlayerLootStats,
  calculateEnhancedPriorityScore,
  calculateAverageDrops,
} from '../../utils/lootCoordination';
import { getRoleColor } from '../../gamedata';
import { JobIcon } from '../ui/JobIcon';
import { WeaponPriorityList } from './WeaponPriorityList';
import { QuickLogDropModal } from './QuickLogDropModal';
import { QuickLogWeaponModal } from './QuickLogWeaponModal';
import { QuickLogMaterialModal } from './QuickLogMaterialModal';
import { WhoNeedsItMatrix } from './WhoNeedsItMatrix';

interface LootPriorityPanelProps {
  players: SnapshotPlayer[];
  settings: StaticSettings;
  selectedFloor: FloorNumber;
  floorName: string; // e.g., "M5S"
  floors: string[]; // All floor names e.g., ["M9S", "M10S", "M11S", "M12S"]
  dutyNames?: string[]; // Optional duty names for floor selector tooltip
  onFloorChange?: (floor: FloorNumber) => void; // Floor change callback
  // Optional props for inline logging
  showLogButtons?: boolean;
  groupId?: string;
  tierId?: string;
  currentWeek?: number;
  maxWeek?: number; // Max week for week selector (defaults to currentWeek)
  onLogSuccess?: () => void;
  // Optional props for enhanced priority display
  lootLog?: LootLogEntry[];
  materialLog?: MaterialLogEntry[];
  showEnhancedScores?: boolean;
}

interface EnhancedPriorityEntry extends PriorityEntry {
  enhancedScore?: number;
  droughtBonus?: number;
  balancePenalty?: number;
}

interface PriorityListProps {
  entries: EnhancedPriorityEntry[];
  maxShown?: number;
  showLogButton?: boolean;
  onLogClick?: (player: SnapshotPlayer) => void;
  showEnhanced?: boolean;
}

function PriorityList({
  entries,
  maxShown = 3,
  showLogButton = false,
  onLogClick,
  showEnhanced = false,
}: PriorityListProps) {
  const [expanded, setExpanded] = useState(false);

  if (entries.length === 0) {
    return (
      <div className="text-status-success text-sm py-1">No one needs</div>
    );
  }

  const visibleEntries = expanded ? entries : entries.slice(0, maxShown);
  const hasMore = entries.length > maxShown;

  return (
    <div className="space-y-1">
      {visibleEntries.map((entry, index) => {
        const roleColor = getRoleColor(entry.player.role as any);
        const isFirst = index === 0;
        const displayScore = showEnhanced && entry.enhancedScore !== undefined
          ? entry.enhancedScore
          : entry.score;

        // Build tooltip for enhanced score breakdown with intuitive labels
        const tooltipText = showEnhanced && entry.enhancedScore !== undefined
          ? `Role Priority: ${entry.score} | No Drops Bonus: +${entry.droughtBonus ?? 0} | Fair Share Adj: -${entry.balancePenalty ?? 0}`
          : undefined;

        return (
          <div
            key={entry.player.id}
            className={`flex items-center justify-between px-2 py-1 rounded text-sm group ${
              isFirst ? 'bg-accent/20' : ''
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className={isFirst ? 'text-accent font-medium' : 'text-text-secondary'}>
                {index + 1}.
              </span>
              <JobIcon job={entry.player.job} size="xs" />
              <span className={isFirst ? 'text-accent font-medium' : 'text-text-secondary'}>
                {entry.player.name}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Log button - shows on hover for any entry */}
              {showLogButton && onLogClick && (
                <button
                  onClick={() => onLogClick(entry.player)}
                  className="opacity-0 group-hover:opacity-100 px-2 py-0.5 text-xs rounded bg-accent text-accent-contrast font-bold hover:bg-accent-hover transition-all"
                >
                  Log
                </button>
              )}
              <span
                className="text-xs px-1.5 py-0.5 rounded cursor-help"
                style={{ backgroundColor: `${roleColor}30`, color: roleColor }}
                title={tooltipText}
              >
                {displayScore}
              </span>
            </div>
          </div>
        );
      })}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-text-muted hover:text-accent text-xs px-2 py-0.5 transition-colors"
        >
          {expanded ? 'Show less' : `+${entries.length - maxShown} more`}
        </button>
      )}
    </div>
  );
}

type LootSubTab = 'matrix' | 'gear' | 'weapon';

export function LootPriorityPanel({
  players,
  settings,
  selectedFloor,
  floorName,
  floors,
  dutyNames,
  onFloorChange,
  showLogButtons = false,
  groupId,
  tierId,
  currentWeek = 1,
  maxWeek,
  onLogSuccess,
  lootLog = [],
  materialLog = [],
  showEnhancedScores = false,
}: LootPriorityPanelProps) {
  // Default maxWeek to currentWeek if not provided, minimum of 1
  const effectiveMaxWeek = Math.max(maxWeek ?? currentWeek, 1);
  const lootTable = FLOOR_LOOT_TABLES[selectedFloor];

  // Sub-tab state with localStorage persistence
  const [activeSubTab, setActiveSubTabState] = useState<LootSubTab>(() => {
    try {
      const saved = localStorage.getItem('loot-priority-subtab');
      return (saved as LootSubTab) || 'matrix';
    } catch {
      return 'matrix';
    }
  });

  const setActiveSubTab = useCallback((tab: LootSubTab) => {
    setActiveSubTabState(tab);
    try {
      localStorage.setItem('loot-priority-subtab', tab);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Modal state for quick log
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    slot: string;
    floor: string;
    player: SnapshotPlayer | null;
  }>({
    isOpen: false,
    slot: '',
    floor: '',
    player: null,
  });

  // Weapon modal state
  const [weaponModalState, setWeaponModalState] = useState<{
    isOpen: boolean;
    weaponJob: string;
    player: SnapshotPlayer | null;
  }>({
    isOpen: false,
    weaponJob: '',
    player: null,
  });

  // Material modal state
  const [materialModalState, setMaterialModalState] = useState<{
    isOpen: boolean;
    material: MaterialType;
    player: SnapshotPlayer | null;
  }>({
    isOpen: false,
    material: 'twine',
    player: null,
  });

  // Calculate average drops for balance penalty
  const averageDrops = useMemo(() => {
    if (!showEnhancedScores || lootLog.length === 0) return 0;
    const playerIds = players.map((p) => p.id);
    return calculateAverageDrops(playerIds, lootLog);
  }, [showEnhancedScores, lootLog, players]);

  // Helper to enhance priority entries with loot history
  const enhanceEntries = (entries: PriorityEntry[]): EnhancedPriorityEntry[] => {
    if (!showEnhancedScores || lootLog.length === 0) {
      return entries;
    }

    return entries.map((entry) => {
      const stats = calculatePlayerLootStats(entry.player.id, lootLog, currentWeek);
      const droughtBonus = Math.min(stats.weeksSinceLastDrop * 10, 50);
      const excessDrops = stats.totalDrops - averageDrops;
      const balancePenalty = excessDrops > 0 ? Math.min(excessDrops * 15, 45) : 0;
      const enhancedScore = calculateEnhancedPriorityScore(entry.score, stats, averageDrops);

      return {
        ...entry,
        enhancedScore,
        droughtBonus,
        balancePenalty,
      };
    }).sort((a, b) => (b.enhancedScore ?? b.score) - (a.enhancedScore ?? a.score));
  };

  // Get gear drops for this floor, but handle ring specially
  const gearItems: Array<{ slot: GearSlot | 'ring'; label: string }> =
    lootTable.gearDrops.map((slot) => {
      // Consolidate ring1 to just "ring" display
      if (slot === 'ring1') {
        return { slot: 'ring' as const, label: 'Ring' };
      }
      return { slot, label: GEAR_SLOT_NAMES[slot] };
    });

  // Get priority entries for each item (with enhancement)
  const itemPriorities = gearItems.map((item) => {
    const baseEntries =
      item.slot === 'ring'
        ? getPriorityForRing(players, settings)
        : getPriorityForItem(players, item.slot, settings);
    return { ...item, entries: enhanceEntries(baseEntries) };
  });

  // Get upgrade materials for this floor (with enhancement)
  // Pass materialLog so priority accounts for materials already received
  const materialPriorities = lootTable.upgradeMaterials.map((material) => {
    // Use different priority calculation for Universal Tomestone vs slot-based materials
    const baseEntries = isSlotAugmentationMaterial(material)
      ? getPriorityForUpgradeMaterial(players, material, settings, materialLog)
      : getPriorityForUniversalTomestone(players, settings, materialLog);

    return {
      material,
      label: UPGRADE_MATERIAL_DISPLAY_NAMES[material],
      entries: enhanceEntries(baseEntries),
    };
  });

  // Can show log buttons if we have the required context
  const canShowLogButtons = showLogButtons && groupId && tierId;

  const handleLogClick = (slot: string, player: SnapshotPlayer, floor?: string) => {
    // For ring, use ring1 as the actual slot
    const actualSlot = slot === 'ring' ? 'ring1' : slot;
    setModalState({
      isOpen: true,
      slot: actualSlot,
      floor: floor || floorName, // Use provided floor or fallback to current floorName
      player,
    });
  };

  const handleModalClose = () => {
    setModalState({ isOpen: false, slot: '', floor: '', player: null });
  };

  const handleWeaponLogClick = (weaponJob: string, player: SnapshotPlayer) => {
    setWeaponModalState({
      isOpen: true,
      weaponJob,
      player,
    });
  };

  const handleWeaponModalClose = () => {
    setWeaponModalState({ isOpen: false, weaponJob: '', player: null });
  };

  const handleMaterialLogClick = (material: MaterialType, player: SnapshotPlayer) => {
    setMaterialModalState({
      isOpen: true,
      material,
      player,
    });
  };

  const handleMaterialModalClose = () => {
    setMaterialModalState({ isOpen: false, material: 'twine', player: null });
  };

  const handleLogSuccess = () => {
    onLogSuccess?.();
  };

  return (
    <div className="bg-surface-card border border-border-default rounded-lg p-4">
      {/* Header with sub-tabs */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h3 className="font-display text-lg text-accent">
            Loot Priority
          </h3>
          {/* Sub-tab navigation */}
          <div className="flex bg-surface-base rounded-lg p-1">
            <button
              onClick={() => setActiveSubTab('matrix')}
              className={`px-3 py-1 text-sm rounded transition-colors font-bold ${
                activeSubTab === 'matrix'
                  ? 'bg-accent text-accent-contrast'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Who Needs It
            </button>
            <button
              onClick={() => setActiveSubTab('gear')}
              className={`px-3 py-1 text-sm rounded transition-colors font-bold ${
                activeSubTab === 'gear'
                  ? 'bg-accent text-accent-contrast'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Gear Priority
            </button>
            <button
              onClick={() => setActiveSubTab('weapon')}
              className={`px-3 py-1 text-sm rounded transition-colors font-bold ${
                activeSubTab === 'weapon'
                  ? 'bg-accent text-accent-contrast'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Weapon Priority
            </button>
          </div>
        </div>
        {showEnhancedScores && lootLog.length > 0 && (
          <span className="text-xs text-text-muted" title="Priority scores adjusted based on loot history: players who haven't received drops get a bonus, players who've received more than average get a small penalty">
            Loot history adjustments active
          </span>
        )}
      </div>

      {/* Gear Priority Tab Content */}
      {activeSubTab === 'gear' && (
        <>
          {/* Floor selector for Gear Priority - button style tabs */}
          {onFloorChange && (
            <div className="flex items-center gap-2 mb-4 bg-surface-elevated/50 p-2 rounded-lg border border-border-default">
              <span className="text-xs text-text-muted mr-1">Floor:</span>
              {([1, 2, 3, 4] as FloorNumber[]).map((floor) => {
                const isSelected = selectedFloor === floor;
                const floorColors = FLOOR_COLORS[floor];
                return (
                  <button
                    key={floor}
                    onClick={() => onFloorChange(floor)}
                    className={`
                      px-3 py-1.5 rounded text-xs font-medium transition-colors
                      ${isSelected
                        ? `${floorColors?.bg} ${floorColors?.text} ${floorColors?.border} border`
                        : 'bg-surface-interactive text-text-secondary hover:text-text-primary'
                      }
                    `}
                    title={dutyNames?.[floor - 1]}
                  >
                    {floors[floor - 1] || `Floor ${floor}`}
                  </button>
                );
              })}
            </div>
          )}
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
                <PriorityList
                  entries={entries}
                  showLogButton={!!canShowLogButtons}
                  onLogClick={(player) => handleLogClick(slot, player)}
                  showEnhanced={showEnhancedScores && lootLog.length > 0}
                />
              </div>
            ))}
          </div>

          {/* Upgrade materials (if any for this floor) */}
          {materialPriorities.length > 0 && (
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
                    <PriorityList
                      entries={entries}
                      showLogButton={!!canShowLogButtons}
                      onLogClick={(player) => handleMaterialLogClick(material, player)}
                      showEnhanced={showEnhancedScores && lootLog.length > 0}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

        </>
      )}

      {/* Weapon Priority Tab Content */}
      {activeSubTab === 'weapon' && (
        <div>
          <WeaponPriorityList
            players={players}
            settings={settings}
            showLogButtons={!!canShowLogButtons}
            onLogClick={handleWeaponLogClick}
          />
        </div>
      )}

      {/* Who Needs It Matrix Tab Content */}
      {activeSubTab === 'matrix' && (
        <WhoNeedsItMatrix
          players={players}
          floors={floors}
          showLogButtons={!!canShowLogButtons}
          onLogClick={(slot, player, floor) => handleLogClick(slot, player, floor)}
        />
      )}

      {/* Quick Log Modal */}
      {canShowLogButtons && modalState.player && (
        <QuickLogDropModal
          isOpen={modalState.isOpen}
          onClose={handleModalClose}
          groupId={groupId!}
          tierId={tierId!}
          floor={modalState.floor || floorName}
          slot={modalState.slot}
          maxWeek={effectiveMaxWeek}
          suggestedPlayer={modalState.player}
          allPlayers={players}
          onSuccess={handleLogSuccess}
        />
      )}

      {/* Quick Log Weapon Modal */}
      {canShowLogButtons && weaponModalState.player && (
        <QuickLogWeaponModal
          isOpen={weaponModalState.isOpen}
          onClose={handleWeaponModalClose}
          groupId={groupId!}
          tierId={tierId!}
          floor={floors[3] || 'Floor 4'} // Weapons always drop from floor 4
          weaponJob={weaponModalState.weaponJob}
          maxWeek={effectiveMaxWeek}
          suggestedPlayer={weaponModalState.player}
          allPlayers={players}
          settings={settings}
          onSuccess={handleLogSuccess}
        />
      )}

      {/* Quick Log Material Modal */}
      {canShowLogButtons && materialModalState.player && (() => {
        // Get correct floor for this material type (glaze=2, twine/solvent=3)
        const materialFloorNum = getFloorForUpgradeMaterial(materialModalState.material)[0];
        const materialFloor = floors[materialFloorNum - 1] || `Floor ${materialFloorNum}`;
        return (
          <QuickLogMaterialModal
            isOpen={materialModalState.isOpen}
            onClose={handleMaterialModalClose}
            groupId={groupId!}
            tierId={tierId!}
            floor={materialFloor}
            material={materialModalState.material}
            maxWeek={effectiveMaxWeek}
            suggestedPlayer={materialModalState.player}
            allPlayers={players}
            settings={settings}
            onSuccess={handleLogSuccess}
          />
        );
      })()}
    </div>
  );
}
