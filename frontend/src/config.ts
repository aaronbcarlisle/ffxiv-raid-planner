/**
 * Application Configuration
 *
 * Central place for environment-based configuration.
 * This file should NOT import from stores to avoid circular dependencies.
 */

// Get API base URL from environment or default to localhost
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

// Environment detection
export const isBrowser = typeof window !== 'undefined';
export const hostname = isBrowser ? window.location.hostname : '';
export const isProduction = isBrowser && hostname !== 'localhost' && hostname !== '127.0.0.1';
export const isLocalhostApi = API_BASE_URL.includes('localhost');

// Discord integration
export const DISCORD_BUG_REPORT_URL =
  import.meta.env.VITE_DISCORD_BUG_REPORT_URL ||
  'https://discord.com/channels/1461997093399957527/1462005836841750587';
