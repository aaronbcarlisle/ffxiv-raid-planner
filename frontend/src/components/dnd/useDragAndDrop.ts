import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { DropMode } from './collisionDetection';
import type { SnapshotPlayer } from '../../types';
import { getGroupFromPosition, swapPositionGroup } from '../../utils/calculations';

export interface DragState {
  activeId: string | null;
  overId: string | null;
  dropMode: DropMode | null;
}

export interface PlayerUpdate {
  playerId: string;
  data: Partial<SnapshotPlayer>;
}

interface UseDragAndDropOptions {
  players: SnapshotPlayer[];
  groupView: boolean;
  canEdit: boolean;
  disabled?: boolean; // Disable DnD when modal is open
  onReorder: (updates: PlayerUpdate[]) => Promise<void>;
}

const EDGE_THRESHOLD = 0.2; // 20% on each side for insert mode

export function useDragAndDrop({
  players,
  groupView,
  canEdit,
  disabled = false,
  onReorder,
}: UseDragAndDropOptions) {
  // Drag state
  const [dragState, setDragState] = useState<DragState>({
    activeId: null,
    overId: null,
    dropMode: null,
  });

  // Track actual pointer position via document listener
  const pointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY };

      // Recalculate dropMode continuously while dragging over a player card
      if (dragState.activeId && dragState.overId && !dragState.overId.startsWith('edge-')) {
        const element = document.querySelector(`[data-droppable-id="${dragState.overId}"]`);
        if (element) {
          const rect = element.getBoundingClientRect();
          const relativeX = e.clientX - rect.left;
          const percentage = relativeX / rect.width;

          let newDropMode: DropMode;
          if (percentage < EDGE_THRESHOLD) {
            newDropMode = 'insert-before';
          } else if (percentage > 1 - EDGE_THRESHOLD) {
            newDropMode = 'insert-after';
          } else {
            newDropMode = 'swap';
          }

          // Only update if changed to avoid unnecessary re-renders
          if (newDropMode !== dragState.dropMode) {
            setDragState(prev => ({ ...prev, dropMode: newDropMode }));
          }
        }
      }
    };

    document.addEventListener('pointermove', handlePointerMove);
    return () => document.removeEventListener('pointermove', handlePointerMove);
  }, [dragState.activeId, dragState.overId, dragState.dropMode]);

  // Sensors - use impossibly high activation distance when disabled
  // This keeps array size constant to avoid React useEffect warnings from @dnd-kit
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: disabled ? 999999 : 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Calculate drop mode based on pointer position relative to element
  const calculateDropMode = useCallback((elementId: string): DropMode | null => {
    const element = document.querySelector(`[data-droppable-id="${elementId}"]`);
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    const pointerX = pointerRef.current.x;
    const relativeX = pointerX - rect.left;
    const percentage = relativeX / rect.width;

    if (percentage < EDGE_THRESHOLD) return 'insert-before';
    if (percentage > 1 - EDGE_THRESHOLD) return 'insert-after';
    return 'swap';
  }, []);

  // Event handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDragState({
      activeId: event.active.id as string,
      overId: null,
      dropMode: null,
    });
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id as string | null;

    if (!overId || overId === dragState.activeId) {
      setDragState(prev => ({
        ...prev,
        overId: null,
        dropMode: null,
      }));
      return;
    }

    // Check if this is an edge drop zone
    if (overId.startsWith('edge-')) {
      setDragState(prev => ({
        ...prev,
        overId,
        dropMode: overId.includes('start') ? 'insert-before' : 'insert-after',
      }));
      return;
    }

    // Calculate drop mode for player cards
    const dropMode = calculateDropMode(overId);
    setDragState(prev => ({
      ...prev,
      overId,
      dropMode,
    }));
  }, [dragState.activeId, calculateDropMode]);

  const handleDragEnd = useCallback(async (_event: DragEndEvent) => {
    const { activeId, overId, dropMode } = dragState;

    // Clear state first
    setDragState({
      activeId: null,
      overId: null,
      dropMode: null,
    });

    // Validate
    if (!activeId || !overId || activeId === overId || !dropMode) return;

    const activePlayer = players.find(p => p.id === activeId);
    if (!activePlayer) return;

    // Handle edge drop zones
    if (overId.startsWith('edge-')) {
      const updates = calculateEdgeDropUpdates(players, activeId, overId, groupView);
      if (updates.length > 0) {
        await onReorder(updates);
      }
      return;
    }

    // Handle player card drops
    const overPlayer = players.find(p => p.id === overId);
    if (!overPlayer) return;

    let updates: PlayerUpdate[];

    if (dropMode === 'swap') {
      updates = calculateSwapUpdates(activePlayer, overPlayer, groupView);
    } else {
      updates = calculateInsertUpdates(players, activePlayer, overPlayer, dropMode, groupView);
    }

    if (updates.length > 0) {
      await onReorder(updates);
    }
  }, [dragState, players, groupView, onReorder]);

  const handleDragCancel = useCallback(() => {
    setDragState({
      activeId: null,
      overId: null,
      dropMode: null,
    });
  }, []);

  // Memoized player IDs for droppable registration
  const playerIds = useMemo(() => players.map(p => p.id), [players]);

  return {
    sensors,
    dragState,
    playerIds,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    canEdit,
  };
}

/**
 * Calculate updates for swapping two players
 */
function calculateSwapUpdates(
  activePlayer: SnapshotPlayer,
  overPlayer: SnapshotPlayer,
  groupView: boolean
): PlayerUpdate[] {
  const updates: PlayerUpdate[] = [
    { playerId: activePlayer.id, data: { sortOrder: overPlayer.sortOrder } },
    { playerId: overPlayer.id, data: { sortOrder: activePlayer.sortOrder } },
  ];

  // Handle cross-group position swap in G1/G2 view
  if (groupView) {
    const activeGroup = getGroupFromPosition(activePlayer.position);
    const overGroup = getGroupFromPosition(overPlayer.position);

    if (activeGroup && overGroup && activeGroup !== overGroup) {
      if (activePlayer.position) {
        updates[0].data.position = swapPositionGroup(activePlayer.position) as SnapshotPlayer['position'];
      }
      if (overPlayer.position) {
        updates[1].data.position = swapPositionGroup(overPlayer.position) as SnapshotPlayer['position'];
      }
    }
  }

  return updates;
}

/**
 * Calculate updates for inserting a player before/after another
 */
function calculateInsertUpdates(
  players: SnapshotPlayer[],
  activePlayer: SnapshotPlayer,
  overPlayer: SnapshotPlayer,
  dropMode: 'insert-before' | 'insert-after',
  groupView: boolean
): PlayerUpdate[] {
  // Sort players by current sortOrder
  const sortedPlayers = [...players].sort((a, b) => a.sortOrder - b.sortOrder);
  const activeIndex = sortedPlayers.findIndex(p => p.id === activePlayer.id);
  const overIndex = sortedPlayers.findIndex(p => p.id === overPlayer.id);

  // Calculate target position
  let targetIndex = dropMode === 'insert-before' ? overIndex : overIndex + 1;
  if (activeIndex < targetIndex) {
    targetIndex--;
  }

  // Remove active from list and insert at target
  const withoutActive = sortedPlayers.filter(p => p.id !== activePlayer.id);
  withoutActive.splice(targetIndex, 0, activePlayer);

  // Build updates for all affected players
  const updates: PlayerUpdate[] = [];
  const activeGroup = getGroupFromPosition(activePlayer.position);
  const overGroup = getGroupFromPosition(overPlayer.position);

  withoutActive.forEach((player, index) => {
    if (player.sortOrder !== index) {
      const playerUpdate: PlayerUpdate = {
        playerId: player.id,
        data: { sortOrder: index },
      };

      // Handle cross-group position update for the moved player
      if (
        player.id === activePlayer.id &&
        groupView &&
        activeGroup &&
        overGroup &&
        activeGroup !== overGroup &&
        activePlayer.position
      ) {
        playerUpdate.data.position = swapPositionGroup(activePlayer.position) as SnapshotPlayer['position'];
      }

      updates.push(playerUpdate);
    }
  });

  return updates;
}

/**
 * Calculate updates for dropping on edge zones (start/end of list)
 */
function calculateEdgeDropUpdates(
  players: SnapshotPlayer[],
  activeId: string,
  edgeZoneId: string,
  groupView: boolean
): PlayerUpdate[] {
  const activePlayer = players.find(p => p.id === activeId);
  if (!activePlayer) return [];

  const sortedPlayers = [...players].sort((a, b) => a.sortOrder - b.sortOrder);
  const activeIndex = sortedPlayers.findIndex(p => p.id === activeId);

  // Determine target position and group
  let targetIndex: number;
  let targetGroup: 1 | 2 | null = null;

  if (edgeZoneId === 'edge-start' || edgeZoneId === 'edge-start-g1') {
    targetIndex = 0;
    if (edgeZoneId === 'edge-start-g1') targetGroup = 1;
  } else if (edgeZoneId === 'edge-end') {
    targetIndex = sortedPlayers.length - 1;
  } else if (edgeZoneId === 'edge-end-g1') {
    const g1Players = sortedPlayers.filter(p => getGroupFromPosition(p.position) === 1);
    targetIndex = g1Players.length > 0
      ? sortedPlayers.findIndex(p => p.id === g1Players[g1Players.length - 1].id)
      : 0;
    targetGroup = 1;
  } else if (edgeZoneId === 'edge-start-g2') {
    const firstG2Index = sortedPlayers.findIndex(p => getGroupFromPosition(p.position) === 2);
    targetIndex = firstG2Index >= 0 ? firstG2Index : sortedPlayers.length;
    targetGroup = 2;
  } else if (edgeZoneId === 'edge-end-g2') {
    targetIndex = sortedPlayers.length - 1;
    targetGroup = 2;
  } else {
    return [];
  }

  // Adjust if moving from before target
  if (activeIndex < targetIndex) {
    targetIndex--;
  }

  // Build updates
  const updates: PlayerUpdate[] = [];
  const withoutActive = sortedPlayers.filter(p => p.id !== activeId);
  withoutActive.splice(targetIndex, 0, activePlayer);

  const activeGroup = getGroupFromPosition(activePlayer.position);

  withoutActive.forEach((player, index) => {
    if (player.sortOrder !== index) {
      const playerUpdate: PlayerUpdate = {
        playerId: player.id,
        data: { sortOrder: index },
      };

      // Update position if moving to different group
      if (
        player.id === activePlayer.id &&
        groupView &&
        targetGroup &&
        activeGroup !== targetGroup &&
        activePlayer.position
      ) {
        playerUpdate.data.position = swapPositionGroup(activePlayer.position) as SnapshotPlayer['position'];
      }

      updates.push(playerUpdate);
    }
  });

  return updates;
}
