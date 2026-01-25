import { useState, useMemo, useCallback, memo } from 'react';
import { useSwipe } from '../../hooks/useSwipe';
import { Tooltip } from '../primitives/Tooltip';
import type { SnapshotPlayer, StaticSettings, GearSlot, LootLogEntry, MaterialLogEntry, MaterialType } from '../../types';
import type { FloorNumber } from '../../gamedata/loot-tables';
import { FLOOR_LOOT_TABLES, getFloorForUpgradeMaterial, UPGRADE_MATERIAL_DISPLAY_NAMES, isSlotAugmentationMaterial } from '../../gamedata/loot-tables';
import { GEAR_SLOT_NAMES, GEAR_SLOT_ICONS } from '../../types';
import {
  getPriorityForItem,
  getPriorityForRing,
  getPriorityForUpgradeMaterial,
  getPriorityForUniversalTomestone,
  calculatePriorityScoreWithBreakdown,
  type PriorityEntry,
  type PriorityScoreBreakdown,
} from '../../utils/priority';
import {
  calculatePlayerLootStats,
  calculateEnhancedPriorityScore,
  calculateAverageDrops,
} from '../../utils/lootCoordination';
import { getRoleColor, type Role } from '../../gamedata';
import { JobIcon } from '../ui/JobIcon';
import { FilterBar } from './FilterBar';
import { WeaponPriorityList } from './WeaponPriorityList';
import { QuickLogDropModal } from './QuickLogDropModal';
import { QuickLogWeaponModal } from './QuickLogWeaponModal';
import { QuickLogMaterialModal } from './QuickLogMaterialModal';
import { WhoNeedsItMatrix } from './WhoNeedsItMatrix';

interface EnhancedPriorityEntry extends PriorityEntry {
  enhancedScore?: number;
  droughtBonus?: number;
  balancePenalty?: number;
  // Score breakdown for tooltips
  breakdown?: PriorityScoreBreakdown;
}

// Memoized priority entry component to prevent unnecessary re-renders
interface LootPriorityEntryProps {
  entry: EnhancedPriorityEntry;
  index: number;
  isFirst: boolean;
  showEnhanced: boolean;
  showLogButton: boolean;
  onLogClick?: (player: SnapshotPlayer) => void;
  /** Label for the slot/item being logged (e.g., "Head", "Glaze") */
  itemLabel?: string;
}

// Tooltip content for gear priority score breakdown
function GearScoreTooltip({ entry, showEnhanced }: { entry: EnhancedPriorityEntry; showEnhanced: boolean }) {
  const hasEnhanced = showEnhanced && entry.enhancedScore !== undefined;
  const breakdown = entry.breakdown;

  return (
    <div className="text-xs space-y-0.5">
      <div className="font-medium text-text-primary mb-1">
        Priority Score: {hasEnhanced ? entry.enhancedScore : entry.score}
      </div>
      {breakdown ? (
        <>
          {breakdown.rolePriority > 0 && (
            <div className="text-text-secondary">
              Role Priority: <span className="text-accent">+{breakdown.rolePriority}</span>
            </div>
          )}
          {breakdown.weightedNeedBonus > 0 && (
            <div className="text-text-secondary">
              Gear Needed: <span className="text-accent">+{breakdown.weightedNeedBonus}</span>
              <span className="text-text-muted ml-1">({breakdown.weightedNeed.toFixed(1)} weighted)</span>
            </div>
          )}
          {breakdown.lootAdjustmentPenalty !== 0 && (
            <div className="text-text-secondary">
              Loot Adj: <span className={breakdown.lootAdjustmentPenalty > 0 ? 'text-status-warning' : 'text-status-success'}>
                {breakdown.lootAdjustmentPenalty > 0 ? '-' : '+'}{Math.abs(breakdown.lootAdjustmentPenalty)}
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="text-text-secondary">
          Base Score: <span className="text-accent">+{entry.score}</span>
        </div>
      )}
      {hasEnhanced && (
        <>
          {(entry.droughtBonus ?? 0) > 0 && (
            <div className="text-text-secondary">
              No Drops Bonus: <span className="text-status-success">+{entry.droughtBonus}</span>
            </div>
          )}
          {(entry.balancePenalty ?? 0) > 0 && (
            <div className="text-text-secondary">
              Fair Share Adj: <span className="text-status-warning">-{entry.balancePenalty}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const LootPriorityEntry = memo(function LootPriorityEntry({
  entry,
  index,
  isFirst,
  showEnhanced,
  showLogButton,
  onLogClick,
  itemLabel,
}: LootPriorityEntryProps) {
  const roleColor = getRoleColor(entry.player.role as Role);
  const displayScore = showEnhanced && entry.enhancedScore !== undefined
    ? entry.enhancedScore
    : entry.score;

  return (
    <div
      className={`flex items-center justify-between px-2 py-1 rounded text-sm group min-w-0 ${
        isFirst ? 'bg-accent/20' : ''
      }`}
    >
      {/* Left side - player info with truncation */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
        <span className={`flex-shrink-0 ${isFirst ? 'text-accent font-medium' : 'text-text-secondary'}`}>
          {index + 1}.
        </span>
        <span className="flex-shrink-0">
          <JobIcon job={entry.player.job} size="xs" />
        </span>
        <span className={`truncate ${isFirst ? 'text-accent font-medium' : 'text-text-secondary'}`}>
          {entry.player.name}
        </span>
      </div>
      {/* Right side - score (never shrinks) */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Log button - shows on hover for any entry */}
        {showLogButton && onLogClick && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <Tooltip content={`Log ${itemLabel || 'drop'} for ${entry.player.name}`}>
              <button
                onClick={() => onLogClick(entry.player)}
                className="px-2 py-0.5 text-xs rounded bg-accent text-accent-contrast font-bold hover:bg-accent-hover transition-colors"
              >
                Log
              </button>
            </Tooltip>
          </div>
        )}
        <Tooltip delayDuration={200} content={<GearScoreTooltip entry={entry} showEnhanced={showEnhanced} />}>
          <span
            className="text-xs px-1.5 py-0.5 rounded cursor-help"
            style={{ backgroundColor: `color-mix(in srgb, ${roleColor} 30%, transparent)`, color: roleColor }}
          >
            {displayScore}
          </span>
        </Tooltip>
      </div>
    </div>
  );
});

type MatrixFloorFilter = FloorNumber | 'all';

type LootSubTabType = 'matrix' | 'gear' | 'weapon';

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
  // Optional props for URL-controlled subtab (for deep linking)
  activeSubTab?: LootSubTabType;
  onSubTabChange?: (tab: LootSubTabType) => void;
}

interface PriorityListProps {
  entries: EnhancedPriorityEntry[];
  showLogButton?: boolean;
  onLogClick?: (player: SnapshotPlayer) => void;
  showEnhanced?: boolean;
  /** Label for the item type (e.g., "Head", "Glaze") for tooltip */
  itemLabel?: string;
}

function PriorityList({
  entries,
  showLogButton = false,
  onLogClick,
  showEnhanced = false,
  itemLabel,
}: PriorityListProps) {
  if (entries.length === 0) {
    return (
      <div className="text-status-success text-sm py-1">No one needs</div>
    );
  }

  return (
    <div className="space-y-1">
      {entries.map((entry, index) => (
        <LootPriorityEntry
          key={entry.player.id}
          entry={entry}
          index={index}
          isFirst={index === 0}
          showEnhanced={showEnhanced}
          showLogButton={showLogButton}
          onLogClick={onLogClick}
          itemLabel={itemLabel}
        />
      ))}
    </div>
  );
}

export function LootPriorityPanel({
  players,
  settings,
  selectedFloor,
  floorName,
  floors,
  // dutyNames - unused but kept in interface for future use
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
  activeSubTab: controlledSubTab,
  onSubTabChange,
}: LootPriorityPanelProps) {
  // Default maxWeek to currentWeek if not provided, minimum of 1
  const effectiveMaxWeek = Math.max(maxWeek ?? currentWeek, 1);
  const lootTable = FLOOR_LOOT_TABLES[selectedFloor];

  // Sub-tab state - controlled by parent if props provided, otherwise local with localStorage
  const [localSubTab, setLocalSubTab] = useState<LootSubTabType>(() => {
    try {
      const saved = localStorage.getItem('loot-priority-subtab');
      return (saved as LootSubTabType) || 'matrix';
    } catch {
      return 'matrix';
    }
  });

  // Use controlled value if provided, otherwise local
  const activeSubTab = controlledSubTab ?? localSubTab;

  const setActiveSubTab = useCallback((tab: LootSubTabType) => {
    // If parent controls subtab, call their handler
    if (onSubTabChange) {
      onSubTabChange(tab);
    } else {
      // Otherwise manage locally with localStorage
      setLocalSubTab(tab);
      try {
        localStorage.setItem('loot-priority-subtab', tab);
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [onSubTabChange]);

  // Swipe gesture handling for mobile tab switching
  const subTabs: LootSubTabType[] = ['matrix', 'gear', 'weapon'];
  const currentTabIndex = subTabs.indexOf(activeSubTab);

  const swipeHandlers = useSwipe({
    onSwipeLeft: () => {
      // Swipe left = go to next tab
      if (currentTabIndex < subTabs.length - 1) {
        setActiveSubTab(subTabs[currentTabIndex + 1]);
      }
    },
    onSwipeRight: () => {
      // Swipe right = go to previous tab
      if (currentTabIndex > 0) {
        setActiveSubTab(subTabs[currentTabIndex - 1]);
      }
    },
    minSwipeDistance: 50,
  });

  // Matrix floor filter state (supports 'all' option)
  // Syncs with parent's selectedFloor when a specific floor is selected
  const [matrixFloor, setMatrixFloor] = useState<MatrixFloorFilter>('all');

  // Handle matrix floor change - sync with parent when specific floor selected
  const handleMatrixFloorChange = useCallback((floor: MatrixFloorFilter) => {
    setMatrixFloor(floor);
    // If a specific floor is selected (not 'all'), also update parent
    if (floor !== 'all' && onFloorChange) {
      onFloorChange(floor);
    }
  }, [onFloorChange]);

  // Handle gear floor change - also update matrix floor to keep in sync
  // Type accepts FloorNumber | 'all' for FilterBar compatibility, but 'all' is filtered out
  const handleGearFloorChange = useCallback((floor: FloorNumber | 'all') => {
    if (floor === 'all') return; // Gear Priority doesn't support 'all'
    // Update matrix floor to match (unless user has 'all' selected, keep their preference)
    if (matrixFloor !== 'all') {
      setMatrixFloor(floor);
    }
    // Call parent handler
    onFloorChange?.(floor);
  }, [matrixFloor, onFloorChange]);

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

  // Helper to enhance priority entries with loot history and breakdown
  const enhanceEntries = (entries: PriorityEntry[]): EnhancedPriorityEntry[] => {
    // Always calculate breakdown for tooltips
    const entriesWithBreakdown = entries.map((entry) => {
      const breakdown = calculatePriorityScoreWithBreakdown(entry.player, settings);
      return {
        ...entry,
        breakdown,
      };
    });

    // If not showing enhanced scores or no loot history, return with just breakdown
    if (!showEnhancedScores || lootLog.length === 0) {
      return entriesWithBreakdown;
    }

    // Add enhanced score modifications based on loot history
    return entriesWithBreakdown.map((entry) => {
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
    <div className="bg-surface-card border border-border-default rounded-lg flex flex-col h-[calc(100%-1rem)] sm:max-h-[calc(100dvh-14rem)] sm:h-auto">
      {/* Header with sub-tabs - stays visible */}
      <div className="flex items-center justify-between p-4 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Mobile: show current tab name, Desktop: show "Loot Priority" */}
          <h3 className="font-display text-base sm:text-lg text-accent">
            <span className="sm:hidden">
              {activeSubTab === 'matrix' ? 'Who Needs It' :
               activeSubTab === 'gear' ? 'Gear Priority' : 'Weapon Priority'}
            </span>
            <span className="hidden sm:inline">Loot Priority</span>
          </h3>
          {/* Sub-tab navigation - hidden on mobile, use Controls sheet instead */}
          <div className="hidden sm:flex bg-surface-base rounded-lg p-1">
            <Tooltip
              content={
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    Who Needs It
                    <kbd className="px-1.5 py-0.5 text-xs bg-surface-base rounded border border-border-default">Alt+1</kbd>
                  </div>
                  <div className="text-text-secondary text-xs mt-0.5">Matrix showing which slots each player still needs</div>
                </div>
              }
            >
              {/* design-system-ignore: Subtab button requires specific toggle styling */}
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
            </Tooltip>
            <Tooltip
              content={
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    Gear Priority
                    <kbd className="px-1.5 py-0.5 text-xs bg-surface-base rounded border border-border-default">Alt+2</kbd>
                  </div>
                  <div className="text-text-secondary text-xs mt-0.5">Ordered priority list for each loot item by floor</div>
                </div>
              }
            >
              {/* design-system-ignore: Subtab button requires specific toggle styling */}
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
            </Tooltip>
            <Tooltip
              content={
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    Weapon Priority
                    <kbd className="px-1.5 py-0.5 text-xs bg-surface-base rounded border border-border-default">Alt+3</kbd>
                  </div>
                  <div className="text-text-secondary text-xs mt-0.5">Custom weapon priority order with tie-break rolls</div>
                </div>
              }
            >
              {/* design-system-ignore: Subtab button requires specific toggle styling */}
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
            </Tooltip>
          </div>
        </div>
        {showEnhancedScores && lootLog.length > 0 && (
          <span className="text-xs text-text-muted" title="Priority scores adjusted based on loot history: players who haven't received drops get a bonus, players who've received more than average get a small penalty">
            Loot history adjustments active
          </span>
        )}
      </div>

      {/* Content area - filter bars fixed, content scrolls, swipe to change tabs on mobile */}
      <div
        className="flex-1 min-h-0 flex flex-col sm:p-4 sm:pt-0 sm:overflow-y-auto"
        {...swipeHandlers}
      >
        {/* Gear Priority Tab Content */}
      {activeSubTab === 'gear' && (
        <div className="flex flex-col flex-1 min-h-0 bg-surface-card border border-border-default rounded-lg overflow-hidden sm:block sm:flex-none">
          {/* Floor selector - matches Who Needs It layout */}
          {onFloorChange && (
            <div className="flex-shrink-0 p-3 border-b border-border-default bg-surface-elevated">
              <FilterBar
                type="floor"
                floors={floors}
                selectedFloor={selectedFloor}
                onFloorChange={handleGearFloorChange}
                showAllOption={false}
              />
            </div>
          )}
          {/* Content area - scrolls on mobile */}
          <div className="flex-1 min-h-0 overflow-y-auto sm:overflow-visible p-4">
            {/* Gear drops grid - responsive: 1 col mobile, 2 cols sm, 4 cols lg */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {itemPriorities.map(({ slot, label, entries }) => {
                // Use ring1 icon for consolidated "ring" slot
                const iconSlot = slot === 'ring' ? 'ring1' : slot;
                return (
                  <div
                    key={slot}
                    className="bg-surface-base rounded-lg p-3"
                  >
                    <div className="flex items-center gap-1.5 text-text-primary font-medium text-sm mb-2 border-b border-border-default pb-2">
                      <img
                        src={GEAR_SLOT_ICONS[iconSlot as keyof typeof GEAR_SLOT_ICONS]}
                        alt=""
                        className="w-4 h-4 brightness-[3.0]"
                      />
                      <span>{label}</span>
                    </div>
                    <PriorityList
                      entries={entries}
                      showLogButton={!!canShowLogButtons}
                      onLogClick={(player) => handleLogClick(slot, player)}
                      showEnhanced={showEnhancedScores && lootLog.length > 0}
                      itemLabel={label}
                    />
                  </div>
                );
              })}
            </div>

            {/* Upgrade materials (if any for this floor) */}
            {materialPriorities.length > 0 && (
              <div className="border-t border-border-default pt-4 mt-4">
                <h4 className="text-text-secondary text-sm mb-3">Upgrade Materials</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                        itemLabel={label}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Weapon Priority Tab Content */}
      {activeSubTab === 'weapon' && (
        <div className="flex flex-col flex-1 min-h-0 bg-surface-card border border-border-default rounded-lg overflow-hidden sm:block sm:flex-none">
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
        <div className="flex flex-col flex-1 min-h-0 sm:block sm:flex-none">
          <WhoNeedsItMatrix
            players={players}
            floors={floors}
            showLogButtons={!!canShowLogButtons}
            onLogClick={(slot, player, floor) => handleLogClick(slot, player, floor)}
            selectedFloor={matrixFloor}
            onFloorChange={handleMatrixFloorChange}
          />
        </div>
      )}
      </div>

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
