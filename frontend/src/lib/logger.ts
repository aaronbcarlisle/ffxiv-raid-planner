/**
 * Frontend Logger Utility
 *
 * Provides consistent logging across the application with environment awareness.
 * Only logs debug/info in development mode to keep production clean.
 */

const isDev = import.meta.env.DEV;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogArgs = unknown[];

/**
 * Indices for extracting time portion from ISO 8601 string.
 * Date.toISOString() returns "YYYY-MM-DDTHH:MM:SS.mmmZ"
 * - Index 11 is 'H' (start of hours)
 * - Index 23 is 'Z' (exclusive end, after milliseconds)
 * Result: "HH:MM:SS.mmm"
 */
const ISO_TIME_START = 11;
const ISO_TIME_END = 23;

/**
 * Format a timestamp for log messages
 * Extracts "HH:MM:SS.mmm" from the ISO 8601 string.
 */
function timestamp(): string {
  return new Date().toISOString().slice(ISO_TIME_START, ISO_TIME_END);
}

/**
 * Format log arguments with optional context
 */
function formatArgs(level: LogLevel, context: string | null, args: LogArgs): LogArgs {
  const prefix = context ? `[${timestamp()}] [${level.toUpperCase()}] [${context}]` : `[${timestamp()}] [${level.toUpperCase()}]`;
  return [prefix, ...args];
}

/**
 * Main logger object with level-specific methods
 */
export const logger = {
  /**
   * Debug level - only in development
   * Early return to avoid unnecessary string formatting in production
   */
  debug: (...args: LogArgs) => {
    if (!isDev) return;
    console.log(...formatArgs('debug', null, args));
  },

  /**
   * Info level - only in development
   * Early return to avoid unnecessary string formatting in production
   */
  info: (...args: LogArgs) => {
    if (!isDev) return;
    console.info(...formatArgs('info', null, args));
  },

  /**
   * Warning level - always logged
   */
  warn: (...args: LogArgs) => {
    console.warn(...formatArgs('warn', null, args));
  },

  /**
   * Error level - always logged
   */
  error: (...args: LogArgs) => {
    console.error(...formatArgs('error', null, args));
  },

  /**
   * Create a scoped logger with a fixed context prefix
   *
   * @example
   * const log = logger.scope('TierStore');
   * log.debug('Fetching tiers...'); // [timestamp] [DEBUG] [TierStore] Fetching tiers...
   */
  scope: (context: string) => ({
    debug: (...args: LogArgs) => {
      if (!isDev) return;
      console.log(...formatArgs('debug', context, args));
    },
    info: (...args: LogArgs) => {
      if (!isDev) return;
      console.info(...formatArgs('info', context, args));
    },
    warn: (...args: LogArgs) => {
      console.warn(...formatArgs('warn', context, args));
    },
    error: (...args: LogArgs) => {
      console.error(...formatArgs('error', context, args));
    },
  }),

  /**
   * Log a performance measurement
   *
   * @example
   * const end = logger.time('fetchTiers');
   * await fetchTiers();
   * end(); // Logs: [timestamp] [DEBUG] [PERF] fetchTiers took 123ms
   */
  time: (label: string) => {
    if (!isDev) return () => {};

    const start = performance.now();
    return () => {
      const duration = Math.round(performance.now() - start);
      console.log(...formatArgs('debug', 'PERF', [`${label} took ${duration}ms`]));
    };
  },

  /**
   * Group related log messages
   *
   * @example
   * logger.group('API Request', () => {
   *   logger.debug('URL:', url);
   *   logger.debug('Method:', method);
   * });
   */
  group: (label: string, fn: () => void) => {
    if (isDev) {
      console.group(label);
      fn();
      console.groupEnd();
    }
  },

  /**
   * Collapsed group (expandable in console)
   */
  groupCollapsed: (label: string, fn: () => void) => {
    if (isDev) {
      console.groupCollapsed(label);
      fn();
      console.groupEnd();
    }
  },
};

// Type export for external use
export type Logger = typeof logger;
export type ScopedLogger = ReturnType<typeof logger.scope>;
