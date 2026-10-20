/**
 * S2a-2·F3: the V2 Progress matrix on DEVTST, read-only.
 *
 * Seeds two farms through the owner's API (prefix "E2E Progress"): a Scheduled
 * mount that carries a token cost (a catalog mount when the dev catalog has one
 * with a cost and DEVTST doesn't already track it, else a custom mount with a
 * cost), and a Farming custom farm. The owner marks the mount Need with a count,
 * so the mount outranks the custom farm (Q3: more Need first). A viewer is made by
 * setting DevMember's role to viewer and restoring it afterwards.
 *
 * CI has no Playwright job; run against dev-auth servers:
 *   E2E_API_URL=http://localhost:8001 E2E_FRONTEND_URL=http://localhost:5174 \
 *     pnpm -C frontend exec playwright test e2e/progress.spec.ts
 */
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect, type Browser, type Page } from '@playwright/test';
import {
  API_BASE,
  DEV_SHARE_CODE,
  FRONTEND_BASE,
  freshContext,
  loginAsMember,
  loginAsOwner,
  ownerApiContext,
} from './helpers/auth';

const PREFIX = 'E2E Progress';
const THEMES = ['dark', 'light'] as const;

/**
 * Ids of every farm this file created, written the moment each exists. A catalog-sourced
 * mount carries the catalog's title, not the prefix, so a crashed run would otherwise leak
 * it on DEVTST; the next run's pre-clean reads this file. It lives in the OS temp dir, not
 * `test-results/`: Playwright empties its output directory before `beforeAll`, which would
 * erase the very record a crashed run left behind.
 */
const LEDGER = join(tmpdir(), 'xrp-progress-e2e-seeded.json');

function ledgerIds(): string[] {
  try {
    return JSON.parse(readFileSync(LEDGER, 'utf8')) as string[];
  } catch {
    return [];
  }
}

function recordSeeded(id: string): void {
  writeFileSync(LEDGER, JSON.stringify([...ledgerIds(), id]));
}

interface Seeded {
  mountId: string;
  customId: string;
  mountCost: number;
}
let seeded: Seeded;
/**
 * The owner's own record for the catalog mount before the run. Records outlive farms, and the
 * owner's Need/62 writes through to it, so afterAll puts the values back (there is no route that
 * deletes a record, so a record that did not exist is left as "unknown" with no count).
 */
let priorRecord: { catalogItemId: string; ownership_state: string; token_count: number | null } | null = null;
/** DevMember's id, once the viewer test has demoted them (afterAll restores the role). */
let demotedUserId: string | null = null;

type ApiHeaders = { 'X-CSRF-Token': string };

async function ownerSession(browser: Browser) {
  const context = await freshContext(browser);
  const page = await context.newPage();
  await loginAsOwner(page);
  const { groupId, csrfToken } = await ownerApiContext(page);
  const headers: ApiHeaders = { 'X-CSRF-Token': csrfToken };
  return { context, page, groupId, headers };
}

/** The signed-in user's id (DEVTST has other members, so the role change must target this one). */
async function currentUserId(page: Page): Promise<string> {
  const res = await page.request.get(`${API_BASE}/api/auth/me`);
  if (!res.ok()) throw new Error(`auth/me returned ${res.status()}`);
  return ((await res.json()) as { id: string }).id;
}

async function setMemberRole(page: Page, groupId: string, headers: ApiHeaders, userId: string, role: 'member' | 'viewer') {
  const res = await page.request.put(`${API_BASE}/api/static-groups/${groupId}/members/${userId}`, { headers, data: { role } });
  if (!res.ok()) throw new Error(`setting the member's role to ${role} returned ${res.status()}`);
}

async function deleteSeededFarms(page: Page, groupId: string, headers: ApiHeaders, ids: string[] = []) {
  const list = await page.request.get(`${API_BASE}/api/static-groups/${groupId}/collection-goals`);
  if (!list.ok()) throw new Error(`E2E cleanup failed: farm list returned ${list.status()}`);
  const goals = (await list.json()) as Array<{ id: string; title: string }>;
  const doomed = new Set([...ids, ...ledgerIds(), ...goals.filter((g) => g.title.startsWith(PREFIX)).map((g) => g.id)]);
  for (const id of doomed) {
    const del = await page.request.delete(`${API_BASE}/api/static-groups/${groupId}/collection-goals/${id}`, { headers });
    if (!del.ok() && del.status() !== 404) throw new Error(`E2E cleanup failed: deleting ${id} returned ${del.status()}`);
  }
  rmSync(LEDGER, { force: true });
}

test.describe.serial('Progress matrix', () => {
  test.beforeAll(async ({ browser }) => {
    const { context, page, groupId, headers } = await ownerSession(browser);
    try {
      await deleteSeededFarms(page, groupId, headers);

      // The scheduled mount with a token cost.
      let mountId: string | null = null;
      let mountCost = 99;
      const catalog = await page.request.get(`${API_BASE}/api/collection-catalog?category=mount`);
      if (catalog.ok()) {
        const items = (await catalog.json()) as Array<{ id: string; token_cost: number | null }>;
        const item = items.find((i) => i.token_cost != null && i.token_cost > 0);
        if (item) {
          const snaps = await page.request.get(`${API_BASE}/api/me/collection-snapshots`);
          const records = snaps.ok()
            ? ((await snaps.json()) as Array<{ catalog_item_id: string; ownership_state: string; token_count: number | null }>)
            : [];
          const before = records.find((r) => r.catalog_item_id === item.id);
          priorRecord = {
            catalogItemId: item.id,
            ownership_state: before?.ownership_state ?? 'unknown',
            token_count: before?.token_count ?? null,
          };
          const res = await page.request.post(`${API_BASE}/api/static-groups/${groupId}/collection-goals/from-suggestion`, {
            headers,
            data: { catalog_item_id: item.id, status: 'scheduled' },
          });
          if (res.ok()) {
            mountId = ((await res.json()) as { id: string }).id;
            recordSeeded(mountId);
            mountCost = item.token_cost as number;
          } else {
            priorRecord = null; // nothing of the owner's record was touched
          }
        }
      }
      if (mountId === null) {
        const res = await page.request.post(`${API_BASE}/api/static-groups/${groupId}/collection-goals`, {
          headers,
          data: { goal_type: 'mount', title: `${PREFIX} Mount`, status: 'scheduled', token_name: 'Tokens', token_cost: mountCost },
        });
        if (!res.ok()) throw new Error(`seeding the mount returned ${res.status()}`);
        mountId = ((await res.json()) as { id: string }).id;
        recordSeeded(mountId);
      }

      const custom = await page.request.post(`${API_BASE}/api/static-groups/${groupId}/collection-goals`, {
        headers,
        data: { goal_type: 'custom_reward', title: `${PREFIX} Custom`, status: 'farming' },
      });
      if (!custom.ok()) throw new Error(`seeding the custom farm returned ${custom.status()}`);
      const customId = ((await custom.json()) as { id: string }).id;
      recordSeeded(customId);

      // The owner needs the mount (so it sorts first) and wants the custom farm.
      for (const [id, data] of [
        [mountId, { state: 'need', token_count: 62 }],
        [customId, { state: 'want' }],
      ] as const) {
        const res = await page.request.patch(`${API_BASE}/api/static-groups/${groupId}/collection-goals/${id}/participants`, { headers, data });
        if (!res.ok()) throw new Error(`setting the owner's status returned ${res.status()}`);
      }

      seeded = { mountId, customId, mountCost };
    } finally {
      await context.close();
    }
  });

  test.afterAll(async ({ browser }) => {
    const { context, page, groupId, headers } = await ownerSession(browser);
    try {
      if (demotedUserId) await setMemberRole(page, groupId, headers, demotedUserId, 'member');
      await deleteSeededFarms(page, groupId, headers, seeded ? [seeded.mountId, seeded.customId] : []);
      if (priorRecord) {
        const res = await page.request.put(`${API_BASE}/api/me/collection-snapshot/${priorRecord.catalogItemId}`, {
          headers,
          data: { ownership_state: priorRecord.ownership_state, token_count: priorRecord.token_count },
        });
        if (!res.ok()) throw new Error(`restoring the owner's record returned ${res.status()}`);
        priorRecord = null;
      }
    } finally {
      await context.close();
    }
  });

  /** At phone width the shell hides the user menu, so that wait is optional there. */
  async function openProgress(page: Page, { userMenu = true } = {}) {
    await page.goto(`/group/${DEV_SHARE_CODE}?shell=v2&tab=progress`);
    await page.locator('[data-testid="new-shell"]').waitFor({ timeout: 15_000 });
    if (userMenu) await page.getByRole('button', { name: /User menu for/i }).waitFor({ timeout: 15_000 });
    await expect(page.getByTestId('progress-matrix')).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState('networkidle');
  }

  /** The seeded farms' rows, in the order they appear. */
  async function seededOrder(page: Page): Promise<string[]> {
    const ids = await page.getByTestId('progress-farm-row').evaluateAll((rows) => rows.map((r) => r.getAttribute('data-goal-id') ?? ''));
    return ids.filter((id) => id === seeded.mountId || id === seeded.customId);
  }

  test('owner: the tier row, then the seeded rows by need, with the owner\'s counts', async ({ browser }) => {
    const context = await freshContext(browser);
    const page = await context.newPage();
    await loginAsOwner(page);
    await openProgress(page);

    // S2a-3b·H3 (R-T-3): the tier row is the matrix's first body row, above every farm row.
    const matrix = page.getByTestId('progress-screen').getByTestId('progress-matrix');
    await expect(matrix.locator('tbody tr').first()).toHaveAttribute('data-testid', 'progress-tier-row');
    const tierBox = await matrix.getByTestId('progress-tier-row').boundingBox();
    const firstFarmBox = await page.getByTestId('progress-farm-row').first().boundingBox();
    expect(tierBox!.y).toBeLessThan(firstFarmBox!.y);

    expect(await seededOrder(page)).toEqual([seeded.mountId, seeded.customId]);
    const mount = page.locator(`[data-goal-id="${seeded.mountId}"]`);
    await expect(mount.getByText('Scheduled', { exact: true })).toBeVisible();
    await expect(mount.getByText(`Need 62/${seeded.mountCost}`)).toBeVisible();
    await expect(page.locator(`[data-goal-id="${seeded.customId}"]`).getByText('★ Want')).toBeVisible();
    await expect(mount.getByTestId('progress-status')).toContainText(/\d+ of \d+ have it|Everyone has it|Nobody to track yet/);

    // The controls in the matrix body: each farm's name and Finished (disclosures, S2a-3a), the
    // owner's row menus (a lead's ⋯ column, G4: they also carry aria-expanded, so they are told
    // apart by aria-haspopup) and the owner's own cells (F5). A menu is named "Actions for {title}",
    // a cell button "… your status"; the disclosures are exempt. The tier row's controls (S2a-3b·H3)
    // are its BiS cells, named with their numbers, and Open board; they are checked on their own.
    const tierButtons = await matrix.getByTestId('progress-tier-row').locator('button:not([aria-controls="progress-tier-expansion"])').evaluateAll((els) =>
      els.map((el) => el.getAttribute('aria-label') ?? el.textContent ?? ''),
    );
    expect(tierButtons).toContain('Open board');
    for (const label of tierButtons.filter((l) => l !== 'Open board')) {
      expect(label).toMatch(/, \d+ of \d+ BiS slots done(, \d+ need augment)?$|, no BiS set$/);
    }
    // S2a-3b·H4 (R-T-6): the owner's tier name is the split-clear disclosure, and the grid's one stop.
    await expect(
      matrix.locator('[role="gridcell"][tabindex="0"], [role="gridcell"] [tabindex="0"], [role="rowheader"][tabindex="0"], [role="rowheader"] [tabindex="0"]'),
    ).toHaveAttribute('aria-controls', 'progress-tier-expansion');
    const bodyButtons = await matrix.locator('tbody tr:not([data-testid="progress-tier-row"]) button').evaluateAll((els) =>
      els.map((el) => ({
        label: el.getAttribute('aria-label') ?? el.textContent ?? '',
        menu: el.getAttribute('aria-haspopup') === 'menu',
        disclosure: el.hasAttribute('aria-expanded') && el.getAttribute('aria-haspopup') !== 'menu',
      })),
    );
    expect(bodyButtons.length).toBeGreaterThan(0);
    expect(bodyButtons.some((b) => b.menu)).toBe(true);
    for (const { label, menu, disclosure } of bodyButtons) {
      if (menu) expect(label).toMatch(/^Actions for /);
      else if (!disclosure) expect(label).toMatch(/ your status$/);
    }
    await expect(mount.locator('[role="rowheader"] button')).toHaveAttribute('aria-expanded', 'false');
    await context.close();
  });

  test('owner: a farm row opens by click, by keyboard and by ?track=, one at a time (S2a-3a·G2)', async ({ browser }) => {
    const context = await freshContext(browser);
    const page = await context.newPage();
    await loginAsOwner(page);
    await openProgress(page);
    const nameOf = (id: string) => page.locator(`[data-goal-id="${id}"] [role="rowheader"] button`);
    const panel = page.getByTestId('progress-expansion');

    // Click opens the row: the panel is the next row, and the URL names it in place.
    await nameOf(seeded.mountId).click();
    await expect(nameOf(seeded.mountId)).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toHaveCount(1);
    expect(await panel.evaluate((el) => el.previousElementSibling?.getAttribute('data-goal-id') ?? null)).toBe(seeded.mountId);
    await expect(page).toHaveURL(new RegExp(`[?&]track=${seeded.mountId}(&|$)`));

    // Another row swaps the one open panel.
    await nameOf(seeded.customId).click();
    await expect(nameOf(seeded.mountId)).toHaveAttribute('aria-expanded', 'false');
    await expect(nameOf(seeded.customId)).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toHaveCount(1);
    await expect(page).toHaveURL(new RegExp(`[?&]track=${seeded.customId}(&|$)`));

    // Keyboard: the owner is a lead, so ArrowRight leaves the name for the row menu (R-S3-17),
    // then the status cell (S2a-3b·H3a, R-T-4), then the first player cell; ArrowLeft goes back
    // through the status and the menu, Home lands on the name, and Enter toggles.
    const onStatus = () => page.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'progress-status');
    await nameOf(seeded.customId).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('button', { name: /^Actions for / }).and(page.locator(':focus'))).toHaveCount(1);
    await page.keyboard.press('ArrowRight');
    expect(await onStatus()).toBe(true);
    await page.keyboard.press('ArrowRight');
    expect(await page.evaluate(() => document.activeElement?.closest('[data-testid="progress-cell"]') !== null)).toBe(true);
    await page.keyboard.press('ArrowLeft');
    expect(await onStatus()).toBe(true);
    await page.keyboard.press('ArrowLeft');
    expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')?.startsWith('Actions for '))).toBe(true);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Home');
    expect(await page.evaluate(() => document.activeElement?.closest('[role="rowheader"]') !== null)).toBe(true);
    await page.keyboard.press('Enter');
    await expect(nameOf(seeded.customId)).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toHaveCount(0);
    await expect(page).not.toHaveURL(/[?&]track=/);
    await page.keyboard.press('Enter');
    await expect(nameOf(seeded.customId)).toHaveAttribute('aria-expanded', 'true');

    // A deep link opens its row on load.
    await page.goto(`/group/${DEV_SHARE_CODE}?shell=v2&tab=progress&track=${seeded.mountId}`);
    await expect(page.getByTestId('progress-matrix')).toBeVisible({ timeout: 15_000 });
    await expect(nameOf(seeded.mountId)).toHaveAttribute('aria-expanded', 'true');
    await expect(nameOf(seeded.customId)).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toHaveCount(1);
    await context.close();
  });

  test('owner: one Tab stop, arrow keys between cells, and a focused cell says where its value came from', async ({ browser }) => {
    const context = await freshContext(browser);
    const page = await context.newPage();
    await loginAsOwner(page);
    await openProgress(page);

    const matrix = page.getByTestId('progress-matrix');
    // The scroller is not a stop of its own; the grid has exactly one: since S2a-3b·H3a (R-T-4)
    // the tier row's name cell until a cell is focused, then that cell, or, for the owner's own
    // cell (F5), the picker button inside it. The tier row's menu cell, Open board and BiS cells
    // are grid cells at -1, no plain tab stops.
    const stops = matrix.locator(
      '[role="gridcell"][tabindex="0"], [role="gridcell"] [tabindex="0"], [role="rowheader"][tabindex="0"], [role="rowheader"] [tabindex="0"]',
    );
    const tierRow = page.getByTestId('progress-tier-row');
    await expect(matrix).not.toHaveAttribute('tabindex', /.*/);
    await expect(stops).toHaveCount(1);
    await expect(tierRow.locator('[role="rowheader"][tabindex="0"], [role="rowheader"] [tabindex="0"]')).toHaveCount(1);
    for (const button of await tierRow.locator('button:not([aria-controls="progress-tier-expansion"])').all()) await expect(button).toHaveAttribute('tabindex', '-1');
    // S2a-3b·H4 (R-T-6): the owner's tier name is the split-clear disclosure, and it is the one stop.
    await expect(stops).toHaveAttribute('aria-controls', 'progress-tier-expansion');

    // A real Tab in from the element before the matrix lands on that one stop, the tier's name;
    // the next Tab leaves the grid's rows (not onto the scroller, not onto a cell, not onto
    // another name, not onto a tier button). Since F6 the owner's toolbar ("Edit statuses") is
    // the last control before the matrix.
    await page.getByRole('button', { name: 'Edit statuses' }).focus();
    await page.keyboard.press('Tab');
    expect(
      await page.evaluate(
        () => document.activeElement?.closest('[role="rowheader"]')?.closest('[data-testid="progress-tier-row"]') != null,
      ),
    ).toBe(true);
    expect(await matrix.evaluate((m) => m.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.closest('[role="gridcell"], [role="rowheader"]') ?? null)).toBeNull();
    expect(await matrix.evaluate((m) => m === document.activeElement)).toBe(false);

    // ArrowDown from the tier's name reaches the first farm's name (R-T-4), ArrowUp comes back.
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('ArrowDown');
    expect(
      await page.evaluate(() => document.activeElement?.closest('[role="rowheader"]')?.closest('[data-testid="progress-farm-row"]') != null),
    ).toBe(true);
    await page.keyboard.press('ArrowUp');
    expect(
      await page.evaluate(() => document.activeElement?.closest('[role="rowheader"]')?.closest('[data-testid="progress-tier-row"]') != null),
    ).toBe(true);

    // The owner's Need cell is their own, so its focus element is the picker button (F5).
    const needCell = page.locator(`[data-goal-id="${seeded.mountId}"] [data-testid="progress-cell"][aria-label*=", Need, "]`).first();
    // The cell sits past the scroller's edge, and Radix closes a tooltip when its scroller scrolls: scroll first, let that land, then focus.
    await needCell.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await needCell.locator('button').focus();
    // The owner wrote their own status, so the tooltip reads "you" to them.
    await expect(page.getByRole('tooltip').first()).toContainText('you');
    await expect(stops).toHaveCount(1);

    const name = await needCell.getAttribute('aria-label');
    await page.keyboard.press('ArrowRight');
    const moved = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? null);
    expect(moved).not.toBeNull();
    expect(moved).not.toBe(name);
    await page.keyboard.press('ArrowDown');
    expect(await page.evaluate(() => document.activeElement?.closest('[role="gridcell"]') !== null)).toBe(true);
    await context.close();
  });

  test('member: the same rows in the same order, counts shown', async ({ browser }) => {
    const context = await freshContext(browser);
    const page = await context.newPage();
    await loginAsMember(page);
    await openProgress(page);

    expect(await seededOrder(page)).toEqual([seeded.mountId, seeded.customId]);
    // A member sees the owner's count on the seeded mount, and the tally.
    await expect(page.locator(`[data-goal-id="${seeded.mountId}"]`).getByText(`Need 62/${seeded.mountCost}`)).toBeVisible();
    await expect(page.getByTestId('progress-matrix').getByText(/of \d+ have it/).first()).toBeVisible();
    await context.close();
  });

  test('phone width: the matrix scrolls inside its container and the page does not', async ({ browser }) => {
    const context = await freshContext(browser);
    const page = await context.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsOwner(page);
    await openProgress(page, { userMenu: false });

    const { pageWidth, viewport, scroller, client } = await page.evaluate(() => {
      const box = document.querySelector('[data-testid="progress-matrix"]') as HTMLElement;
      return {
        pageWidth: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
        scroller: box.scrollWidth,
        client: box.clientWidth,
      };
    });
    expect(pageWidth, 'the page must not scroll sideways').toBeLessThanOrEqual(viewport);
    expect(scroller, 'the matrix scrolls inside its container').toBeGreaterThan(client);
    await context.close();
  });

  test('viewer: states only, no count anywhere in the matrix', async ({ browser }) => {
    const owner = await ownerSession(browser);
    try {
      const context = await freshContext(browser);
      const page = await context.newPage();
      // Dev login re-seats DevMember as a member, so demote after logging in.
      await loginAsMember(page);
      demotedUserId = await currentUserId(page);
      await setMemberRole(owner.page, owner.groupId, owner.headers, demotedUserId, 'viewer');
      await openProgress(page);

      expect(await seededOrder(page)).toEqual([seeded.mountId, seeded.customId]);
      const matrix = page.getByTestId('progress-matrix');
      await expect(page.locator(`[data-goal-id="${seeded.mountId}"]`).getByText('Need', { exact: true })).toBeVisible();
      const cellText = await matrix.getByTestId('progress-cell').allTextContents();
      expect(cellText.filter((t) => /\d/.test(t))).toEqual([]);
      await context.close();
    } finally {
      if (demotedUserId) await setMemberRole(owner.page, owner.groupId, owner.headers, demotedUserId, 'member');
      demotedUserId = null;
      await owner.context.close();
    }
  });

  for (const theme of THEMES) {
    test(`owner: axe reports no critical or serious violation in the Progress screen (${theme}, 1440 x 900)`, async ({ browser }) => {
      const context = await freshContext(browser);
      const page = await context.newPage();
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.addInitScript((t) => window.localStorage.setItem('theme', t), theme);
      await loginAsOwner(page);
      await page.goto(`${FRONTEND_BASE}/group/${DEV_SHARE_CODE}?shell=v2&tab=progress`);
      await expect(page.getByTestId('progress-matrix')).toBeVisible({ timeout: 15_000 });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(300);

      const results = await new AxeBuilder({ page })
        .include('[data-testid="progress-screen"]')
        .analyze();
      const blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
      await context.close();
    });

    test(`owner: axe reports no critical or serious violation with a row open (${theme}, 1440 x 900)`, async ({ browser }) => {
      const context = await freshContext(browser);
      const page = await context.newPage();
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.addInitScript((t) => window.localStorage.setItem('theme', t), theme);
      await loginAsOwner(page);
      // S2a-3a·G2: the deep link opens the mount's row; the panel is the row after it.
      await page.goto(`${FRONTEND_BASE}/group/${DEV_SHARE_CODE}?shell=v2&tab=progress&track=${seeded.mountId}`);
      await expect(page.getByTestId('progress-matrix')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('progress-expansion')).toBeVisible({ timeout: 15_000 });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(300);

      const results = await new AxeBuilder({ page })
        .include('[data-testid="progress-screen"]')
        .analyze();
      const blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
      await context.close();
    });
  }
});

/**
 * S2a-2·F6: Edit statuses. The owner is a lead, so the mode corrects another member's cell, sets
 * their first count, and fills every blank claimed cell with Need in one go (then Undoes it).
 *
 * Two farms (the first carries the "E2E Progress" prefix, the second a catalog title, so the ledger
 * covers it): a custom mount with a token cost, whose rows the corrections touch (no catalog item,
 * so nothing reaches a member's record), and a farm tracked from the catalog through
 * `from-suggestion` for an item that no seeded member has any signal for (B5: the members stay
 * blank). Settings' Add Farm seeds nothing, so it would prove nothing about B5.
 */
const CLAIMED = ['Healer Two', 'Melee One', 'Caster One'] as const; // DevOwner, DevMember, Lloyd
const EDIT_TITLE = `${PREFIX} Edit Mount`;

/** A claimed cell's gridcell on one farm's row, by the column's name. */
const cellOf = (page: Page, goalId: string, column: string) =>
  page.locator(`[data-goal-id="${goalId}"] td[data-testid="progress-cell"][aria-label^="${column}, "]`);

interface ParticipantsRead {
  participants: Array<{ user_id: string; state: string; token_count: number | null; updated_by_user_id: string | null }>;
  record_only?: unknown[];
}

async function readParticipants(page: Page, groupId: string, goalId: string): Promise<ParticipantsRead> {
  const res = await page.request.get(`${API_BASE}/api/static-groups/${groupId}/collection-participants?goal_id=${goalId}`);
  if (!res.ok()) throw new Error(`reading the participants returned ${res.status()}`);
  return ((await res.json()) as ParticipantsRead[])[0];
}

/**
 * Track a catalog item through `from-suggestion` and keep it only if the static's members have no
 * signal for it (no row, no record): tries the catalog's items in turn and deletes the ones that
 * have one. The dev DB's seeded records decide which item wins, so it is chosen at run time.
 */
async function trackBlankCatalogFarm(page: Page, groupId: string, headers: ApiHeaders): Promise<{ id: string; title: string }> {
  const catalog = await page.request.get(`${API_BASE}/api/collection-catalog`);
  if (!catalog.ok()) throw new Error(`the catalog returned ${catalog.status()}`);
  const items = (await catalog.json()) as Array<{ id: string; name: string }>;
  for (const item of items.slice(0, 40)) {
    const res = await page.request.post(`${API_BASE}/api/static-groups/${groupId}/collection-goals/from-suggestion`, {
      headers,
      data: { catalog_item_id: item.id, status: 'wanted' },
    });
    if (!res.ok()) continue; // already tracked by someone's goal, or not suggestible
    const id = ((await res.json()) as { id: string }).id;
    recordSeeded(id);
    const read = await readParticipants(page, groupId, id);
    if (read.participants.length === 0 && (read.record_only ?? []).length === 0) return { id, title: item.name };
    const del = await page.request.delete(`${API_BASE}/api/static-groups/${groupId}/collection-goals/${id}`, { headers });
    if (!del.ok()) throw new Error(`deleting the candidate returned ${del.status()}`);
  }
  throw new Error('no catalog item in the first 40 is free of every member signal: the B5 farm cannot be built');
}

test.describe.serial('Progress: Edit statuses', () => {
  let editId = '';
  let blank = { id: '', title: '' };

  test.beforeAll(async ({ browser }) => {
    const { context, page, groupId, headers } = await ownerSession(browser);
    try {
      await deleteSeededFarms(page, groupId, headers);
      const mount = await page.request.post(`${API_BASE}/api/static-groups/${groupId}/collection-goals`, {
        headers,
        data: { goal_type: 'mount', title: EDIT_TITLE, status: 'farming', token_name: 'Tokens', token_cost: 99 },
      });
      if (!mount.ok()) throw new Error(`seeding the edit mount returned ${mount.status()}`);
      editId = ((await mount.json()) as { id: string }).id;
      recordSeeded(editId);
      blank = await trackBlankCatalogFarm(page, groupId, headers);
    } finally {
      await context.close();
    }
  });

  test.afterAll(async ({ browser }) => {
    const { context, page, groupId, headers } = await ownerSession(browser);
    try {
      await deleteSeededFarms(page, groupId, headers, [editId, blank.id].filter(Boolean));
    } finally {
      await context.close();
    }
  });

  async function openEditable(page: Page, theme?: 'dark' | 'light') {
    await page.setViewportSize({ width: 1440, height: 900 });
    if (theme) await page.addInitScript((t) => window.localStorage.setItem('theme', t), theme);
    await loginAsOwner(page);
    await page.goto(`/group/${DEV_SHARE_CODE}?shell=v2&tab=progress`);
    await page.locator('[data-testid="new-shell"]').waitFor({ timeout: 15_000 });
    await expect(page.getByTestId('progress-matrix')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(`[data-goal-id="${editId}"]`)).toBeVisible();
    await page.waitForLoadState('networkidle');
  }

  test('owner: Edit statuses corrects a member\'s cell and sets their first count', async ({ browser }) => {
    const context = await freshContext(browser);
    const page = await context.newPage();
    await openEditable(page);

    // Outside the mode only the owner's own cell is a control.
    const memberCell = cellOf(page, editId, 'Melee One');
    await expect(memberCell).toHaveAttribute('aria-label', `Melee One, ${EDIT_TITLE}, no status`);
    await expect(memberCell.getByRole('button')).toHaveCount(0);

    await page.getByRole('button', { name: 'Edit statuses' }).click();
    await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark everyone without a status as Need' })).toBeEnabled();

    // A correction: a blank cell of another member says "set status", the pick lands on their row.
    await memberCell.getByRole('button', { name: `Melee One, ${EDIT_TITLE}, no status — set status` }).click();
    await page.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'Need', exact: true }).click();
    await expect(memberCell).toHaveAttribute('aria-label', `Melee One, ${EDIT_TITLE}, Need`);

    // Their first count, through the same cell (the field shows for a token farm they have not hidden).
    await memberCell.getByRole('button', { name: `Melee One, ${EDIT_TITLE}, Need — change status` }).click();
    const count = page.getByRole('spinbutton', { name: 'Tokens' });
    await count.fill('7');
    await count.press('Enter');
    await expect(memberCell).toHaveAttribute('aria-label', `Melee One, ${EDIT_TITLE}, Need, 7 of 99 Tokens`);
    await page.keyboard.press('Escape');

    // The owner's own cell in the mode is still "your" status.
    await expect(cellOf(page, editId, 'Healer Two').getByRole('button')).toHaveAccessibleName(/ — set your status$/);

    // The row on the server: DevMember's Need/7, written by someone else.
    const { groupId } = await ownerApiContext(page);
    const rows = (await readParticipants(page, groupId, editId)).participants;
    const memberId = (await (await page.request.get(`${API_BASE}/api/static-groups/${groupId}/members`)).json() as Array<{ userId: string; user?: { discordUsername: string } }>)
      .find((m) => m.user?.discordUsername === 'DevMember')?.userId;
    const row = rows.find((r) => r.user_id === memberId);
    expect(row).toMatchObject({ state: 'need', token_count: 7 });
    expect(row!.updated_by_user_id).not.toBe(memberId);
    await context.close();
  });

  test('member: the corrected cell\'s tooltip reads "set by" the owner', async ({ browser }) => {
    const context = await freshContext(browser);
    const page = await context.newPage();
    await loginAsMember(page);
    await page.goto(`/group/${DEV_SHARE_CODE}?shell=v2&tab=progress`);
    await expect(page.getByTestId('progress-matrix')).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState('networkidle');

    // DevMember's own cell (their column is Melee One) holds the owner's correction.
    const cell = cellOf(page, editId, 'Melee One');
    await expect(cell).toHaveAttribute('aria-label', `Melee One, ${EDIT_TITLE}, Need, 7 of 99 Tokens`);
    await cell.getByRole('button').focus();
    // The writer is named by their column first (ProgressMatrix's nameOf): DevOwner's claimed player.
    await expect(page.getByRole('tooltip').first()).toContainText(/set by (Healer Two|Dev ?Owner)/);
    // No lead control for a member.
    await expect(page.getByRole('button', { name: 'Edit statuses' })).toHaveCount(0);
    await context.close();
  });

  test('owner: a farm tracked from the catalog leaves members blank (B5); the bulk Need fills them and Undo empties them', async ({ browser }) => {
    const context = await freshContext(browser);
    const page = await context.newPage();
    await openEditable(page);
    const { groupId } = await ownerApiContext(page);

    // B5: the tracked item carries no signal for any member, so every claimed cell is blank.
    const before = await readParticipants(page, groupId, blank.id);
    expect(before.participants).toEqual([]);
    for (const column of CLAIMED) {
      await expect(cellOf(page, blank.id, column)).toHaveAttribute('aria-label', `${column}, ${blank.title}, no status`);
    }

    await page.getByRole('button', { name: 'Edit statuses' }).click();
    const blanks = await page.getByTestId('progress-matrix').locator('td[data-testid="progress-cell"][aria-label$=", no status"]').count();
    expect(blanks, 'the B5 farm alone has three blank claimed cells').toBeGreaterThanOrEqual(3);

    await page.getByRole('button', { name: 'Mark everyone without a status as Need' }).click();
    await expect(page.getByText(`Marked ${blanks} ${blanks === 1 ? 'cell' : 'cells'} Need`)).toBeVisible();
    // The trigger was disabled while it ran, which drops focus to the body: it lands on Done.
    await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeFocused();
    for (const column of CLAIMED) {
      await expect(cellOf(page, blank.id, column)).toHaveAttribute('aria-label', `${column}, ${blank.title}, Need`);
    }
    expect((await readParticipants(page, groupId, blank.id)).participants.map((r) => r.state)).toEqual(['need', 'need', 'need']);
    // The member's corrected cell was not blank, so the bulk left it alone.
    await expect(cellOf(page, editId, 'Melee One')).toHaveAttribute('aria-label', `Melee One, ${EDIT_TITLE}, Need, 7 of 99 Tokens`);

    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.getByText('Undone', { exact: true })).toBeVisible();
    for (const column of CLAIMED) {
      await expect(cellOf(page, blank.id, column)).toHaveAttribute('aria-label', `${column}, ${blank.title}, no status`);
    }
    expect((await readParticipants(page, groupId, blank.id)).participants).toEqual([]);
    await expect(cellOf(page, editId, 'Melee One')).toHaveAttribute('aria-label', `Melee One, ${EDIT_TITLE}, Need, 7 of 99 Tokens`);

    // Done leaves the mode: the bulk is gone, "Edit statuses" is back.
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Edit statuses' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark everyone without a status as Need' })).toHaveCount(0);
    await context.close();
  });

  async function blockingViolations(page: Page, includes: string[]) {
    let builder = new AxeBuilder({ page });
    for (const selector of includes) builder = builder.include(selector);
    const results = await builder.analyze();
    return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  }

  for (const theme of THEMES) {
    test(`owner: axe reports no critical or serious violation in Edit statuses (${theme}, 1440 x 900)`, async ({ browser }) => {
      const context = await freshContext(browser);
      const page = await context.newPage();
      await openEditable(page, theme);
      await page.getByRole('button', { name: 'Edit statuses' }).click();
      await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeVisible();
      await page.waitForTimeout(300);

      const blocking = await blockingViolations(page, ['[data-testid="progress-screen"]']);
      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
      await context.close();
    });

    test(`owner: axe reports no critical or serious violation with the picker open (${theme}, 1440 x 900)`, async ({ browser }) => {
      const context = await freshContext(browser);
      const page = await context.newPage();
      await openEditable(page, theme);
      await page.getByRole('button', { name: 'Edit statuses' }).click();
      await cellOf(page, editId, 'Melee One').getByRole('button').click();
      const status = page.getByRole('group', { name: 'Status' });
      await expect(status).toBeVisible();
      await expect(page.getByRole('spinbutton', { name: 'Tokens' })).toBeVisible();
      // The picker is portalled out of the screen: tag it so the scan includes it.
      const tagged = await status.evaluate((el) => {
        const popover = el.closest('[role="dialog"]');
        popover?.setAttribute('data-e2e-picker', '1');
        return popover !== null;
      });
      expect(tagged, 'the picker is a dialog').toBe(true);
      // The click left the pointer on the trigger: its ghost hover tint (bg-accent/10) puts a Need
      // count at 4.49:1 in dark, a hover-only reading. Park the pointer so the scan is of the rest state.
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);

      const blocking = await blockingViolations(page, ['[data-testid="progress-screen"]', '[data-e2e-picker="1"]']);
      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
      await context.close();
    });
  }
});

/**
 * S2a-3a·G5b: the row expansion end to end (design criteria 4, 5, 10, 11; R-S3-3, R-S3-4, R-S3-17).
 *
 * Four farms ("E2E Progress Row …"), each owned by one test group so the serial order does not
 * matter between groups: `drops` (the owner and DevMember Need it: a queue of two), `finish` (the
 * owner Needs it), `everyone` (every member Has it: the action bar's Mark finished) and `edit`
 * (renamed, then deleted). As the owner: `?track=`, the grid's arrows, a log for #1 and its Undo,
 * a log for Nobody with a note, Mark finished from the menu and its Undo, Mark finished from the
 * action bar and Reopen, Edit and Delete, and axe with the row, the picker and Edit open in both
 * themes. As DevMember: "I got it", gone after the log, back after Undo.
 */
const ROW = `${PREFIX} Row`;
const TITLES = {
  drops: `${ROW} Drops`,
  finish: `${ROW} Finish`,
  everyone: `${ROW} Everyone`,
  edit: `${ROW} Edit`,
} as const;
const EDITED_TITLE = `${ROW} Renamed`;

/** The active rows' body: every `tbody` but the Finished section's. */
const ACTIVE_ROWS = 'tbody:not([data-testid="progress-finished"]) [data-testid="progress-farm-row"]';

interface MemberRow {
  userId: string;
  user?: { discordUsername?: string };
}

test.describe.serial('Progress: row expansion', () => {
  const ids = { drops: '', finish: '', everyone: '', edit: '' };
  let editedTitle: string = TITLES.edit;

  async function seedFarm(page: Page, groupId: string, headers: ApiHeaders, title: string): Promise<string> {
    const res = await page.request.post(`${API_BASE}/api/static-groups/${groupId}/collection-goals`, {
      headers,
      data: { goal_type: 'custom_reward', title, status: 'farming' },
    });
    if (!res.ok()) throw new Error(`seeding ${title} returned ${res.status()}`);
    const id = ((await res.json()) as { id: string }).id;
    recordSeeded(id);
    return id;
  }

  async function setStates(page: Page, groupId: string, headers: ApiHeaders, goalId: string, userIds: string[], state: 'need' | 'have') {
    for (const userId of userIds) {
      const res = await page.request.patch(`${API_BASE}/api/static-groups/${groupId}/collection-goals/${goalId}/participants/${userId}`, {
        headers,
        data: { state },
      });
      if (!res.ok()) throw new Error(`setting ${state} for ${userId} returned ${res.status()}`);
    }
  }

  test.beforeAll(async ({ browser }) => {
    const { context, page, groupId, headers } = await ownerSession(browser);
    try {
      await deleteSeededFarms(page, groupId, headers);
      const membersRes = await page.request.get(`${API_BASE}/api/static-groups/${groupId}/members`);
      if (!membersRes.ok()) throw new Error(`the member list returned ${membersRes.status()}`);
      const members = (await membersRes.json()) as MemberRow[];
      const ownerId = await currentUserId(page);
      const memberId = members.find((m) => m.user?.discordUsername === 'DevMember')?.userId;
      if (!memberId) throw new Error('DevMember is not in DEVTST');

      ids.drops = await seedFarm(page, groupId, headers, TITLES.drops);
      ids.finish = await seedFarm(page, groupId, headers, TITLES.finish);
      ids.everyone = await seedFarm(page, groupId, headers, TITLES.everyone);
      ids.edit = await seedFarm(page, groupId, headers, TITLES.edit);
      await setStates(page, groupId, headers, ids.drops, [ownerId, memberId], 'need');
      await setStates(page, groupId, headers, ids.finish, [ownerId], 'need');
      await setStates(page, groupId, headers, ids.everyone, members.map((m) => m.userId), 'have');
    } finally {
      await context.close();
    }
  });

  test.afterAll(async ({ browser }) => {
    const { context, page, groupId, headers } = await ownerSession(browser);
    try {
      await deleteSeededFarms(page, groupId, headers, Object.values(ids).filter(Boolean));
    } finally {
      await context.close();
    }
  });

  const nameOf = (page: Page, id: string) => page.locator(`[data-goal-id="${id}"] [role="rowheader"] button`);
  const panelOf = (page: Page) => page.getByTestId('progress-expansion');

  /** Sign in as `login`, open Progress (optionally on a `?track=` row) and wait for the matrix. */
  async function open(page: Page, opts: { login?: 'owner' | 'member'; track?: string; theme?: 'dark' | 'light' } = {}) {
    await page.setViewportSize({ width: 1440, height: 900 });
    if (opts.theme) await page.addInitScript((t) => window.localStorage.setItem('theme', t), opts.theme);
    if ((opts.login ?? 'owner') === 'owner') await loginAsOwner(page);
    else await loginAsMember(page);
    const track = opts.track ? `&track=${opts.track}` : '';
    await page.goto(`${FRONTEND_BASE}/group/${DEV_SHARE_CODE}?shell=v2&tab=progress${track}`);
    await page.locator('[data-testid="new-shell"]').waitFor({ timeout: 15_000 });
    await expect(page.getByTestId('progress-matrix')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(`[data-goal-id="${ids.drops}"]`)).toBeVisible();
    await page.waitForLoadState('networkidle');
  }

  async function menuItem(page: Page, title: string, item: string) {
    await page.getByRole('button', { name: `Actions for ${title}` }).click();
    await page.getByRole('menuitem', { name: item, exact: true }).click();
  }

  test('owner: ?track= opens its row, in view, and the panel is the row after it (criterion 5)', async ({ browser }) => {
    const context = await freshContext(browser);
    const page = await context.newPage();
    await open(page, { track: ids.drops });

    await expect(nameOf(page, ids.drops)).toHaveAttribute('aria-expanded', 'true');
    await expect(nameOf(page, ids.drops)).toBeInViewport();
    await expect(panelOf(page)).toHaveCount(1);
    await expect(panelOf(page)).toBeInViewport();
    expect(await panelOf(page).evaluate((el) => el.previousElementSibling?.getAttribute('data-goal-id') ?? null)).toBe(ids.drops);
    await expect(page).toHaveURL(new RegExp(`[?&]track=${ids.drops}(&|$)`));
    await context.close();
  });

  test('owner: arrows reach the name and the menu column and skip the open panel (R-S3-4, R-S3-17)', async ({ browser }) => {
    const context = await freshContext(browser);
    const page = await context.newPage();
    await open(page);

    const first = page.locator(ACTIVE_ROWS).first();
    const firstId = (await first.getAttribute('data-goal-id'))!;
    await nameOf(page, firstId).click();
    await expect(panelOf(page)).toHaveCount(1);
    const nextId = await panelOf(page).evaluate((el) => el.nextElementSibling?.getAttribute('data-goal-id') ?? null);
    expect(nextId, 'a farm row follows the open panel').not.toBeNull();

    const where = () =>
      page.evaluate(() => ({
        inPanel: document.activeElement?.closest('[data-testid="progress-expansion"]') !== null,
        row: document.activeElement?.closest('[data-testid="progress-farm-row"]')?.getAttribute('data-goal-id') ?? null,
        tier: document.activeElement?.closest('[data-testid="progress-tier-row"]') != null,
        menu: document.activeElement?.getAttribute('aria-label')?.startsWith('Actions for ') ?? false,
        tierMenu: document.activeElement?.textContent === 'No actions',
        status: document.activeElement?.getAttribute('data-testid') === 'progress-status',
        openBoard: document.activeElement?.textContent === 'Open board',
        bis: / BiS slots done| no BiS set$/.test(document.activeElement?.getAttribute('aria-label') ?? ''),
        name: document.activeElement?.closest('[role="rowheader"]') != null,
      }));

    // Name, then the menu column, then the status cell (S2a-3b·H3a, R-T-4), then the first player cell, all of the open row.
    await nameOf(page, firstId).focus();
    await page.keyboard.press('ArrowRight');
    expect(await where()).toMatchObject({ row: firstId, menu: true, inPanel: false });
    await page.keyboard.press('ArrowRight');
    expect(await where()).toMatchObject({ row: firstId, status: true, inPanel: false });
    await page.keyboard.press('ArrowRight');
    expect(await where()).toMatchObject({ row: firstId, menu: false, status: false, inPanel: false });
    // Down from the open row's cell lands on the next farm's cell, past the panel.
    await page.keyboard.press('ArrowDown');
    expect(await where()).toMatchObject({ row: nextId, inPanel: false });
    // Back up: the open row's cell, never the panel.
    await page.keyboard.press('ArrowUp');
    expect(await where()).toMatchObject({ row: firstId, inPanel: false });
    // Left three times: the status, the menu, then the name.
    await page.keyboard.press('ArrowLeft');
    expect(await where()).toMatchObject({ row: firstId, status: true });
    await page.keyboard.press('ArrowLeft');
    expect(await where()).toMatchObject({ row: firstId, menu: true });
    await page.keyboard.press('ArrowLeft');
    expect(await where()).toMatchObject({ row: firstId, name: true });
    // Down from the name and up again: never the panel.
    await page.keyboard.press('ArrowDown');
    expect(await where()).toMatchObject({ row: nextId, name: true, inPanel: false });
    await page.keyboard.press('ArrowUp');
    expect(await where()).toMatchObject({ row: firstId, name: true, inPanel: false });

    // Up again: the tier row's name, the grid's top row (R-T-4). Across it a lead steps through
    // the empty menu cell, Open board, then the first BiS cell; Home comes back to the name.
    await page.keyboard.press('ArrowUp');
    expect(await where()).toMatchObject({ tier: true, name: true, row: null });
    await page.keyboard.press('ArrowRight');
    expect(await where()).toMatchObject({ tier: true, tierMenu: true });
    await page.keyboard.press('ArrowRight');
    expect(await where()).toMatchObject({ tier: true, openBoard: true });
    await page.keyboard.press('ArrowRight');
    expect(await where()).toMatchObject({ tier: true, bis: true });
    await page.keyboard.press('Home');
    expect(await where()).toMatchObject({ tier: true, name: true });
    // Down from Open board is the first farm's status cell, the same column.
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    expect(await where()).toMatchObject({ row: firstId, status: true });
    await context.close();
  });

  test('owner: Log drop for #1, then Undo (criterion 4)', async ({ browser }) => {
    const context = await freshContext(browser);
    const page = await context.newPage();
    await open(page, { track: ids.drops });
    const panel = panelOf(page);

    const main = panel.getByRole('button', { name: /^Log drop for / });
    const recipient = ((await main.textContent()) ?? '').replace(/^\s*Log drop for /, '').trim();
    expect(recipient).not.toBe('');
    await main.click();
    await expect(page.getByText(`Drop logged for ${recipient}`)).toBeVisible();
    const drops = panel.getByTestId('progress-expansion-drops');
    // The list names the drop by the member's display name, the queue by their column, so count the line.
    await expect(drops.locator('li')).toHaveCount(1);
    await expect(drops).toContainText('×1');

    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.getByText('Undone', { exact: true })).toBeVisible();
    await expect(drops).toContainText('No drops logged yet.');
    await context.close();
  });

  test('owner: Log a drop for Nobody with a note, then delete it', async ({ browser }) => {
    const context = await freshContext(browser);
    const page = await context.newPage();
    await open(page, { track: ids.drops });
    const panel = panelOf(page);

    await panel.getByRole('button', { name: 'More recipients' }).click();
    const picker = page.getByRole('dialog', { name: `Log a drop for ${TITLES.drops}` });
    await expect(picker).toBeVisible();
    await picker.getByRole('radio', { name: /^Nobody/ }).click();
    await expect(picker.getByRole('radio', { name: /^Nobody/ })).toHaveAttribute('aria-checked', 'true');
    await picker.getByLabel('Note (optional)').fill('E2E note');
    await picker.getByRole('button', { name: 'Log drop', exact: true }).click();
    await expect(picker).toBeHidden();
    await expect(page.getByText('Drop logged', { exact: true })).toBeVisible();
    const drops = panel.getByTestId('progress-expansion-drops');
    await expect(drops).toContainText('Nobody · ×1 · E2E note');

    // Delete Drop (G4): the confirm is V1's, and the list empties.
    await drops.getByRole('button', { name: /^Delete drop for Nobody/ }).click();
    await page.getByRole('dialog', { name: 'Delete Drop' }).getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(drops).toContainText('No drops logged yet.');
    await context.close();
  });

  test('member: "I got it" logs, the button is gone, Undo brings it back (criterion 10)', async ({ browser }) => {
    const context = await freshContext(browser);
    const page = await context.newPage();
    await open(page, { login: 'member', track: ids.drops });
    const panel = panelOf(page);

    // A member has no lead controls in the panel or the matrix.
    await expect(panel.getByRole('group', { name: 'Log a drop' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Actions for / })).toHaveCount(0);
    const gotIt = panel.getByRole('button', { name: 'I got it' });
    await expect(gotIt).toBeVisible();
    await gotIt.click();
    await expect(page.getByText('Logged as yours')).toBeVisible();
    await expect(gotIt).toHaveCount(0);
    await expect(panel.getByTestId('progress-expansion-drops')).not.toContainText('No drops logged yet.');

    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.getByText('Undone', { exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'I got it' })).toBeVisible();
    await expect(panel.getByTestId('progress-expansion-drops')).toContainText('No drops logged yet.');
    await context.close();
  });

  test('owner: Mark finished from the menu, then Undo (criterion 11)', async ({ browser }) => {
    const context = await freshContext(browser);
    const page = await context.newPage();
    await open(page);
    const active = page.locator(`tbody:not([data-testid="progress-finished"]) [data-goal-id="${ids.finish}"]`);
    await expect(active).toBeVisible();

    await menuItem(page, TITLES.finish, 'Mark finished');
    await expect(page.getByText('Marked finished', { exact: true })).toBeVisible();
    await expect(active).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Finished \(\d+\)$/ })).toBeVisible();

    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.getByText('Undone', { exact: true })).toBeVisible();
    await expect(active).toBeVisible();
    await context.close();
  });

  test('owner: Mark finished from the action bar of a farm everyone has, then Reopen', async ({ browser }) => {
    const context = await freshContext(browser);
    const page = await context.newPage();
    await open(page, { track: ids.everyone });
    const row = page.locator(`[data-goal-id="${ids.everyone}"]`);
    await expect(row.getByTestId('progress-status')).toHaveText('Everyone has it');
    // The inline link is gone (R-S3-17): the action bar and the menu carry it.
    await expect(row.getByTestId('progress-status').getByRole('button')).toHaveCount(0);

    await panelOf(page).getByTestId('progress-expansion-actions').getByRole('button', { name: 'Mark finished' }).click();
    await expect(page.getByText('Marked finished', { exact: true })).toBeVisible();
    const finishedSection = page.getByTestId('progress-finished');
    await expect(finishedSection).toBeVisible();

    // Expand Finished, then Reopen from the row's menu.
    const toggle = page.getByRole('button', { name: /^Finished \(\d+\)$/ });
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
    await expect(finishedSection.locator(`[data-goal-id="${ids.everyone}"]`)).toBeVisible();
    await menuItem(page, TITLES.everyone, 'Reopen');
    await expect(page.getByText('Reopened', { exact: true })).toBeVisible();
    await expect(
      page.locator(`tbody:not([data-testid="progress-finished"]) [data-goal-id="${ids.everyone}"]`),
    ).toBeVisible();
    await expect(finishedSection.locator(`[data-goal-id="${ids.everyone}"]`)).toHaveCount(0);
    await context.close();
  });

  for (const theme of THEMES) {
    test(`owner: axe reports no critical or serious violation with the picker open (${theme}, 1440 x 900)`, async ({ browser }) => {
      const context = await freshContext(browser);
      const page = await context.newPage();
      await open(page, { track: ids.drops, theme });
      await panelOf(page).getByRole('button', { name: 'More recipients' }).click();
      const radios = page.getByRole('radiogroup', { name: 'Recipient' });
      await expect(radios).toBeVisible();
      // The picker is portalled out of the screen: tag it so the scan includes it.
      const tagged = await radios.evaluate((el) => {
        const popover = el.closest('[role="dialog"]');
        popover?.setAttribute('data-e2e-picker', '1');
        return popover !== null;
      });
      expect(tagged, 'the picker is a dialog').toBe(true);
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);

      const blocking = await blockingIn(page, ['[data-testid="progress-screen"]', '[data-e2e-picker="1"]']);
      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
      await context.close();
    });

    test(`owner: axe reports no critical or serious violation with Mark finished in the action bar (${theme}, 1440 x 900)`, async ({ browser }) => {
      const context = await freshContext(browser);
      const page = await context.newPage();
      await open(page, { track: ids.everyone, theme });
      await expect(panelOf(page).getByRole('button', { name: 'Mark finished' })).toBeVisible();
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);

      const blocking = await blockingIn(page, ['[data-testid="progress-screen"]']);
      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
      await context.close();
    });

    test(`owner: axe reports no critical or serious violation with Edit open (${theme}, 1440 x 900)`, async ({ browser }) => {
      const context = await freshContext(browser);
      const page = await context.newPage();
      await open(page, { track: ids.drops, theme });
      await menuItem(page, TITLES.drops, 'Edit');
      await expect(page.getByTestId('progress-edit-block')).toBeVisible();
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);

      const blocking = await blockingIn(page, ['[data-testid="progress-screen"]']);
      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
      await context.close();
    });
  }

  test('owner: Edit the title and save, then Delete the farm (criterion 11)', async ({ browser }) => {
    const context = await freshContext(browser);
    const page = await context.newPage();
    await open(page);

    await menuItem(page, TITLES.edit, 'Edit');
    const block = page.getByTestId('progress-edit-block');
    await expect(block).toBeVisible();
    await expect(nameOf(page, ids.edit)).toHaveAttribute('aria-expanded', 'true');
    await block.getByRole('textbox', { name: 'Title' }).fill(EDITED_TITLE);
    await block.getByRole('button', { name: 'Save' }).click();
    await expect(block).toBeHidden();
    editedTitle = EDITED_TITLE;
    await expect(nameOf(page, ids.edit)).toHaveText(EDITED_TITLE);
    // Focus goes back to the row's menu button, which carries the new name.
    await expect(page.getByRole('button', { name: `Actions for ${EDITED_TITLE}` })).toBeFocused();
    const { groupId } = await ownerApiContext(page);
    const read = await page.request.get(`${API_BASE}/api/static-groups/${groupId}/collection-goals`);
    expect(((await read.json()) as Array<{ id: string; title: string }>).find((g) => g.id === ids.edit)?.title).toBe(EDITED_TITLE);

    await menuItem(page, editedTitle, 'Delete');
    const confirm = page.getByRole('dialog', { name: 'Delete Goal' });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.locator(`[data-goal-id="${ids.edit}"]`)).toHaveCount(0);
    await expect(page).not.toHaveURL(new RegExp(`[?&]track=${ids.edit}`));
    await context.close();
  });
});

async function blockingIn(page: Page, includes: string[]) {
  let builder = new AxeBuilder({ page });
  for (const selector of includes) builder = builder.include(selector);
  const results = await builder.analyze();
  return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}
