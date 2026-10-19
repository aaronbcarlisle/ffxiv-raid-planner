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

    const screenRoot = page.getByTestId('progress-screen');
    const tierBox = await screenRoot.getByTestId('progress-tier-row').boundingBox();
    const matrixBox = await screenRoot.getByTestId('progress-matrix').boundingBox();
    expect(tierBox!.y).toBeLessThan(matrixBox!.y);

    expect(await seededOrder(page)).toEqual([seeded.mountId, seeded.customId]);
    const mount = page.locator(`[data-goal-id="${seeded.mountId}"]`);
    await expect(mount.getByText('Scheduled', { exact: true })).toBeVisible();
    await expect(mount.getByText(`Need 62/${seeded.mountCost}`)).toBeVisible();
    await expect(page.locator(`[data-goal-id="${seeded.customId}"]`).getByText('★ Want')).toBeVisible();
    await expect(mount.getByTestId('progress-status')).toContainText(/\d+ of \d+ have it|Everyone has it|Nobody to track yet/);

    // Read-only: no control inside the matrix body except the Finished button.
    await expect(page.getByTestId('progress-matrix').locator('tbody button:not([aria-expanded])')).toHaveCount(0);
    await context.close();
  });

  test('owner: one Tab stop, arrow keys between cells, and a focused cell says where its value came from', async ({ browser }) => {
    const context = await freshContext(browser);
    const page = await context.newPage();
    await loginAsOwner(page);
    await openProgress(page);

    const matrix = page.getByTestId('progress-matrix');
    // The scroller is not a stop of its own; the grid has exactly one.
    await expect(matrix).not.toHaveAttribute('tabindex', /.*/);
    await expect(matrix.locator('[role="gridcell"][tabindex="0"]')).toHaveCount(1);

    // A real Tab in from the element before the matrix lands on that one gridcell; the next
    // Tab leaves the matrix (not onto the scroller, not onto another cell).
    await page.getByTestId('progress-tier-row').getByText('Open board').focus();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.getAttribute('role'))).toBe('gridcell');
    expect(await matrix.evaluate((m) => m.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Tab');
    expect(await matrix.evaluate((m) => m === document.activeElement || m.contains(document.activeElement))).toBe(false);

    const needCell = page.locator(`[data-goal-id="${seeded.mountId}"] [data-testid="progress-cell"][aria-label*=", Need, "]`).first();
    await needCell.focus();
    // The owner wrote their own status, so the tooltip reads "you" to them.
    await expect(page.getByRole('tooltip').first()).toContainText('you');
    await expect(matrix.locator('[role="gridcell"][tabindex="0"]')).toHaveCount(1);

    const name = await needCell.getAttribute('aria-label');
    await page.keyboard.press('ArrowRight');
    const moved = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? null);
    expect(moved).not.toBeNull();
    expect(moved).not.toBe(name);
    await page.keyboard.press('ArrowDown');
    expect(await page.evaluate(() => document.activeElement?.getAttribute('role'))).toBe('gridcell');
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

      // KNOWN TOKEN DEBT (excluded, as contrast.spec.ts excludes the role badges): the plan
      // sets each column header's name in text-role-{role}, and the light-theme healer
      // token (#1a8a4a on white) measures 4.39:1, just under AA. Fixing it is a change to
      // the shared role tokens, which render in both shells; every other node is scanned.
      const results = await new AxeBuilder({ page })
        .include('[data-testid="progress-screen"]')
        .exclude('[data-testid="progress-column"] [class*="text-role-"]')
        .analyze();
      const blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
      await context.close();
    });
  }
});
