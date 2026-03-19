/**
 * Analytics Collector
 *
 * Buffers user interaction events and sends them to the backend in batches.
 * Respects Do Not Track. Uses direct fetch() to avoid circular dependencies
 * with the api helper and to prevent analytics failures from triggering error toasts.
 */

import { eventBus, Events } from '../lib/eventBus';
import { API_BASE_URL } from '../config';

interface AnalyticsEvent {
  category: string;
  name: string;
  data?: Record<string, unknown>;
  pageUrl: string;
  timestamp: string;
}

class AnalyticsCollector {
  private buffer: AnalyticsEvent[] = [];
  private sessionId: string;
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private enabled: boolean;

  constructor() {
    // Generate session ID or restore from sessionStorage
    this.sessionId = sessionStorage.getItem('analytics_session_id') || crypto.randomUUID();
    sessionStorage.setItem('analytics_session_id', this.sessionId);
    // Respect Do Not Track
    this.enabled = navigator.doNotTrack !== '1';
  }

  init(): void {
    if (!this.enabled) return;

    // Subscribe to existing event bus events
    eventBus.on(Events.PLAYER_UPDATED, (data) => this.track('action', 'player_update', data as Record<string, unknown>));
    eventBus.on(Events.PLAYER_GEAR_CHANGED, (data) => this.track('action', 'player_gear_changed', data as Record<string, unknown>));
    eventBus.on(Events.LOOT_LOGGED, (data) => this.track('action', 'loot_logged', data as Record<string, unknown>));
    eventBus.on(Events.LOOT_DELETED, (data) => this.track('action', 'loot_deleted', data as Record<string, unknown>));
    eventBus.on(Events.MODAL_OPENED, (data) => this.track('navigation', 'modal_open', data as Record<string, unknown>));
    eventBus.on(Events.MODAL_CLOSED, (data) => this.track('navigation', 'modal_close', data as Record<string, unknown>));
    eventBus.on(Events.TIER_CHANGED, (data) => this.track('action', 'tier_changed', data as Record<string, unknown>));
    eventBus.on(Events.TIER_CREATED, (data) => this.track('admin', 'tier_create', data as Record<string, unknown>));
    eventBus.on(Events.MEMBER_ROLE_CHANGED, (data) => this.track('admin', 'member_role_changed', data as Record<string, unknown>));

    // Start 30s flush timer
    this.flushInterval = setInterval(() => this.flush(), 30_000);

    // Flush on page unload using fetch with keepalive (NOT sendBeacon)
    window.addEventListener('beforeunload', () => this.flush(true));
  }

  track(category: string, name: string, data?: Record<string, unknown>): void {
    if (!this.enabled) return;
    this.buffer.push({
      category,
      name,
      data,
      pageUrl: location.pathname,
      timestamp: new Date().toISOString(),
    });
  }

  private flush(isUnload = false): void {
    if (this.buffer.length === 0) return;
    const events = [...this.buffer];
    this.buffer = [];

    const body = JSON.stringify({
      sessionId: this.sessionId,
      events,
    });

    if (isUnload) {
      // Use fetch with keepalive for page unload -- supports credentials + CORS
      fetch(`${API_BASE_URL}/api/analytics/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        credentials: 'include',
        keepalive: true,
      }).catch(() => {}); // Best-effort on unload
    } else {
      fetch(`${API_BASE_URL}/api/analytics/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        credentials: 'include',
      }).catch(() => {
        // Re-add to buffer on failure (will retry next flush)
        this.buffer.unshift(...events);
      });
    }
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flush();
  }
}

export const analytics = new AnalyticsCollector();
