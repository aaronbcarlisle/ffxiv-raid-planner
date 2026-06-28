import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import designSystemPlugin from './eslint-design-system-plugin.js'
import boundaries from 'eslint-plugin-boundaries'
import jsxA11y from 'eslint-plugin-jsx-a11y'

// jsx-a11y recommended, downgraded to warn for the legacy backlog. The shared
// layer re-locks these to error below (it is small and clean).
const a11yRecommendedWarn = Object.fromEntries(
  Object.keys(jsxA11y.flatConfigs.recommended.rules).map((rule) => [rule, 'warn']),
)

export default defineConfig([
  globalIgnores(['dist', 'e2e', 'playwright-report', 'test-results']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'design-system': designSystemPlugin,
      boundaries,
      'jsx-a11y': jsxA11y,
    },
    settings: {
      // Tell eslint-module-utils to resolve .ts/.tsx in addition to .js/.jsx
      // so that eslint-plugin-boundaries can identify imported element types.
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      },
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': [
        { type: 'shared',   pattern: 'src/components/(primitives|ui)/**' },
        { type: 'shell',    pattern: 'src/components/(layout|dnd|docs)/**' },
        { type: 'person',   pattern: 'src/components/(profile|auth|dashboard)/**' },
        { type: 'ring0',    pattern: 'src/components/(roster|player|bis|loot|priority|weapon-priority|history|wizard|team|static-group|group)/**' },
        { type: 'ring1',    pattern: 'src/components/(schedule|split-clear)/**' },
        { type: 'ring3',    pattern: 'src/components/(mount-farms|collections)/**' },
        { type: 'admin',    pattern: 'src/components/admin/**' },
        { type: 'settings', pattern: 'src/components/settings/**' }, // mixed, person-primary; separate so its debt is visible
        { type: 'store',    pattern: 'src/stores/**', mode: 'file' },
        { type: 'page',     pattern: 'src/pages/**', mode: 'file' },
        { type: 'service',  pattern: 'src/services/**', mode: 'file' },
      ],
    },
    rules: {
      // jsx-a11y recommended at warn globally; shared layer locks these to error below.
      ...a11yRecommendedWarn,

      // Allow underscore-prefixed variables to be unused (common convention)
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // Layer boundary enforcement (F2 carry-over + F4 store rules).
      // Ring-inward rules are added in F4 Task 4; default stays 'allow' so the
      // tree remains green until suppressions are baselined.
      //
      // NOTE: importKind is a DEPRECATED rule-level field in v6.0.2 (it fires a
      // console warning and will be removed in v7). The correct v6 selector-level
      // syntax is `dependency: { kind: 'value' }` inside `disallow` / `allow`.
      // The disallow policy schema has `additionalProperties: false`, so placing
      // `importKind` inside `disallow` would fail schema validation.
      'boundaries/dependencies': ['error', {
        default: 'allow',
        // Files in the same element (e.g., two stores) share the same elementPath
        // under mode:'file', so eslint-plugin-boundaries treats them as "internal"
        // and skips them unless checkInternals is enabled. The store→store rule
        // requires this to fire on intra-stores/ imports (e.g., viewAsStore→authStore).
        checkInternals: true,
        rules: [
          // F2 carry-over: shared leaf imports nothing outward.
          {
            from: { type: 'shared' },
            disallow: { to: { type: ['shell', 'person', 'ring0', 'ring1', 'ring3', 'admin', 'settings', 'store', 'page', 'service'] } },
            message: 'Shared layer (primitives/ui) must not import feature/app modules (incl. stores/pages/services). Keep it leaf-level.',
          },
          // One store per domain: a store must not import another store.
          {
            from: { type: 'store' },
            disallow: { to: { type: 'store' } },
            message: 'One store per domain: a store must not import another store. Coordinate via utils/ (see utils/lootCoordination.ts). Single documented exception: viewAsStore→authStore.',
          },
          // Data layer must not depend on the view layer — value imports only.
          // Type-only imports erase at runtime (no coupling) and are permitted.
          // `dependency: { kind: 'value' }` is the v6 selector-level mechanism
          // for filtering by import kind (replaces deprecated rule-level importKind).
          {
            from: { type: 'store' },
            disallow: { to: { type: ['shared', 'shell', 'person', 'ring0', 'ring1', 'ring3', 'admin', 'settings'] }, dependency: { kind: 'value' } },
            message: 'A store (data layer) must not import a component (view layer). Type-only imports are allowed.',
          },

          // F4 Task 4: Ring-inward-only rules (fail-on-new).
          // Grandfathered debt is in eslint-suppressions.json; new outward edges
          // will fail immediately. admin/page/service have NO from-rule (exempt).
          // NOTE: no same-type disallows here — checkInternals is active globally,
          // so a same-type disallow would wrongly catch intra-ring same-subdir imports.
          {
            from: { type: 'shell' },
            disallow: { to: { type: ['person', 'ring0', 'ring1', 'ring3', 'admin', 'settings'] } },
            message: 'Shell/platform imports inward only (shared). It must not import Person or product-ring features.',
          },
          {
            from: { type: ['person', 'settings'] }, // settings is person-primary (mixed)
            disallow: { to: { type: ['ring0', 'ring1', 'ring3', 'admin'] } },
            message: 'Person layer must not import product-ring features (rings depend on Person, not the reverse).',
          },
          {
            from: { type: 'ring0' },
            disallow: { to: { type: ['ring1', 'ring3', 'admin'] } },
            message: 'Ring 0 (core loop) must not import outer rings or admin-ops.',
          },
          {
            from: { type: 'ring1' },
            disallow: { to: { type: ['ring3', 'admin'] } },
            message: 'Ring 1 must not import Ring 3 or admin-ops.',
          },
          {
            from: { type: 'ring3' },
            disallow: { to: { type: ['admin'] } },
            message: 'Product rings must not import the admin-ops surface.',
          },
        ],
      }],

      // Design system enforcement
      // Note: Disabled by default to allow gradual migration
      // Enable with 'error' once all violations are fixed
      'design-system/no-raw-button': 'warn',
      'design-system/no-raw-input': 'warn',
      'design-system/no-raw-select': 'error',
      'design-system/no-raw-label': 'warn',
      'design-system/no-raw-textarea': 'error',

      // Color / typography / interaction-semantics enforcement.
      // Start as 'warn' so legacy code stays green; the Plan L per-area sweeps
      // ratchet each directory to 'error' as it is cleaned (Wave 4).
      'design-system/no-arbitrary-color': 'warn',
      'design-system/no-tiny-text': 'warn',
      'design-system/no-noninteractive-onclick': 'warn',
      'design-system/no-cursor-pointer-without-role': 'warn',
    },
  },
  // Exclude component files that define these primitives
  {
    files: [
      'src/components/primitives/**/*.tsx',
      'src/components/ui/Input.tsx',
      'src/components/ui/Select.tsx',
      'src/components/ui/Checkbox.tsx',
      'src/components/ui/Label.tsx',
      'src/components/ui/TextArea.tsx',
      'src/components/ui/NumberInput.tsx',
      'src/components/ui/RadioGroup.tsx',
      'src/pages/DesignSystem.tsx',
    ],
    rules: {
      'design-system/no-raw-button': 'off',
      'design-system/no-raw-input': 'off',
      'design-system/no-raw-select': 'off',
      'design-system/no-raw-label': 'off',
      'design-system/no-raw-textarea': 'off',
    },
  },
  // index.css is the canonical token-definition file; the design-system page
  // legitimately demonstrates arbitrary values. Don't flag color/size there.
  {
    files: ['src/pages/DesignSystem.tsx'],
    rules: {
      'design-system/no-arbitrary-color': 'off',
      'design-system/no-tiny-text': 'off',
    },
  },
  // Shared layer is the design system's own surface — lock the color/type/
  // interaction rules at error so it cannot regress (F3 rewrites these files).
  // Raw-element rules are intentionally NOT locked here: primitives use raw
  // elements by design (see the off-block above).
  {
    files: ['src/components/primitives/**/*.{ts,tsx}', 'src/components/ui/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'design-system/no-arbitrary-color': 'error',
      'design-system/no-tiny-text': 'error',
      'design-system/no-noninteractive-onclick': 'error',
      'design-system/no-cursor-pointer-without-role': 'error',

      // jsx-a11y locked on the shared layer (verified clean in F2).
      ...jsxA11y.flatConfigs.recommended.rules,
    },
  },
  // Test files exercise raw elements and arbitrary values as fixtures; the
  // design-system rules target shipped UI, not test scaffolding. (Matches the
  // exclusion already in scripts/check-design-system.sh.)
  // Boundary rules are also off for tests: test files legitimately import across
  // element boundaries (e.g., store tests import multiple stores for integration
  // testing), and test code is not shipped, so architectural coupling rules don't
  // apply there.
  {
    files: ['**/*.test.{ts,tsx}', '**/__tests__/**'],
    rules: {
      'design-system/no-raw-button': 'off',
      'design-system/no-raw-input': 'off',
      'design-system/no-raw-select': 'off',
      'design-system/no-raw-label': 'off',
      'design-system/no-raw-textarea': 'off',
      'design-system/no-arbitrary-color': 'off',
      'design-system/no-tiny-text': 'off',
      'design-system/no-noninteractive-onclick': 'off',
      'design-system/no-cursor-pointer-without-role': 'off',
      'boundaries/dependencies': 'off',
    },
  },
  // Ring-governed modules must import cross-domain via RELATIVE paths so
  // eslint-plugin-boundaries can resolve and check them. The `@` alias
  // (vite.config.ts) is not resolved by the boundaries node resolver, so an
  // `@/components/...` import would silently bypass the ring graph. Forbid it here.
  // src/pages/** is exempt: pages legitimately use the @ alias and are outside
  // the ring graph (no from-rule applies to them as importers).
  {
    files: ['src/components/**/*.{ts,tsx}', 'src/stores/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          // `**` (not `*`) so deep paths like `@/components/ui/GearStatusCircle`
          // are caught, not just one-segment `@/components/x`; bare barrel
          // imports (`@/components`) are listed explicitly.
          group: ['@/components', '@/components/**', '@/stores', '@/stores/**'],
          message: 'Within components/ and stores/, import cross-domain via a RELATIVE path (../x), not the @ alias — the boundaries lint cannot resolve @ and would skip the ring check.',
        }],
      }],
    },
  },
])
