/**
 * Analytics Collector
 *
 * Buffers user interaction events and sends them to the backend in batches.
 * Respects Do Not Track. Uses direct fetch() to avoid circular dependencies
 * with the api helper and to prevent analytics failures from triggering error toasts.
 */

import { eventBus, Events } from '../lib/eventBus';
import { API_BASE_URL } from '../config';
import { getCSRFToken } from './api';

interface AnalyticsEvent {
  category: string;
  name: string;
  data?: Record<string, unknown>;
  pageUrl: string;
}

/** Maximum events per batch (backend enforces max_length=50). */
const MAX_BATCH_SIZE = 50;
/** Maximum buffer size to prevent memory leaks. */
const MAX_BUFFER_SIZE = 200;

class AnalyticsCollector {
  private buffer: AnalyticsEvent[] = [];
  private sessionId: string;
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private enabled: boolean;
  private initialized = false;

  constructor() {
    if (typeof window === 'undefined') {
      this.sessionId = '';
      this.enabled = false;
      return;
    }
    // Generate session ID or restore from sessionStorage
    this.sessionId = sessionStorage.getItem('analytics_session_id') || crypto.randomUUID();
    sessionStorage.setItem('analytics_session_id', this.sessionId);
    // Respect Do Not Track
    this.enabled = navigator.doNotTrack !== '1';
  }

  init(): void {
    if (!this.enabled || this.initialized) return;
    this.initialized = true;

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
    });
  }

  private flush(isUnload = false): void {
    if (this.buffer.length === 0) return;

    // Cap buffer to prevent memory leaks
    if (this.buffer.length > MAX_BUFFER_SIZE) {
      this.buffer = this.buffer.slice(-MAX_BUFFER_SIZE);
    }

    const allEvents = [...this.buffer];
    this.buffer = [];

    // Chunk into batches of MAX_BATCH_SIZE to respect backend limit
    for (let i = 0; i < allEvents.length; i += MAX_BATCH_SIZE) {
      const chunk = allEvents.slice(i, i + MAX_BATCH_SIZE);
      const csrfToken = getCSRFToken();
      const body = JSON.stringify({
        sessionId: this.sessionId,
        events: chunk.map(e => ({
          eventCategory: e.category,
          eventName: e.name,
          eventData: e.data,
          pageUrl: e.pageUrl,
        })),
      });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      if (isUnload) {
        // Use fetch with keepalive for page unload -- supports credentials + CORS
        fetch(`${API_BASE_URL}/api/analytics/events`, {
          method: 'POST',
          headers,
          body,
          credentials: 'include',
          keepalive: true,
        }).catch(() => {}); // Best-effort on unload
      } else {
        fetch(`${API_BASE_URL}/api/analytics/events`, {
          method: 'POST',
          headers,
          body,
          credentials: 'include',
        }).catch(() => {
          // Re-add to buffer on failure, but only if under cap
          if (this.buffer.length < MAX_BUFFER_SIZE) {
            this.buffer.unshift(...chunk.slice(0, MAX_BUFFER_SIZE - this.buffer.length));
          }
        });
      }
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
