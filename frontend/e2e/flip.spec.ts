/**
 * FLIP P2 — GroupRoute gate proof.
 *
 * After the flip, the bare /group/:code route renders the v2 NewShell; `?shell=legacy`
 * is the soak-window escape hatch back to legacy GroupView; `?shell=v2` stays a
 * no-op alias that still renders v2. Legacy flow coverage lives in smoke.spec.ts
 * (pinned to ?shell=legacy); this file proves both (a) which shell GroupRoute selects
 * per URL, and (b) that Layout's isGroupV2Shell predicate suppresses/renders the
 * legacy Header in lockstep with that selection.
 *
 * Prereqs: backend :8001 (DEV_AUTH_MODE=true) + frontend :5174. Run: pnpm test:e2e
 */
import { test, expect } from '@playwright/test';
import { loginAsOwner, DEV_SHARE_CODE } from './helpers/auth';

// The v2 shell root; present only when NewShell mounts.
const V2_ROOT = '[data-testid="new-shell"]';
// The legacy header renders the Roster tab as a role=button; the v2 Spine renders it
// as role=tab. So a role=button match named "Roster" is a legacy-only signal.
const legacyRosterButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Roster', exact: true });
// The legacy <Header/> (Layout chrome) renders this link; the v2 shell does not.
// It exists only in Header.tsx, so it directly observes Layout's isGroupV2Shell
// suppression (present under ?shell=legacy, absent when v2 suppresses the Header).
const legacyHeaderLink = (page: import('@playwright/test').Page) =>
  page.getByRole('link', { name: 'View source on GitHub', exact: true });

test.describe('FLIP P2 — group route shell selection', () => {
  test('bare /group/:code renders the v2 NewShell (no legacy header)', async ({ page }) => {
    await loginAsOwner(page);
    await page.goto(`/group/${DEV_SHARE_CODE}`);
    await expect(page.locator(V2_ROOT)).toBeVisible({ timeout: 15_000 });
    // v2 Roster is a role=tab, so the legacy role=button Roster must be absent.
    await expect(legacyRosterButton(page)).toHaveCount(0);
    // Layout suppresses the legacy Header for the v2 shell.
    await expect(legacyHeaderLink(page)).toHaveCount(0);
  });

  test('?shell=legacy renders the legacy GroupView (escape hatch)', async ({ page }) => {
    await loginAsOwner(page);
    await page.goto(`/group/${DEV_SHARE_CODE}?shell=legacy`);
    await expect(legacyRosterButton(page).first()).toBeVisible({ timeout: 15_000 });
    // Layout renders the legacy Header (not suppressed) for the legacy shell.
    await expect(legacyHeaderLink(page).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(V2_ROOT)).toHaveCount(0);
  });

  test('?shell=v2 still renders the v2 NewShell (no-op alias)', async ({ page }) => {
    await loginAsOwner(page);
    await page.goto(`/group/${DEV_SHARE_CODE}?shell=v2`);
    await expect(page.locator(V2_ROOT)).toBeVisible({ timeout: 15_000 });
    await expect(legacyRosterButton(page)).toHaveCount(0);
    await expect(legacyHeaderLink(page)).toHaveCount(0);
  });

  test('?shell=<unknown> falls through to v2 NewShell (only "legacy" opts out)', async ({ page }) => {
    await loginAsOwner(page);
    await page.goto(`/group/${DEV_SHARE_CODE}?shell=nope`);
    await expect(page.locator(V2_ROOT)).toBeVisible({ timeout: 15_000 });
    await expect(legacyRosterButton(page)).toHaveCount(0);
    await expect(legacyHeaderLink(page)).toHaveCount(0);
  });
});
