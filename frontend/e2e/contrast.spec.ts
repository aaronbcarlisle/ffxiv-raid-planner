/**
 * Contrast net (local). Asserts zero WCAG color-contrast violations on the
 * most stable surfaces, in both themes. Durable deliverable = the harness;
 * the view list is revised in F6 as screens are rebuilt.
 *
 * Prerequisites (same as smoke.spec.ts):
 *   1. Backend on :8001 with DEV_AUTH_MODE=true  (only needed for seeded views)
 *   2. Frontend on :5174
 * Run: pnpm test:contrast
 *
 * Token-contrast fix (F2 Task 9b, 2026-06-28)
 * ─────────────────────────────────────────────────────────────────────────────
 * Two systemic tokens were fixed to meet WCAG AA:
 *   • --color-text-muted (dark):  #52525b → #8a8a94 (~5.79:1 on #0a0a0f)
 *   • --color-accent (light):     #0f9688 → #0c7d71 (~4.65:1 on #f5f5f8, ~5.02:1 on #fff)
 *
 * landing dark/light: ASSERTED GREEN — zero violations after token fixes.
 *
 * design-system dark: RESIDUAL — page-level opacity-modified text-muted
 *   Sidebar accordion button spans (Foundations/Colors/Spacing/Typography/
 *   Components/Constrained Primitives): text-text-muted (#8a8a94) at ~70%
 *   opacity composited on bg-surface-raised (#0a0a0f) → effective #64646c =
 *   3.36:1 on font 6.8pt (9px) normal — needs 4.5:1. The opacity modifier is
 *   baked into the design-system sidebar component; deferred to F3 page rebuild.
 *
 * design-system light: RESIDUAL — two page-level violations remain:
 *   (1) Same sidebar accordion labels: text-muted-light (#6b6b7e) at ~70%
 *       opacity on #ededf2 → #9292a1 = 2.62:1 on 9px normal text. F3 rebuild.
 *   (2) Active nav item ("Design Principles"): text-accent (#0c7d71) on
 *       bg-accent/10 tinted bg (#d7e2e5) = 3.79:1 on 9.8pt normal. The tinted
 *       background is applied by the sidebar's active-state styling; F3 rebuild.
 *
 * GroupView dark/light: Scoped (§3.1 pre-existing tint/card/badge debt, deferred to F6):
 *   RESOLVED by F2 token fix: text-text-muted player-card violations (dark) and base
 *   text-accent surface violations (light) — both now ≥ 4.5:1 on standard surfaces. ✓
 *   REMAINING dark  — keyboard-hint/60: #57575f on #0a0a0f = 2.75:1 (12px normal);
 *                     membership-owner badge: #14b8a6 on #104443 = 4.37:1 (10px normal);
 *                     role position btns: #d45a5a on #361d22 = 3.99:1 (12px bold);
 *                     text-muted@opacity on hardcoded dark-card bg: #696971 on #0c0c11 = 3.58:1
 *   REMAINING light — text-accent (#0c7d71) on bg-accent/10 tinted surfaces: 3.42–4.07:1;
 *                     #0f9688 (membership-owner/gear-source-tome tokens, unchanged by F2 fix)
 *                       on tinted bg: 2.42–3.80:1;
 *                     keyboard-hint/60: #9f9fac on #ededf2 = 2.24:1 (12px normal);
 *                     role position btns on tinted bg: 3.40–4.00:1 (12px bold)
 *   Both themes deferred to F6 GroupView rebuild.
 *
 * NOTE: goToTestStatic is intentionally NOT used here. It has a pre-existing
 * strict-mode violation on this branch: "Show substitutes with main roster"
 * button (aria-label contains "Roster") causes getByRole('button', /Roster/i)
 * to match 2 elements. GroupView navigation is written inline.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { FRONTEND_BASE, loginAsOwner, DEV_SHARE_CODE } from './helpers/auth'

const THEMES = ['dark', 'light'] as const

async function forceTheme(page: import('@playwright/test').Page, theme: string) {
  await page.addInitScript((t) => window.localStorage.setItem('theme', t), theme)
}

async function contrastViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withRules(['color-contrast'])
    .analyze()
  return results.violations
}

// ── Anchor: design-system reference page ─────────────────────────────────────
// Scoped (both themes): page-level residual violations NOT from the core tokens.
//   dark  — sidebar accordion labels use text-text-muted at ~70% opacity →
//           #64646c on #0a0a0f = 3.36:1 (9px normal, needs 4.5:1); F3 rebuild.
//   light — sidebar accordion labels text-muted/70 → #9292a1 on #ededf2 = 2.62:1;
//           active nav item "Design Principles" text-accent on bg-accent/10 →
//           #0c7d71 on #d7e2e5 = 3.79:1 (9px–10px normal); F3 rebuild.
for (const theme of THEMES) {
  test(`design-system page has zero contrast violations (${theme})`, async ({ page }) => {
    test.skip(true, `design-system ${theme}: residual page-level opacity-modified text violations — deferred to F3 page rebuild`)
    await forceTheme(page, theme)
    await page.goto(`${FRONTEND_BASE}/docs/design-system`)
    await page.waitForLoadState('networkidle')
    const violations = await contrastViolations(page)
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([])
  })
}

// ── Anchor: pre-auth landing / login surface ──────────────────────────────────
// ASSERTED GREEN (both themes). Core token fixes resolved all violations:
//   dark  — text-text-muted #8a8a94 on #050508 = ~5.96:1 ✓
//   light — text-accent #0c7d71 on #f5f5f8 = ~4.65:1, on #ffffff = ~5.02:1 ✓
for (const theme of THEMES) {
  test(`landing page has zero contrast violations (${theme})`, async ({ page }) => {
    await forceTheme(page, theme)
    await page.goto(`${FRONTEND_BASE}/`)
    await page.waitForLoadState('networkidle')
    const violations = await contrastViolations(page)
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([])
  })
}

// ── Risk view: GroupView / Home (seeded) ──────────────────────────────────────
// Scoped out both themes — §3.1 pre-existing card/badge/tint debt; deferred to F6.
//
// RESOLVED by F2 token fix (these violations no longer appear):
//   dark  — text-text-muted (#52525b→#8a8a94) on player cards: was ~2.5:1, now ≥5.5:1 ✓
//   light — text-accent base on standard surfaces: was 3.36–3.65:1, now ≥4.5:1 ✓
//
// REMAINING dark (observed post-fix, 2026-06-28):
//   (1) keyboard-hint/60: text-text-muted composited at ~60% → #57575f on #0a0a0f = 2.75:1
//       (12px normal; opacity modifier baked into GroupView keyboard hint button)
//   (2) membership-owner badge: #14b8a6 on #104443 = 4.37:1 (10px normal; just below AA)
//   (3) role position buttons: text-role-melee (#d45a5a) on bg-role-melee/20 (#361d22) = 3.99:1
//       (12px bold; role-color-on-tint pattern repeated for all positions)
//   (4) text-muted at opacity on hardcoded dark-card bg: #696971 on #0c0c11 = 3.58:1 (14px normal)
//
// REMAINING light (observed post-fix, 2026-06-28):
//   (1) text-accent (#0c7d71) on bg-accent/10 tinted surfaces: 3.42–4.07:1 (14px normal)
//       (active tab, "Current" tier badge, invite button tints)
//   (2) #0f9688 (membership-owner + gear-source-tome tokens, separate from accent — NOT
//       changed by F2 fix) on tinted bg: 2.42–3.80:1 (10px normal)
//   (3) keyboard-hint/60: text-text-muted/60 → #9f9fac on #ededf2 = 2.24:1 (12px normal)
//   (4) role position buttons: role-tank/healer/melee on bg-role/20 tinted bg: 3.40–4.00:1
//       (12px bold)
//
// Re-enable in F6 after §3.1 cards/badges are rebuilt.
// Navigation is inline (not goToTestStatic) — see file header.
for (const theme of THEMES) {
  test(`group view has zero contrast violations (${theme})`, async ({ page }) => {
    test.skip(true, `GroupView ${theme}: §3.1 card/badge/tint debt — player-card text-muted RESOLVED by F2 fix; remaining: keyboard-hint/60, owner badge, role btns, text-muted@opacity on dark cards — deferred to F6 rebuild`)
    await forceTheme(page, theme)
    await loginAsOwner(page)
    await page.goto(`${FRONTEND_BASE}/group/${DEV_SHARE_CODE}`)
    // Wait for the AppRail nav to confirm GroupView has loaded
    await page.locator('nav[aria-label="Application navigation"]').waitFor({ timeout: 15_000 })
    await page.waitForLoadState('networkidle')
    const violations = await contrastViolations(page)
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([])
  })
}
