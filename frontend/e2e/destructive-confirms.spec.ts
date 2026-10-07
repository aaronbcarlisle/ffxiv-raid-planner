/**
 * W0 DEL-1 — destructive actions ask first, and the session modal says what
 * Discord will do.
 *
 *   1. The farm trash in Settings → Goals & Farms → Farms opens a "Delete Farm"
 *      confirm in BOTH shells (R-D1-1 / R-D1-2); Cancel keeps the row, Delete
 *      removes it.
 *   2. The trash is hover-revealed (`opacity-0 group-hover:opacity-100`), so a
 *      keyboard user must see it on focus (`focus-visible:opacity-100`). The
 *      check uses real Tab presses with the mouse parked off the row and polls
 *      the computed opacity: `toBeVisible` and a programmatic `focus()` prove
 *      nothing here.
 *   3. V2 Schedule → "Add session" shows the Discord Delivery block fed by the
 *      static's scheduler settings (R-D1-5 / R-D1-6).
 *
 * LOCAL-ONLY: CI has no Playwright job. Run against live servers (see
 * smoke.spec.ts for the prerequisites):
 *   E2E_API_URL=http://localhost:8021 E2E_FRONTEND_URL=http://localhost:5179 \
 *     pnpm -C frontend exec playwright test e2e/destructive-confirms.spec.ts
 *
 * Farms are seeded through the API as DevOwner on DEVTST. Cleanup follows
 * smoke.spec.ts's prefix rule: every farm titled "E2E Farm …" is deleted in
 * afterEach, whether or not the test already deleted its own.
 */

import { test, expect, type Page } from '@playwright/test';
import {
  API_BASE,
  DEV_SHARE_CODE,
  loginAsOwner,
  goToTestStatic,
  goToTestStaticLegacy,
  switchTab,
} from './helpers/auth';

const TEST_FARM_PREFIX = 'E2E Farm ';

/** DEVTST's id plus a CSRF token for the owner's API writes. */
async function ownerApiContext(page: Page): Promise<{ groupId: string; csrfToken: string }> {
  const groupRes = await page.request.get(`${API_BASE}/api/static-groups/by-code/${DEV_SHARE_CODE}`);
  if (!groupRes.ok()) throw new Error(`static lookup returned ${groupRes.status()}`);
  const group = await groupRes.json() as { id: string };
  const csrfToken = (await page.context().cookies(API_BASE)).find((c) => c.name === 'csrf_token')?.value;
  if (!csrfToken) throw new Error('missing csrf_token cookie — call after loginAsOwner');
  return { groupId: group.id, csrfToken };
}

/** Seed a custom-reward farm through the API. Returns its id. */
async function seedFarm(page: Page, title: string): Promise<string> {
  const { groupId, csrfToken } = await ownerApiContext(page);
  const res = await page.request.post(`${API_BASE}/api/static-groups/${groupId}/collection-goals`, {
    headers: { 'X-CSRF-Token': csrfToken },
    data: { goal_type: 'custom_reward', title },
  });
  if (!res.ok()) throw new Error(`seeding farm "${title}" returned ${res.status()}`);
  return (await res.json() as { id: string }).id;
}

/** Delete every farm whose title starts with the E2E prefix. */
async function cleanupTestFarms(page: Page) {
  const request = page.context().request;
  const login = await request.post(`${API_BASE}/api/dev-auth/login/0`);
  if (!login.ok()) throw new Error(`E2E cleanup failed: dev owner login returned ${login.status()}`);
  const { groupId, csrfToken } = await ownerApiContext(page);
  const listRes = await request.get(`${API_BASE}/api/static-groups/${groupId}/collection-goals`);
  if (!listRes.ok()) throw new Error(`E2E cleanup failed: farm list returned ${listRes.status()}`);
  const goals = await listRes.json() as Array<{ id: string; title: string }>;
  for (const g of goals.filter((x) => x.title.startsWith(TEST_FARM_PREFIX))) {
    const del = await request.delete(`${API_BASE}/api/static-groups/${groupId}/collection-goals/${g.id}`, {
      headers: { 'X-CSRF-Token': csrfToken },
    });
    if (!del.ok()) throw new Error(`E2E cleanup failed: deleting "${g.title}" returned ${del.status()}`);
  }
}

/** Gear → Goals & Farms → Farms, in whichever shell the page is already in. */
async function openFarmsList(page: Page) {
  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Static settings' });
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  await dialog.getByRole('button', { name: 'Goals & Farms', exact: true }).click();
  await dialog.getByRole('tab', { name: 'Farms', exact: true }).click();
  await expect(page).toHaveURL(/gsub=farms/);
  return dialog;
}

test.describe('Farm delete asks first (R-D1-1 / R-D1-2)', () => {
  test.beforeEach(() => {
    test.setTimeout(60_000);
  });

  test.afterEach(async ({ page }) => {
    await cleanupTestFarms(page);
  });

  test('V2: the trash opens Delete Farm; Cancel keeps the row; Delete removes it', async ({ page }) => {
    const title = `${TEST_FARM_PREFIX}v2 ${Date.now()}`;
    await loginAsOwner(page);
    await seedFarm(page, title);
    await goToTestStatic(page);

    const dialog = await openFarmsList(page);
    const row = dialog.getByTestId('collection-goal-row').filter({ hasText: title });
    await expect(row).toHaveCount(1, { timeout: 10_000 });
    const trash = row.getByRole('button', { name: `Delete ${title}` });
    const confirm = page.getByRole('dialog', { name: 'Delete Farm' });

    // Cancel: the confirm appears and closes, the row stays.
    await row.hover();
    await trash.click();
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText(title);
    await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(confirm).toHaveCount(0);
    await expect(row).toHaveCount(1);

    // Confirm: the row is gone.
    await row.hover();
    await trash.click();
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(confirm).toHaveCount(0);
    await expect(dialog.getByTestId('collection-goal-row').filter({ hasText: title })).toHaveCount(0);
  });

  test('V2: a keyboard user reaches the trash by Tab and it is opaque on focus (vet I-3)', async ({ page }) => {
    const title = `${TEST_FARM_PREFIX}kbd ${Date.now()}`;
    await loginAsOwner(page);
    await seedFarm(page, title);
    await goToTestStatic(page);

    const dialog = await openFarmsList(page);
    const row = dialog.getByTestId('collection-goal-row').filter({ hasText: title });
    await expect(row).toHaveCount(1, { timeout: 10_000 });
    const trash = row.getByRole('button', { name: `Delete ${title}` });

    // Park the pointer off the row so :hover cannot reveal the trash, and
    // prove the starting state: hidden while neither hovered nor focused.
    await page.mouse.move(0, 0);
    await expect.poll(() => trash.evaluate((el) => getComputedStyle(el).opacity)).toBe('0');

    // Start at the header action that precedes the list, then Tab for real
    // until the trash holds focus (a farm list may carry other rows' trashes).
    await dialog.getByRole('button', { name: 'New Farm' }).focus();
    const focused = page.locator(':focus');
    const target = `Delete ${title}`;
    let reached = false;
    for (let i = 0; i < 12 && !reached; i += 1) {
      await page.keyboard.press('Tab');
      reached = (await focused.getAttribute('aria-label').catch(() => null)) === target;
    }
    expect(reached, `Tab never reached "${target}"`).toBe(true);

    await expect(focused).toHaveAccessibleName(target);
    await expect.poll(() => focused.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  });

  test('legacy: the same Delete Farm confirm appears; Delete removes the row', async ({ page }) => {
    const title = `${TEST_FARM_PREFIX}legacy ${Date.now()}`;
    await loginAsOwner(page);
    await seedFarm(page, title);
    await goToTestStaticLegacy(page);

    const dialog = await openFarmsList(page);
    const row = dialog.getByTestId('collection-goal-row').filter({ hasText: title });
    await expect(row).toHaveCount(1, { timeout: 10_000 });

    await row.hover();
    await row.getByRole('button', { name: `Delete ${title}` }).click();
    const confirm = page.getByRole('dialog', { name: 'Delete Farm' });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(confirm).toHaveCount(0);
    await expect(dialog.getByTestId('collection-goal-row').filter({ hasText: title })).toHaveCount(0);
  });
});

test.describe('V2 session modal — Discord Delivery (R-D1-5 / R-D1-6)', () => {
  test.beforeEach(() => {
    test.setTimeout(45_000);
  });

  test('Add session shows the block, and its line matches the static\'s scheduler settings', async ({ page }) => {
    await loginAsOwner(page);
    const { groupId } = await ownerApiContext(page);
    const settingsRes = await page.request.get(`${API_BASE}/api/static-groups/${groupId}/scheduler/settings`);
    expect(settingsRes.ok(), `scheduler/settings returned ${settingsRes.status()}`).toBe(true);
    const settings = await settingsRes.json() as {
      discordLinkStatus?: string | null;
      discordBotConfigured?: boolean;
      discordGuildId?: string | null;
      discordGuildName?: string | null;
    };
    // Mirrors buildDiscordDeliverySummary's mirrorEnabled / serverLabel.
    const linked = settings.discordLinkStatus === 'connected'
      || Boolean(settings.discordBotConfigured && settings.discordGuildId);
    const serverLabel = settings.discordGuildName
      ?? (settings.discordGuildId ? `Guild ${settings.discordGuildId}` : 'Discord');

    await goToTestStatic(page);
    await switchTab(page, 'Schedule');
    await page.getByRole('button', { name: 'Add session', exact: true }).first().click();

    const modal = page.getByRole('dialog', { name: /Add Session/i });
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await expect(modal.getByText('Discord Delivery', { exact: true })).toBeVisible({ timeout: 10_000 });

    if (linked) {
      await expect(modal.getByText(`Mirror to Discord Events on ${serverLabel}`, { exact: true })).toBeVisible();
      await expect(modal.getByText('Connect Discord Events in settings before this can publish')).toHaveCount(0);
    } else {
      await expect(modal.getByText('Mirror to Discord Events', { exact: true })).toBeVisible();
      await expect(modal.getByText('Connect Discord Events in settings before this can publish')).toBeVisible();
    }
  });
});
