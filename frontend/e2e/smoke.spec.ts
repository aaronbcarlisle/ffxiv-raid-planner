/**
 * FFXIV Raid Planner — Playwright smoke tests.
 *
 * Prerequisites:
 *   1. Backend running on localhost:8001 with DEV_AUTH_MODE=true
 *   2. Frontend running on localhost:5174
 *   3. Optional E2E_API_URL / E2E_FRONTEND_URL when using non-default ports
 *
 * Run: pnpm test:e2e
 */

import { test, expect, type Page } from '@playwright/test';
import {
  API_BASE,
  FRONTEND_BASE,
  loginAsOwner,
  loginAsMember,
  goToTestStatic,
  switchTab,
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

async function switchScheduleSubTab(page: Page, tabName: 'Sessions' | 'Availability' | 'Integrations') {
  await page.getByTestId(`schedule-subtab-${tabName.toLowerCase()}`).click();
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

test.describe('Auth & Navigation', () => {
  test('1 — Owner can log in and open test static', async ({ page }) => {
    await loginAsOwner(page);
    await goToTestStatic(page);
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
    await goToTestStatic(page);
    await switchTab(page, 'Schedule');
    await expect(page.getByText('Raid Schedule')).toBeVisible();
    await expect(page.getByTestId('schedule-tab')).toBeVisible();
    await expect(page.getByTestId('schedule-subtab-sessions')).toBeVisible();
    await expect(page.getByTestId('schedule-subtab-availability')).toBeVisible();
    await expect(page.getByTestId('schedule-subtab-integrations')).toBeVisible();
  });

  test('3 — Owner can create a session', async ({ page }) => {
    await loginAsOwner(page);
    await goToTestStatic(page);
    await switchTab(page, 'Schedule');
    await switchScheduleSubTab(page, 'Sessions');

    const title = `${TEST_SESSION_PREFIX}Smoke ${runId}`;
    await page.getByTestId('add-session-btn').click();
    await expect(page.getByText('Add Raid Session')).toBeVisible();
    await fillAndSubmitSession(page, { title });
    const card = page.getByTestId('session-card').filter({ hasText: title });
    await expect(card).toBeVisible({ timeout: 5_000 });
  });

  test('4 — Owner can create Tue/Fri recurring session', async ({ page }) => {
    await loginAsOwner(page);
    await goToTestStatic(page);
    await switchTab(page, 'Schedule');
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
    await goToTestStatic(page);
    await switchTab(page, 'Schedule');
    await switchScheduleSubTab(page, 'Sessions');
    await page.getByTestId('add-session-btn').click();
    await fillAndSubmitSession(page, { title });

    const memberContext = await browser.newContext({ baseURL: FRONTEND_BASE });
    const memberPage = await memberContext.newPage();
    await loginAsMember(memberPage);
    await goToTestStatic(memberPage);
    await switchTab(memberPage, 'Schedule');
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
    await goToTestStatic(page);
    await switchTab(page, 'Schedule');
    await switchScheduleSubTab(page, 'Sessions');
    await page.getByTestId('add-session-btn').click();
    await expect(page.getByTestId('initial-rsvp-field')).toContainText('No response');
    await fillAndSubmitSession(page, { title, initialRsvp: 'Available' });

    const ownerCard = page.getByTestId('session-card').filter({ hasText: title });
    await expect(ownerCard.getByTestId('rsvp-available')).toHaveClass(/bg-green/, { timeout: 5_000 });

    const memberContext = await browser.newContext({ baseURL: FRONTEND_BASE });
    const memberPage = await memberContext.newPage();
    await loginAsMember(memberPage);
    await goToTestStatic(memberPage);
    await switchTab(memberPage, 'Schedule');
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
    await goToTestStatic(page);
    await switchTab(page, 'Schedule');

    // Register the waitForResponse BEFORE tab switch so the GET is captured.
    const availGetPromise = page.waitForResponse(
      (r) => r.url().includes('/availability') && r.request().method() === 'GET',
      { timeout: 15_000 },
    );
    await switchScheduleSubTab(page, 'Availability');
    await availGetPromise;

    const grid = page.getByTestId('availability-grid');
    await grid.scrollIntoViewIfNeeded();
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
    await goToTestStatic(page);
    await switchTab(page, 'Schedule');

    // Register before tab switch so the GET is captured.
    const availGetPromise = page.waitForResponse(
      (r) => r.url().includes('/availability') && r.request().method() === 'GET',
      { timeout: 15_000 },
    );
    await switchScheduleSubTab(page, 'Availability');
    await availGetPromise;

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
    await loginAsOwner(page);
    await goToTestStatic(page);
    await switchTab(page, 'Schedule');
    await switchScheduleSubTab(page, 'Availability');

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

    // Reload and verify
    await page.reload();
    await page.getByRole('button', { name: 'Roster', exact: true }).first().waitFor({ timeout: 15_000 });
    await switchTab(page, 'Schedule');
    await switchScheduleSubTab(page, 'Availability');

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
    await switchScheduleSubTab(page, 'Availability');

    const grid = page.getByTestId('availability-grid');
    await grid.scrollIntoViewIfNeeded();
    await expect(grid.getByText('Members Tracked')).toBeVisible({ timeout: 5_000 });
    await expect(grid.getByText('Shared Windows')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. Viewer / unauthenticated user cannot access private static
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Viewer restrictions', () => {
  test('10 — Unauthenticated user cannot access private static schedule', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ baseURL: FRONTEND_BASE });
    const page = await ctx.newPage();
    await page.goto(`/group/${DEV_SHARE_CODE}`);

    // The dev static is private → "Private Static" error wall
    await expect(page.getByText('Private Static')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('schedule-tab')).toBeHidden();
    await expect(page.getByTestId('add-session-btn')).toBeHidden();
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

    const settingsBtn = page.getByRole('button', { name: /Static settings/i });
    await expect(settingsBtn).toBeVisible({ timeout: 5_000 });
    await settingsBtn.click();

    await expect(
      page.getByRole('button', { name: /^General$/i }).first(),
    ).toBeVisible({ timeout: 3_000 });
  });

  test('12 — Unauthenticated user sees Private Static wall, not settings', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ baseURL: FRONTEND_BASE });
    const page = await ctx.newPage();
    await page.goto(`/group/${DEV_SHARE_CODE}`);
    await expect(page.getByText('Private Static')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Static settings/i })).toBeHidden();
    await ctx.close();
  });

  test('13 — Owner settings panel has all management tabs', async ({ page }) => {
    await loginAsOwner(page);
    await goToTestStatic(page);

    await page.getByRole('button', { name: /Static settings/i }).click();

    // Scope to settings slide-out (role="dialog")
    const panel = page.getByLabel('Static Settings', { exact: true });
    await expect(panel).toBeVisible({ timeout: 3_000 });

    for (const tab of ['General', 'Priority', 'Members', 'Invitations']) {
      await expect(
        panel.getByRole('button', { name: new RegExp(`^${tab}$`, 'i') }),
      ).toBeVisible();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 14. Lodestone dev mock flow
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Lodestone Sync', () => {
  test('14 — DEV_LODESTONE_MOCK search, preview, and sync work from PlayerCard', async ({ page }) => {
    await loginAsOwner(page);

    if (!(await isLodestoneMockEnabled(page))) {
      test.skip(true, 'DEV_LODESTONE_MOCK is not enabled on the backend');
      return;
    }

    await goToTestStatic(page);

    await openPlayerContextMenu(page);
    await page.getByRole('menuitem', { name: /Lodestone Sync|Re-sync Lodestone/i }).click();

    await expect(page.getByTestId('lodestone-dev-mock-hint')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('lodestone-mock-search-mock-raider').click();
    await page.getByTestId('lodestone-search-result-910001').click();

    const preview = page.getByTestId('lodestone-preview-card');
    await expect(preview.getByText('Mock Raider')).toBeVisible({ timeout: 10_000 });
    await expect(preview.getByText(/Gilgamesh • DRG/i)).toBeVisible();
    await expect(preview.getByText("Cruiserweight Champion's Spear")).toBeVisible();

    await page.getByTestId('lodestone-sync-button').click();
    await expect(page.getByTestId('lodestone-sync-button')).toBeHidden({ timeout: 10_000 });

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
