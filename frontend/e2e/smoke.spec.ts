/**
 * FFXIV Raid Planner — Playwright smoke tests.
 *
 * Prerequisites:
 *   1. Backend running on localhost:8001 with DEV_AUTH_MODE=true
 *   2. Frontend running on localhost:5174
 *   3. Optional E2E_API_URL / E2E_FRONTEND_URL when using non-default ports
 *
 * Run: pnpm test:e2e
 *
 * FLIP P3: rewritten from the legacy `?shell=legacy` GroupView chrome to the
 * v2 shell selectors — the legacy escape hatch was removed in this branch.
 */

import { test, expect, type Page } from '@playwright/test';
import {
  API_BASE,
  FRONTEND_BASE,
  loginAsOwner,
  loginAsMember,
  goToTestStatic,
  switchTab,
  setStaticPublic,
  DEV_SHARE_CODE,
} from './helpers/auth';

const TEST_SESSION_PREFIX = 'E2E Scheduler ';
const LEGACY_TEST_SESSION_PREFIXES = [
  'Smoke Test ',
  'Recurring ',
  'RSVP Target ',
];
const LEGACY_TEST_SESSION_PATTERNS = [
  /^Smoke \d{13}$/,
  /^Recur \d{13}$/,
];
const runId = Date.now();

// The dev-mock Lodestone character used by test 14 (id verified live against
// GET /api/lodestone/search?name=Mock Raider — see task-5-report.md).
const MOCK_CHARACTER_NAME = 'Mock Raider';
const MOCK_CHARACTER_LODESTONE_ID = '910001';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * datetime-local string N hours from now.
 *
 * v2 Schedule scopes SessionList to the CURRENT raid week (Sat–Fri reset,
 * WeekNavigatorStrip) rather than showing all upcoming sessions like the
 * legacy Sessions sub-tab did — a fixed "tomorrow at 8pm" can land in the
 * NEXT scoped week (e.g. when the test runs on the week's last day) and
 * silently never appear in the current-week SessionList. Staying a few
 * hours ahead of "now" keeps the created session on today's date, safely
 * inside the currently-scoped week.
 */
function hoursFromNow(hours: number): string {
  const now = new Date();
  const target = new Date(now.getTime() + hours * 60 * 60 * 1000);

  // Clamp the midnight/week-boundary hole: on the scoped week's last day
  // (Friday, Sat-Fri reset per the comment above), pushing `hours` ahead can
  // roll past local midnight into Saturday — the START of the NEXT scoped
  // week — which would silently drop the created session outside the window
  // every assertion here expects it in. If that happens, pin the target to
  // late-but-still-Friday instead of letting it roll over. (Residual edge:
  // if `now` itself is already within the last hour of Friday, both a
  // caller's start- and end-offset can clamp to the same instant — accepted
  // here as a negligible window vs. the boundary bug this fixes.)
  if (target.getDate() !== now.getDate()) {
    target.setTime(now.getTime());
    target.setHours(23, 30, 0, 0);
  }

  const offset = target.getTimezoneOffset();
  const local = new Date(target.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

/** Fill the Create-Session modal and submit. Expects modal already open. */
async function fillAndSubmitSession(
  page: Page,
  opts: {
    title: string;
    startOffsetHours?: number;
    endOffsetHours?: number;
    recurring?: boolean;
    days?: string[];
    initialRsvp?: 'Available' | 'Tentative' | 'Unavailable';
  },
) {
  await page.getByTestId('session-title-input').fill(opts.title);
  await page.getByTestId('session-start-input').fill(hoursFromNow(opts.startOffsetHours ?? 1));
  await page.getByTestId('session-end-input').fill(hoursFromNow(opts.endOffsetHours ?? 3));

  if (opts.recurring) {
    await page.getByText('Recurring weekly').click();
    if (opts.days) {
      for (const day of opts.days) {
        await page.locator('button', { hasText: new RegExp(`^${day}$`) }).click();
      }
    }
  }

  if (opts.initialRsvp) {
    const field = page.getByTestId('initial-rsvp-field');
    await field.getByText('No response').click();
    await page.getByRole('option', { name: opts.initialRsvp, exact: true }).click();
  }

  await page.getByTestId('session-submit-btn').click();
  await expect(page.getByTestId('session-submit-btn')).toBeHidden({ timeout: 5_000 });
}

/**
 * The v2 Schedule screen anchors the FIRST occurrence of each session with a
 * `schedule-session-{id}` DOM id (SessionList.tsx). The session's title text
 * is NOT reliably visible in the card body — SessionRsvpCard always prefers
 * the formatted day/time line over `session.title` (SessionRsvpCard.tsx:326),
 * and the CardShell `<h3>` itself renders "Next session" (not the title) for
 * whichever occurrence is chronologically soonest (the "next" variant) — which
 * a freshly-created session (1-3h out) usually is. So identify the card by its
 * real DB id (looked up via the schedule API) rather than by title text.
 */
async function sessionIdByTitle(page: Page, title: string): Promise<string> {
  const groupRes = await page.request.get(`${API_BASE}/api/static-groups/by-code/${DEV_SHARE_CODE}`);
  if (!groupRes.ok()) {
    throw new Error(`sessionIdByTitle("${title}"): by-code lookup returned ${groupRes.status()}`);
  }
  const group = await groupRes.json() as { id: string };
  const sessionsRes = await page.request.get(`${API_BASE}/api/static-groups/${group.id}/schedule`);
  if (!sessionsRes.ok()) {
    throw new Error(`sessionIdByTitle("${title}"): schedule lookup returned ${sessionsRes.status()}`);
  }
  const sessions = await sessionsRes.json() as Array<{ id: string; title: string }>;
  const match = sessions.find((s) => s.title === title);
  if (!match) throw new Error(`sessionIdByTitle: no session titled "${title}" found via API`);
  return match.id;
}

async function sessionCard(page: Page, title: string) {
  const id = await sessionIdByTitle(page, title);
  return page.locator(`#schedule-session-${id}`);
}

async function cleanupTestSessions(page: Page) {
  const context = page.context();
  const request = context.request;
  const loginResponse = await request.post(`${API_BASE}/api/dev-auth/login/0`);
  if (!loginResponse.ok()) {
    throw new Error(`E2E cleanup failed: dev owner login returned ${loginResponse.status()}`);
  }
  const csrfToken =
    loginResponse.headers()['x-csrf-token']
    || (await context.cookies(API_BASE)).find((cookie) => cookie.name === 'csrf_token')?.value;
  if (!csrfToken) {
    throw new Error('E2E cleanup failed: missing CSRF token after dev owner login');
  }

  const groupResponse = await request.get(`${API_BASE}/api/static-groups/by-code/${DEV_SHARE_CODE}`);
  if (!groupResponse.ok()) {
    throw new Error(`E2E cleanup failed: static lookup returned ${groupResponse.status()}`);
  }
  const group = await groupResponse.json() as { id: string };

  const sessionsResponse = await request.get(`${API_BASE}/api/static-groups/${group.id}/schedule`);
  if (!sessionsResponse.ok()) {
    throw new Error(`E2E cleanup failed: session list returned ${sessionsResponse.status()}`);
  }

  const sessions = await sessionsResponse.json() as Array<{ id: string; title: string }>;
  const testPrefixes = [TEST_SESSION_PREFIX, ...LEGACY_TEST_SESSION_PREFIXES];
  const testSessions = sessions.filter((session) =>
    testPrefixes.some((prefix) => session.title.startsWith(prefix))
    || LEGACY_TEST_SESSION_PATTERNS.some((pattern) => pattern.test(session.title))
  );

  for (const session of testSessions) {
    const deleteResponse = await request.delete(
      `${API_BASE}/api/static-groups/${group.id}/schedule/${session.id}`,
      { headers: { 'X-CSRF-Token': csrfToken } },
    );
    if (!deleteResponse.ok()) {
      throw new Error(
        `E2E cleanup failed: deleting "${session.title}" returned ${deleteResponse.status()}`,
      );
    }
  }
}

async function isLodestoneMockEnabled(page: Page) {
  const response = await page.context().request.get(`${API_BASE}/api/lodestone/status`);
  if (!response.ok()) {
    return false;
  }

  const payload = await response.json() as { mockMode?: boolean };
  return payload.mockMode === true;
}

/**
 * Delete any player character linked to the current (owner) session matching
 * the mock lodestone id, via API. Keeps test 14 idempotent across repeat runs
 * (the backend rejects re-linking the same lodestoneId with a 409).
 */
async function cleanupLinkedMockCharacter(page: Page) {
  const context = page.context();
  const listResponse = await context.request.get(`${API_BASE}/api/player/characters`);
  if (!listResponse.ok()) return;
  const characters = await listResponse.json() as Array<{ id: string; lodestoneId?: string | null }>;
  const csrfToken = (await context.cookies(API_BASE)).find((c) => c.name === 'csrf_token')?.value;
  if (!csrfToken) return;

  for (const character of characters) {
    if (character.lodestoneId === MOCK_CHARACTER_LODESTONE_ID) {
      await context.request.delete(`${API_BASE}/api/player/characters/${character.id}`, {
        headers: { 'X-CSRF-Token': csrfToken },
      });
    }
  }
}

/** Today as YYYY-MM-DD. */
function todayStr(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * Find the first visible & unselected availability cell for today. Expects
 * the "Edit availability" modal to already be open.
 * Returns { cell, cellId } or null.
 */
async function findUnselectedCell(page: Page) {
  const today = todayStr();
  for (const time of ['1800', '1830', '1900', '1930', '2000', '2030']) {
    const id = `avail-cell-${today}-${time}`;
    const cell = page.getByTestId(id);
    if (await cell.isVisible().catch(() => false)) {
      const sel = await cell.getAttribute('data-user-selected');
      if (sel !== 'true') return { cell, cellId: id };
    }
  }
  return null;
}

/**
 * Open the "Edit availability" modal from the Schedule screen's "Edit week"
 * affordance (AvailabilityHeatmap) and wait for the grid's data GET.
 */
async function openEditAvailability(page: Page) {
  // "Edit week" is gated on canRsvp, which is only known once the auth store
  // rehydrates — wait for the button itself (generous timeout) before also
  // racing a network wait, so a slow-to-hydrate page fails with a clear
  // "button never appeared" signal instead of a confusing dual timeout.
  const editButton = page.getByRole('button', { name: 'Edit week' });
  await expect(editButton).toBeVisible({ timeout: 30_000 });

  const availGetPromise = page.waitForResponse(
    (r) => r.url().includes('/availability') && r.request().method() === 'GET',
    { timeout: 15_000 },
  );
  await editButton.click();
  await availGetPromise;
  const dialog = page.getByRole('dialog', { name: 'Edit availability' });
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  return dialog;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Auth & navigation
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Auth & Navigation', () => {
  test('1 — Owner can log in and open test static', async ({ page }) => {
    await loginAsOwner(page);
    await goToTestStatic(page);
    await expect(page.getByText('Dev Test Static').first()).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Roster' })).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2-9. Schedule
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Schedule', () => {
  test.describe.configure({ mode: 'serial' });

  // Extra headroom over the file's 30s default — Schedule fans out into the
  // most concurrent per-navigation fetches of any screen (schedule,
  // availability, tiers/current-week, exceptions, …).
  test.beforeEach(() => {
    test.setTimeout(45_000);
  });

  test.afterEach(async ({ page }) => {
    await cleanupTestSessions(page);
  });

  test('2 — Schedule tab loads', async ({ page }) => {
    await loginAsOwner(page);
    await goToTestStatic(page);
    await switchTab(page, 'Schedule');
    await expect(page.getByTestId('schedule-screen')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Team availability' })).toBeVisible();
  });

  test('3 — Owner can create a session', async ({ page }) => {
    await loginAsOwner(page);
    await goToTestStatic(page);
    await switchTab(page, 'Schedule');

    const title = `${TEST_SESSION_PREFIX}Smoke ${runId}`;
    // .first(): WeekNavigatorStrip's "Add session" is always present for a
    // manager; SessionList's empty-state also renders one with the same name
    // when the current scoped week has zero occurrences (real live state,
    // not test-order-dependent — the shared dev DB's non-E2E seed sessions
    // don't always fall in "this week"). WeekNavigatorStrip's renders first.
    await page.getByRole('button', { name: 'Add session' }).first().click();
    await expect(page.getByRole('dialog', { name: /Add Session/i })).toBeVisible();
    await fillAndSubmitSession(page, { title });
    await expect(await sessionCard(page, title)).toBeVisible({ timeout: 5_000 });
  });

  test('4 — Owner can create Tue/Fri recurring session', async ({ page }) => {
    await loginAsOwner(page);
    await goToTestStatic(page);
    await switchTab(page, 'Schedule');

    const title = `${TEST_SESSION_PREFIX}Recurring ${runId}`;
    await page.getByRole('button', { name: 'Add session' }).first().click();
    await fillAndSubmitSession(page, { title, recurring: true, days: ['Tue', 'Fri'] });

    await expect(await sessionCard(page, title)).toBeVisible({ timeout: 5_000 });
  });

  test('5 — Member can RSVP', async ({ page, browser }) => {
    const title = `${TEST_SESSION_PREFIX}RSVP Target ${runId}`;

    await loginAsOwner(page);
    await goToTestStatic(page);
    await switchTab(page, 'Schedule');
    await page.getByRole('button', { name: 'Add session' }).first().click();
    await fillAndSubmitSession(page, { title });

    const memberContext = await browser.newContext({ baseURL: FRONTEND_BASE });
    const memberPage = await memberContext.newPage();
    await loginAsMember(memberPage);
    await goToTestStatic(memberPage);
    await switchTab(memberPage, 'Schedule');

    const targetCard = await sessionCard(memberPage, title);
    await expect(targetCard).toBeVisible({ timeout: 5_000 });

    const btn = targetCard.getByRole('button', { name: "I'm in" });
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'true', { timeout: 3_000 });
    await memberContext.close();
  });

  test('5b — Initial RSVP defaults members and can be changed', async ({ page, browser }) => {
    const title = `${TEST_SESSION_PREFIX}Initial RSVP ${runId}`;

    await loginAsOwner(page);
    await goToTestStatic(page);
    await switchTab(page, 'Schedule');
    await page.getByRole('button', { name: 'Add session' }).first().click();
    await expect(page.getByTestId('initial-rsvp-field')).toContainText('No response');
    await fillAndSubmitSession(page, { title, initialRsvp: 'Available' });

    const ownerCard = await sessionCard(page, title);
    await expect(ownerCard.getByRole('button', { name: "I'm in" })).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });

    const memberContext = await browser.newContext({ baseURL: FRONTEND_BASE });
    const memberPage = await memberContext.newPage();
    await loginAsMember(memberPage);
    await goToTestStatic(memberPage);
    await switchTab(memberPage, 'Schedule');

    const memberCard = await sessionCard(memberPage, title);
    await expect(memberCard).toBeVisible({ timeout: 5_000 });
    await expect(memberCard.getByRole('button', { name: "I'm in" })).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
    await memberCard.getByRole('button', { name: "Can't make it" }).click();
    await expect(memberCard.getByRole('button', { name: "Can't make it" })).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
    await memberContext.close();
  });

  test('6 — Availability grid can save one cell', async ({ page }) => {
    await loginAsOwner(page);
    await goToTestStatic(page);
    await switchTab(page, 'Schedule');
    await openEditAvailability(page);

    const grid = page.getByTestId('availability-grid');
    await grid.scrollIntoViewIfNeeded();
    await expect(page.locator('[data-testid^="avail-cell-"]').first()).toBeVisible({ timeout: 10_000 });

    let found = await findUnselectedCell(page);
    if (!found) {
      // The probe window (1800-2030) is fully selected — this test's own
      // prior runs (plus test 8's permanent claim on 1900) saturate it over
      // time. The grid is a click-toggle, auto-save-on-click editor
      // (AvailabilityGrid.tsx's window `mouseup` handler persists on every
      // click, no separate save button), so deselecting a probe cell IS a
      // real save — do that first to free a cell, then fall through to the
      // normal select+save+verify path below. Skip 1900: test 8 depends on
      // it staying selected. This makes the test idempotent long-term: once
      // saturated, every future run deselects then reselects the same cell,
      // always exercising a genuine click+save instead of permanently
      // skipping.
      const today = todayStr();
      let toggled: { cell: ReturnType<Page['getByTestId']>; cellId: string } | null = null;
      for (const time of ['1800', '1830', '1930', '2000', '2030']) {
        const id = `avail-cell-${today}-${time}`;
        const candidate = page.getByTestId(id);
        if (await candidate.isVisible().catch(() => false)) {
          toggled = { cell: candidate, cellId: id };
          break;
        }
      }
      if (!toggled) {
        throw new Error('6 — Availability grid: no probe cell visible to deselect for un-saturation');
      }

      await toggled.cell.click();
      await expect(page.getByTestId(toggled.cellId)).toHaveAttribute('data-user-selected', 'false', {
        timeout: 5_000,
      });

      found = await findUnselectedCell(page);
      if (!found) {
        throw new Error('6 — Availability grid: still no unselected cell after deselecting a probe cell');
      }
    }
    const { cell, cellId } = found;

    await cell.click();
    await expect(page.getByTestId(cellId)).toHaveAttribute('data-user-selected', 'true', {
      timeout: 5_000,
    });
  });

  test('7 — Availability grid can save drag-selected cells', async ({ page }) => {
    await loginAsMember(page);
    await goToTestStatic(page);
    await switchTab(page, 'Schedule');
    await openEditAvailability(page);

    const grid = page.getByTestId('availability-grid');
    await grid.scrollIntoViewIfNeeded();
    await expect(page.locator('[data-testid^="avail-cell-"]').first()).toBeVisible({ timeout: 10_000 });

    // Use late-evening slots that are unlikely to be selected already
    const today = todayStr();
    const cell1 = page.getByTestId(`avail-cell-${today}-2200`);
    const cell2 = page.getByTestId(`avail-cell-${today}-2230`);
    const cell3 = page.getByTestId(`avail-cell-${today}-2300`);

    // Scroll the target cells into the viewport before interacting
    await cell1.scrollIntoViewIfNeeded().catch(() => {});
    if (!(await cell1.isVisible().catch(() => false))) {
      test.skip(true, 'Grid cells not visible — timezone boundary');
      return;
    }

    // If already selected, deselect first by clicking each
    for (const c of [cell1, cell2, cell3]) {
      if ((await c.getAttribute('data-user-selected')) === 'true') {
        await c.click();
        await page.waitForTimeout(300);
      }
    }

    // Scroll cell1 into view again (deselecting may have shifted layout)
    await cell1.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);

    const box1 = await cell1.boundingBox();
    const box3 = await cell3.boundingBox();
    if (!box1 || !box3) {
      test.skip(true, 'Cannot get bounding boxes');
      return;
    }

    await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2);
    await page.mouse.down();
    const box2 = await cell2.boundingBox();
    if (box2) {
      await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2, { steps: 3 });
    }
    await page.mouse.move(box3.x + box3.width / 2, box3.y + box3.height / 2, { steps: 3 });
    await page.mouse.up();

    await expect(cell1).toHaveAttribute('data-user-selected', 'true', { timeout: 5_000 });
    await expect(cell2).toHaveAttribute('data-user-selected', 'true', { timeout: 5_000 });
    await expect(cell3).toHaveAttribute('data-user-selected', 'true', { timeout: 5_000 });
  });

  test('8 — Availability persists after refresh', async ({ page }) => {
    // A hard page.reload() mid-suite can hit a cold Vite dev-server module
    // fetch (observed live to occasionally take >15s before React even mounts)
    // — give this test more runway than the file's 30s default so that alone
    // doesn't flake it.
    test.setTimeout(60_000);
    await loginAsOwner(page);
    await goToTestStatic(page);
    await switchTab(page, 'Schedule');
    await openEditAvailability(page);

    const grid = page.getByTestId('availability-grid');
    await grid.scrollIntoViewIfNeeded();
    await expect(page.locator('[data-testid^="avail-cell-"]').first()).toBeVisible({ timeout: 10_000 });

    // Find or create a selected cell
    const today = todayStr();
    let cellId = `avail-cell-${today}-1900`;
    let cell = page.getByTestId(cellId);

    if (!(await cell.isVisible().catch(() => false))) {
      cellId = `avail-cell-${today}-2000`;
      cell = page.getByTestId(cellId);
    }
    if (!(await cell.isVisible().catch(() => false))) {
      test.skip(true, 'Target cell not visible');
      return;
    }

    // Ensure selected — wait for the backend PUT /availability to complete before
    // reloading, otherwise the optimistic UI update is visible but the save hasn't
    // persisted yet and the cell won't show as selected after refresh.
    if ((await cell.getAttribute('data-user-selected')) !== 'true') {
      const savePromise = page.waitForResponse(
        (r) => r.url().includes('/availability') && r.request().method() === 'PUT',
        { timeout: 10_000 },
      );
      await cell.click();
      await expect(cell).toHaveAttribute('data-user-selected', 'true', { timeout: 5_000 });
      await savePromise;
    }

    // Reload and verify — re-enter through Edit week after the reload. A cold
    // dev-server module fetch can make this particular reload much slower
    // than the app's steady-state — same canRsvp-gates-"Edit week" hydration
    // race goToTestStatic() guards against, just with more runway here.
    await page.reload();
    await page.locator('[data-testid="new-shell"]').waitFor({ timeout: 30_000 });
    await page.getByRole('button', { name: /User menu for/i }).waitFor({ timeout: 30_000 });
    await switchTab(page, 'Schedule');
    await openEditAvailability(page);

    const gridAfter = page.getByTestId('availability-grid');
    await gridAfter.scrollIntoViewIfNeeded();
    await expect(page.getByTestId(cellId)).toHaveAttribute('data-user-selected', 'true', {
      timeout: 5_000,
    });
  });

  test('9 — Recommendation panel appears after availability exists', async ({ page }) => {
    await loginAsOwner(page);
    await goToTestStatic(page);
    await switchTab(page, 'Schedule');

    await expect(page.getByRole('heading', { name: 'Best times this week' })).toBeVisible({ timeout: 5_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. Guest / unauthenticated access to a PUBLIC static (read-only)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Viewer restrictions', () => {
  test('10 — Guest on public static is read-only', async ({ browser }) => {
    // dev-auth flips DEVTST to isPublic=true on every owner/member login, and
    // no prior test in this file leaves it private, so the static is public
    // here — no setStaticPublic call needed for this half of the split.
    const ctx = await browser.newContext({ baseURL: FRONTEND_BASE });
    const page = await ctx.newPage();
    await page.goto(`/group/${DEV_SHARE_CODE}?shell=v2`);
    await page.locator('[data-testid="new-shell"]').waitFor({ timeout: 15_000 });

    // Anchor on a positive signal that the static actually rendered before
    // asserting the negative — otherwise a count-0 assert would pass just as
    // easily on a blank/broken page as on a correctly-gated one.
    await expect(page.getByText('Dev Test Static').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Invite members' })).toHaveCount(0);

    await switchTab(page, 'Schedule');
    await expect(page.getByTestId('schedule-screen')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add session' })).toHaveCount(0);

    await ctx.close();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11-13. Settings panel access
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Settings access', () => {
  test('11 — Owner can open settings panel', async ({ page }) => {
    await loginAsOwner(page);
    await goToTestStatic(page);

    const settingsBtn = page.getByRole('button', { name: 'Settings' });
    await expect(settingsBtn).toBeVisible({ timeout: 5_000 });
    await settingsBtn.click();

    const dialog = page.getByRole('dialog', { name: 'Static settings' });
    await expect(dialog).toBeVisible({ timeout: 3_000 });
    await expect(dialog.getByRole('button', { name: 'General', exact: true })).toBeVisible();
  });

  test('12 — Unauthenticated user sees Private Static wall, not the static', async ({
    page,
    browser,
  }) => {
    await loginAsOwner(page);
    try {
      await setStaticPublic(page, false);

      const ctx = await browser.newContext({ baseURL: FRONTEND_BASE });
      const guestPage = await ctx.newPage();
      await guestPage.goto(`/group/${DEV_SHARE_CODE}?shell=v2`);
      await expect(guestPage.getByTestId('shell-state-error')).toBeVisible({ timeout: 15_000 });
      await expect(guestPage.getByRole('heading', { name: 'Private Static' })).toBeVisible();
      await ctx.close();
    } finally {
      await setStaticPublic(page, true);
    }
  });

  test('13 — Owner settings panel has all management tabs', async ({ page }) => {
    await loginAsOwner(page);
    await goToTestStatic(page);

    await page.getByRole('button', { name: 'Settings' }).click();

    const dialog = page.getByRole('dialog', { name: 'Static settings' });
    await expect(dialog).toBeVisible({ timeout: 3_000 });

    for (const tab of ['General', 'Priority', 'Members', 'Recruitment', 'Integrations']) {
      await expect(dialog.getByRole('button', { name: tab, exact: true })).toBeVisible();
    }

    await dialog.getByRole('button', { name: 'Recruitment', exact: true }).click();
    // The Recruitment sub-nav (Overview/Listing/Requests/Invitations) renders as
    // role="tab" (SettingsSubNav), unlike the top-level settings tabs above
    // (plain buttons) — see task-5-report.md for the brief-vs-reality note.
    await expect(dialog.getByRole('tab', { name: 'Invitations', exact: true })).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 14. Lodestone dev mock flow (via the surviving Profile → Character Link UI)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Lodestone Sync', () => {
  test('14 — DEV_LODESTONE_MOCK search and link work from the profile Character Link modal', async ({ page }) => {
    await loginAsOwner(page);

    if (!(await isLodestoneMockEnabled(page))) {
      test.skip(true, 'DEV_LODESTONE_MOCK is not enabled on the backend');
      return;
    }

    await cleanupLinkedMockCharacter(page);

    // Stage-1 T6: this is the v2 family suite, so pin the shell explicitly.
    // Before the coverage flip `/profile` was legacy-chromed for everyone; now
    // its chrome depends on the resolved shell, and a param-less navigation
    // would inherit whatever the dev owner's account happens to mirror. The
    // pin is tab-sticky (sessionStorage), so the `page.reload()` below keeps it.
    await page.goto('/profile?shell=v2');
    // The v2 chrome mounted: the AppRail is the sentinel (AppChrome renders it
    // on every v2-chromed route). Its presence + the sidebar click below pin
    // chrome AND flow together — P1 keeps ProfileSidebarNav inside v2 chrome.
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Sync & Gear' }).click();

    await page.getByTestId('character-identity-row').getByRole('button').click();
    const modal = page.getByRole('dialog', { name: 'Link Character' });
    await expect(modal).toBeVisible({ timeout: 5_000 });

    await modal.getByPlaceholder('Character name').fill(MOCK_CHARACTER_NAME);
    await modal.getByRole('button', { name: 'Search' }).click();

    const resultRow = modal.getByTestId(`lodestone-search-result-${MOCK_CHARACTER_LODESTONE_ID}`);
    await expect(resultRow).toBeVisible({ timeout: 10_000 });
    await expect(resultRow.getByText(MOCK_CHARACTER_NAME)).toBeVisible();

    await resultRow.getByRole('button', { name: 'Link' }).click();
    await expect(modal).toBeHidden({ timeout: 10_000 });

    await expect(page.getByTestId('character-identity-row')).toContainText(MOCK_CHARACTER_NAME, { timeout: 5_000 });

    await page.reload();
    await page.getByRole('button', { name: 'Sync & Gear' }).click();
    await expect(page.getByTestId('character-identity-row')).toContainText(MOCK_CHARACTER_NAME, { timeout: 15_000 });

    await cleanupLinkedMockCharacter(page);
  });
});
