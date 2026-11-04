/**
 * S2a-5a·C2b Task C2-4 (O-3, O-4, O-5, C-3, C-5, R-M-7): the objectives moves on DEVTST, end to end.
 *
 * The card on Home and the editor on Recruit ▸ Listing, by role, and `?tab=goals&goal=objectives`.
 * Rows are seeded through the owner's API with the `E2E Objective ` prefix; every test starts with
 * none and `afterEach` deletes them, on failure too. A viewer is DevMember demoted, restored in
 * `finally`. Every URL names its `?shell=`, which is sticky per tab.
 *
 * Unit twins: `NewShell.goalLink.test.tsx` (the redirect), `Home.objectives.test.tsx`,
 * `ObjectivesCard.test.tsx` and `ListingTab.objectives.test.tsx` (the card and the editor).
 *
 * CI has no Playwright job; run against dev-auth servers:
 *   pnpm -C frontend test:e2e objectives --project=chromium --reporter=line
 */
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Browser, type Locator, type Page } from '@playwright/test';
import { API_BASE, DEV_SHARE_CODE, FRONTEND_BASE, freshContext, loginAsMember, loginAsOwner } from './helpers/auth';
import { type OwnerApi, currentUserId, ownerSession, setRole } from './helpers/owner';

const PREFIX = 'E2E Objective ';
const THEMES = ['dark', 'light'] as const;

interface Row { id: string; title: string; priority: string }

const REQUIRED = {
  category: 'ultimate_clear',
  title: `${PREFIX}Clear the "Ultimate" & don't wipe $1`,
  description: `${PREFIX}Reclears on Tuesdays… 100%`,
  priority: 'required',
};

const objectivesUrl = (groupId: string) => `${API_BASE}/api/static-groups/${groupId}/objective-goals`;

async function listObjectives(owner: OwnerApi): Promise<Row[]> {
  const res = await owner.page.request.get(objectivesUrl(owner.groupId));
  if (!res.ok()) throw new Error(`the objective list returned ${res.status()}`);
  return (await res.json()) as Row[];
}

async function deleteSeeded(owner: OwnerApi) {
  for (const row of await listObjectives(owner)) {
    if (!row.title.startsWith(PREFIX)) continue;
    const del = await owner.page.request.delete(`${objectivesUrl(owner.groupId)}/${row.id}`, { headers: owner.headers });
    if (!del.ok() && del.status() !== 404) throw new Error(`deleting ${row.title} returned ${del.status()}`);
  }
}

async function seed(browser: Browser, ...rows: Array<{ category: string; title: string; description?: string; priority: string }>) {
  const owner = await ownerSession(browser);
  try {
    for (const row of rows) {
      const res = await owner.page.request.post(objectivesUrl(owner.groupId), { headers: owner.headers, data: row });
      if (!res.ok()) throw new Error(`seeding ${row.title} returned ${res.status()}`);
    }
  } finally {
    await owner.context.close();
  }
}

async function devMemberId(owner: OwnerApi): Promise<string> {
  const res = await owner.page.request.get(`${API_BASE}/api/static-groups/${owner.groupId}/members`);
  if (!res.ok()) throw new Error(`the member list returned ${res.status()}`);
  const members = (await res.json()) as Array<{ userId: string; user?: { discordUsername?: string } }>;
  const id = members.find((m) => m.user?.discordUsername === 'DevMember')?.userId;
  if (!id) throw new Error('DevMember is not in DEVTST');
  return id;
}

/** Runs `body` as DevMember demoted to viewer. Dev login re-seats a member, so this demotes after it. */
async function asViewer(browser: Browser, page: Page, body: () => Promise<void>) {
  const owner = await ownerSession(browser);
  let demoted: string | null = null;
  try {
    await loginAsMember(page);
    demoted = await currentUserId(page);
    await setRole(owner, demoted, 'viewer');
    await body();
  } finally {
    if (demoted) await setRole(owner, demoted, 'member');
    await owner.context.close();
  }
}

const main = (page: Page) => page.getByRole('main');
const homeHero = (page: Page) => page.getByRole('heading', { level: 1, name: 'This week' });
const card = (page: Page) => main(page).getByRole('heading', { name: 'Objectives', exact: true });
const editLink = (page: Page) => main(page).getByRole('button', { name: 'Edit objectives' });
const listing = (page: Page) => page.getByTestId('listing-objectives');
const saveListing = (page: Page) => main(page).getByRole('button', { name: 'Save Listing' });
/** The editor's row for `title`: the innermost div holding both the title and its pencil. */
const editorRow = (page: Page, title: string) =>
  listing(page)
    .locator('div')
    .filter({ has: page.getByText(title, { exact: true }) })
    .filter({ has: page.getByRole('button', { name: 'Edit objective' }) })
    .last();

async function shellReady(page: Page, signedIn = true) {
  await page.locator('[data-testid="new-shell"]').waitFor({ timeout: 15_000 });
  if (signedIn) await page.getByRole('button', { name: /User menu for/i }).waitFor({ timeout: 15_000 });
}

async function openGroup(page: Page, query: string, signedIn = true) {
  await page.goto(`${FRONTEND_BASE}/group/${DEV_SHARE_CODE}?shell=v2&${query}`);
  await shellReady(page, signedIn);
}

/** Home, with its hero up and every request it sends settled. */
async function openHome(page: Page, signedIn = true) {
  await openGroup(page, 'tab=overview', signedIn);
  await expect(homeHero(page)).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState('networkidle');
}

async function openListing(page: Page) {
  await page.goto(`${FRONTEND_BASE}/group/${DEV_SHARE_CODE}/recruit?shell=v2&rtab=listing`);
  await shellReady(page);
  await expect(listing(page).getByRole('heading', { name: 'Static Objectives' })).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState('networkidle');
}

/** Home's card, in full: title, "{category} · {priority}" and description. */
async function expectCardReads(page: Page) {
  await expect(card(page)).toBeVisible({ timeout: 15_000 });
  await expect(main(page).getByText(REQUIRED.title, { exact: true })).toBeVisible();
  await expect(main(page).getByText('Ultimate — Clear · Required', { exact: true })).toBeVisible();
  await expect(main(page).getByText(REQUIRED.description, { exact: true })).toBeVisible();
}

/** The link's final URL holds: now, and again once every write has landed. */
async function expectLanded(page: Page, target: 'home' | 'listing', viewAs?: string) {
  const check = async () => {
    await expect(page).not.toHaveURL(/[?&]goal=/);
    if (target === 'home') {
      await expect(page).not.toHaveURL(/\/recruit(\?|$)/);
      await expect(page).toHaveURL(/[?&]tab=overview(&|$)/);
    } else {
      await expect(page).toHaveURL(new RegExp(`/group/${DEV_SHARE_CODE}/recruit\\?`));
      await expect(page).toHaveURL(/[?&]rtab=listing(&|$)/);
      await expect(page).not.toHaveURL(/[?&]tab=/);
    }
    if (viewAs) await expect(page).toHaveURL(new RegExp(`[?&]viewAs=${viewAs}(&|$)`));
  };
  await check();
  await page.waitForLoadState('networkidle');
  await check();
}

/**
 * Pre-existing contrast debt on Home in light, nothing to do with the card: `Button
 * variant="accent-subtle"` (text-accent on bg-accent/10, "Add session" and "Import BiS"), 4.38:1,
 * tracked in #394. As `withoutAccentSubtleDebt` in home-pointers.spec.ts: only that variant's nodes
 * leave `color-contrast`, every other rule still sees them, and dark still does.
 */
async function nodesOutside<V extends { id: string; nodes: Array<{ target: unknown }> }>(
  page: Page,
  violations: V[],
  rule: string,
  inDebt: (selector: string) => Promise<boolean>,
): Promise<V[]> {
  const kept: V[] = [];
  for (const violation of violations) {
    if (violation.id !== rule) {
      kept.push(violation);
      continue;
    }
    const nodes: V['nodes'] = [];
    for (const node of violation.nodes) {
      const selector = Array.isArray(node.target) ? node.target[node.target.length - 1] : node.target;
      if (typeof selector !== 'string' || !(await inDebt(selector))) nodes.push(node);
    }
    if (nodes.length > 0) kept.push({ ...violation, nodes });
  }
  return kept;
}

const isAccentSubtle = (page: Page) => (selector: string) =>
  page.evaluate((sel) => document.querySelector(sel)?.matches('button.bg-accent\\/10') === true, selector);

/**
 * The frozen `ObjectiveGoalsPanel`'s priority Badges calculate under 4.5:1 at 12px in both themes;
 * tracked in #437. Only a Badge reading a priority inside the editor leaves `color-contrast`: not the
 * category Badge beside it, not the panel's other text, and no other rule.
 */
const isPriorityBadge = (page: Page) => (selector: string) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return (
      el?.closest('[data-testid="listing-objectives"]') != null &&
      el.matches('span.inline-flex.rounded.border') &&
      ['required', 'preferred', 'optional', 'not doing'].includes(el.textContent?.trim() ?? '')
    );
  }, selector);

const blocking = <V extends { impact?: string | null }>(violations: V[]) =>
  violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');

test.describe('Objectives (S2a-5a)', () => {
  test.beforeEach(async ({ browser }) => {
    const owner = await ownerSession(browser);
    try {
      await deleteSeeded(owner);
    } finally {
      await owner.context.close();
    }
  });

  test.afterEach(async ({ browser }) => {
    const owner = await ownerSession(browser);
    try {
      await deleteSeeded(owner);
    } finally {
      await owner.context.close();
    }
  });

  // Regression proof: both ship in C2a.
  test('owner: adds, edits and deletes on Listing with no Save Listing; it shows on Home, whose Edit opens Listing', async ({ page }) => {
    test.setTimeout(60_000);
    const title = `${PREFIX}Added on Listing`;
    const edited = `${PREFIX}Edited on Listing`;
    const description = `${PREFIX}Described on Listing`;
    await loginAsOwner(page);
    await openListing(page);

    // O-4: above the builder.
    const editorBox = await listing(page).boundingBox();
    const builderBox = await saveListing(page).boundingBox();
    expect(editorBox && builderBox && editorBox.y < builderBox.y, 'the editor sits above the listing builder').toBe(true);

    // Add. Leaving the page proves it saved by itself: Save Listing is never pressed.
    await listing(page).getByRole('button', { name: 'Add Static Goal', exact: true }).click();
    await listing(page).getByPlaceholder('e.g., Clear The Futures Rewritten (Ultimate)').fill(title);
    await listing(page).getByPlaceholder('Additional context for this objective').fill(description);
    await listing(page).getByRole('button', { name: 'Save', exact: true }).click();
    await expect(editorRow(page, title)).toBeVisible();
    await openHome(page);
    await expect(card(page)).toBeVisible({ timeout: 15_000 });
    await expect(main(page).getByText(title, { exact: true })).toBeVisible();
    await expect(main(page).getByText(description, { exact: true })).toBeVisible();

    // Home's Edit opens Listing, by the registered redirect.
    await editLink(page).click();
    await expect(page).toHaveURL(new RegExp(`/group/${DEV_SHARE_CODE}/recruit\\?.*rtab=listing`));
    await expect(editorRow(page, title)).toBeVisible({ timeout: 15_000 });

    // Edit.
    await editorRow(page, title).getByRole('button', { name: 'Edit objective' }).click();
    const titleField = listing(page).getByPlaceholder('e.g., Clear The Futures Rewritten (Ultimate)');
    await expect(titleField).toHaveValue(title);
    await titleField.fill(edited);
    await listing(page).getByRole('button', { name: 'Save', exact: true }).click();
    await expect(editorRow(page, edited)).toBeVisible();
    await page.reload();
    await shellReady(page);
    await expect(editorRow(page, edited)).toBeVisible({ timeout: 15_000 });

    // Delete, through the Remove Objective confirm.
    await editorRow(page, edited).getByRole('button', { name: 'Delete objective' }).click();
    const confirm = page.getByRole('dialog').filter({ hasText: 'Remove Objective' });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(listing(page).getByText(edited, { exact: true })).toHaveCount(0);
    await page.reload();
    await shellReady(page);
    await expect(listing(page).getByRole('heading', { name: 'Static Objectives' })).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState('networkidle');
    await expect(listing(page).getByText(edited, { exact: true })).toHaveCount(0);
  });

  test('member: reads title, meta and description on Home, has no Edit, and /recruit?rtab=listing redirects', async ({ page, browser }) => {
    await seed(browser, REQUIRED);
    await loginAsMember(page);
    await openHome(page);
    await expectCardReads(page);
    await expect(editLink(page)).toHaveCount(0);

    await page.goto(`${FRONTEND_BASE}/group/${DEV_SHARE_CODE}/recruit?shell=v2&rtab=listing`);
    await shellReady(page);
    await expect(page).toHaveURL(new RegExp(`/group/${DEV_SHARE_CODE}(\\?|$)`));
    await expect(listing(page)).toHaveCount(0);
  });

  test('viewer: reads it, with no Edit', async ({ page, browser }) => {
    await seed(browser, REQUIRED);
    await asViewer(browser, page, async () => {
      await openHome(page);
      await expectCardReads(page);
      await expect(editLink(page)).toHaveCount(0);
    });
  });

  test('guest: no card and no objective-goals request', async ({ browser }) => {
    await seed(browser, REQUIRED);
    const context = await freshContext(browser);
    const page = await context.newPage();
    try {
      const requests: string[] = [];
      page.on('request', (req) => {
        if (req.url().includes('/objective-goals')) requests.push(`${req.method()} ${req.url()}`);
      });
      await openHome(page, false);
      await expect(card(page)).toHaveCount(0);
      await expect(main(page).getByText(REQUIRED.title, { exact: true })).toHaveCount(0);
      expect(requests).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('only a Not Doing objective: no card, and the editor still lists it', async ({ page, browser }) => {
    const title = `${PREFIX}Not doing this`;
    const owner = await ownerSession(browser);
    let foreign: string[];
    try {
      foreign = (await listObjectives(owner)).filter((r) => !r.title.startsWith(PREFIX) && r.priority !== 'not_doing').map((r) => r.title);
    } finally {
      await owner.context.close();
    }
    test.skip(foreign.length > 0, `DEVTST holds active objectives this spec didn't seed, so a card would be right: ${foreign.join('; ')}`);

    await seed(browser, { category: 'custom', title, priority: 'not_doing' });
    await loginAsOwner(page);
    await openHome(page);
    await expect(card(page)).toHaveCount(0);
    await expect(main(page).getByText(title, { exact: true })).toHaveCount(0);

    await openListing(page);
    await expect(editorRow(page, title)).toBeVisible({ timeout: 15_000 });
  });

  // The cases that fail until C2b's redirect exists.
  test.describe('?tab=goals&goal=objectives', () => {
    test('owner: lands on Recruit ▸ Listing with the editor, and Back does not return to the link', async ({ page, browser }) => {
      await seed(browser, REQUIRED);
      await loginAsOwner(page);
      await page.goto(`${FRONTEND_BASE}/group/${DEV_SHARE_CODE}?shell=v2&tab=overview`);
      await shellReady(page);

      await page.goto(`${FRONTEND_BASE}/group/${DEV_SHARE_CODE}?shell=v2&tab=goals&goal=objectives`);
      await shellReady(page);
      await expectLanded(page, 'listing');
      await expect(editorRow(page, REQUIRED.title)).toBeVisible({ timeout: 15_000 });

      await page.goBack();
      await expect(page).not.toHaveURL(/[?&]goal=/);
    });

    test('member: lands on Home with the card', async ({ page, browser }) => {
      await seed(browser, REQUIRED);
      await loginAsMember(page);
      await openGroup(page, 'tab=goals&goal=objectives');
      await expectLanded(page, 'home');
      await expect(homeHero(page)).toBeVisible({ timeout: 15_000 });
      await expectCardReads(page);
    });

    test('viewer: lands on Home with the card', async ({ page, browser }) => {
      await seed(browser, REQUIRED);
      await asViewer(browser, page, async () => {
        await openGroup(page, 'tab=goals&goal=objectives');
        await expectLanded(page, 'home');
        await expect(homeHero(page)).toBeVisible({ timeout: 15_000 });
        await expectCardReads(page);
      });
    });

    test('DevOwner, the admin, with viewAs=<DevMember>: lands on Home keeping viewAs, with no Edit', async ({ page, browser }) => {
      await seed(browser, REQUIRED);
      const owner = await ownerSession(browser);
      let memberId: string;
      try {
        memberId = await devMemberId(owner);
      } finally {
        await owner.context.close();
      }
      await loginAsOwner(page);
      await openGroup(page, `tab=goals&goal=objectives&viewAs=${memberId}`);
      await expectLanded(page, 'home', memberId);
      await expect(homeHero(page)).toBeVisible({ timeout: 15_000 });
      await expectCardReads(page);
      await expect(editLink(page)).toHaveCount(0);
    });

    test('DevOwner with viewAs=<DevMember> and the read held: nothing moves until it lands', async ({ page, browser }) => {
      const owner = await ownerSession(browser);
      let memberId: string;
      try {
        memberId = await devMemberId(owner);
      } finally {
        await owner.context.close();
      }
      await loginAsOwner(page);

      let release = () => {};
      const released = new Promise<void>((resolve) => { release = resolve; });
      await page.route('**/api/static-groups/admin/user-role/**', async (route) => {
        await released;
        await route.continue();
      });
      const read = page.waitForRequest((req) => req.url().includes('/admin/user-role/'));

      await page.goto(`${FRONTEND_BASE}/group/${DEV_SHARE_CODE}?shell=v2&tab=goals&goal=objectives&viewAs=${memberId}`);
      await read;
      await shellReady(page);
      await expect(page).toHaveURL(/[?&]goal=objectives(&|$)/);
      await expect(page).not.toHaveURL(/\/recruit(\?|$)/);

      release();
      await expectLanded(page, 'home', memberId);
    });
  });

  for (const theme of THEMES) {
    // Regression proof: both ship in C2a.
    test(`owner: axe reports no critical or serious violation on Home with the card (${theme}, 1440 x 900)`, async ({ browser }) => {
      await seed(browser, REQUIRED, {
        category: 'savage_bis',
        title: `${PREFIX}Preferred, no description`,
        priority: 'preferred',
      });
      const context = await freshContext(browser);
      const page = await context.newPage();
      try {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.addInitScript((t) => window.localStorage.setItem('theme', t), theme);
        await loginAsOwner(page);
        await openHome(page);
        await expectCardReads(page);
        await expect(editLink(page)).toBeVisible();

        const results = await new AxeBuilder({ page }).include('main').analyze();
        const left = blocking(results.violations);
        const kept = theme === 'light' ? await nodesOutside(page, left, 'color-contrast', isAccentSubtle(page)) : left;
        expect(kept, JSON.stringify(kept, null, 2)).toEqual([]);
      } finally {
        await context.close();
      }
    });

    test(`owner: axe reports no critical or serious violation on the Listing editor, form closed (${theme}, 1440 x 900)`, async ({ browser }) => {
      await seed(
        browser,
        REQUIRED,
        { category: 'savage_bis', title: `${PREFIX}Preferred row`, priority: 'preferred' },
        { category: 'gil_farm', title: `${PREFIX}Optional row`, priority: 'optional' },
        { category: 'custom', title: `${PREFIX}Not Doing row`, priority: 'not_doing' },
      );
      const context = await freshContext(browser);
      const page = await context.newPage();
      try {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.addInitScript((t) => window.localStorage.setItem('theme', t), theme);
        await loginAsOwner(page);
        await openListing(page);
        await expect(editorRow(page, REQUIRED.title)).toBeVisible({ timeout: 15_000 });
        await expect(listing(page).getByPlaceholder('e.g., Clear The Futures Rewritten (Ultimate)')).toHaveCount(0);

        const results = await new AxeBuilder({ page }).include('[data-testid="listing-objectives"]').analyze();
        const kept = await nodesOutside(page, blocking(results.violations), 'color-contrast', isPriorityBadge(page));
        expect(kept, JSON.stringify(kept, null, 2)).toEqual([]);
      } finally {
        await context.close();
      }
    });
  }
});
