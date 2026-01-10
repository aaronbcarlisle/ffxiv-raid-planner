/**
 * Group View Page
 *
 * Shows a static group with its tier snapshots and roster.
 * Full integration with PlayerCard components, DnD, loot/stats tabs.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { DndContext, DragOverlay, pointerWithin } from '@dnd-kit/core';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import { useTierStore } from '../stores/tierStore';
import { useAuthStore } from '../stores/authStore';
import { useLootTrackingStore } from '../stores/lootTrackingStore';
import { useViewAsStore } from '../stores/viewAsStore';
import { toast } from '../stores/toastStore';
import { getTierById } from '../gamedata';
import { DroppablePlayerCard } from '../components/player/DroppablePlayerCard';
import { DragOverlayCard } from '../components/player/DragOverlayCard';
import { EmptySlotCard } from '../components/player/EmptySlotCard';
import { InlinePlayerEdit } from '../components/player/InlinePlayerEdit';
import { useDragAndDrop } from '../components/dnd/useDragAndDrop';
import { LootPriorityPanel } from '../components/loot';
import { TeamSummaryEnhanced } from '../components/team/TeamSummaryEnhanced';
import { HistoryView } from '../components/history/HistoryView';
import { TabNavigation, ViewModeToggle, SortModeSelector, GroupViewToggle, KeyboardShortcutsHelp } from '../components/ui';
import { Button } from '../components/primitives';
import { GroupSettingsModal, RolloverDialog, CreateTierModal, DeleteTierModal } from '../components/static-group';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { HEADER_EVENTS } from '../components/layout/Header';
import { sortPlayersByRole, groupPlayersByLightParty } from '../utils/calculations';
import { SORT_PRESETS, DEFAULT_SETTINGS } from '../utils/constants';
import { canManageRoster, canResetGear } from '../utils/permissions';
import { logger } from '../lib/logger';
import type { SnapshotPlayer, PageMode, ViewMode, SortPreset, GearSlotStatus, ResetMode } from '../types';
import { GEAR_SLOTS } from '../types';
import type { FloorNumber } from '../gamedata/loot-tables';
import { ShieldAlert, Eye } from 'lucide-react';

export function GroupView() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentGroup, isLoading: groupLoading, error: groupError, fetchGroupByShareCode } = useStaticGroupStore();
  const {
    tiers,
    currentTier,
    isLoading: tierLoading,
    error: tierError,
    fetchTiers,
    fetchTier,
    updatePlayer,
    addPlayer,
    removePlayer,
    reorderPlayers,
    claimPlayer,
    releasePlayer,
    clearTiers,
  } = useTierStore();
  const { user, login } = useAuthStore();
  const { viewAsUser, startViewAs, stopViewAs } = useViewAsStore();

  // Handle viewAs URL parameter
  useEffect(() => {
    const viewAsUserId = searchParams.get('viewAs');
    if (viewAsUserId && currentGroup?.id && user?.isAdmin) {
      // Only start viewAs if not already viewing as this user in this group
      if (!viewAsUser || viewAsUser.userId !== viewAsUserId || viewAsUser.groupId !== currentGroup.id) {
        startViewAs(currentGroup.id, viewAsUserId);
      }
    } else if (!viewAsUserId && viewAsUser) {
      // URL param removed, stop viewing as
      stopViewAs();
    }
  }, [searchParams, currentGroup?.id, user?.isAdmin, startViewAs, stopViewAs, viewAsUser]);

  // Clear stale viewAs state if group changed
  useEffect(() => {
    if (viewAsUser && currentGroup?.id && viewAsUser.groupId !== currentGroup.id) {
      stopViewAs();
    }
  }, [viewAsUser, currentGroup?.id, stopViewAs]);

  // Clean up viewAs state when unmounting (leaving this page entirely)
  useEffect(() => {
    return () => {
      stopViewAs();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Local UI state
  const [showCreateTierModal, setShowCreateTierModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showRolloverDialog, setShowRolloverDialog] = useState(false);
  const [showDeleteTierConfirm, setShowDeleteTierConfirm] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  // Tab state: URL param > localStorage > default
  // URL uses user-friendly names: log, summary; internal PageMode uses: history, stats
  const [pageMode, setPageModeState] = useState<PageMode>(() => {
    const urlTab = searchParams.get('tab');
    // Map URL-friendly names to internal PageMode
    if (urlTab === 'players') return 'players';
    if (urlTab === 'loot') return 'loot';
    if (urlTab === 'log') return 'history';
    if (urlTab === 'summary') return 'stats';
    const saved = localStorage.getItem('group-view-tab');
    // Handle legacy 'stats' tab - redirect to 'players'
    if (saved === 'stats') return 'players';
    return (saved as PageMode) || 'players';
  });

  // Subtab state for loot panel: URL param > localStorage > default
  const [lootSubTab, setLootSubTabState] = useState<'matrix' | 'gear' | 'weapon'>(() => {
    const urlSubtab = searchParams.get('subtab');
    if (urlSubtab === 'matrix' || urlSubtab === 'gear' || urlSubtab === 'weapon') {
      return urlSubtab;
    }
    try {
      const saved = localStorage.getItem('loot-priority-subtab');
      if (saved === 'matrix' || saved === 'gear' || saved === 'weapon') return saved;
    } catch {
      // Ignore
    }
    return 'matrix';
  });

  // Wrapper to persist pageMode and update URL
  const setPageMode = useCallback((mode: PageMode) => {
    setPageModeState(mode);
    try {
      localStorage.setItem('group-view-tab', mode);
    } catch {
      // Ignore localStorage errors
    }
    // Map internal PageMode to URL-friendly names
    const urlTab = mode === 'history' ? 'log' : mode === 'stats' ? 'summary' : mode;
    // Update URL params
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      params.set('tab', urlTab);
      // Remove subtab if not on loot tab
      if (mode !== 'loot') {
        params.delete('subtab');
      } else {
        // Add current subtab when switching to loot
        params.set('subtab', lootSubTab);
      }
      return params;
    }, { replace: true });
  }, [setSearchParams, lootSubTab]);

  // Wrapper to persist lootSubTab and update URL
  const setLootSubTab = useCallback((tab: 'matrix' | 'gear' | 'weapon') => {
    setLootSubTabState(tab);
    try {
      localStorage.setItem('loot-priority-subtab', tab);
    } catch {
      // Ignore localStorage errors
    }
    // Update URL params
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      params.set('subtab', tab);
      return params;
    }, { replace: true });
  }, [setSearchParams]);
  // View mode: URL param > localStorage > default
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    const urlView = searchParams.get('view');
    if (urlView === 'compact' || urlView === 'expanded') return urlView;
    const saved = localStorage.getItem('party-view-mode');
    return saved === 'expanded' ? 'expanded' : 'compact';
  });

  // Floor selection: URL param > default (1)
  const [selectedFloor, setSelectedFloorState] = useState<FloorNumber>(() => {
    const urlFloor = searchParams.get('floor');
    if (urlFloor === '1' || urlFloor === '2' || urlFloor === '3' || urlFloor === '4') {
      return parseInt(urlFloor, 10) as FloorNumber;
    }
    return 1;
  });

  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [clipboardPlayer, setClipboardPlayer] = useState<SnapshotPlayer | null>(null);

  // Sort preset: URL param > localStorage > default
  const [sortPreset, setSortPresetState] = useState<SortPreset>(() => {
    const urlSort = searchParams.get('sort');
    if (urlSort === 'standard' || urlSort === 'dps-first' || urlSort === 'healer-first' || urlSort === 'custom') {
      return urlSort;
    }
    return 'standard'; // Will be overwritten by tier-specific localStorage in useEffect
  });

  // Group view (G1/G2): URL param > default (false)
  const [groupView, setGroupViewState] = useState(() => {
    return searchParams.get('groups') === 'true';
  });

  // Subs view (separate substitutes): URL param > default (false)
  const [subsView, setSubsViewState] = useState(() => {
    return searchParams.get('subs') === 'true';
  });
  const [playerModalCount, setPlayerModalCount] = useState(0); // Track open modals in PlayerCards

  // Highlighted player for deep-link scroll animation
  const [highlightedPlayerId, setHighlightedPlayerId] = useState<string | null>(null);

  // Wrapper to persist sortPreset per-tier and update URL
  const setSortPreset = useCallback((preset: SortPreset) => {
    setSortPresetState(preset);
    if (currentTier?.tierId) {
      try {
        localStorage.setItem(`sort-preset-${currentTier.tierId}`, preset);
      } catch {
        // Ignore localStorage errors
      }
    }
    // Update URL - only include if not default
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      if (preset === 'standard') {
        params.delete('sort');
      } else {
        params.set('sort', preset);
      }
      return params;
    }, { replace: true });
  }, [currentTier?.tierId, setSearchParams]);

  // Wrapper to persist viewMode and update URL
  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem('party-view-mode', mode);
    } catch {
      // Ignore localStorage errors
    }
    // Update URL - only include if not default
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      if (mode === 'compact') {
        params.delete('view');
      } else {
        params.set('view', mode);
      }
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  // Wrapper to update floor and URL
  const setSelectedFloor = useCallback((floor: FloorNumber) => {
    setSelectedFloorState(floor);
    // Update URL - only include if not default
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      if (floor === 1) {
        params.delete('floor');
      } else {
        params.set('floor', String(floor));
      }
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  // Wrapper to update groupView and URL
  const setGroupView = useCallback((enabled: boolean) => {
    setGroupViewState(enabled);
    // Update URL - only include if enabled
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      if (enabled) {
        params.set('groups', 'true');
      } else {
        params.delete('groups');
      }
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  // G1/G2 layout mode: 'side' (side-by-side on ultrawide) or 'stacked' (always vertical)
  const [g1g2Layout, setG1G2LayoutState] = useState<'side' | 'stacked'>(() => {
    // Check URL param first, then localStorage, then default to 'side'
    const urlLayout = searchParams.get('g1g2layout');
    if (urlLayout === 'side' || urlLayout === 'stacked') {
      return urlLayout;
    }
    try {
      const stored = localStorage.getItem('group-view-g1g2-layout');
      if (stored === 'side' || stored === 'stacked') return stored;
    } catch {
      // Ignore localStorage errors
    }
    return 'side';
  });

  // Wrapper to update g1g2Layout, localStorage, and URL
  const setG1G2Layout = useCallback((layout: 'side' | 'stacked') => {
    setG1G2LayoutState(layout);
    try {
      localStorage.setItem('group-view-g1g2-layout', layout);
    } catch {
      // Ignore localStorage errors
    }
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      if (layout === 'side') {
        params.delete('g1g2layout');
      } else {
        params.set('g1g2layout', layout);
      }
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  // Wrapper to update subsView and URL
  const setSubsView = useCallback((enabled: boolean) => {
    setSubsViewState(enabled);
    // Update URL - only include if enabled
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      if (enabled) {
        params.set('subs', 'true');
      } else {
        params.delete('subs');
      }
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  // Clear tiers when shareCode changes (switching groups)
  useEffect(() => {
    clearTiers();
  }, [shareCode, clearTiers]);

  // Fetch group on mount
  useEffect(() => {
    if (shareCode) {
      fetchGroupByShareCode(shareCode);
    }
  }, [shareCode, fetchGroupByShareCode]);

  // Track recently accessed statics in localStorage
  useEffect(() => {
    if (!shareCode) return;

    try {
      const MAX_RECENT = 10;
      const saved = localStorage.getItem('recent-statics');
      const recent: string[] = saved ? JSON.parse(saved) : [];

      // Remove this code if it exists, then add to front
      const filtered = recent.filter(code => code !== shareCode);
      const updated = [shareCode, ...filtered].slice(0, MAX_RECENT);

      localStorage.setItem('recent-statics', JSON.stringify(updated));
    } catch {
      // Ignore localStorage errors
    }
  }, [shareCode]);

  // Smart tab defaulting: reset to Roster when switching statics
  // Note: We only depend on currentGroup.id, not searchParams, to avoid
  // re-running when other URL params change (tier, viewAs, etc.)
  useEffect(() => {
    if (!currentGroup?.id) return;

    try {
      const lastStaticId = localStorage.getItem('last-static-id');
      // Read URL tab directly from window.location to avoid searchParams dependency
      const urlParams = new URLSearchParams(window.location.search);
      const urlTab = urlParams.get('tab');

      // If switching to a different static (not just refreshing the same one)
      // AND there's no explicit tab in the URL, reset to 'players' tab
      if (lastStaticId && lastStaticId !== currentGroup.id && !urlTab) {
        setPageMode('players');
      }

      // Always update last-static-id to current
      localStorage.setItem('last-static-id', currentGroup.id);
    } catch {
      // Ignore localStorage errors
    }
  }, [currentGroup?.id, setPageMode]);

  // Load sortPreset from localStorage when tier changes (only if not specified in URL)
  useEffect(() => {
    if (!currentTier?.tierId) return;
    // Skip if URL already has a sort param (user explicitly linked to this sort)
    const urlSort = searchParams.get('sort');
    if (urlSort === 'standard' || urlSort === 'dps-first' || urlSort === 'healer-first' || urlSort === 'custom') {
      return;
    }
    try {
      const saved = localStorage.getItem(`sort-preset-${currentTier.tierId}`);
      if (saved === 'standard' || saved === 'dps-first' || saved === 'healer-first' || saved === 'custom') {
        setSortPresetState(saved);
      } else {
        setSortPresetState('standard');
      }
    } catch {
      setSortPresetState('standard');
    }
  }, [currentTier?.tierId, searchParams]);

  // Handle player deep link - scroll to and highlight player
  useEffect(() => {
    const playerParam = searchParams.get('player');
    if (!playerParam || !currentTier?.players) return;

    // Find the player by ID
    const player = currentTier.players.find(p => p.id === playerParam);
    if (!player) return;

    // Set highlighted player ID
    setHighlightedPlayerId(playerParam);

    // Scroll to the player card after a short delay (allow render)
    setTimeout(() => {
      const element = document.getElementById(`player-card-${playerParam}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    // Clear highlight after animation completes (2s)
    const timer = setTimeout(() => {
      setHighlightedPlayerId(null);
      // Also clear the player param from URL
      setSearchParams(prev => {
        const params = new URLSearchParams(prev);
        params.delete('player');
        return params;
      }, { replace: true });
    }, 2500);

    return () => clearTimeout(timer);
  }, [searchParams, currentTier?.players, setSearchParams]);

  // Fetch tiers and load tier (from URL, localStorage, or active) sequentially
  useEffect(() => {
    if (!currentGroup?.id) return;

    let cancelled = false;
    const log = logger.scope('TierSelection');

    (async () => {
      // First fetch the list of tiers
      await fetchTiers(currentGroup.id);
      if (cancelled) return;

      // Get fresh tiers from store after fetch completes
      const { tiers: freshTiers } = useTierStore.getState();
      if (freshTiers.length === 0) return;

      // Priority: URL param > localStorage > active tier > first tier
      const urlTierId = searchParams.get('tier');
      const urlTier = urlTierId ? freshTiers.find(t => t.tierId === urlTierId) : null;

      const savedTierId = localStorage.getItem(`selected-tier-${currentGroup.id}`);
      const savedTier = savedTierId ? freshTiers.find(t => t.tierId === savedTierId) : null;

      // Load URL tier, saved tier, active tier, or first tier
      const activeTier = urlTier || savedTier || freshTiers.find(t => t.isActive) || freshTiers[0];

      // Debug: Log tier selection for troubleshooting
      const selectionSource = urlTier ? 'URL' : savedTier ? 'localStorage' : freshTiers.find(t => t.isActive) ? 'isActive' : 'fallback';
      log.debug(`Selected tier: ${activeTier?.tierId} (source: ${selectionSource})`);

      if (activeTier) {
        await fetchTier(currentGroup.id, activeTier.tierId);
        // Always show current tier in URL (so copying URL shares the right tier)
        // Preserve existing tab/subtab params
        setSearchParams(prev => {
          const params = new URLSearchParams(prev);
          params.set('tier', activeTier.tierId);
          return params;
        }, { replace: true });
      }
    })();

    return () => { cancelled = true; };
  }, [currentGroup?.id, fetchTiers, fetchTier, searchParams, setSearchParams]);

  // Initialize loot tracking store when Loot tab is active
  const { currentWeek: storeCurrentWeek, maxWeek: storeMaxWeek, fetchCurrentWeek, fetchLootLog, lootLog, fetchMaterialLog, materialLog } = useLootTrackingStore();
  useEffect(() => {
    if (pageMode === 'loot' && currentGroup?.id && currentTier?.tierId) {
      fetchCurrentWeek(currentGroup.id, currentTier.tierId);
      // Fetch all loot log entries (no week filter) for enhanced priority calculation
      fetchLootLog(currentGroup.id, currentTier.tierId);
      // Fetch all material log entries for material priority calculation
      fetchMaterialLog(currentGroup.id, currentTier.tierId);
    }
  }, [pageMode, currentGroup?.id, currentTier?.tierId, fetchCurrentWeek, fetchLootLog, fetchMaterialLog]);

  const handleTierChange = useCallback((tierId: string) => {
    if (currentGroup?.id) {
      // Save tier selection to localStorage for persistence
      try {
        localStorage.setItem(`selected-tier-${currentGroup.id}`, tierId);
      } catch {
        // Ignore localStorage errors
      }
      // Update URL to reflect current tier, preserving tab/subtab params
      setSearchParams(prev => {
        const params = new URLSearchParams(prev);
        params.set('tier', tierId);
        return params;
      }, { replace: true });
      fetchTier(currentGroup.id, tierId);
    }
  }, [currentGroup?.id, fetchTier, setSearchParams]);

  // Called when a tier is deleted - load the next available tier
  const handleTierDeleted = async () => {
    if (!currentGroup?.id) return;

    const { tiers: freshTiers } = useTierStore.getState();
    if (freshTiers.length > 0) {
      const nextTier = freshTiers.find(t => t.isActive) || freshTiers[0];
      if (nextTier) {
        await fetchTier(currentGroup.id, nextTier.tierId);
      }
    }
  };

  // Player update handler
  const handleUpdatePlayer = useCallback(async (playerId: string, updates: Partial<SnapshotPlayer>) => {
    if (!currentGroup?.id || !currentTier?.tierId) return;
    await updatePlayer(currentGroup.id, currentTier.tierId, playerId, updates);
  }, [currentGroup?.id, currentTier?.tierId, updatePlayer]);

  // Player remove handler
  const handleRemovePlayer = useCallback(async (playerId: string) => {
    if (!currentGroup?.id || !currentTier?.tierId) return;
    await removePlayer(currentGroup.id, currentTier.tierId, playerId);
  }, [currentGroup?.id, currentTier?.tierId, removePlayer]);

  // Claim player handler (take ownership)
  const handleClaimPlayer = useCallback(async (playerId: string) => {
    if (!currentGroup?.id || !currentTier?.tierId) return;
    await claimPlayer(currentGroup.id, currentTier.tierId, playerId);
  }, [currentGroup?.id, currentTier?.tierId, claimPlayer]);

  // Release player handler (remove ownership)
  const handleReleasePlayer = useCallback(async (playerId: string) => {
    if (!currentGroup?.id || !currentTier?.tierId) return;
    await releasePlayer(currentGroup.id, currentTier.tierId, playerId);
  }, [currentGroup?.id, currentTier?.tierId, releasePlayer]);

  // Configure player (set name, job, role)
  const handleConfigurePlayer = useCallback(async (playerId: string, name: string, job: string, role: string) => {
    if (!currentGroup?.id || !currentTier?.tierId) return;
    await updatePlayer(currentGroup.id, currentTier.tierId, playerId, {
      name,
      job,
      role,
      configured: true,
    });
    setEditingPlayerId(null);
  }, [currentGroup?.id, currentTier?.tierId, updatePlayer]);

  // Add player handler
  const handleAddPlayer = useCallback(async () => {
    if (!currentGroup?.id || !currentTier?.tierId) return;
    await addPlayer(currentGroup.id, currentTier.tierId);
  }, [currentGroup?.id, currentTier?.tierId, addPlayer]);

  // Duplicate player handler - creates a copy of the player
  const handleDuplicatePlayer = useCallback(async (sourcePlayer: SnapshotPlayer) => {
    if (!currentGroup?.id || !currentTier?.tierId) return;
    try {
      // Create a new player slot
      const newPlayer = await addPlayer(currentGroup.id, currentTier.tierId);
      // Update the new player with the source player's data
      await updatePlayer(currentGroup.id, currentTier.tierId, newPlayer.id, {
        name: `${sourcePlayer.name} (Copy)`,
        job: sourcePlayer.job,
        role: sourcePlayer.role,
        position: sourcePlayer.position,
        tankRole: sourcePlayer.tankRole,
        templateRole: sourcePlayer.templateRole,
        configured: true,
        gear: sourcePlayer.gear,
        tomeWeapon: sourcePlayer.tomeWeapon,
        isSubstitute: sourcePlayer.isSubstitute,
        notes: sourcePlayer.notes,
        bisLink: sourcePlayer.bisLink,
      });
    } catch {
      // Error handled in store
    }
  }, [currentGroup?.id, currentTier?.tierId, addPlayer, updatePlayer]);

  // Reset gear handler - handles three reset modes
  const handleResetGear = useCallback(async (playerId: string, mode: ResetMode) => {
    if (!currentGroup?.id || !currentTier?.tierId || !currentTier.players) return;

    const player = currentTier.players.find(p => p.id === playerId);
    if (!player) return;

    let updates: Partial<SnapshotPlayer>;

    switch (mode) {
      case 'progress':
        // Reset progress only (keep BiS config)
        const progressResetGear = player.gear.map(slot => ({
          ...slot,
          hasItem: false,
          isAugmented: false,
          currentSource: 'crafted' as const, // Reset to crafted since no item
          // Keep: bisSource, itemName, itemIcon, itemLevel, itemStats
        }));
        updates = {
          gear: progressResetGear,
          tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false },
        };
        break;

      case 'unlink':
        // Unlink BiS (keep progress and sources)
        // Recalculate currentSource based on current hasItem/isAugmented state
        const unlinkGear = player.gear.map(slot => {
          let currentSource: 'savage' | 'tome' | 'tome_up' | 'crafted' = 'crafted';
          if (slot.hasItem) {
            if (slot.bisSource === 'raid') {
              currentSource = 'savage';
            } else {
              currentSource = slot.isAugmented ? 'tome_up' : 'tome';
            }
          }
          return {
            slot: slot.slot,
            bisSource: slot.bisSource,
            hasItem: slot.hasItem,
            isAugmented: slot.isAugmented,
            currentSource,
            // Clear: itemName, itemIcon, itemLevel, itemStats
          };
        });
        updates = {
          gear: unlinkGear,
          bisLink: '',
        };
        break;

      case 'all':
        // Reset everything
        const defaultGear: GearSlotStatus[] = GEAR_SLOTS.map((slot) => ({
          slot,
          bisSource: slot === 'ring2' ? 'tome' as const : 'raid' as const,
          hasItem: false,
          isAugmented: false,
          currentSource: 'crafted' as const, // Reset to crafted since no item
        }));
        updates = {
          gear: defaultGear,
          tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false },
          bisLink: '',
        };
        break;
    }

    await updatePlayer(currentGroup.id, currentTier.tierId, playerId, updates);
  }, [currentGroup?.id, currentTier?.tierId, currentTier?.players, updatePlayer]);

  // Listen for header events
  useEffect(() => {
    const handleTierChangeEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.tierId) {
        handleTierChange(detail.tierId);
      }
    };

    const handleAddPlayerEvent = () => {
      handleAddPlayer();
    };

    const handleNewTierEvent = () => {
      setShowCreateTierModal(true);
    };

    const handleRolloverEvent = () => {
      setShowRolloverDialog(true);
    };

    const handleSettingsEvent = () => {
      setShowSettingsModal(true);
    };

    const handleDeleteTierEvent = () => {
      setShowDeleteTierConfirm(true);
    };

    window.addEventListener(HEADER_EVENTS.TIER_CHANGE, handleTierChangeEvent);
    window.addEventListener(HEADER_EVENTS.ADD_PLAYER, handleAddPlayerEvent);
    window.addEventListener(HEADER_EVENTS.NEW_TIER, handleNewTierEvent);
    window.addEventListener(HEADER_EVENTS.ROLLOVER, handleRolloverEvent);
    window.addEventListener(HEADER_EVENTS.SETTINGS, handleSettingsEvent);
    window.addEventListener(HEADER_EVENTS.DELETE_TIER, handleDeleteTierEvent);

    return () => {
      window.removeEventListener(HEADER_EVENTS.TIER_CHANGE, handleTierChangeEvent);
      window.removeEventListener(HEADER_EVENTS.ADD_PLAYER, handleAddPlayerEvent);
      window.removeEventListener(HEADER_EVENTS.NEW_TIER, handleNewTierEvent);
      window.removeEventListener(HEADER_EVENTS.ROLLOVER, handleRolloverEvent);
      window.removeEventListener(HEADER_EVENTS.SETTINGS, handleSettingsEvent);
      window.removeEventListener(HEADER_EVENTS.DELETE_TIER, handleDeleteTierEvent);
    };
  }, [handleTierChange, handleAddPlayer]);

  // Calculate sorted players
  const sortedPlayers = useMemo(() => {
    if (!currentTier?.players) return [];
    const displayOrder = SORT_PRESETS[sortPreset]?.order ?? DEFAULT_SETTINGS.displayOrder;
    return sortPlayersByRole(currentTier.players, displayOrder, sortPreset);
  }, [currentTier?.players, sortPreset]);

  // Check if current user (or viewAs user) has already claimed a player in this tier
  const userHasClaimedPlayer = useMemo(() => {
    const checkUserId = viewAsUser ? viewAsUser.userId : user?.id;
    if (!checkUserId || !currentTier?.players) return false;
    return currentTier.players.some(p => p.userId === checkUserId);
  }, [viewAsUser, user?.id, currentTier?.players]);

  // Group players by light party when group view is enabled
  const groupedPlayers = useMemo(() => {
    if (!groupView) return null;
    return groupPlayersByLightParty(sortedPlayers, subsView);
  }, [groupView, sortedPlayers, subsView]);

  // Check if we have enough position data to enable group view
  const hasPositionData = sortedPlayers.filter(p => p.configured && p.position).length >= 2;

  // Check if any substitutes exist
  const hasSubstitutes = useMemo(() => {
    return sortedPlayers.some(p => p.isSubstitute);
  }, [sortedPlayers]);

  // Main roster players: configured and not substitutes
  // Used for Loot Priority, Summary, and other features that should exclude subs
  const mainRosterPlayers = useMemo(() => {
    return sortedPlayers.filter(p => p.configured && !p.isSubstitute);
  }, [sortedPlayers]);

  const isLoading = groupLoading || tierLoading;
  const error = groupError || tierError;

  // When viewing as another user, use their role instead of actual role
  const actualUserRole = currentGroup?.userRole;
  const userRole = viewAsUser ? viewAsUser.role : actualUserRole;
  // Admin access is determined by the API - true if user has admin privileges (not actual membership)
  // When using View As, we want to simulate the viewed user's permissions, so disable admin access
  const isAdminAccess = !viewAsUser && (currentGroup?.isAdminAccess ?? false);
  const canEdit = userRole === 'owner' || userRole === 'lead' || isAdminAccess;

  // Effective user ID for ownership checks (use viewAs user's ID when viewing as them)
  const effectiveUserId = viewAsUser ? viewAsUser.userId : user?.id;

  // Get tier info for display
  const tierInfo = currentTier ? getTierById(currentTier.tierId) : null;

  // Available tiers for creation (filter out existing)
  const existingTierIds = tiers.map(t => t.tierId);

  // Reorder handler for DnD hook
  const handleReorder = useCallback(async (updates: Array<{ playerId: string; data: Partial<SnapshotPlayer> }>) => {
    if (!currentGroup?.id || !currentTier?.tierId) return;
    await reorderPlayers(currentGroup.id, currentTier.tierId, updates);
    setSortPreset('custom');
  }, [currentGroup?.id, currentTier?.tierId, reorderPlayers]);

  // Check if any modal is open (page-level or player-level)
  const isAnyModalOpen = showSettingsModal || showRolloverDialog ||
                          showDeleteTierConfirm || showCreateTierModal ||
                          showKeyboardHelp || playerModalCount > 0;

  // Keyboard shortcuts
  useKeyboardShortcuts({
    disabled: isAnyModalOpen,
    shortcuts: [
      { key: '?', description: 'Show keyboard shortcuts', action: () => setShowKeyboardHelp(true), requireShift: true },
      { key: '1', description: 'Players tab', action: () => setPageMode('players') },
      { key: '2', description: 'Loot tab', action: () => setPageMode('loot') },
      { key: '3', description: 'Log tab', action: () => setPageMode('history') },
      { key: '4', description: 'Summary tab', action: () => setPageMode('stats') },
      { key: 'v', description: 'Toggle view mode', action: () => {
        // Only toggle view mode on players tab
        if (pageMode === 'players') {
          setViewMode(viewMode === 'compact' ? 'expanded' : 'compact');
        }
      }},
      { key: 'g', description: 'Toggle group view', action: () => {
        // Only toggle group view on players tab
        if (pageMode === 'players') {
          setGroupView(!groupView);
        }
      }},
      { key: 'Escape', description: 'Close/clear', action: () => {
        setShowKeyboardHelp(false);
        setEditingPlayerId(null);
        setHighlightedPlayerId(null);
      }},
    ],
  });

  // Modal callbacks for PlayerCards
  const handlePlayerModalOpen = useCallback(() => {
    setPlayerModalCount(prev => prev + 1);
  }, []);

  const handlePlayerModalClose = useCallback(() => {
    setPlayerModalCount(prev => Math.max(0, prev - 1));
  }, []);

  // Check roster management permission for DnD
  const rosterPermission = canManageRoster(userRole, isAdminAccess);

  // DnD hook - encapsulates all drag and drop logic
  const dnd = useDragAndDrop({
    players: sortedPlayers,
    groupView,
    canEdit,
    disabled: isAnyModalOpen || !rosterPermission.allowed,
    onReorder: handleReorder,
  });

  // Grid classes - responsive from 1 column (mobile) to 6 columns (ultrawide)
  const gridClasses = 'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 grid-4xl grid-5xl grid-6xl';

  // Helper function to render a player card
  const renderPlayerCard = (player: SnapshotPlayer) => {
    // If editing this player, show inline edit form
    if (editingPlayerId === player.id) {
      return (
        <InlinePlayerEdit
          key={player.id}
          player={player}
          userRole={userRole}
          onSave={(name, job, role) => handleConfigurePlayer(player.id, name, job, role)}
          onCancel={() => setEditingPlayerId(null)}
        />
      );
    }

    // If player is configured, show droppable player card
    if (player.configured) {
      // Check if user can reset this player's gear
      const resetPermission = canResetGear(userRole, player, effectiveUserId, isAdminAccess);

      return (
        <DroppablePlayerCard
          key={player.id}
          player={player}
          settings={DEFAULT_SETTINGS}
          viewMode={viewMode}
          contentType={currentTier?.contentType ?? 'savage'}
          clipboardPlayer={clipboardPlayer}
          dragState={dnd.dragState}
          canEdit={canEdit}
          currentUserId={effectiveUserId}
          isGroupOwner={userRole === 'owner'}
          userRole={userRole}
          userHasClaimedPlayer={userHasClaimedPlayer}
          isAdmin={isAdminAccess}
          groupId={currentGroup!.id}
          tierId={currentTier!.tierId}
          isHighlighted={highlightedPlayerId === player.id}
          onUpdate={(updates) => handleUpdatePlayer(player.id, updates)}
          onRemove={() => handleRemovePlayer(player.id)}
          onCopy={() => {
            setClipboardPlayer(player);
            toast.info(`Copied ${player.name}`);
          }}
          onPaste={() => {
            if (clipboardPlayer) {
              handleUpdatePlayer(player.id, {
                job: clipboardPlayer.job,
                role: clipboardPlayer.role,
                gear: clipboardPlayer.gear,
                tomeWeapon: clipboardPlayer.tomeWeapon,
                isSubstitute: clipboardPlayer.isSubstitute,
                notes: clipboardPlayer.notes,
                bisLink: clipboardPlayer.bisLink,
              });
              toast.success(`Pasted ${clipboardPlayer.name}'s data`);
            }
          }}
          onDuplicate={() => handleDuplicatePlayer(player)}
          onResetGear={resetPermission.allowed ? (mode: ResetMode) => { handleResetGear(player.id, mode); } : undefined}
          onClaimPlayer={() => handleClaimPlayer(player.id)}
          onReleasePlayer={() => handleReleasePlayer(player.id)}
          onModalOpen={handlePlayerModalOpen}
          onModalClose={handlePlayerModalClose}
          onCopyUrl={() => {
            const url = new URL(window.location.href);
            url.searchParams.set('tab', 'players');
            url.searchParams.set('player', player.id);
            navigator.clipboard.writeText(url.toString());
            toast.success('Link copied to clipboard');
          }}
        />
      );
    }

    // Otherwise show empty slot
    return (
      <EmptySlotCard
        key={player.id}
        templateRole={player.templateRole}
        position={player.position}
        onStartEdit={() => setEditingPlayerId(player.id)}
        onRemove={canEdit ? () => handleRemovePlayer(player.id) : undefined}
      />
    );
  };

  if (isLoading && !currentGroup) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    // Check if this is a private group error (user needs to log in)
    const isPrivateGroupError = error.toLowerCase().includes('private');

    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className={`${isPrivateGroupError ? 'bg-accent/10 border-accent/30' : 'bg-status-error/10 border-status-error/30'} border rounded-lg p-6 text-center`}>
          <h2 className={`text-xl font-display mb-2 ${isPrivateGroupError ? 'text-accent' : 'text-status-error'}`}>
            {isPrivateGroupError ? 'Private Group' : 'Error'}
          </h2>
          <p className="text-text-secondary mb-4">
            {isPrivateGroupError
              ? 'This static group is private. Please log in to view it.'
              : error
            }
          </p>
          <div className="flex gap-3 justify-center">
            {isPrivateGroupError && !user && (
              <Button onClick={() => login()}>
                Log In with Discord
              </Button>
            )}
            <Button
              variant={isPrivateGroupError && !user ? 'secondary' : 'primary'}
              onClick={() => navigate('/dashboard')}
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentGroup) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="text-center py-12">
          <h2 className="text-xl font-display text-accent mb-2">Group Not Found</h2>
          <p className="text-text-muted">The static group you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[160rem] mx-auto">
      {/* No tiers state */}
      {tiers.length === 0 && !isLoading && (
        <div className="text-center py-12 bg-surface-card rounded-lg border border-border-default">
          <h2 className="text-xl font-display text-accent mb-2">No Raid Tiers</h2>
          <p className="text-text-muted mb-6">
            Create your first tier snapshot to start tracking gear progress.
          </p>
          {canEdit && (
            <button
              onClick={() => setShowCreateTierModal(true)}
              className="bg-accent text-bg-primary px-6 py-2 rounded font-medium hover:bg-accent-bright"
            >
              Create First Tier
            </button>
          )}
        </div>
      )}

      {/* Admin viewing indicator - shows when admin is viewing a static they're not a member of */}
      {isAdminAccess && (
        <div className="mb-3 p-3 bg-status-warning/10 border border-status-warning/30 rounded-lg">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-status-warning" />
            <span className="text-sm text-status-warning">
              <span className="font-medium">Admin Access:</span>{' '}
              You're viewing this static as an administrator. You have owner-level permissions but are not a member.
            </span>
          </div>
        </div>
      )}

      {/* View As indicator - shows when admin is viewing as another user */}
      {viewAsUser && (
        <div className="mb-3 p-3 bg-membership-lead/10 border border-membership-lead/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-membership-lead" />
              <span className="text-sm text-membership-lead">
                <span className="font-medium">Viewing as:</span>{' '}
                {viewAsUser.displayName || viewAsUser.discordUsername}
                <span className="ml-1 text-membership-lead/70">
                  ({viewAsUser.role || 'no membership'})
                </span>
              </span>
            </div>
            <button
              onClick={() => {
                stopViewAs();
                // Clear viewAs URL param
                setSearchParams(prev => {
                  const params = new URLSearchParams(prev);
                  params.delete('viewAs');
                  return params;
                }, { replace: true });
              }}
              className="text-sm text-membership-lead hover:text-membership-lead/80 px-3 py-1 rounded bg-membership-lead/20 hover:bg-membership-lead/30 transition-colors"
            >
              Exit View As
            </button>
          </div>
        </div>
      )}

      {/* Content when tier exists */}
      {currentTier && (
        <>
          {/* Toolbar: Tabs + Context Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
            <TabNavigation activeTab={pageMode} onTabChange={setPageMode} />
            <div className="relative flex items-center justify-end gap-3">
              {/* Floor selector moved into Loot tab's Gear Priority sub-tab */}
              {/* Sort mode + Group view + Subs + View mode toggle - visible in Players tab */}
              <div className={`absolute right-0 flex items-center gap-3 ${pageMode !== 'players' ? 'invisible' : ''}`}>
                <SortModeSelector
                  sortPreset={sortPreset}
                  onPresetChange={setSortPreset}
                />
                <GroupViewToggle
                  enabled={groupView}
                  onToggle={setGroupView}
                  disabled={!hasPositionData}
                />
                {/* G1/G2 Layout toggle - only show when groupView is active */}
                {groupView && (
                  <button
                    onClick={() => setG1G2Layout(g1g2Layout === 'side' ? 'stacked' : 'side')}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                      g1g2Layout === 'side'
                        ? 'bg-accent/20 text-accent border border-accent/50'
                        : 'bg-surface-raised border border-border-default text-text-secondary hover:text-text-primary hover:border-accent'
                    }`}
                    title={g1g2Layout === 'side' ? 'Side-by-side layout (responsive)' : 'Stacked layout (always vertical)'}
                    aria-label={g1g2Layout === 'side' ? 'Switch to stacked layout' : 'Switch to side-by-side layout'}
                    aria-pressed={g1g2Layout === 'side'}
                  >
                    {g1g2Layout === 'side' ? (
                      /* Columns icon for side-by-side */
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                      </svg>
                    ) : (
                      /* Rows icon for stacked */
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    )}
                  </button>
                )}
                {/* Subs toggle - only show when substitutes exist */}
                {hasSubstitutes && (
                  <button
                    onClick={() => setSubsView(!subsView)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                      subsView
                        ? 'bg-accent/20 text-accent border border-accent/50'
                        : 'bg-surface-raised border border-border-default text-text-secondary hover:text-text-primary hover:border-accent'
                    }`}
                    title={subsView ? 'Show subs with main roster' : 'Separate substitutes'}
                    aria-label={subsView ? 'Show substitutes with main roster' : 'Separate substitute players into their own section'}
                    aria-pressed={subsView}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    <span>Subs</span>
                  </button>
                )}
                <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
              </div>
            </div>
          </div>

          {/* Players Tab */}
          {pageMode === 'players' && currentTier.players && (
            <>
              {/* Permission message when DnD is disabled and user is on custom sort */}
              {!rosterPermission.allowed && sortPreset === 'custom' && (
                <div className="mb-3 p-3 bg-surface-card border border-border-subtle rounded-lg">
                  <p className="text-sm text-text-muted flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Player reordering is disabled. {rosterPermission.reason}
                  </p>
                </div>
              )}

              <DndContext
                sensors={dnd.sensors}
                collisionDetection={pointerWithin}
                onDragStart={dnd.handleDragStart}
                onDragOver={dnd.handleDragOver}
                onDragEnd={dnd.handleDragEnd}
                onDragCancel={dnd.handleDragCancel}
              >
              {/* Grouped View (G1/G2) */}
              {groupView && groupedPlayers ? (
                <div className="space-y-8 mb-8">
                  {/* G1/G2 Container - side by side on ultrawide (unless stacked layout selected) */}
                  <div className={`grid grid-cols-1 gap-6 ${g1g2Layout === 'side' ? 'grid-g1g2-side' : ''}`}>
                    {/* Group 1 - Blue themed with backdrop */}
                    {groupedPlayers.group1.length > 0 && (
                      <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                        <h3 className="text-text-secondary text-sm font-medium mb-4 flex items-center gap-2">
                          <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs font-bold border border-blue-500/30">G1</span>
                          Light Party 1
                        </h3>
                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 grid-g1g2-cards">
                          {groupedPlayers.group1.map((player) => renderPlayerCard(player))}
                        </div>
                      </div>
                    )}

                    {/* Group 2 - Red themed with backdrop */}
                    {groupedPlayers.group2.length > 0 && (
                      <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                        <h3 className="text-text-secondary text-sm font-medium mb-4 flex items-center gap-2">
                          <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-xs font-bold border border-red-500/30">G2</span>
                          Light Party 2
                        </h3>
                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 grid-g1g2-cards">
                          {groupedPlayers.group2.map((player) => renderPlayerCard(player))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Unassigned */}
                  {groupedPlayers.unassigned.length > 0 && (
                    <div className="opacity-75">
                      <h3 className="text-text-muted text-sm font-medium mb-3">
                        Unassigned Positions
                      </h3>
                      <div className={gridClasses}>
                        {groupedPlayers.unassigned.map((player) => renderPlayerCard(player))}
                      </div>
                    </div>
                  )}

                  {/* Substitutes - shown when subsView is enabled */}
                  {subsView && groupedPlayers.substitutes.length > 0 && (
                    <div className="opacity-75">
                      <h3 className="text-text-secondary text-sm font-medium mb-3 flex items-center gap-2">
                        <span className="bg-surface-interactive text-text-muted px-2 py-0.5 rounded text-xs font-bold border border-border-subtle">SUB</span>
                        Substitutes
                      </h3>
                      <div className={gridClasses}>
                        {groupedPlayers.substitutes.map((player) => renderPlayerCard(player))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Standard View - with optional subs section */
                <div className="space-y-8 mb-8">
                  <div className={gridClasses}>
                    {subsView
                      ? sortedPlayers.filter(p => !p.isSubstitute).map((player) => renderPlayerCard(player))
                      : sortedPlayers.map((player) => renderPlayerCard(player))
                    }
                  </div>
                  {/* Substitutes section - shown in standard view when subsView is enabled */}
                  {subsView && sortedPlayers.some(p => p.isSubstitute) && (
                    <div className="opacity-75">
                      <h3 className="text-text-secondary text-sm font-medium mb-3 flex items-center gap-2">
                        <span className="bg-surface-interactive text-text-muted px-2 py-0.5 rounded text-xs font-bold border border-border-subtle">SUB</span>
                        Substitutes
                      </h3>
                      <div className={gridClasses}>
                        {sortedPlayers.filter(p => p.isSubstitute).map((player) => renderPlayerCard(player))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Drag overlay - ghost card that follows cursor */}
              <DragOverlay dropAnimation={null}>
                {dnd.dragState.activeId && (() => {
                  const draggedPlayer = sortedPlayers.find(p => p.id === dnd.dragState.activeId);
                  if (!draggedPlayer || !draggedPlayer.configured) return null;
                  return (
                    <DragOverlayCard
                      player={draggedPlayer}
                      settings={DEFAULT_SETTINGS}
                      viewMode={viewMode}
                      contentType={currentTier?.contentType ?? 'savage'}
                      groupId={currentGroup?.id ?? ''}
                      tierId={currentTier?.tierId ?? ''}
                    />
                  );
                })()}
              </DragOverlay>
            </DndContext>
            </>
          )}

          {/* Loot Tab */}
          {pageMode === 'loot' && tierInfo && mainRosterPlayers.length > 0 && (
            <LootPriorityPanel
              players={mainRosterPlayers}
              settings={{
                ...DEFAULT_SETTINGS,
                ...(currentGroup?.settings && { lootPriority: currentGroup.settings.lootPriority }),
              }}
              selectedFloor={selectedFloor}
              floorName={tierInfo.floors[selectedFloor - 1]}
              floors={tierInfo.floors}
              dutyNames={tierInfo.dutyNames}
              onFloorChange={setSelectedFloor}
              showLogButtons={canEdit}
              groupId={currentGroup?.id}
              tierId={currentTier?.tierId}
              currentWeek={storeCurrentWeek}
              maxWeek={storeMaxWeek}
              lootLog={lootLog}
              materialLog={materialLog}
              showEnhancedScores={true}
              activeSubTab={lootSubTab}
              onSubTabChange={setLootSubTab}
              onLogSuccess={() => {
                // Refresh tier data so weapon priority list updates
                if (currentGroup?.id && currentTier?.tierId) {
                  fetchTier(currentGroup.id, currentTier.tierId);
                }
              }}
            />
          )}

          {/* Summary Tab */}
          {pageMode === 'stats' && tierInfo && mainRosterPlayers.length > 0 && (
            <TeamSummaryEnhanced
              groupId={currentGroup!.id}
              tierId={currentTier.tierId}
              players={mainRosterPlayers}
              tierInfo={tierInfo}
            />
          )}

          {/* History Tab */}
          {pageMode === 'history' && currentTier?.players && tierInfo && (
            <HistoryView
              groupId={currentGroup!.id}
              tierId={currentTier.tierId}
              players={currentTier.players}
              floors={tierInfo.floors}
              userRole={userRole || 'viewer'}
              isAdmin={isAdminAccess}
            />
          )}
        </>
      )}

      {/* Create Tier Modal */}
      {showCreateTierModal && currentGroup && (
        <CreateTierModal
          groupId={currentGroup.id}
          existingTierIds={existingTierIds}
          onClose={() => setShowCreateTierModal(false)}
          onCreate={() => setPageMode('players')}
        />
      )}

      {/* Group Settings Modal */}
      {showSettingsModal && currentGroup && (
        <GroupSettingsModal
          group={currentGroup}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* Rollover Dialog */}
      {showRolloverDialog && currentGroup && currentTier && (
        <RolloverDialog
          groupId={currentGroup.id}
          currentTier={currentTier}
          existingTierIds={existingTierIds}
          onClose={() => setShowRolloverDialog(false)}
        />
      )}

      {/* Delete Tier Confirmation */}
      {showDeleteTierConfirm && currentGroup && currentTier && (
        <DeleteTierModal
          groupId={currentGroup.id}
          tierSnapshotId={currentTier.id}
          tierId={currentTier.tierId}
          onClose={() => setShowDeleteTierConfirm(false)}
          onDeleted={handleTierDeleted}
        />
      )}

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp
        isOpen={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
      />
    </div>
  );
}
