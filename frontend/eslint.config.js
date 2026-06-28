import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import designSystemPlugin from './eslint-design-system-plugin.js'
import boundaries from 'eslint-plugin-boundaries'

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
        { type: 'shared', pattern: 'src/components/(primitives|ui)/**' },
        { type: 'feature', pattern: 'src/components/!(primitives|ui)/**' },
        { type: 'app', pattern: '(src/pages|src/stores|src/services)/**' },
      ],
    },
    rules: {
      // Allow underscore-prefixed variables to be unused (common convention)
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // Layer boundary enforcement (F2): shared layer must not import features.
      // Rule renamed from boundaries/element-types in v5 to boundaries/dependencies in v6.
      // from/allow/disallow now use object selectors { type } with required `to` wrapper.
      'boundaries/dependencies': ['error', {
        default: 'allow',
        rules: [
          {
            from: { type: 'shared' },
            disallow: { to: { type: ['feature', 'app'] } },
            message:
              'Shared layer (primitives/ui) must not import from feature or app modules. Keep the shared layer leaf-level; the Ring-aware graph lands in F4.',
          },
        ],
      }],

      // Design system enforcement
      // Note: Disabled by default to allow gradual migration
      // Enable with 'error' once all violations are fixed
      'design-system/no-raw-button': 'warn',
      'design-system/no-raw-input': 'warn',
      'design-system/no-raw-select': 'warn',
      'design-system/no-raw-label': 'warn',
      'design-system/no-raw-textarea': 'warn',

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
])
