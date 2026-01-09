/**
 * Event Bus Utility
 *
 * A lightweight publish-subscribe system for decoupled component communication.
 * Useful for cross-component events that don't fit into Zustand state.
 */

import { useEffect, useCallback, useRef } from 'react';

type EventCallback<T = unknown> = (data: T) => void;

/**
 * Create a type-safe event bus instance
 */
function createEventBus() {
  const events = new Map<string, Set<EventCallback>>();

  return {
    /**
     * Subscribe to an event
     *
     * @returns Unsubscribe function
     * @example
     * const unsub = eventBus.on('player:updated', (data) => console.log(data));
     * // Later: unsub();
     */
    on<T>(event: string, callback: EventCallback<T>): () => void {
      if (!events.has(event)) {
        events.set(event, new Set());
      }
      events.get(event)!.add(callback as EventCallback);

      // Return unsubscribe function
      return () => {
        events.get(event)?.delete(callback as EventCallback);
      };
    },

    /**
     * Subscribe to an event once (auto-unsubscribes after first call)
     */
    once<T>(event: string, callback: EventCallback<T>): () => void {
      const wrapper = (data: T) => {
        unsubscribe();
        callback(data);
      };
      const unsubscribe = this.on(event, wrapper);
      return unsubscribe;
    },

    /**
     * Emit an event to all subscribers
     *
     * @example
     * eventBus.emit('player:updated', { playerId: '123', changes: { name: 'New Name' } });
     */
    emit<T>(event: string, data?: T): void {
      events.get(event)?.forEach((cb) => cb(data));
    },

    /**
     * Remove all subscribers for an event
     */
    off(event: string): void {
      events.delete(event);
    },

    /**
     * Remove all subscribers for all events
     */
    clear(): void {
      events.clear();
    },

    /**
     * Get subscriber count for an event (useful for debugging)
     */
    listenerCount(event: string): number {
      return events.get(event)?.size ?? 0;
    },
  };
}

/**
 * Global event bus instance
 */
export const eventBus = createEventBus();

/**
 * React hook for subscribing to events with automatic cleanup
 *
 * @example
 * function MyComponent() {
 *   useEventBus('loot:logged', (data) => {
 *     console.log('Loot was logged:', data);
 *   });
 * }
 */
export function useEventBus<T>(event: string, handler: (data: T) => void): void {
  // Use ref to always have access to latest handler without re-subscribing
  const handlerRef = useRef(handler);

  // Keep ref updated with latest handler
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  // Stable callback that calls the ref
  const stableHandler = useCallback((data: T) => {
    handlerRef.current(data);
  }, []);

  useEffect(() => {
    return eventBus.on<T>(event, stableHandler);
  }, [event, stableHandler]);
}

/**
 * Common event types for the application
 * Use these as keys when emitting/subscribing to events
 */
export const Events = {
  // Player events
  PLAYER_UPDATED: 'player:updated',
  PLAYER_GEAR_CHANGED: 'player:gear-changed',

  // Loot events
  LOOT_LOGGED: 'loot:logged',
  LOOT_DELETED: 'loot:deleted',

  // UI events
  MODAL_OPENED: 'ui:modal-opened',
  MODAL_CLOSED: 'ui:modal-closed',
  REFRESH_DATA: 'ui:refresh-data',

  // Tier events
  TIER_CHANGED: 'tier:changed',
  TIER_CREATED: 'tier:created',
} as const;

// Type for event names
export type EventName = typeof Events[keyof typeof Events];
