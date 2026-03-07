# Design System Integration Verification

Quick tests to verify your design system is working correctly.

## Test 1: Component Propagation

**Goal:** Verify that changes to components automatically reflect in the design system page.

### Steps:

1. Start dev server:
   ```bash
   pnpm dev
   ```

2. Open design system page:
   ```
   http://localhost:5174/docs/design-system
   ```

3. Make a test change to a component:
   ```tsx
   // src/components/primitives/Button.tsx
   // Add a test border to primary variant

   variant === 'primary' && 'border-4 border-red-500'
   ```

4. **Expected:** Design system page should show red border on all primary buttons
5. **Why:** DesignSystem.tsx imports actual Button component
6. **Revert:** Remove test border

✅ **Pass:** Changes propagate automatically
❌ **Fail:** Design system shows old styling (indicates duplication)

---

## Test 2: ESLint Real-Time Warnings

**Goal:** Verify ESLint catches violations as you type.

### Steps:

1. Create test file:
   ```bash
   touch src/components/test-violation.tsx
   ```

2. Add violation:
   ```tsx
   // src/components/test-violation.tsx
   export function TestComponent() {
     return <button>Click me</button>;
   }
   ```

3. Run lint:
   ```bash
   pnpm lint
   ```

4. **Expected output:**
   ```
   warning: Use <Button> or <IconButton> instead of raw <button>
   ```

5. Clean up:
   ```bash
   rm src/components/test-violation.tsx
   ```

✅ **Pass:** ESLint shows warning
❌ **Fail:** No warning (check eslint.config.js)

---

## Test 3: CI/CD Blocking

**Goal:** Verify design system violations block builds.

### Steps:

1. Run strict check:
   ```bash
   pnpm check:design-system:strict
   ```

2. **Expected:** If violations exist, exit code 1 (fails)

3. View violations:
   ```bash
   pnpm check:design-system --summary
   ```

✅ **Pass:** Strict mode catches violations
❌ **Fail:** Passes with violations

---

## Test 4: Ignore Comments Work

**Goal:** Verify `// design-system-ignore` comments are respected.

### Steps:

1. Create test file:
   ```tsx
   // src/components/test-ignore.tsx
   export function TestIgnore() {
     // design-system-ignore - Radix requires native button
     return <button>Radix trigger</button>;
   }
   ```

2. Run lint:
   ```bash
   pnpm lint src/components/test-ignore.tsx
   ```

3. **Expected:** No warnings for that line

4. Clean up:
   ```bash
   rm src/components/test-ignore.tsx
   ```

✅ **Pass:** Ignore comment works
❌ **Fail:** Still shows warning

---

## Test 5: Component Discovery

**Goal:** Verify developers can find the right component.

### Scenario: "I need a dropdown menu"

1. Check quick reference in CLAUDE.md → "Dropdown: `Select`"
2. Open UI_COMPONENTS.md → Search "dropdown"
3. Find three options:
   - `Dropdown` - Action menu
   - `Select` - Single value selection
   - `SearchableSelect` - Large lists
4. Check visual examples at `/docs/design-system#menus-navigation`

✅ **Pass:** Found correct component in <2 minutes
❌ **Fail:** Had to search codebase or ask

---

## Test 6: Color Token Enforcement

**Goal:** Verify hardcoded colors are caught.

### Steps:

1. Run color-only check:
   ```bash
   pnpm check:design-system --colors
   ```

2. **Expected:** Lists any `#14b8a6` or other hex codes

3. Example violation:
   ```tsx
   <div style={{ color: '#14b8a6' }}>Text</div>
   ```

4. Correct usage:
   ```tsx
   <div className="text-accent">Text</div>
   ```

✅ **Pass:** Color violations caught
❌ **Fail:** Hardcoded colors not detected

---

## Test 7: Documentation Accuracy

**Goal:** Verify design system page matches codebase.

### Steps:

1. Pick a component from design system page (e.g., Button)
2. Note its variants: `primary`, `secondary`, `ghost`, `danger`
3. Check actual component:
   ```bash
   grep -A 5 "variant:" src/components/primitives/Button.tsx
   ```
4. **Expected:** Variants match exactly

✅ **Pass:** Documentation matches implementation
❌ **Fail:** Mismatch indicates stale docs

---

## Troubleshooting

### ESLint not showing warnings

Check:
1. Is plugin imported? (`eslint.config.js`)
2. Are rules enabled? (should be `warn` or `error`)
3. Is file excluded? (check exclusions array)

### Changes not appearing in design system page

Check:
1. Is DesignSystem.tsx importing from correct path?
2. Did you save the file?
3. Is Vite dev server running?
4. Check browser console for errors

### Bash script not finding violations

Check:
1. Is pattern in HTML_PATTERNS or COLOR_PATTERNS array?
2. Is file excluded in EXCLUDE_FILES?
3. Try without filters: `pnpm check:design-system --all`

---

## Success Criteria

Your design system is properly integrated if:

- [x] ESLint shows warnings for raw HTML elements
- [x] `pnpm check:design-system` catches violations
- [x] Design system page shows live components
- [x] Component changes appear in design system page automatically
- [x] CI/CD blocks PRs with violations
- [x] Developers can find components in <2 minutes

---

## Next Steps

If all tests pass:
1. ✅ Design system is working correctly
2. 📝 Start addressing existing violations
3. 🔒 Enable strict mode when violations < 50
4. 🚀 Add pre-commit hooks

If tests fail:
1. 📖 Check DESIGN_SYSTEM_ENFORCEMENT.md
2. 🐛 Review error messages
3. 💬 Ask for help with specific test that failed
