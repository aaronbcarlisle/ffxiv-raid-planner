/**
 * FFXIV Raid Planner — Playwright smoke tests (LEGACY shell).
 *
 * Phase R restored the classic GroupView chrome (byte-for-byte, f45a241 state)
 * as the default `/group/:shareCode` experience, with v2 available behind
 * `?shell=v2` / a persisted opt-in preference. This suite is the resurrection
 * of the pre-flip `smoke.spec.ts` (last live at f45a241, before flip-P2 made
 * v2 the default and flip-P3 deleted the legacy chrome entirely) — it
 * characterizes the RESTORED legacy surface. All navigation pins
 * `?shell=legacy` explicitly so it never depends on the resolver's default.
 *
 * Six rot fixes (test drift, not product bugs — see task-9-report.md):
 *   1    — test 2 now navigates into the Schedule tab's "Calendar" view
 *          before asserting: the restored `ScheduleTab` (sub-tabs, the
 *          "Raid Schedule" heading) only renders there — the Schedule tab's
 *          default "Upcoming" view is a newer summary panel
 *          (`ScheduleUpcomingPanel`) added after this suite was last live.
 *          Tests 3-9 route through the same `goToScheduleCalendarView` helper.
 *   2/4  — tests 10/12 now explicitly flip DEVTST private (dev-auth re-flips
 *          it public on every login, so "the dev static is private" could no
 *          longer be assumed) via setStaticPublic + try/finally restore.
 *   3/5  — tests 11/13 now target the LIVE desktop settings trigger
 *          (SettingsDockToggle, aria-label "Open settings"/"Close settings" —
 *          the old "Static settings"-labelled button no longer exists) and
 *          the actual settings-panel tab set (General/Priority/Members are
 *          still top-level; "Invitations" is nested under "Recruitment").
 *   6    — test 14's `isLodestoneMockEnabled` guard (GET /api/lodestone/status
 *          → mockMode) was already correct; kept verbatim.
 *
 * A few more live-verified fixes surfaced beyond the 6 above while making
 * this suite reliably green (all same class — test/fixture drift, not app
 * bugs): "Add Session" modal copy (was "Add Raid Session"); the Schedule
 * sub-tab selection (`ScheduleTab`'s URL-backed `activeSubTab`) and the
 * sidebar rail's own tab selection can each silently revert shortly after a
 * click — same race class the sibling v2 suite's `switchTab` helper already
 * documents — so `goToScheduleCalendarView` / `switchScheduleSubTab` retry
 * click+verify instead of clicking once; and test 14's sync-modal outcome
 * (job mismatch between this fixture's seeded player and the mock character)
 * needed handling beyond the single auto-close path the original test assumed.
 *
 * Prerequisites:
 *   1. Backend running on localhost:8001 with DEV_AUTH_MODE=true
 *   2. Frontend running on localhost:5174
 *   3. Optional E2E_API_URL / E2E_FRONTEND_URL when using non-default ports
 *
 * Run: pnpm exec playwright test e2e/smoke-legacy.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';
import {
  API_BASE,
  FRONTEND_BASE,
  loginAsOwner,
  loginAsMember,
  goToTestStaticLegacy,
  switchTabLegacy,
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** datetime-local string for "tomorrow at <hour>". */
function tomorrowAt(hour: number): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

/** Fill the Create-Session modal and submit. Expects modal already open. */
async function fillAndSubmitSession(
  page: Page,
  opts: {
    title: string;
    startHour?: number;
    endHour?: number;
    recurring?: boolean;
    days?: string[];
    initialRsvp?: 'Available' | 'Tentative' | 'Unavailable';
  },
) {
  await page.getByTestId('session-title-input').fill(opts.title);
  await page.getByTestId('session-start-input').fill(tomorrowAt(opts.startHour ?? 20));
  await page.getByTestId('session-end-input').fill(tomorrowAt(opts.endHour ?? 23));

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
 * Click a Sessions/Availability/Integrations sub-tab within the restored
 * `ScheduleTab` and make sure the selection sticks. Same race class as
 * `goToScheduleCalendarView` above (and the same one the v2 `switchTab`
 * helper documents): `ScheduleTab`'s `activeSubTab` is URL-backed
 * (`useUrlTabState('stab', ...)`), and that hook's own missing-param backfill
 * effect can settle AFTER this click and silently revert the selection —
 * observed live, intermittently, most often for non-owner sessions (e.g. test
 * 7's `loginAsMember`). Retry click+verify via the tab's own
 * `aria-selected="true"` (ScheduleTab.tsx renders these as `role="tab"`).
 */
async function switchScheduleSubTab(page: Page, tabName: 'Sessions' | 'Availability' | 'Integrations') {
  const tab = page.getByTestId(`schedule-subtab-${tabName.toLowerCase()}`);
  await expect(async () => {
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 1_000 });
    await page.waitForTimeout(300);
    await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

/**
 * Locate the availability grid and scroll it into view, retrying the whole
 * lookup+scroll if it throws "Element is not attached to the DOM" (observed
 * live, intermittently: AvailabilityGrid swaps its loading-skeleton DOM node
 * for the real grid shortly after the Availability sub-tab activates, and a
 * scroll that lands mid-swap grabs a reference to the about-to-be-replaced
 * node). Not selector drift — a genuine same-suite render race.
 */
async function scrollAvailabilityGridIntoView(page: Page) {
  const grid = page.getByTestId('availability-grid');
  await expect(async () => {
    await grid.scrollIntoViewIfNeeded();
  }).toPass({ timeout: 20_000 });
  return grid;
}

/**
 * Rot fix #1: switch to the Schedule tab AND select its "Calendar" view.
 * The restored `ScheduleTab` (Sessions/Availability/Integrations sub-tabs,
 * the `schedule-tab` testid, the "Raid Schedule" heading) only renders behind
 * that toggle — GroupViewContent's Schedule tab defaults to an "Upcoming"
 * view (`ScheduleUpcomingPanel`, a newer summary surface added after this
 * suite was last live) and only swaps to `ScheduleTab` once "Calendar" is
 * selected (GroupViewContent.tsx `scheduleView` local state).
 *
 * The sidebar rail's own tab switch races a URL/pageMode-memory effect the
 * same way v2's `switchTab` helper documents (observed live: the rail's
 * "Schedule" item briefly activates then silently reverts to whatever tab was
 * previously active) — `switchTabLegacy` itself stays the verbatim f45a241
 * single click, so the retry lives here instead, gated on the rail item's own
 * `aria-current="page"` active-state attribute (SidebarRail.tsx).
 */
async function goToScheduleCalendarView(page: Page): Promise<void> {
  const scheduleNavItem = page.getByRole('button', { name: 'Schedule', exact: true });
  await expect(async () => {
    await switchTabLegacy(page, 'Schedule');
    await expect(scheduleNavItem).toHaveAttribute('aria-current', 'page', { timeout: 1_000 });
    await page.waitForTimeout(300);
    await expect(scheduleNavItem).toHaveAttribute('aria-current', 'page', { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
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

async function openPlayerContextMenu(page: Page) {
  const card = page.getByTestId('player-card').first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.scrollIntoViewIfNeeded();

  const box = await card.boundingBox();
  if (!box) {
    throw new Error('Could not determine PlayerCard bounds');
  }

  await page.mouse.click(box.x + 24, box.y + 24, { button: 'right' });
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
 * Find the first visible & unselected availability cell for today.
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

// ═══════════════════════════════════════════════════════════════════════════
// 1. Auth & navigation
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Legacy shell smoke', () => {

test.describe('Auth & Navigation', () => {
  test('1 — Owner can log in and open test static', async ({ page }) => {
    await loginAsOwner(page);
    await goToTestStaticLegacy(page);
    await expect(page.getByText('Dev Test Static').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Roster', exact: true }).first()).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2-9. Schedule
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Schedule', () => {
  test.describe.configure({ mode: 'serial' });

  test.afterEach(async ({ page }) => {
    await cleanupTestSessions(page);
  });

  test('2 — Schedule tab loads', async ({ page }) => {
    await loginAsOwner(page);
    await goToTestStaticLegacy(page);
    await goToScheduleCalendarView(page);
    await expect(page.getByText('Raid Schedule')).toBeVisible();
    await expect(page.getByTestId('schedule-tab')).toBeVisible();
    await expect(page.getByTestId('schedule-subtab-sessions')).toBeVisible();
    await expect(page.getByTestId('schedule-subtab-availability')).toBeVisible();
    await expect(page.getByTestId('schedule-subtab-integrations')).toBeVisible();
  });

  test('3 — Owner can create a session', async ({ page }) => {
    await loginAsOwner(page);
    await goToTestStaticLegacy(page);
    await goToScheduleCalendarView(page);
    await switchScheduleSubTab(page, 'Sessions');

    const title = `${TEST_SESSION_PREFIX}Smoke ${runId}`;
    await page.getByTestId('add-session-btn').click();
    await expect(page.getByRole('dialog', { name: /Add Session/i })).toBeVisible();
    await fillAndSubmitSession(page, { title });
    const card = page.getByTestId('session-card').filter({ hasText: title });
    await expect(card).toBeVisible({ timeout: 5_000 });
  });

  test('4 — Owner can create Tue/Fri recurring session', async ({ page }) => {
    await loginAsOwner(page);
    await goToTestStaticLegacy(page);
    await goToScheduleCalendarView(page);
    await switchScheduleSubTab(page, 'Sessions');

    const title = `${TEST_SESSION_PREFIX}Recurring ${runId}`;
    await page.getByTestId('add-session-btn').click();
    await fillAndSubmitSession(page, { title, recurring: true, days: ['Tue', 'Fri'] });

    const card = page.getByTestId('session-card').filter({ hasText: title });
    await expect(card).toBeVisible({ timeout: 5_000 });
  });

  test('5 — Member can RSVP', async ({ page, browser }) => {
    const title = `${TEST_SESSION_PREFIX}RSVP Target ${runId}`;

    await loginAsOwner(page);
    await goToTestStaticLegacy(page);
    await goToScheduleCalendarView(page);
    await switchScheduleSubTab(page, 'Sessions');
    await page.getByTestId('add-session-btn').click();
    await fillAndSubmitSession(page, { title });

    const memberContext = await browser.newContext({ baseURL: FRONTEND_BASE });
    const memberPage = await memberContext.newPage();
    await loginAsMember(memberPage);
    await goToTestStaticLegacy(memberPage);
    await goToScheduleCalendarView(memberPage);
    await switchScheduleSubTab(memberPage, 'Sessions');

    const targetCard = memberPage.getByTestId('session-card').filter({ hasText: title });
    await expect(targetCard).toBeVisible({ timeout: 5_000 });

    const btn = targetCard.getByTestId('rsvp-available');
    await btn.click();
    await expect(btn).toHaveClass(/bg-green/, { timeout: 3_000 });
    await memberContext.close();
  });

  test('5b — Initial RSVP defaults members and can be changed', async ({ page, browser }) => {
    const title = `${TEST_SESSION_PREFIX}Initial RSVP ${runId}`;

    await loginAsOwner(page);
    await goToTestStaticLegacy(page);
    await goToScheduleCalendarView(page);
    await switchScheduleSubTab(page, 'Sessions');
    await page.getByTestId('add-session-btn').click();
    await expect(page.getByTestId('initial-rsvp-field')).toContainText('No response');
    await fillAndSubmitSession(page, { title, initialRsvp: 'Available' });

    const ownerCard = page.getByTestId('session-card').filter({ hasText: title });
    await expect(ownerCard.getByTestId('rsvp-available')).toHaveClass(/bg-green/, { timeout: 5_000 });

    const memberContext = await browser.newContext({ baseURL: FRONTEND_BASE });
    const memberPage = await memberContext.newPage();
    await loginAsMember(memberPage);
    await goToTestStaticLegacy(memberPage);
    await goToScheduleCalendarView(memberPage);
    await switchScheduleSubTab(memberPage, 'Sessions');

    const memberCard = memberPage.getByTestId('session-card').filter({ hasText: title });
    await expect(memberCard).toBeVisible({ timeout: 5_000 });
    await expect(memberCard.getByTestId('rsvp-available')).toHaveClass(/bg-green/, { timeout: 5_000 });
    await memberCard.getByTestId('rsvp-unavailable').click();
    await expect(memberCard.getByTestId('rsvp-unavailable')).toHaveClass(/bg-red/, { timeout: 5_000 });
    await memberContext.close();
  });

  test('6 — Availability grid can save one cell', async ({ page }) => {
    await loginAsOwner(page);
    await goToTestStaticLegacy(page);
    await goToScheduleCalendarView(page);

    // Register the waitForResponse BEFORE tab switch so the GET is captured.
    const availGetPromise = page.waitForResponse(
      (r) => r.url().includes('/availability') && r.request().method() === 'GET',
      { timeout: 15_000 },
    );
    await switchScheduleSubTab(page, 'Availability');
    await availGetPromise;

    await scrollAvailabilityGridIntoView(page);
    await expect(page.locator('[data-testid^="avail-cell-"]').first()).toBeVisible({ timeout: 10_000 });

    const found = await findUnselectedCell(page);
    if (!found) {
      test.skip(true, 'No unselected cell available — all evening slots already selected');
      return;
    }
    const { cell, cellId } = found;

    await cell.click();
    await expect(page.getByTestId(cellId)).toHaveAttribute('data-user-selected', 'true', {
      timeout: 5_000,
    });
  });

  test('7 — Availability grid can save drag-selected cells', async ({ page }) => {
    await loginAsMember(page);
    await goToTestStaticLegacy(page);
    await goToScheduleCalendarView(page);

    // Register before tab switch so the GET is captured.
    const availGetPromise = page.waitForResponse(
      (r) => r.url().includes('/availability') && r.request().method() === 'GET',
      { timeout: 15_000 },
    );
    await switchScheduleSubTab(page, 'Availability');
    await availGetPromise;

    await scrollAvailabilityGridIntoView(page);
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
    // fetch (same symptom the sibling v2 suite's equivalent test documents:
    // occasionally >15s before React even mounts) — give this test more
    // runway than the file's 30s default so that alone doesn't flake it.
    test.setTimeout(60_000);
    await loginAsOwner(page);
    await goToTestStaticLegacy(page);
    await goToScheduleCalendarView(page);
    await switchScheduleSubTab(page, 'Availability');

    await scrollAvailabilityGridIntoView(page);
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

    // Reload and verify
    await page.reload();
    await page.getByRole('button', { name: 'Roster', exact: true }).first().waitFor({ timeout: 15_000 });
    await goToScheduleCalendarView(page);
    await switchScheduleSubTab(page, 'Availability');

    await scrollAvailabilityGridIntoView(page);
    await expect(page.getByTestId(cellId)).toHaveAttribute('data-user-selected', 'true', {
      timeout: 5_000,
    });
  });

  test('9 — Recommendation panel appears after availability exists', async ({ page }) => {
    await loginAsOwner(page);
    await goToTestStaticLegacy(page);
    await goToScheduleCalendarView(page);
    await switchScheduleSubTab(page, 'Availability');

    const grid = await scrollAvailabilityGridIntoView(page);
    await expect(grid.getByText('Members Tracked')).toBeVisible({ timeout: 5_000 });
    await expect(grid.getByText('Shared Windows')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. Viewer / unauthenticated user cannot access private static
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Viewer restrictions', () => {
  // Rot fix #2: dev-auth re-flips DEVTST to isPublic=true on every owner/member
  // login (a behavior added after this suite was last live), so "the dev static
  // is private" can no longer be assumed by default — flip it explicitly and
  // restore afterwards (P3-proven try/finally pattern, helper already at HEAD).
  test('10 — Unauthenticated user cannot access private static schedule', async ({ page, browser }) => {
    await loginAsOwner(page);
    try {
      await setStaticPublic(page, false);

      const ctx = await browser.newContext({ baseURL: FRONTEND_BASE });
      const guestPage = await ctx.newPage();
      await guestPage.goto(`/group/${DEV_SHARE_CODE}?shell=legacy`);

      // The static is private → "Private Static" error wall
      await expect(guestPage.getByText('Private Static')).toBeVisible({ timeout: 15_000 });
      await expect(guestPage.getByTestId('schedule-tab')).toBeHidden();
      await expect(guestPage.getByTestId('add-session-btn')).toBeHidden();
      await ctx.close();
    } finally {
      await setStaticPublic(page, true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11-13. Settings panel access
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Settings access', () => {
  // Rot fix #3: the legacy desktop settings trigger is SettingsDockToggle
  // (components/layout/SettingsDockToggle.tsx), a docked toggle at the right
  // content edge — aria-label "Open settings" / "Close settings" depending on
  // state. The header's mobile-only gear (aria-label "Settings") is `sm:hidden`
  // and never renders at the 1440x900 desktop viewport this suite runs at; the
  // old "Static settings"-labelled button this test used to target no longer
  // exists.
  test('11 — Owner can open settings panel', async ({ page }) => {
    await loginAsOwner(page);
    await goToTestStaticLegacy(page);

    const settingsBtn = page.getByRole('button', { name: /Open settings|Close settings/i });
    await expect(settingsBtn).toBeVisible({ timeout: 5_000 });
    await settingsBtn.click();

    await expect(
      page.getByRole('button', { name: /^General$/i }).first(),
    ).toBeVisible({ timeout: 3_000 });
  });

  // Rot fix #4: same fix as test 10 — explicitly flip DEVTST private and
  // restore in `finally`.
  test('12 — Unauthenticated user sees Private Static wall, not settings', async ({ page, browser }) => {
    await loginAsOwner(page);
    try {
      await setStaticPublic(page, false);

      const ctx = await browser.newContext({ baseURL: FRONTEND_BASE });
      const guestPage = await ctx.newPage();
      await guestPage.goto(`/group/${DEV_SHARE_CODE}?shell=legacy`);
      await expect(guestPage.getByText('Private Static')).toBeVisible({ timeout: 15_000 });
      await expect(guestPage.getByRole('button', { name: /Open settings|Close settings/i })).toBeHidden();
      await ctx.close();
    } finally {
      await setStaticPublic(page, true);
    }
  });

  // Rot fix #5: same trigger fix as test 11, PLUS the settings panel's actual
  // tab set — General/Priority/Members are still top-level buttons, but
  // "Invitations" moved under the "Recruitment" tab as a nested `role="tab"`
  // (SettingsSubNav), not a top-level plain button. Verified live against
  // SettingsPanel.tsx (shared by both shells via StaticSettingsHost —
  // identical byte-for-byte at f45a241 and HEAD, so this isn't a legacy-only
  // drift; the ORIGINAL assertion set was already stale by f45a241).
  test('13 — Owner settings panel has all management tabs', async ({ page }) => {
    await loginAsOwner(page);
    await goToTestStaticLegacy(page);

    await page.getByRole('button', { name: /Open settings|Close settings/i }).click();

    // Scope to settings slide-out (role="dialog")
    const panel = page.getByRole('dialog', { name: 'Static settings' });
    await expect(panel).toBeVisible({ timeout: 3_000 });

    for (const tab of ['General', 'Priority', 'Members', 'Recruitment']) {
      await expect(
        panel.getByRole('button', { name: tab, exact: true }),
      ).toBeVisible();
    }

    await panel.getByRole('button', { name: 'Recruitment', exact: true }).click();
    // The Recruitment sub-nav (Overview/Listing/Requests/Invitations) renders as
    // role="tab" (SettingsSubNav), unlike the top-level settings tabs above
    // (plain buttons).
    await expect(panel.getByRole('tab', { name: 'Invitations', exact: true })).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 14. Lodestone dev mock flow
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Lodestone Sync', () => {
  // Rot fix #6: `isLodestoneMockEnabled` (GET /api/lodestone/status →
  // { mockMode: true } = enabled, non-2xx/404 = disabled) was already correct
  // — kept verbatim. The flow below drives the restored PlayerCard context
  // menu → LodestoneSearchModal (components/player/LodestoneSearchModal.tsx),
  // confirmed live to still expose the exact testids this test targets.
  test('14 — DEV_LODESTONE_MOCK search, preview, and sync work from PlayerCard', async ({ page }) => {
    await loginAsOwner(page);

    if (!(await isLodestoneMockEnabled(page))) {
      test.skip(true, 'DEV_LODESTONE_MOCK is not enabled on the backend');
      return;
    }

    await goToTestStaticLegacy(page);

    await openPlayerContextMenu(page);
    await page.getByRole('menuitem', { name: /Lodestone Sync|Re-sync Lodestone/i }).click();

    await expect(page.getByTestId('lodestone-dev-mock-hint')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('lodestone-mock-search-mock-raider').click();
    await page.getByTestId('lodestone-search-result-910001').click();

    const preview = page.getByTestId('lodestone-preview-card');
    await expect(preview.getByText('Mock Raider')).toBeVisible({ timeout: 10_000 });
    await expect(preview.getByText(/Gilgamesh • DRG/i)).toBeVisible();
    await expect(preview.getByText("Cruiserweight Champion's Spear")).toBeVisible();

    const syncButton = page.getByTestId('lodestone-sync-button');
    const confirmOverwrite = page.getByTestId('lodestone-sync-confirm-overwrite');
    const dialog = page.getByRole('dialog', { name: /Lodestone Sync/i });

    // Register before the click: when the sync trips a pre-sync warning (job
    // mismatch / large iLv delta — computeSyncWarnings), the POST doesn't
    // fire until "Overwrite anyway" is confirmed below; when it doesn't, the
    // POST fires immediately on this click. Either way this promise resolves
    // once the sync itself actually executes.
    const syncPostPromise = page.waitForResponse(
      (r) => /\/api\/lodestone\/sync\//.test(r.url()) && r.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await syncButton.click();
    const needsOverwriteConfirm = await confirmOverwrite
      .waitFor({ state: 'visible', timeout: 3_000 })
      .then(() => true)
      .catch(() => false);
    if (needsOverwriteConfirm) {
      await confirmOverwrite.click();
    }
    await syncPostPromise;

    // The modal only auto-closes when the executed sync changed nothing AND
    // had no job-mismatch warning (LodestoneSearchModal.tsx `executeSync`).
    // This fixture's seeded roster player's job doesn't match the mock
    // character's job (verified live: "Job mismatch detected... player is
    // set as PLD"), so the "compare panel" and/or "job mismatch" banner —
    // both call the same onRequestClose via a "Close"/"Close anyway" button —
    // is the more common outcome. Close explicitly instead of assuming
    // auto-close.
    const closeAffordance = dialog.getByRole('button', { name: /^Close( anyway)?$/ }).first();
    await expect(async () => {
      const dialogHidden = await dialog.isHidden();
      const closeVisible = await closeAffordance.isVisible().catch(() => false);
      expect(dialogHidden || closeVisible).toBe(true);
    }).toPass({ timeout: 10_000 });
    if (await dialog.isVisible().catch(() => false)) {
      await closeAffordance.click();
    }
    // Wait for the modal itself (not just the sync button) to fully close —
    // it renders as a full-screen overlay, so a right-click meant for the
    // player card behind it can otherwise land on the still-open dialog.
    await expect(dialog).toBeHidden({ timeout: 5_000 });

    await openPlayerContextMenu(page);
    await expect(page.getByRole('menuitem', { name: /Re-sync Lodestone/i })).toBeVisible();
    await page.keyboard.press('Escape');

    if (!(await page.getByTestId('lodestone-character-avatar').first().isVisible().catch(() => false))) {
      test.skip(true, 'Cached Lodestone avatar schema is not available on this backend');
      return;
    }

    await expect(page.getByTestId('lodestone-character-avatar').first()).toBeVisible();
    await expect(page.getByTestId('lodestone-character-subtitle').first()).toContainText('Mock Raider');
    await page.reload();
    await expect(page.getByTestId('lodestone-character-avatar').first()).toBeVisible({ timeout: 15_000 });
  });
});

});
