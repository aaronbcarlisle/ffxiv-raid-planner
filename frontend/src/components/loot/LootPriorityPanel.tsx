import { useState, useMemo, useCallback } from 'react';
import type { SnapshotPlayer, StaticSettings, GearSlot, LootLogEntry, MaterialLogEntry, MaterialType } from '../../types';
import type { FloorNumber } from '../../gamedata/loot-tables';
import { FLOOR_LOOT_TABLES } from '../../gamedata/loot-tables';
import { GEAR_SLOT_NAMES } from '../../types';
import {
  getPriorityForItem,
  getPriorityForRing,
  getPriorityForUpgradeMaterial,
  type PriorityEntry,
} from '../../utils/priority';
import {
  calculatePlayerLootStats,
  calculateEnhancedPriorityScore,
  calculateAverageDrops,
} from '../../utils/lootCoordination';
import { getRoleColor } from '../../gamedata';
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
  // Optional props for inline logging
  showLogButtons?: boolean;
  groupId?: string;
  tierId?: string;
  currentWeek?: number;
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
            <span
              className={isFirst ? 'text-accent font-medium' : 'text-text-secondary'}
            >
              {index + 1}. {entry.player.name}
            </span>
            <div className="flex items-center gap-2">
              {/* Log button - only show on first entry */}
              {showLogButton && isFirst && onLogClick && (
                <button
                  onClick={() => onLogClick(entry.player)}
                  className="opacity-0 group-hover:opacity-100 px-2 py-0.5 text-xs rounded bg-accent/80 text-white hover:bg-accent transition-all"
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
      {entries.length > maxShown && (
        <div className="text-text-muted text-xs px-2">
          +{entries.length - maxShown} more
        </div>
      )}
    </div>
  );
}

type LootSubTab = 'gear' | 'weapon' | 'matrix';

export function LootPriorityPanel({
  players,
  settings,
  selectedFloor,
  floorName,
  floors,
  showLogButtons = false,
  groupId,
  tierId,
  currentWeek = 1,
  onLogSuccess,
  lootLog = [],
  materialLog = [],
  showEnhancedScores = false,
}: LootPriorityPanelProps) {
  const lootTable = FLOOR_LOOT_TABLES[selectedFloor];

  // Sub-tab state with localStorage persistence
  const [activeSubTab, setActiveSubTabState] = useState<LootSubTab>(() => {
    try {
      const saved = localStorage.getItem('loot-priority-subtab');
      return (saved as LootSubTab) || 'gear';
    } catch {
      return 'gear';
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
  const materialPriorities = lootTable.upgradeMaterials.map((material) => ({
    material,
    label: material.charAt(0).toUpperCase() + material.slice(1),
    entries: enhanceEntries(getPriorityForUpgradeMaterial(players, material, settings, materialLog)),
  }));

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
            {floorName} Loot Priority
          </h3>
          {/* Sub-tab navigation */}
          <div className="flex bg-surface-base rounded-lg p-1">
            <button
              onClick={() => setActiveSubTab('gear')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                activeSubTab === 'gear'
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Gear Priority
            </button>
            <button
              onClick={() => setActiveSubTab('weapon')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                activeSubTab === 'weapon'
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Weapon Priority
              {selectedFloor === 4 && (
                <span className="ml-1.5 text-xs px-1 py-0.5 rounded bg-white/20">
                  !
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveSubTab('matrix')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                activeSubTab === 'matrix'
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Who Needs It
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
        </>
      )}

      {/* Weapon Priority Tab Content */}
      {activeSubTab === 'weapon' && (
        <div>
          {selectedFloor === 4 && (
            <div className="mb-4 px-3 py-2 rounded bg-accent/10 border border-accent/30 text-sm text-accent">
              Weapons drop from this floor (Floor 4)
            </div>
          )}
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
          currentWeek={currentWeek}
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
          floor={floorName}
          weaponJob={weaponModalState.weaponJob}
          currentWeek={currentWeek}
          suggestedPlayer={weaponModalState.player}
          allPlayers={players}
          settings={settings}
          onSuccess={handleLogSuccess}
        />
      )}

      {/* Quick Log Material Modal */}
      {canShowLogButtons && materialModalState.player && (
        <QuickLogMaterialModal
          isOpen={materialModalState.isOpen}
          onClose={handleMaterialModalClose}
          groupId={groupId!}
          tierId={tierId!}
          floor={floorName}
          material={materialModalState.material}
          currentWeek={currentWeek}
          suggestedPlayer={materialModalState.player}
          allPlayers={players}
          settings={settings}
          onSuccess={handleLogSuccess}
        />
      )}
    </div>
  );
}
