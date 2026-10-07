/**
 * RSVP-0 (R-P0-12) — a recurring series renders ONE card per week in the v2
 * Schedule, and a past week's card reads "Played · <weekday> <date>" with no
 * RSVP buttons.
 *
 * LOCAL-ONLY: CI has no Playwright job. Run against live servers (see
 * smoke.spec.ts for the prerequisites): `pnpm -C frontend test:e2e schedule-series`.
 *
 * The series is seeded through the API (not the create modal) so it can start
 * 14 days in the past: that guarantees the previous raid week lies wholly
 * after the series' start and holds a Tue and a Fri, both already over.
 * Cleanup follows smoke.spec.ts's prefix rule: every session titled
 * "E2E Scheduler …" is deleted after the test.
 */

import { test, expect, type Page } from '@playwright/test';
import { API_BASE, loginAsOwner, ownerApiContext, goToTestStatic, switchTab } from './helpers/auth';

const TEST_SESSION_PREFIX = 'E2E Scheduler ';
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** Seed a Tue/Fri weekly series (UTC, 1 h) that started 14 days ago. Returns its id. */
async function seedTueFriSeries(page: Page, title: string): Promise<string> {
  const { groupId, csrfToken } = await ownerApiContext(page);
  const start = new Date(Date.now() - 14 * DAY_MS);
  start.setUTCSeconds(0, 0);
  const res = await page.request.post(`${API_BASE}/api/static-groups/${groupId}/schedule`, {
    headers: { 'X-CSRF-Token': csrfToken },
    data: {
      title,
      startTime: start.toISOString(),
      endTime: new Date(start.getTime() + HOUR_MS).toISOString(),
      timezone: 'UTC',
      isRecurring: true,
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU,FR',
      mirrorToDiscord: false,
      sendDiscordReminders: false,
    },
  });
  if (!res.ok()) throw new Error(`seeding "${title}" returned ${res.status()}`);
  return (await res.json() as { id: string }).id;
}

/** Delete every session whose title starts with the E2E prefix (smoke.spec.ts rule). */
async function cleanupTestSessions(page: Page) {
  const request = page.context().request;
  const login = await request.post(`${API_BASE}/api/dev-auth/login/0`);
  if (!login.ok()) throw new Error(`E2E cleanup failed: dev owner login returned ${login.status()}`);
  const { groupId, csrfToken } = await ownerApiContext(page);
  const listRes = await request.get(`${API_BASE}/api/static-groups/${groupId}/schedule`);
  if (!listRes.ok()) throw new Error(`E2E cleanup failed: session list returned ${listRes.status()}`);
  const sessions = await listRes.json() as Array<{ id: string; title: string }>;
  for (const s of sessions.filter((x) => x.title.startsWith(TEST_SESSION_PREFIX))) {
    const del = await request.delete(`${API_BASE}/api/static-groups/${groupId}/schedule/${s.id}`, {
      headers: { 'X-CSRF-Token': csrfToken },
    });
    if (!del.ok()) throw new Error(`E2E cleanup failed: deleting "${s.title}" returned ${del.status()}`);
  }
}

test.describe('Schedule — recurring series (RSVP-0)', () => {
  test.beforeEach(() => {
    test.setTimeout(45_000);
  });

  test.afterEach(async ({ page }) => {
    await cleanupTestSessions(page);
  });

  test('a Tue/Fri series shows one card this week and a Played card with no RSVP last week', async ({ page }) => {
    const title = `${TEST_SESSION_PREFIX}series ${Date.now()}`;

    await loginAsOwner(page);
    const id = await seedTueFriSeries(page, title);
    await goToTestStatic(page);
    await switchTab(page, 'Schedule');

    // Current week: the week holds a Tue and a Fri occurrence, but ONE card.
    const card = page.locator(`[id="schedule-session-${id}"]`);
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: title, exact: true })).toHaveCount(1);
    await expect(card.getByText(/^Every Tue\/Fri · .*RSVP applies to every week$/)).toBeVisible();

    // Previous week: one card, reading Played, with no RSVP buttons.
    const previous = page.getByRole('button', { name: 'Previous week' });
    test.skip(await previous.isDisabled(), 'DEVTST is on raid week 1, so there is no previous week to scope');
    await previous.click();
    await expect(card.getByTestId('countdown-chip')).toHaveText(
      /^Played · (Sun|Mon|Tue|Wed|Thu|Fri|Sat) [A-Z][a-z]{2} \d{1,2}$/,
      { timeout: 10_000 },
    );
    await expect(page.getByRole('heading', { name: title, exact: true })).toHaveCount(1);
    await expect(card.getByRole('button', { name: "I'm in" })).toHaveCount(0);
  });
});
