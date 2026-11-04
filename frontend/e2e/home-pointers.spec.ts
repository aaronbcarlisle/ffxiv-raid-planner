/**
 * S2a-4b·B2 (design §4 items 6, 7 and 8; D-9, D-11, D-13; parent criterion 8): Home's two pointers
 * into Progress on DEVTST, end to end, as the owner.
 *
 * Seeds two prefixed farms through the owner's API. "Zed" has two Needs and "Alpha" one, so Progress
 * puts Zed above Alpha even though Alpha sorts first by title. Neither the farm nor the next member
 * is hardcoded: each is read from the matrix and compared with Home's card, as criterion 8 says.
 * afterAll deletes both, and `withSplit` puts DEVTST's split clears back. A later run pre-cleans by
 * the prefix.
 *
 * Role gating is in role-gating.spec.ts and the guest's requests in guest.spec.ts.
 *
 * CI has no Playwright job; run against dev-auth servers:
 *   E2E_API_URL=http://localhost:8001 E2E_FRONTEND_URL=http://localhost:5174 \
 *     pnpm -C frontend exec playwright test e2e/home-pointers.spec.ts
 */
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import { API_BASE, DEV_SHARE_CODE, FRONTEND_BASE, freshContext, loginAsOwner, switchTab } from './helpers/auth';
import { type OwnerApi, currentUserId, ownerSession, withSplit } from './helpers/owner';
import { findRegion } from './helpers/find';

const PREFIX = 'E2E Home Pointers';
const TOP = `${PREFIX} Zed`;
const OTHER = `${PREFIX} Alpha`;
const THEMES = ['dark', 'light'] as const;
const ACTIVE_ROWS = 'tbody:not([data-testid="progress-finished"]) [data-testid="progress-farm-row"]';

const goalsUrl = (groupId: string) => `${API_BASE}/api/static-groups/${groupId}/collection-goals`;

async function deleteSeeded(owner: OwnerApi) {
  const list = await owner.page.request.get(goalsUrl(owner.groupId));
  if (!list.ok()) throw new Error(`the farm list returned ${list.status()}`);
  for (const goal of (await list.json()) as Array<{ id: string; title: string }>) {
    if (!goal.title.startsWith(PREFIX)) continue;
    const del = await owner.page.request.delete(`${goalsUrl(owner.groupId)}/${goal.id}`, { headers: owner.headers });
    if (!del.ok() && del.status() !== 404) throw new Error(`deleting ${goal.title} returned ${del.status()}`);
  }
}

async function seedFarm(owner: OwnerApi, title: string): Promise<string> {
  const res = await owner.page.request.post(goalsUrl(owner.groupId), {
    headers: owner.headers,
    data: { goal_type: 'mount', title, status: 'farming', token_name: 'Tokens', token_cost: 99 },
  });
  if (!res.ok()) throw new Error(`seeding ${title} returned ${res.status()}`);
  return ((await res.json()) as { id: string }).id;
}

async function setNeed(owner: OwnerApi, goalId: string, userId: string, tokenCount: number) {
  const res = await owner.page.request.patch(`${goalsUrl(owner.groupId)}/${goalId}/participants/${userId}`, {
    headers: owner.headers,
    data: { state: 'need', token_count: tokenCount },
  });
  if (!res.ok()) throw new Error(`setting Need for ${userId} returned ${res.status()}`);
}

async function memberIdOf(owner: OwnerApi): Promise<string> {
  const res = await owner.page.request.get(`${API_BASE}/api/static-groups/${owner.groupId}/members`);
  if (!res.ok()) throw new Error(`the member list returned ${res.status()}`);
  const members = (await res.json()) as Array<{ userId: string; user?: { discordUsername?: string } }>;
  const id = members.find((m) => m.user?.discordUsername === 'DevMember')?.userId;
  if (!id) throw new Error('DevMember is not in DEVTST');
  return id;
}

/** The roster seats split clears count (E-11), and the alts assigned among them. */
async function splitNumbers(owner: OwnerApi): Promise<{ x: number; y: number }> {
  const base = `${API_BASE}/api/static-groups/${owner.groupId}`;
  const tiers = (await (await owner.page.request.get(`${base}/tiers`)).json()) as Array<{ tierId: string; isActive?: boolean }>;
  const tierId = (tiers.find((t) => t.isActive) ?? tiers[0]).tierId;
  const players = (await (await owner.page.request.get(`${base}/tiers/${tierId}/players`)).json()) as Array<{ id: string; configured: boolean; isSubstitute: boolean }>;
  const counted = new Set(players.filter((p) => p.configured && !p.isSubstitute).map((p) => p.id));
  const split = (await (await owner.page.request.get(`${base}/split-clear`)).json()) as {
    assignments: Array<{ snapshotPlayerId: string; altCharacterName: string | null }>;
  };
  return { x: split.assignments.filter((a) => counted.has(a.snapshotPlayerId) && a.altCharacterName).length, y: counted.size };
}

/**
 * Light-theme contrast debt that isn't either pointer: Home's own `Button variant="accent-subtle"`
 * (text-accent on bg-accent/10, "Add session" and "Import BiS"), 4.38:1, tracked in #394. Only that
 * variant's nodes leave `color-contrast`; every other rule still sees them, and dark still does.
 */
async function withoutAccentSubtleDebt<V extends { id: string; nodes: Array<{ target: unknown }> }>(page: Page, violations: V[]): Promise<V[]> {
  const kept: V[] = [];
  for (const violation of violations) {
    if (violation.id !== 'color-contrast') {
      kept.push(violation);
      continue;
    }
    const nodes: V['nodes'] = [];
    for (const node of violation.nodes) {
      const selector = Array.isArray(node.target) ? node.target[node.target.length - 1] : node.target;
      const inDebt =
        typeof selector === 'string' &&
        (await page.evaluate((sel) => document.querySelector(sel)?.matches('button.bg-accent\\/10') === true, selector));
      if (!inDebt) nodes.push(node);
    }
    if (nodes.length > 0) kept.push({ ...violation, nodes });
  }
  return kept;
}

const main = (page: Page) => page.getByRole('main');
const farmCard = (page: Page) => main(page).getByRole('heading', { name: 'Farm', exact: true });
const cardLink = (page: Page, title: string) => main(page).getByRole('button', { name: title, exact: true });
const nextLine = (page: Page) => main(page).getByText(/ is next\b/);
const openPlan = (page: Page) => main(page).getByRole('button', { name: 'Open split plan', exact: true });
const splitMeta = (page: Page) => main(page).getByText(/^Alts assigned \d+\/\d+( · \d+ needs? attention)?$/);
const nameOf = (page: Page, id: string) => page.locator(`[data-goal-id="${id}"] [role="rowheader"] button`);
const panelOf = (page: Page) => page.getByTestId('progress-expansion');

async function openShell(page: Page, query: string) {
  await page.goto(`${FRONTEND_BASE}/group/${DEV_SHARE_CODE}?shell=v2&${query}`);
  await page.locator('[data-testid="new-shell"]').waitFor({ timeout: 15_000 });
  await page.getByRole('button', { name: /User menu for/i }).waitFor({ timeout: 15_000 });
}

/** Home, with its hero up, and every request it sends settled. */
async function openHome(page: Page) {
  await openShell(page, 'tab=overview');
  await expect(page.getByRole('heading', { level: 1, name: 'This week' })).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState('networkidle');
}

/** The final URL holds: it reads as it should now, and again once every write has landed. */
async function expectFinalUrl(page: Page, track: string) {
  const check = async () => {
    await expect(page).toHaveURL(/[?&]tab=progress(&|$)/);
    await expect(page).toHaveURL(new RegExp(`[?&]track=${track}(&|$)`));
    await expect(page).not.toHaveURL(/[?&]pview=/);
  };
  await check();
  await page.waitForLoadState('networkidle');
  await check();
}

async function expectFarmOpen(page: Page, id: string) {
  await expect(nameOf(page, id)).toHaveAttribute('aria-expanded', 'true', { timeout: 15_000 });
  await expect(panelOf(page)).toBeVisible();
  await expectFinalUrl(page, id);
}

async function expectSplitPlanOpen(page: Page) {
  const tierRow = page.getByTestId('progress-tier-row');
  await expect(tierRow.locator('[aria-controls="progress-tier-expansion"]')).toHaveAttribute('aria-expanded', 'true', { timeout: 15_000 });
  await expect(page.getByTestId('progress-tier-expansion').getByRole('heading', { name: 'Split Clear Composer' })).toBeVisible();
  await expectFinalUrl(page, 'tier');
}

test.describe.serial('Home pointers (S2a-4b)', () => {
  const ids = { top: '', other: '' };

  test.beforeAll(async ({ browser }) => {
    const owner = await ownerSession(browser);
    try {
      await deleteSeeded(owner);
      ids.top = await seedFarm(owner, TOP);
      ids.other = await seedFarm(owner, OTHER);
      const ownerId = await currentUserId(owner.page);
      await setNeed(owner, ids.top, ownerId, 40);
      await setNeed(owner, ids.top, await memberIdOf(owner), 62);
      await setNeed(owner, ids.other, ownerId, 5);
    } finally {
      await owner.context.close();
    }
  });

  test.afterAll(async ({ browser }) => {
    const owner = await ownerSession(browser);
    try {
      await deleteSeeded(owner);
    } finally {
      await owner.context.close();
    }
  });

  /** Progress's first active farm row, read from the matrix, with the seed's order checked. */
  async function firstFarm(page: Page): Promise<{ id: string; title: string }> {
    await openShell(page, 'tab=progress');
    await expect(nameOf(page, ids.top)).toBeVisible({ timeout: 15_000 });
    const rows = await page.locator(ACTIVE_ROWS).evaluateAll((els) => els.map((el) => el.getAttribute('data-goal-id') ?? ''));
    // Non-vacuous: the card can't get this right by sorting on the title.
    expect(rows.indexOf(ids.top)).toBeGreaterThanOrEqual(0);
    expect(rows.indexOf(ids.top)).toBeLessThan(rows.indexOf(ids.other));
    return { id: rows[0], title: (await nameOf(page, rows[0]).innerText()).trim() };
  }

  /** The open row's #1, as the queue words it. */
  async function queueTop(page: Page): Promise<string> {
    const line = page.getByTestId('progress-expansion-queue').getByRole('listitem').first();
    await expect(line).toBeVisible();
    return (await line.innerText()).replace(/\s+/g, ' ').trim();
  }

  test('criterion 8: the card names Progress\'s first farm, its link opens that row, and the next line names the row\'s #1', async ({ page }) => {
    await loginAsOwner(page);
    const first = await firstFarm(page);

    await openHome(page);
    await expect(farmCard(page)).toBeVisible();
    await expect(cardLink(page, first.title)).toBeVisible();
    const next = (await nextLine(page).innerText()).trim();

    await cardLink(page, first.title).click();
    await expectFarmOpen(page, first.id);

    const top = await queueTop(page);
    const name = top.match(/^#1\s*([^·]+?)\s*(?:·|$)/)?.[1];
    expect(name, `the queue's first line: ${top}`).toBeTruthy();
    expect(next.startsWith(`${name} is next`), `card "${next}", queue "${top}"`).toBe(true);
    const count = next.match(/\((\d+)\/99\)$/)?.[1];
    expect(count, `the card's next line: ${next}`).toBeTruthy();
    expect(top).toContain(count as string);
  });

  test('D-9: from Find, then Home, the card\'s link still opens the row, and `?track` wins over the remembered `pview`', async ({ page }) => {
    await loginAsOwner(page);
    await openShell(page, 'tab=progress&pview=find');
    await expect(findRegion(page)).toBeVisible({ timeout: 15_000 });

    await switchTab(page, 'Home');
    // Tab memory keeps the view for the Progress tab: the case D-9's rule exists for.
    await expect(page).toHaveURL(/[?&]pview=find/);
    await expect(farmCard(page)).toBeVisible({ timeout: 15_000 });
    await cardLink(page, TOP).click();

    await expectFarmOpen(page, ids.top);
    await expect(findRegion(page)).toHaveCount(0);
  });

  test('split clears on: the row shows Alts assigned x/y and opens the split plan', async ({ page, browser }) => {
    await withSplit(browser, true, async (owner) => {
      const { x, y } = await splitNumbers(owner);
      await loginAsOwner(page);
      await openHome(page);
      await expect(main(page).getByText('Split clears', { exact: true })).toBeVisible();
      await expect(splitMeta(page)).toHaveText(new RegExp(`^Alts assigned ${x}/${y}( · \\d+ needs? attention)?$`));

      await openPlan(page).click();
      await expectSplitPlanOpen(page);
    });
  });

  test('split clears on: from Find, then Home, the row still opens the split plan', async ({ page, browser }) => {
    await withSplit(browser, true, async () => {
      await loginAsOwner(page);
      await openShell(page, 'tab=progress&pview=find');
      await expect(findRegion(page)).toBeVisible({ timeout: 15_000 });

      await switchTab(page, 'Home');
      await expect(page).toHaveURL(/[?&]pview=find/);
      await expect(openPlan(page)).toBeVisible({ timeout: 15_000 });
      await openPlan(page).click();

      await expectSplitPlanOpen(page);
      await expect(findRegion(page)).toHaveCount(0);
    });
  });

  test('split clears off: no row, with the rest of the attention card and the farm card there', async ({ page, browser }) => {
    await withSplit(browser, false, async () => {
      await loginAsOwner(page);
      // Shorter than the test's timeout, so a missing read fails here and `withSplit` still restores.
      const read = page.waitForResponse((res) => res.request().method() === 'GET' && /\/api\/static-groups\/[^/]+\/split-clear$/.test(res.url()), {
        timeout: 15_000,
      });
      await openHome(page);
      // Non-vacuous: Home asked, the static said off, and the card it sits beside rendered.
      expect((await read).ok()).toBe(true);
      await expect(farmCard(page)).toBeVisible();
      await expect(main(page).getByRole('heading', { name: 'Needs your attention' })).toBeVisible();
      await expect(main(page).getByText('Split clears', { exact: true })).toHaveCount(0);
      await expect(openPlan(page)).toHaveCount(0);
    });
  });

  for (const theme of THEMES) {
    test(`owner: axe reports no critical or serious violation on Home with both pointers (${theme}, 1440 x 900)`, async ({ browser }) => {
      await withSplit(browser, true, async () => {
        const context = await freshContext(browser);
        const page = await context.newPage();
        try {
          await page.setViewportSize({ width: 1440, height: 900 });
          await page.addInitScript((t) => window.localStorage.setItem('theme', t), theme);
          await loginAsOwner(page);
          await openHome(page);
          await expect(farmCard(page)).toBeVisible();
          await expect(openPlan(page)).toBeVisible();

          const results = await new AxeBuilder({ page }).include('main').analyze();
          const blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
          const left = theme === 'light' ? await withoutAccentSubtleDebt(page, blocking) : blocking;
          expect(left, JSON.stringify(left, null, 2)).toEqual([]);
        } finally {
          await context.close();
        }
      });
    });
  }
});
