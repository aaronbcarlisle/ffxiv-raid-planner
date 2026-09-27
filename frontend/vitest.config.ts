import { defineConfig } from 'vitest/config';

// Pin the zone before any worker spawns so local runs match CI (UTC):
// timezone-sensitive assertions (e.g. Schedule.test.tsx's heatmap cell,
// bounded by the local PRIME_HOURS window) must not depend on the host.
// Tests guarding a `timeZone: 'UTC'` formatter need a UTC-negative zone to
// bite; they switch per file with vi.hoisted (LootHistoryTable,
// WeekScopeControl, WeekNavigatorStrip).
process.env.TZ = 'UTC';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.mjs'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
