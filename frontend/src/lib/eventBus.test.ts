/**
 * Unit tests for the event bus utility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eventBus, Events } from './eventBus';

describe('eventBus', () => {
  beforeEach(() => {
    // Clear all event subscriptions before each test
    eventBus.clear();
  });

  describe('on', () => {
    it('subscribes to an event', () => {
      const callback = vi.fn();
      eventBus.on('test-event', callback);

      eventBus.emit('test-event', { data: 'value' });

      expect(callback).toHaveBeenCalledWith({ data: 'value' });
    });

    it('returns an unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = eventBus.on('test-event', callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('unsubscribe prevents further callbacks', () => {
      const callback = vi.fn();
      const unsubscribe = eventBus.on('test-event', callback);

      eventBus.emit('test-event', 'first');
      unsubscribe();
      eventBus.emit('test-event', 'second');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('first');
    });

    it('allows multiple subscribers to same event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      eventBus.on('multi-event', callback1);
      eventBus.on('multi-event', callback2);

      eventBus.emit('multi-event', 'data');

      expect(callback1).toHaveBeenCalledWith('data');
      expect(callback2).toHaveBeenCalledWith('data');
    });

    it('allows subscribing to different events', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      eventBus.on('event-a', callback1);
      eventBus.on('event-b', callback2);

      eventBus.emit('event-a', 'a-data');
      eventBus.emit('event-b', 'b-data');

      expect(callback1).toHaveBeenCalledWith('a-data');
      expect(callback2).toHaveBeenCalledWith('b-data');
    });

    it('does not call callback for different events', () => {
      const callback = vi.fn();
      eventBus.on('event-a', callback);

      eventBus.emit('event-b', 'data');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('once', () => {
    it('subscribes and auto-unsubscribes after first call', () => {
      const callback = vi.fn();
      eventBus.once('once-event', callback);

      eventBus.emit('once-event', 'first');
      eventBus.emit('once-event', 'second');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('first');
    });

    it('returns an unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = eventBus.once('once-event', callback);

      unsubscribe();
      eventBus.emit('once-event', 'data');

      expect(callback).not.toHaveBeenCalled();
    });

    it('can be manually unsubscribed before being called', () => {
      const callback = vi.fn();
      const unsubscribe = eventBus.once('once-event', callback);

      unsubscribe();
      eventBus.emit('once-event', 'data');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('emit', () => {
    it('emits with data', () => {
      const callback = vi.fn();
      eventBus.on('data-event', callback);

      eventBus.emit('data-event', { key: 'value', num: 42 });

      expect(callback).toHaveBeenCalledWith({ key: 'value', num: 42 });
    });

    it('emits without data', () => {
      const callback = vi.fn();
      eventBus.on('no-data-event', callback);

      eventBus.emit('no-data-event');

      expect(callback).toHaveBeenCalledWith(undefined);
    });

    it('does nothing if no subscribers', () => {
      // Should not throw
      expect(() => eventBus.emit('no-subscribers')).not.toThrow();
    });

    it('calls all subscribers for an event', () => {
      const callbacks = [vi.fn(), vi.fn(), vi.fn()];
      callbacks.forEach((cb) => eventBus.on('multi', cb));

      eventBus.emit('multi', 'test');

      callbacks.forEach((cb) => {
        expect(cb).toHaveBeenCalledWith('test');
      });
    });
  });

  describe('off', () => {
    it('removes all subscribers for an event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      eventBus.on('remove-event', callback1);
      eventBus.on('remove-event', callback2);

      eventBus.off('remove-event');
      eventBus.emit('remove-event', 'data');

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });

    it('does not affect other events', () => {
      const callbackA = vi.fn();
      const callbackB = vi.fn();

      eventBus.on('event-a', callbackA);
      eventBus.on('event-b', callbackB);

      eventBus.off('event-a');
      eventBus.emit('event-a', 'a');
      eventBus.emit('event-b', 'b');

      expect(callbackA).not.toHaveBeenCalled();
      expect(callbackB).toHaveBeenCalledWith('b');
    });
  });

  describe('clear', () => {
    it('removes all subscribers for all events', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      eventBus.on('event-1', callback1);
      eventBus.on('event-2', callback2);

      eventBus.clear();
      eventBus.emit('event-1', 'data');
      eventBus.emit('event-2', 'data');

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  describe('listenerCount', () => {
    it('returns 0 for events with no subscribers', () => {
      expect(eventBus.listenerCount('nonexistent')).toBe(0);
    });

    it('returns correct count for subscribed events', () => {
      eventBus.on('counted', vi.fn());
      eventBus.on('counted', vi.fn());
      eventBus.on('counted', vi.fn());

      expect(eventBus.listenerCount('counted')).toBe(3);
    });

    it('updates count when unsubscribing', () => {
      const unsub1 = eventBus.on('counted', vi.fn());
      eventBus.on('counted', vi.fn());

      expect(eventBus.listenerCount('counted')).toBe(2);

      unsub1();

      expect(eventBus.listenerCount('counted')).toBe(1);
    });

    it('returns 0 after off() is called', () => {
      eventBus.on('counted', vi.fn());
      eventBus.on('counted', vi.fn());

      eventBus.off('counted');

      expect(eventBus.listenerCount('counted')).toBe(0);
    });
  });

  describe('type safety', () => {
    it('handles typed data correctly', () => {
      interface UserData {
        id: string;
        name: string;
      }

      const callback = vi.fn();
      eventBus.on<UserData>('user-event', callback);

      const userData: UserData = { id: '123', name: 'Test' };
      eventBus.emit<UserData>('user-event', userData);

      expect(callback).toHaveBeenCalledWith(userData);
    });
  });
});

describe('Events constants', () => {
  it('defines player events', () => {
    expect(Events.PLAYER_UPDATED).toBe('player:updated');
    expect(Events.PLAYER_GEAR_CHANGED).toBe('player:gear-changed');
  });

  it('defines loot events', () => {
    expect(Events.LOOT_LOGGED).toBe('loot:logged');
    expect(Events.LOOT_DELETED).toBe('loot:deleted');
  });

  it('defines UI events', () => {
    expect(Events.MODAL_OPENED).toBe('ui:modal-opened');
    expect(Events.MODAL_CLOSED).toBe('ui:modal-closed');
    expect(Events.REFRESH_DATA).toBe('ui:refresh-data');
  });

  it('defines tier events', () => {
    expect(Events.TIER_CHANGED).toBe('tier:changed');
    expect(Events.TIER_CREATED).toBe('tier:created');
  });
});

describe('eventBus integration', () => {
  beforeEach(() => {
    eventBus.clear();
  });

  it('works with predefined event names', () => {
    const callback = vi.fn();
    eventBus.on(Events.PLAYER_UPDATED, callback);

    eventBus.emit(Events.PLAYER_UPDATED, { playerId: '123' });

    expect(callback).toHaveBeenCalledWith({ playerId: '123' });
  });

  it('handles rapid successive events', () => {
    const callback = vi.fn();
    eventBus.on('rapid', callback);

    for (let i = 0; i < 100; i++) {
      eventBus.emit('rapid', i);
    }

    expect(callback).toHaveBeenCalledTimes(100);
  });

  it('handles unsubscribe during emit', () => {
    let unsubscribe: (() => void) | undefined;

    const callback1 = vi.fn(() => {
      if (unsubscribe) unsubscribe();
    });
    const callback2 = vi.fn();

    unsubscribe = eventBus.on('during-emit', callback1);
    eventBus.on('during-emit', callback2);

    // First emit - callback1 runs and unsubscribes itself
    eventBus.emit('during-emit', 'first');

    // Both should have been called on first emit
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);

    // Second emit - only callback2 should be called
    eventBus.emit('during-emit', 'second');

    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(2);
  });
});
