import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import designSystemPlugin from './eslint-design-system-plugin.js'

export default defineConfig([
  globalIgnores(['dist']),
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

      // Design system enforcement
      // Note: Disabled by default to allow gradual migration
      // Enable with 'error' once all violations are fixed
      'design-system/no-raw-button': 'warn',
      'design-system/no-raw-input': 'warn',
      'design-system/no-raw-select': 'warn',
      'design-system/no-raw-label': 'warn',
      'design-system/no-raw-textarea': 'warn',
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
])
