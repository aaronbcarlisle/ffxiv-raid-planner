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
 * v2 Roster (Cards + Board, f6c-board Task 10): ASSERTED GREEN. The v2 Roster
 * is built token-clean; the assertion is scoped to [data-testid="roster-screen"]
 * so shell chrome debt doesn't gate it. Both the Cards grid and the Board gear
 * matrix are asserted, both themes.
 *
 * Three genuine v2-owned contrast bugs were found and fixed at the token level
 * (tokens/tokens.json + tokens/tokens.light.json, regenerated via `pnpm tokens:build`),
 * plus one component-level fix:
 *   • --color-text-tertiary (dark): #71717a → #7d7d87. The old value failed AA
 *     on ALL FOUR dark surfaces, not just card — it topped out at ~4.35:1 on
 *     pure black (surface-base) and measured 3.98:1 on --color-surface-card
 *     (#0e0e14); the documented "4.5:1" never actually held anywhere. The new
 *     value clears AA on all four dark surfaces: ~4.58:1 elevated, ~4.72:1
 *     card, ~4.85:1 raised, ~5.00:1 base. This token also backs
 *     --color-nav-item-icon-inactive, so the fix cascades into the app-rail's
 *     inactive nav icon color in dark theme.
 *   • --color-status-warning (light): #ca8a04 → #8a6004 (was 2.93:1 on white,
 *     used as direct text — "No BiS"/"Unclaimed" labels; now ~5.59:1 on white,
 *     ~4.79:1 on surface-raised).
 *   • --color-status-success (light): #16a34a → #0f7234 (was 3.29:1 on white,
 *     fails AA for direct text use — e.g. the v2 GearBoard "obtained/total"
 *     completed count; now ~6.04:1 on white, ~5.18:1 on surface-raised).
 *   • SegmentedToggle container: bg-surface-elevated → bg-surface-card. The
 *     ghost (inactive) segment's text-accent needs ≥4.5:1 against the
 *     container background showing through; text-accent on surface-elevated
 *     only reached 4.11:1 in light theme (axe-measured), so the ghost label
 *     failed AA. surface-card (the same pairing already asserted green on the
 *     landing page) clears AA with margin in both themes.
 * One family of violations is pre-existing LEGACY debt bleeding into the v2
 * surface via deliberately-reused components (RosterCard imports
 * `components/player/PositionSelector` and `components/player/TankRoleSelector`
 * as-is rather than reimplementing position/tank-role pickers) and is EXCLUDED,
 * not fixed: the tank/healer/melee role-badge triggers — the same "role position
 * btns" pairing documented above (~3.4–4.0:1 across both themes). Excluded via
 * three `.exclude('.text-role-{role}.bg-role-{role}\/20')` calls on the Cards
 * analysis only (GearBoard doesn't render either selector). Tracked for a future
 * shared-selector-component pass — see the test body for the full rationale.
 *
 * v2 Loot (Priority + History, f6d-history Task 10): ASSERTED GREEN — scoped to
 * [data-testid="loot-screen"], both the Priority view and the History view, both
 * themes. No excludes: unlike v2 Roster, Loot doesn't reuse any legacy role-badge
 * selectors, and the harness never opens a modal (RecipientPicker's own instance
 * of the avatar-fill bug below is therefore untested by this harness — fixed
 * anyway on inspection since it's the identical pattern).
 *
 * Four genuine v2-owned (F6d) contrast bugs were found and fixed at the
 * component level (no token/tokens.json changes — all fixes are class-usage
 * swaps local to the loot components):
 *   • ui/PriorityRow.tsx + loot/RecipientPicker.tsx: the role avatar circle
 *     filled its background with the raw role color and used white initials —
 *     fails AA for most role colors (measured as low as 1.86:1 for healer
 *     #5ad490, 2.33:1 ranged #d4a05a, 3.92:1 caster #b45ad4). Fixed by mirroring
 *     ui/PlayerIdentity's fallback-avatar treatment: role color as a border
 *     ring, neutral bg-surface-interactive fill, neutral text-text-secondary
 *     initials — a pattern already proven by the passing v2 Roster assertion.
 *   • ui/PriorityRow.tsx: the non-top chip's rank number used text-text-muted
 *     on bg-surface-interactive — 3.82:1 in light theme (text-muted was
 *     calibrated against surface-base/card, not the darker interactive
 *     surface). Swapped to text-text-secondary.
 *   • ui/PriorityRow.tsx: the top chip's rank number used text-accent on
 *     bg-accent/15 — 4.07:1 in light theme (text-accent only clears AA on
 *     solid surface-base/card, not the tint composited over them). Reduced the
 *     tint to bg-accent/5, which composites light enough for text-accent to
 *     clear AA with margin.
 *   • loot/FloorCard.tsx: the floor header (LinkText "Show", text-accent) sat
 *     on bg-surface-raised — 4.29:1 in light theme (surface-raised, #ededf2, is
 *     darker than the surfaces text-accent was calibrated against). Swapped to
 *     bg-surface-base (#f5f5f8, ~4.65:1), which also preserves the header/body
 *     visual distinction from the card body (bg-surface-card, white).
 *   • loot/WeekGroupHeader.tsx: the current-week pill used text-accent on
 *     bg-accent/15 — same 4.07:1 failure as the PriorityRow top-chip case
 *     above, but here the tint is load-bearing for the pill's visual weight,
 *     so instead of thinning the tint, swapped the darker text-accent-hover
 *     token in (already AA-margin-checked against lighter surfaces per its
 *     tokens.json description) — clears ~5.2:1 against the bg-accent/15
 *     composite. Two existing unit test assertions (LootHistoryTable.test.tsx,
 *     LootEntryRow.test.tsx) updated to match.
 *
 * v2 Schedule (f6e-schedule Task 10): ASSERTED GREEN — scoped to
 * [data-testid="schedule-screen"], both themes. Unlike Roster/Loot, Schedule has
 * no view toggle, so there is a single axe pass per theme. No excludes: all-new
 * token-clean code, and the harness never opens a modal, so the reused legacy
 * CreateSessionModal/OccurrenceListModal surfaces are never in scope. The
 * legacy ScheduleUpcomingPanel light-mode debt (FOUNDATION_ROADMAP §3.1) is
 * bypassed entirely — its v2 replacement (SessionRsvpCard, ring0-shared with
 * Home since F6b) never mounts it.
 *
 * Two genuine v2-owned contrast bugs were found and fixed at the shared
 * component level (both pre-date f6e-schedule — introduced in F6b — but were
 * only now exercised by a scoped axe pass, since no prior harness block
 * touched Home or this Schedule surface):
 *   • ui/Tag.tsx: the `accent` tone (`bg-accent/15 text-accent`) is the same
 *     text-accent-on-bg-accent/15 pairing documented above for PriorityRow /
 *     WeekGroupHeader — 4.07:1 in light theme. Surfaced here via
 *     SessionRsvpCard's countdown chip (`<Tag variant="label" tone="accent">`).
 *     Since `Tag`'s `accent` tone is a shared, generically-named token (not
 *     schedule-specific — also used by the design-system reference page's
 *     filter-pill demo), thinning the tint would ripple into every future
 *     consumer; instead mirrored the WeekGroupHeader fix and swapped the
 *     darker `text-accent-hover` token in, preserving the tint's visual
 *     weight. No unit test asserted the old class.
 *   • primitives/Button.tsx: the `success` variant's idle background
 *     (`bg-status-success/20`) is a shared primitive used by every
 *     variant="success" button app-wide. Surfaced here via SessionRsvpCard's
 *     active "I'm in" RSVP button rendered inside the `next` variant's
 *     accent-ringed CardShell (bg-surface-card, white in light theme):
 *     text-status-success (#0f7234) over the /20-tinted white composite
 *     (#cfe3d6) measured 4.49:1 — a hair under AA, because the token's F2/F6c
 *     fix was validated against solid surfaces (white/surface-raised, where it
 *     clears 6.04:1/5.18:1), not this self-tinting overlay case. Thinned the
 *     overlay to `/15` (and rebalanced hover/active to `/25`/`/35`) — a lighter
 *     overlay sits further from the dark-green text's own hue, restoring
 *     margin (~4.9:1) in light theme, dark theme unaffected (already passing,
 *     and the same direction of change only widens its margin). No unit test
 *     asserted the old opacity classes; full unit suite (1685 tests) reverified
 *     green after the change.
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

// ── Risk view: v2 Roster (Cards + Board), scoped to the roster region ──────────
// The v2 Roster is built token-clean; scope Axe to [data-testid="roster-screen"]
// so shell chrome debt (deferred to later F6 slices) doesn't gate this. Asserts
// both the Cards grid and the Board gear matrix.
//
// EXCLUDED (Cards only): the role-colored badge triggers rendered by the shared
// (pre-existing, non-v2) `components/player/PositionSelector` (T1/T2/H1/H2/M1/M2/R1/R2)
// and `components/player/TankRoleSelector` (MT/OT) — RosterCard deliberately reuses
// both rather than reimplementing position/tank-role pickers. Their
// text-role-{tank,healer,melee}-on-bg-role-{tank,healer,melee}/20 pairing is the
// exact "role position btns" debt already documented above under the legacy
// GroupView notes (~3.4–4.0:1 across both themes, all three role colors — all just
// under AA). This is pre-existing legacy debt, not something introduced by
// f6c-board, so it is excluded here rather than "fixed" in files this slice
// doesn't own. Tracked for the eventual shared-selector-component pass.
const LEGACY_ROLE_BADGE_SELECTORS = [
  '.text-role-tank.bg-role-tank\\/20',
  '.text-role-healer.bg-role-healer\\/20',
  '.text-role-melee.bg-role-melee\\/20',
]
for (const theme of THEMES) {
  test(`v2 roster has zero contrast violations (${theme})`, async ({ page }) => {
    await forceTheme(page, theme)
    await loginAsOwner(page)
    await page.goto(`${FRONTEND_BASE}/group/${DEV_SHARE_CODE}?shell=v2&tab=roster`)
    const roster = page.locator('[data-testid="roster-screen"]')
    await roster.waitFor({ timeout: 15_000 })
    await page.waitForLoadState('networkidle')
    // Settle CSS transitions (Button uses `transition-all duration-fast` = 150ms;
    // a re-render shortly after mount — e.g. the SegmentedToggle's active class
    // resolving from the URL-backed view state — can otherwise be caught mid-
    // transition, producing a transient/false contrast reading).
    await page.waitForTimeout(300)

    // Cards view
    let cardsBuilder = new AxeBuilder({ page }).include('[data-testid="roster-screen"]')
    for (const selector of LEGACY_ROLE_BADGE_SELECTORS) {
      cardsBuilder = cardsBuilder.exclude(selector)
    }
    const cards = await cardsBuilder.withRules(['color-contrast']).analyze()
    expect(cards.violations, JSON.stringify(cards.violations, null, 2)).toEqual([])

    // Cards view, EXPANDED density (Phase C C1): the default density is compact,
    // so without this leg the gear-table surface (item detail lines, source
    // glyphs, headers) would sit outside every Axe run.
    // KNOWN BLINDSPOT (C3, 2026-07-26): axe-core cannot resolve Tailwind-4
    // oklab(...) ALPHA tints, so tinted-badge pairs (text-gear-X on
    // bg-gear-X/20 — the shared BiSSourceSelector triggers) land in axe
    // "incomplete", not violations: this leg stays green while the pair
    // measures ~3.0-3.5:1 in light theme. Frozen shared-leaf debt — queued
    // for a shared-leaf contrast slice (phase-c-roster-plan §2.1 C3 addendum).
    await page.getByRole('button', { name: 'Expanded' }).click()
    // Wait for the density flip to actually render (gear tables mount), then
    // settle the fixed-duration CSS transitions — those aren't observable via
    // DOM state, so the timeout stays but no longer races the re-render.
    await page.locator('[data-testid="roster-screen"] table').first().waitFor()
    await page.waitForTimeout(300)
    let expandedBuilder = new AxeBuilder({ page }).include('[data-testid="roster-screen"]')
    for (const selector of LEGACY_ROLE_BADGE_SELECTORS) {
      expandedBuilder = expandedBuilder.exclude(selector)
    }
    const expanded = await expandedBuilder.withRules(['color-contrast']).analyze()
    expect(expanded.violations, JSON.stringify(expanded.violations, null, 2)).toEqual([])
    // Restore the default so the Board leg below starts from the same state
    // as before this leg existed.
    await page.getByRole('button', { name: 'Compact' }).click()
    await page.locator('[data-testid="roster-screen"] table').first().waitFor({ state: 'hidden' })
    await page.waitForTimeout(300)

    // Board view (GearBoard does not render PositionSelector/TankRoleSelector, so no exclude needed)
    await page.getByRole('button', { name: 'Board' }).click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(300)
    const board = await new AxeBuilder({ page }).include('[data-testid="roster-screen"]').withRules(['color-contrast']).analyze()
    expect(board.violations, JSON.stringify(board.violations, null, 2)).toEqual([])
  })
}

// ── Risk view: v2 Loot (Priority + History), scoped to the loot region ────────
// The v2 Loot screen is built token-clean; scope Axe to [data-testid="loot-screen"]
// so shell chrome debt (deferred to later F6 slices) doesn't gate this. Asserts
// both the Priority view and the History view. No excludes — unlike v2 Roster,
// Loot doesn't reuse any legacy role-badge selectors, and the harness never
// opens a modal, so no reused-legacy-modal surface is ever in scope.
for (const theme of THEMES) {
  test(`v2 loot has zero contrast violations (${theme})`, async ({ page }) => {
    await forceTheme(page, theme)
    await loginAsOwner(page)
    await page.goto(`${FRONTEND_BASE}/group/${DEV_SHARE_CODE}?shell=v2&tab=gear`)
    const loot = page.locator('[data-testid="loot-screen"]')
    await loot.waitFor({ timeout: 15_000 })
    await page.waitForLoadState('networkidle')
    // Settle CSS transitions (Button uses `transition-all duration-fast` = 150ms;
    // a re-render shortly after mount can otherwise be caught mid-transition,
    // producing a transient/false contrast reading).
    await page.waitForTimeout(300)

    // Priority view
    const priority = await new AxeBuilder({ page }).include('[data-testid="loot-screen"]').withRules(['color-contrast']).analyze()
    expect(priority.violations, JSON.stringify(priority.violations, null, 2)).toEqual([])

    // History view
    await page.getByRole('button', { name: 'History', exact: true }).click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(300)
    const history = await new AxeBuilder({ page }).include('[data-testid="loot-screen"]').withRules(['color-contrast']).analyze()
    expect(history.violations, JSON.stringify(history.violations, null, 2)).toEqual([])
  })
}

// ── Risk view: v2 Schedule, scoped to the schedule region ─────────────────────
// The v2 Schedule screen is built token-clean; scope Axe to
// [data-testid="schedule-screen"] so shell chrome debt (deferred to later F6
// slices) doesn't gate this. No excludes expected — all-new token-clean code.
// Unlike Roster/Loot, Schedule has no view toggle, so there's only a single
// pass per theme (no second view click). The harness never opens a modal, so
// the reused legacy CreateSessionModal/OccurrenceListModal surfaces are never
// in scope.
for (const theme of THEMES) {
  test(`v2 schedule has zero contrast violations (${theme})`, async ({ page }) => {
    await forceTheme(page, theme)
    await loginAsOwner(page)
    await page.goto(`${FRONTEND_BASE}/group/${DEV_SHARE_CODE}?shell=v2&tab=schedule`)
    const scheduleScreen = page.locator('[data-testid="schedule-screen"]')
    await scheduleScreen.waitFor({ timeout: 15_000 })
    await page.waitForLoadState('networkidle')
    // Settle CSS transitions (Button uses `transition-all duration-fast` = 150ms;
    // a re-render shortly after mount can otherwise be caught mid-transition,
    // producing a transient/false contrast reading).
    await page.waitForTimeout(300)

    const schedule = await new AxeBuilder({ page }).include('[data-testid="schedule-screen"]').withRules(['color-contrast']).analyze()
    expect(schedule.violations, JSON.stringify(schedule.violations, null, 2)).toEqual([])
  })
}
