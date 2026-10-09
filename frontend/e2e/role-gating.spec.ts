/**
 * ROLE-1 (W0): role-gated controls are HIDDEN for a member, never disabled
 * (R-R1-0, R-R1-13). DEVTST, V2 shell, plus the legacy Goals & Farms catalog.
 * V2's catalog is gone from this file: since S2a-2 the V2 `goals` tab is
 * Progress, and the catalog is reached through the classic view (R-S2-20).
 *
 * CI has no Playwright job; run against dev-auth servers:
 *   E2E_API_URL=http://localhost:8001 E2E_FRONTEND_URL=http://localhost:5174 \
 *     pnpm -C frontend exec playwright test e2e/role-gating.spec.ts
 *
 * Task 4 baseline: this file was written to the END STATE (what holds after
 * ROLE-1 Tasks 1-3) and first run on main's code (6e513583 + the plan commit),
 * where every role-gated check below fails and every state / pin check passes.
 * The per-surface before/after list is in the PR body.
 *
 * Each describe is one surface. Two kinds of check per surface:
 *  - by name: the role-gated control (Add player, Reorder, Track, ...) is not
 *    rendered for DevMember, and is rendered for the DevOwner pin;
 *  - the sweep: `main` holds no `button[disabled]` / `[aria-disabled="true"]`
 *    outside a short allowlist. Allowlist entries are STATE-disabled controls
 *    only, each a scoped selector with the state that disables it (R-R1-15).
 *    Never a bare role selector, and never a control that is off only because
 *    of the viewer's role.
 *
 * DEVTST facts: DevOwner is the owner (and admin), DevMember a member, no
 * seeded lead. The next-session card on Home is conditional on DEVTST's
 * schedule (vet F7b), so only the absence of "Add session" is asserted there.
 */

import { test, expect, type Browser, type Page } from '@playwright/test';
import { API_BASE, DEV_SHARE_CODE, freshContext, loginAsMember, loginAsOwner, ownerApiContext, pinShell } from './helpers/auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface AllowEntry {
  /** Scoped CSS selector, matched against the disabled element. */
  selector: string;
  /** The STATE (not the role) that disables it. */
  state: string;
}

/** Roster Compact: every card's gear pip strip (`RosterCard.tsx` pips pass `disabled`). */
const COMPACT_PIPS: AllowEntry = {
  selector: '[data-testid="roster-screen"] div[role="checkbox"][aria-disabled="true"]:not(table *)',
  state: 'Compact pip strip: a read-only summary, disabled for every role (R-R1-15)',
};
/** Roster Expanded: the gear-state circles in each card's gear table. */
const EXPANDED_CIRCLES: AllowEntry = {
  selector: '[data-testid="roster-screen"] table div[role="checkbox"][aria-disabled="true"]',
  state: 'gear-state circles on a card the viewer does not own: read-only data, keeps aria-disabled (R-R1-15)',
};
/** Roster Board: the gear matrix cells. */
const BOARD_CELLS: AllowEntry = {
  selector: '[data-testid="roster-screen"] table span[role="checkbox"][aria-disabled="true"]',
  state: 'Board cells on a row the viewer does not own: read-only data, keeps aria-disabled (R-R1-15)',
};
/** Loot Log: the week stepper at the current week. */
const WEEK_STEPPER_NEXT: AllowEntry = {
  selector: 'main button[aria-label="Next week"]',
  state: 'week stepper sits on the current week, so there is no later week to step to',
};
const WEEK_STEPPER_CURRENT: AllowEntry = {
  selector: 'main button[aria-label^="Go to the current week"]',
  state: 'the displayed week already is the current week',
};

/** Disabled controls under `root` that no allowlist entry covers. */
async function unexpectedDisabled(page: Page, allow: AllowEntry[], root = 'main'): Promise<string[]> {
  return page.evaluate(
    ({ rootSel, selectors }) => {
      const scope = document.querySelector(rootSel);
      if (!scope) return [`(no ${rootSel} element)`];
      const found: string[] = [];
      scope.querySelectorAll<HTMLElement>('button, [aria-disabled="true"]').forEach((el) => {
        const off = (el as HTMLButtonElement).disabled === true || el.getAttribute('aria-disabled') === 'true';
        if (!off) return;
        if (selectors.some((s) => el.matches(s))) return;
        const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 70);
        found.push(`<${el.tagName.toLowerCase()} role=${el.getAttribute('role') ?? '-'}> ${name}`);
      });
      return [...new Set(found)];
    },
    { rootSel: root, selectors: allow.map((a) => a.selector) },
  );
}

async function expectNoDisabledOutside(page: Page, allow: AllowEntry[], root = 'main'): Promise<void> {
  const left = await unexpectedDisabled(page, allow, root);
  expect(left, `disabled controls outside the allowlist:\n${left.join('\n')}`).toEqual([]);
}

/** Open a V2 surface for DEVTST and wait for auth + the surface's `ready` locator. */
async function openV2(page: Page, query: string, ready: (p: Page) => ReturnType<Page['locator']>): Promise<void> {
  await page.goto(`/group/${DEV_SHARE_CODE}?shell=v2&${query}`);
  await page.locator('[data-testid="new-shell"]').waitFor({ timeout: 15_000 });
  await page.getByRole('button', { name: /User menu for/i }).waitFor({ timeout: 15_000 });
  await ready(page).first().waitFor({ timeout: 15_000 });
  await page.waitForLoadState('networkidle');
}

const homeReady = (p: Page) => p.getByRole('button', { name: /^(Log this week's loot|View loot priority)$/ });
const rosterReady = (p: Page) => p.getByTestId('roster-card-header');
const logReady = (p: Page) => p.getByRole('group', { name: 'Loot view' });
const farmsReady = (p: Page) => p.getByRole('button', { name: 'Browse Catalog' });
const progressReady = (p: Page) => p.getByTestId('progress-tier-row');

/**
 * Run `body` with one active farm on DEVTST, so Progress has a row: "Edit statuses" renders only
 * beside an active row, so without one the absence for a member (and the presence for the owner)
 * would hold vacuously. The farm is created and deleted through the owner's API in its own context.
 */
async function withActiveFarm(browser: Browser, body: () => Promise<void>): Promise<void> {
  const context = await freshContext(browser);
  const page = await context.newPage();
  await loginAsOwner(page);
  const { groupId, csrfToken } = await ownerApiContext(page);
  const headers = { 'X-CSRF-Token': csrfToken };
  const res = await page.request.post(`${API_BASE}/api/static-groups/${groupId}/collection-goals`, {
    headers,
    data: { goal_type: 'custom_reward', title: 'E2E Progress Gating', status: 'farming' },
  });
  if (!res.ok()) throw new Error(`seeding the gating farm returned ${res.status()}`);
  const id = ((await res.json()) as { id: string }).id;
  try {
    await body();
  } finally {
    const del = await page.request.delete(`${API_BASE}/api/static-groups/${groupId}/collection-goals/${id}`, { headers });
    await context.close();
    if (!del.ok() && del.status() !== 404) throw new Error(`deleting the gating farm returned ${del.status()}`);
  }
}

async function openRoster(page: Page, density: 'compact' | 'expanded' | 'board'): Promise<void> {
  await openV2(page, density === 'board' ? 'tab=roster&rview=board' : 'tab=roster', density === 'board'
    ? (p) => p.getByRole('group', { name: 'Roster view' })
    : rosterReady);
  if (density === 'board') return;
  const toggle = page
    .getByRole('group', { name: 'Card density' })
    .getByRole('button', { name: density === 'compact' ? 'Compact' : 'Expanded', exact: true });
  // Only click when not already active: re-clicking Expanded folds every section.
  if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
}

async function openCatalog(page: Page, openQuery: (p: Page) => Promise<void>): Promise<void> {
  await openQuery(page);
  await page.getByRole('button', { name: 'Browse Catalog' }).first().click();
  // Non-vacuous: the catalog's cards are on screen before anything is counted.
  // "Copy plan" (lowercase p) is the catalog card's footer; the Suggested view's
  // "Copy Plan" is visible before the click lands and would let a count of 0 pass.
  await expect(page.getByRole('button', { name: 'Copy plan', exact: true }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /^All\s*\d+$/ })).toBeVisible();
  await page.waitForLoadState('networkidle');
}

interface TierPlayer { id: string; name: string; userId: string | null }
interface Seed { groupId: string; tierId: string; ownName: string; otherNames: string[] }

/**
 * Read DEVTST's active-tier players as the signed-in member through the API.
 * DevMember must hold a claimed card (the Loot Log book-row check needs that
 * row): when it holds none, this claims the first unclaimed card through the
 * claim API, the same call Take Ownership makes.
 */
async function seedMember(page: Page): Promise<Seed> {
  const me = await (await page.request.get(`${API_BASE}/api/auth/me`)).json() as { id: string };
  const group = await (await page.request.get(`${API_BASE}/api/static-groups/by-code/${DEV_SHARE_CODE}`)).json() as { id: string };
  const tiers = await (await page.request.get(`${API_BASE}/api/static-groups/${group.id}/tiers`)).json() as Array<{ tierId: string; isActive?: boolean }>;
  const tierId = (tiers.find((t) => t.isActive) ?? tiers[0]).tierId;
  const playersUrl = `${API_BASE}/api/static-groups/${group.id}/tiers/${tierId}/players`;
  let players = await (await page.request.get(playersUrl)).json() as TierPlayer[];
  if (!players.some((p) => p.userId === me.id)) {
    const csrf = (await page.context().cookies(API_BASE)).find((c) => c.name === 'csrf_token')?.value;
    const free = players.find((p) => !p.userId);
    if (!free || !csrf) throw new Error('DevMember holds no card and none can be claimed');
    const res = await page.request.post(`${playersUrl}/${free.id}/claim`, { headers: { 'X-CSRF-Token': csrf } });
    if (!res.ok()) throw new Error(`claiming a card for DevMember failed: ${res.status()}`);
    players = await (await page.request.get(playersUrl)).json() as TierPlayer[];
  }
  const own = players.find((p) => p.userId === me.id)!;
  return {
    groupId: group.id,
    tierId,
    ownName: own.name,
    otherNames: players.filter((p) => p.userId !== me.id).map((p) => p.name),
  };
}

/** A roster card header by player name. */
const header = (page: Page, name: string) => page.getByTestId('roster-card-header').filter({ hasText: name });

/**
 * The catalog's "Track" buttons, by DOM text. Not getByRole: each farm card's
 * chips sit inside the card's own header <button>, and Chromium drops a
 * button's descendants from the accessibility tree, so a role query counts 0
 * on a page that has 90 of them.
 */
const trackButtons = (page: Page) => page.locator('button').filter({ hasText: /^\s*Track\s*$/ });

/** The seat chip: a position ("H1") or merged tank chip ("Tank role MT, position T1") or "--". */
const SEAT_CHIP = /^(Tank role .*|[THMR][12]|--)$/;

// ---------------------------------------------------------------------------
// Member
// ---------------------------------------------------------------------------

test.describe('Member (DevMember), V2', () => {
  let seed: Seed;

  test.beforeEach(async ({ page }) => {
    await loginAsMember(page);
    seed = await seedMember(page);
  });

  test.describe('Home', () => {
    test('no "Add session"; "View loot priority" instead of "Log this week\'s loot"', async ({ page }) => {
      await openV2(page, 'tab=overview', homeReady);
      // Conditional (vet F7b): if DEVTST has an upcoming session the empty card
      // is not shown at all, so only the ABSENCE of the manager action holds.
      await expect(page.getByRole('button', { name: 'Add session' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'View loot priority' })).toBeVisible();
      await expect(page.getByRole('button', { name: "Log this week's loot" })).toHaveCount(0);
    });

    test('"View loot priority" lands on Priority even after Loot was last on Log (F4)', async ({ page }) => {
      await openV2(page, 'tab=gear&lview=log', logReady);
      // Tab memory keeps `lview=log` for the Loot tab; leave through the Spine.
      await page.getByRole('tab', { name: 'Home', exact: true }).click();
      await expect(page.getByRole('button', { name: 'View loot priority' })).toBeVisible();
      await page.getByRole('button', { name: 'View loot priority' }).click();
      const view = page.getByRole('group', { name: 'Loot view' });
      await expect(view.getByRole('button', { name: 'Priority', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(view.getByRole('button', { name: 'Log', exact: true })).toHaveAttribute('aria-pressed', 'false');
    });

    test('sweep: no disabled control on Home', async ({ page }) => {
      await openV2(page, 'tab=overview', homeReady);
      await expectNoDisabledOutside(page, []);
    });
  });

  test.describe('Roster', () => {
    test('toolbar: no "Add player", no "Reorder"; "Manage characters" stays', async ({ page }) => {
      await openRoster(page, 'compact');
      await expect(page.getByRole('button', { name: 'Add player' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Reorder' })).toHaveCount(0);
      // A member keeps it (R-R1-8): the registry is readable, and V1 shows it to every role.
      await expect(page.getByRole('button', { name: 'Manage characters' })).toBeVisible();
    });

    test('"Manage characters" modal has no disabled button', async ({ page }) => {
      await openRoster(page, 'compact');
      await page.getByRole('button', { name: 'Manage characters' }).click();
      const dialog = page.getByRole('dialog', { name: 'Characters' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button').first()).toBeVisible();
      const left = await unexpectedDisabled(page, [], '[role="dialog"][aria-labelledby]');
      expect(left, `disabled controls in the Characters modal:\n${left.join('\n')}`).toEqual([]);
    });

    test('kebab on a card that is not DevMember\'s: no disabled menuitem', async ({ page }) => {
      await openRoster(page, 'compact');
      expect(seed.otherNames.length).toBeGreaterThan(0);
      const offenders: string[] = [];
      for (const name of seed.otherNames) {
        const card = header(page, name);
        if ((await card.count()) === 0) continue; // e.g. a collapsed section
        await card.first().getByRole('button', { name: 'Player actions' }).click();
        const menu = page.getByRole('menu');
        await expect(menu).toBeVisible();
        const off = await menu.locator('[role="menuitem"]:disabled').allInnerTexts();
        if (off.length) offenders.push(`${name}: ${off.join(', ')}`);
        await page.keyboard.press('Escape');
        await expect(menu).toHaveCount(0);
      }
      expect(offenders, `disabled menu items on other players' cards:\n${offenders.join('\n')}`).toEqual([]);
    });

    test('kebab on DevMember\'s own card keeps its edit items enabled', async ({ page }) => {
      await openRoster(page, 'compact');
      await header(page, seed.ownName).first().getByRole('button', { name: 'Player actions' }).click();
      await expect(page.getByRole('menuitem', { name: 'Update BiS' })).toBeEnabled();
    });

    for (const density of ['compact', 'expanded', 'board'] as const) {
      test(`${density}: no seat-chip button on another's card`, async ({ page }) => {
        await openRoster(page, density);
        if (density !== 'board') {
          expect(seed.otherNames.length).toBeGreaterThan(0);
          for (const name of seed.otherNames) {
            const card = header(page, name);
            if ((await card.count()) === 0) continue;
            await expect(card.first().getByRole('button', { name: SEAT_CHIP }), `${name}'s seat chip`).toHaveCount(0);
          }
          // Never over-hide: DevMember's own seat chip is still a working button.
          await expect(header(page, seed.ownName).first().getByRole('button', { name: SEAT_CHIP })).toBeEnabled();
        } else {
          await expect(page.getByRole('button', { name: SEAT_CHIP })).toHaveCount(0);
        }
        if (density === 'expanded') {
          // BiS-source triggers and the tome "+" render as static values for a
          // non-editor (R-R1-15); DevMember's own card keeps them as buttons.
          await expect(page.getByRole('button', { name: /^BiS source:/ }).first()).toBeEnabled();
        }
      });

      test(`${density}: sweep, no disabled control outside the allowlist`, async ({ page }) => {
        await openRoster(page, density);
        const allow = { compact: [COMPACT_PIPS], expanded: [EXPANDED_CIRCLES], board: [BOARD_CELLS] }[density];
        await expectNoDisabledOutside(page, allow);
      });
    }
  });

  test.describe('Loot', () => {
    test('Log: DevMember\'s book row has no book-cell button (F7a)', async ({ page }) => {
      await openV2(page, 'tab=gear&lview=log', logReady);
      const books = page.getByRole('button', { name: /^Edit .* Book (I|II|III|IV) balance/ });
      // The own row is REQUIRED so the absence below is not vacuous (seedMember claims a card if needed).
      const ownRow = page.locator('tr[id^="book-row-"]').filter({ hasText: seed.ownName });
      await expect(ownRow).toBeVisible();
      await expect(ownRow.getByRole('button', { name: `${seed.ownName}'s ledger` })).toBeVisible();
      await expect(ownRow.getByRole('button', { name: /^Edit .* Book/ })).toHaveCount(0);
      await expect(books).toHaveCount(0);
    });

    test('Log: sweep, no disabled control outside the allowlist', async ({ page }) => {
      await openV2(page, 'tab=gear&lview=log', logReady);
      await expectNoDisabledOutside(page, [WEEK_STEPPER_NEXT, WEEK_STEPPER_CURRENT]);
    });
  });

  test.describe('Progress', () => {
    test('member: Progress sweep, no disabled control', async ({ page }) => {
      await openV2(page, 'tab=progress', progressReady);
      await expectNoDisabledOutside(page, []);
    });

    test('member: no "Edit statuses" beside an active row (hidden, not disabled)', async ({ page, browser }) => {
      await withActiveFarm(browser, async () => {
        await openV2(page, 'tab=progress', progressReady);
        // Non-vacuous: the farm's row is on screen, so the toolbar would be there for a lead.
        await expect(page.getByTestId('progress-farm-row').filter({ hasText: 'E2E Progress Gating' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Edit statuses' })).toHaveCount(0);
        await expect(page.getByTestId('progress-toolbar')).toHaveCount(0);
        await expectNoDisabledOutside(page, []);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Owner pin: the lead controls are still there
// ---------------------------------------------------------------------------

test.describe('Owner pin (DevOwner), V2', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
  });

  test('Roster: "Add player" and "Reorder" enabled', async ({ page }) => {
    await openRoster(page, 'compact');
    await expect(page.getByRole('button', { name: 'Add player' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Reorder' })).toBeEnabled();
  });

  test('Roster: a card kebab keeps every item enabled', async ({ page }) => {
    await openRoster(page, 'compact');
    await page.getByTestId('roster-card-header').first().getByRole('button', { name: 'Player actions' }).click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'Remove Player' })).toBeEnabled();
    await expect(menu.getByRole('menuitem', { name: 'Duplicate' })).toBeEnabled();
    await expect(menu.getByRole('menuitem', { name: 'Update BiS' })).toBeEnabled();
    // Paste is the one STATE-disabled item (R-R1-0): the clipboard is empty.
    const off = await menu.locator('[role="menuitem"]:disabled').allInnerTexts();
    expect(off.map((t) => t.trim()).filter((t) => t !== 'Paste'), 'owner items disabled for a reason other than an empty clipboard').toEqual([]);
  });

  test('Home: "Log this week\'s loot"', async ({ page }) => {
    await openV2(page, 'tab=overview', homeReady);
    await expect(page.getByRole('button', { name: "Log this week's loot" })).toBeVisible();
    await expect(page.getByRole('button', { name: 'View loot priority' })).toHaveCount(0);
  });

  test('Progress: "Edit statuses" enabled, so the member check above is not vacuous', async ({ page, browser }) => {
    await withActiveFarm(browser, async () => {
      await openV2(page, 'tab=progress', progressReady);
      await expect(page.getByRole('button', { name: 'Edit statuses' })).toBeEnabled();
    });
  });
});

// ---------------------------------------------------------------------------
// Legacy: the only V1 delta is Track (R-R1-9)
// ---------------------------------------------------------------------------

test.describe('Legacy shell, Goals & Farms catalog', () => {
  const openLegacyCatalog = (page: Page) =>
    openCatalog(page, async (p) => {
      await pinShell(p, 'legacy', `/group/${DEV_SHARE_CODE}?tab=goals&goal=farms`);
      await farmsReady(p).first().waitFor({ timeout: 15_000 });
    });

  test('member: no "Track"', async ({ page }) => {
    await loginAsMember(page);
    await openLegacyCatalog(page);
    await expect(trackButtons(page)).toHaveCount(0);
  });

  test('owner pin: "Track" is there, so the member check above is not vacuous (F7d)', async ({ page }) => {
    await loginAsOwner(page);
    await openLegacyCatalog(page);
    await expect(trackButtons(page).first()).toBeEnabled();
  });
});
