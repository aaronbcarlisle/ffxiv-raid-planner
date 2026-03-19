/**
 * Error Reporter
 *
 * Captures unhandled errors and unhandled promise rejections, deduplicates them
 * client-side, and reports them to the backend analytics endpoint.
 * Uses direct fetch() to avoid circular dependencies and to prevent error
 * reporting failures from triggering additional error toasts or recursion.
 */

import { parseApiError } from '../lib/errorHandler';
import { API_BASE_URL } from '../config';
import { getCSRFToken } from './api';

class ErrorReporter {
  private recentFingerprints = new Map<string, number>(); // fingerprint -> timestamp
  private enabled: boolean;
  private initialized = false;

  constructor() {
    this.enabled = typeof window !== 'undefined';
  }

  init(): void {
    if (!this.enabled || this.initialized) return;
    this.initialized = true;

    // Use addEventListener to avoid overwriting existing handlers
    window.addEventListener('error', (event) => {
      this.report('js_error', event.error || event.message, {
        source: event.filename,
        line: event.lineno,
        col: event.colno,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.report('unhandled_rejection', event.reason);
    });
  }

  report(type: string, error: unknown, extra?: Record<string, unknown>): void {
    if (!this.enabled) return;

    const parsed = parseApiError(error);
    const fingerprint = this.computeFingerprint(type, parsed.message);

    // Client-side dedup: skip if same fingerprint within 5 minutes
    const lastSent = this.recentFingerprints.get(fingerprint);
    if (lastSent && Date.now() - lastSent < 300_000) return;
    this.recentFingerprints.set(fingerprint, Date.now());

    // Clean old fingerprints (prevent memory leak)
    if (this.recentFingerprints.size > 100) {
      const cutoff = Date.now() - 300_000;
      for (const [fp, ts] of this.recentFingerprints) {
        if (ts < cutoff) this.recentFingerprints.delete(fp);
      }
    }

    const body = JSON.stringify({
      fingerprint,
      errorType: type,
      message: parsed.message,
      stackTrace: error instanceof Error ? error.stack : undefined,
      context: {
        url: location.href,
        browser: navigator.userAgent,
        ...extra,
      },
      severity: parsed.status && parsed.status >= 500 ? 'critical' : 'error',
    });

    // Fire-and-forget -- never recurse on error reporting failures
    const csrfToken = getCSRFToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
    fetch(`${API_BASE_URL}/api/analytics/errors`, {
      method: 'POST',
      headers,
      body,
      credentials: 'include',
    }).catch(() => {});
  }

  private computeFingerprint(type: string, message: string): string {
    // Simple hash for client-side fingerprinting
    const input = `${type}:${message}:${location.pathname}`;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}

export const errorReporter = new ErrorReporter();
