# Design System Enforcement Guide

This document explains how the FFXIV Raid Planner enforces design system compliance and provides recommendations for improvement.

## Current Enforcement Mechanisms

### 1. **Automated Checks (Bash Script)**

**Location:** `frontend/scripts/check-design-system.sh`

**What it catches:**
- Raw HTML elements (`<button>`, `<input>`, `<select>`, `<label>`, `<textarea>`)
- Hardcoded hex colors (30+ patterns)

**When it runs:**
- Manual: `pnpm check:design-system`
- CI/CD: `pnpm check:design-system:strict` (fails build on violations)

**Limitations:**
- Post-hoc detection (violations already written)
- No IDE integration
- Can't auto-fix

### 2. **ESLint Rules (NEW)**

**Location:** `frontend/eslint-design-system-plugin.js`

**What it catches:**
- Same violations as bash script, but at development time
- Shows inline errors in your editor
- Respects `// design-system-ignore` comments

**Status:** Currently set to `warn` to allow gradual migration

**To enable strict mode:**
```js
// In eslint.config.js, change 'warn' to 'error'
'design-system/no-raw-button': 'error',
```

### 3. **Documentation**

- **Component Inventory:** `docs/UI_COMPONENTS.md` - Comprehensive reference
- **Visual Reference:** `/docs/design-system` - Interactive examples
- **CLAUDE.md:** Quick reference table for common components

---

## Architecture: How to Make Design System Changes Propagate

### Current Problem

The DesignSystem.tsx page **does** import actual components (which is good!), but changes to component styling require updating:
1. The component itself
2. The design system page examples
3. Any documentation

### Solution: Component-Driven Architecture

**You already have this!** The DesignSystem page imports real components:

```tsx
// DesignSystem.tsx already does this
import { Button } from '../components/primitives/Button';
import { Input } from '../components/ui/Input';

// Examples use actual components
<Button variant="primary">Save</Button>
```

**This means:**
- ✅ Component changes automatically reflect in design system page
- ✅ No duplication of component code
- ✅ Single source of truth

**What you need to verify:**
Run this check to ensure no duplication:

```bash
# Check if DesignSystem.tsx creates any duplicate button/input/etc components
grep -n "function.*Button\|const.*Button.*=" src/pages/DesignSystem.tsx
```

---

## Recommended Improvements

### Priority 1: Real-Time Developer Feedback

#### A. Enable ESLint Rules in Strict Mode

Once you fix existing violations:

```js
// eslint.config.js
'design-system/no-raw-button': 'error',  // Change from 'warn'
```

#### B. Pre-commit Hook

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run design system check before allowing commit
cd frontend && pnpm check:design-system:strict
```

#### C. VSCode Integration

Create `.vscode/settings.json`:

```json
{
  "eslint.validate": ["typescript", "typescriptreact"],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.associations": {
    "*.tsx": "typescriptreact"
  }
}
```

### Priority 2: Developer Tooling

#### A. VSCode Snippets

Create `.vscode/ffxiv-planner.code-snippets`:

```json
{
  "Import Button": {
    "prefix": "impButton",
    "body": [
      "import { Button } from '../components/primitives/Button';"
    ]
  },
  "Button Component": {
    "prefix": "btn",
    "body": [
      "<Button variant=\"${1|primary,secondary,ghost,danger|}\" onClick={${2:onClick}}>",
      "  ${3:Label}",
      "</Button>"
    ]
  },
  "Input Component": {
    "prefix": "inp",
    "body": [
      "<Input",
      "  value={${1:value}}",
      "  onChange={${2:setValue}}",
      "  placeholder=\"${3:placeholder}\"",
      "  ${4:error={error\\}}",
      "/>"
    ]
  },
  "Modal with Hook": {
    "prefix": "modal",
    "body": [
      "const { isOpen, open, close } = useModal();",
      "",
      "<Modal",
      "  isOpen={isOpen}",
      "  onClose={close}",
      "  title=\"${1:Title}\"",
      "  icon={<${2:Settings} className=\"w-5 h-5\" />}",
      ">",
      "  ${3:// Content}",
      "</Modal>"
    ]
  }
}
```

#### B. Component Usage Tracking

Add script to track which components are used where:

```bash
#!/bin/bash
# frontend/scripts/track-component-usage.sh

echo "Component Usage Report"
echo "======================"
echo ""

components=(
  "Button:components/primitives/Button"
  "IconButton:components/primitives/IconButton"
  "Input:components/ui/Input"
  "Select:components/ui/Select"
  "Modal:components/ui/Modal"
)

for comp in "${components[@]}"; do
  name="${comp%%:*}"
  path="${comp##*:}"
  count=$(grep -r "from.*$path" src --include="*.tsx" --include="*.ts" | wc -l)
  echo "$name: $count usages"
done
```

### Priority 3: Type Safety

#### A. Strict Prop Types

Ensure all components export prop types:

```tsx
// Button.tsx
export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  // ... other props
}

export const Button: React.FC<ButtonProps> = ({ ... }) => { ... }
```

#### B. Banned Patterns Type

Create `src/types/design-system.d.ts`:

```typescript
/**
 * This file uses TypeScript to prevent design system violations
 */

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      // These elements should trigger TypeScript warnings
      // (Note: This is aspirational - TypeScript can't actually ban HTML elements)
    }
  }
}

// Helper type to ensure color token usage
export type ColorToken =
  | 'text-accent'
  | 'text-role-tank'
  | 'text-role-healer'
  | 'bg-surface-card'
  | 'bg-surface-elevated'
  // ... etc
  ;

// Utility to enforce color token usage
export type EnforceColorToken<T extends string> = T extends ColorToken ? T : never;
```

### Priority 4: Visual Regression Testing

Add Playwright or Chromatic for visual testing:

```bash
# Install Playwright
pnpm add -D @playwright/test

# Create test for design system page
# tests/design-system.spec.ts
import { test, expect } from '@playwright/test';

test('design system page renders all components', async ({ page }) => {
  await page.goto('/docs/design-system');

  // Screenshot each section
  const sections = [
    'buttons',
    'forms-inputs',
    'icon-buttons',
    'badges',
  ];

  for (const section of sections) {
    await page.locator(`#${section}`).scrollIntoViewIfNeeded();
    await expect(page.locator(`#${section}`)).toHaveScreenshot(`${section}.png`);
  }
});
```

### Priority 5: Auto-Documentation

#### A. Component Prop Documentation Generator

```bash
# Generate markdown docs from TypeScript prop types
pnpm add -D react-docgen-typescript

# scripts/generate-component-docs.ts
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'react-docgen-typescript';

const components = [
  'src/components/primitives/Button.tsx',
  'src/components/ui/Input.tsx',
  // ... etc
];

const docs = components.map(file => {
  const parsed = parse(file)[0];
  return {
    name: parsed.displayName,
    props: parsed.props,
  };
});

fs.writeFileSync('docs/COMPONENT_API.json', JSON.stringify(docs, null, 2));
```

#### B. Storybook Integration (Optional)

If you want full Storybook:

```bash
pnpm add -D @storybook/react-vite storybook

# Initialize
npx storybook init

# Create story
// Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Primitives/Button',
  component: Button,
};

export default meta;

export const Primary: StoryObj<typeof Button> = {
  args: {
    variant: 'primary',
    children: 'Click me',
  },
};
```

---

## Migration Strategy

If you have existing violations:

### Step 1: Audit Current State

```bash
# Get baseline
pnpm check:design-system --summary > violations-baseline.txt

# Count violations
pnpm check:design-system | grep "Total violations"
```

### Step 2: Fix by Priority

1. **High-traffic components** - Most-used pages first
2. **New features** - Enforce on all new code
3. **Legacy code** - Gradually refactor

### Step 3: Enable Strict Mode

Once violations are below threshold:

```bash
# Update CI to fail on new violations
# .github/workflows/ci.yml
- run: pnpm check:design-system:strict
- run: pnpm lint  # Now includes ESLint design system rules
```

### Step 4: Lock Down

```js
// Change from 'warn' to 'error'
'design-system/no-raw-button': 'error',
```

---

## Best Practices

### For Component Authors

1. **Export prop types** - Always export `ComponentProps` interface
2. **Document with JSDoc** - Add comments to props
3. **Add to UI_COMPONENTS.md** - Keep inventory updated
4. **Add to DesignSystem.tsx** - Add visual example

### For Feature Developers

1. **Check UI_COMPONENTS.md first** - Before creating new UI
2. **Use existing components** - Don't reinvent
3. **Request missing components** - If you need something new
4. **Add `// design-system-ignore`** - Only for legitimate exceptions

### For Reviewers

1. **Check for violations** - Look for raw HTML
2. **Verify component usage** - Ensure correct component chosen
3. **Check color tokens** - No hardcoded colors
4. **Request DesignSystem.tsx update** - For new components

---

## Measuring Success

### Metrics to Track

```bash
# Violation count over time
pnpm check:design-system | grep "Total violations" >> metrics.log

# Component adoption rate
grep -r "from.*components/primitives/Button" src | wc -l

# Coverage: % of files using design system
total_tsx=$(find src -name "*.tsx" | wc -l)
compliant_tsx=$(pnpm check:design-system --strict 2>&1 | grep "No violations" && echo $total_tsx || echo 0)
echo "Coverage: $((compliant_tsx * 100 / total_tsx))%"
```

### Success Criteria

- [ ] Zero violations in `pnpm check:design-system:strict`
- [ ] ESLint rules on `error` (not `warn`)
- [ ] All new PRs pass design system checks
- [ ] All components have visual examples in DesignSystem.tsx
- [ ] 100% of UI uses design system components

---

## FAQ

### Q: Can I use `<button>` if I need custom behavior?

**A:** Use `Button` and pass custom props. If truly impossible, add `// design-system-ignore` with justification.

### Q: What if I need a component that doesn't exist?

**A:**
1. Check if existing component can be extended
2. If not, create new primitive in `components/primitives/`
3. Update UI_COMPONENTS.md
4. Add example to DesignSystem.tsx

### Q: How do I handle Radix UI components?

**A:** Wrap them in design system components. Example: `Dropdown` wraps Radix's `DropdownMenu`.

### Q: Should the design system page import real components or duplicate them?

**A:** Always import real components! This ensures changes propagate automatically.

---

## Additional Resources

- **UI_COMPONENTS.md** - Component reference
- **/docs/design-system** - Visual examples
- **CODING_STANDARDS.md** - General code patterns
- **check-design-system.sh** - Violation checker
