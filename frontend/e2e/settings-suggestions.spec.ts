/**
 * S2a-5a·C3 Task C3-2 (R-M-8, C-6, S2-14's Settings ruling): V2's Settings tab reads "Suggestions" and
 * holds nothing else, on DEVTST, end to end. Legacy keeps "Goals & Farms" and its four sections.
 *
 * Every URL names its `?shell=`, which is sticky per tab, so `?shell=legacy` proves V1 from the same
 * login. Suggestions and the objective a promote writes carry the `E2E Suggestion ` prefix; the
 * promote case sweeps them before it starts and in `finally`, on failure too. A promote copies the
 * suggestion's category, so it can write `mount_farm`, which objective create rejects.
 *
 * Unit twin: `SettingsPanel.suggestionsOnly.test.tsx`.
 *
 * CI has no Playwright job; run against dev-auth servers:
 *   pnpm -C frontend test:e2e settings-suggestions --project=chromium --reporter=line
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { API_BASE, DEV_SHARE_CODE, FRONTEND_BASE, freshContext, loginAsMember, loginAsOwner } from './helpers/auth';
import { type OwnerApi, ownerSession } from './helpers/owner';

const PREFIX = 'E2E Suggestion ';
const TITLE = `${PREFIX}Farm the "Gaze" & don't wipe $1… 100%`;
const DETAILS = `${PREFIX}Tuesdays after reclear`;
const STALE_SECTIONS = ['overview', 'objectives', 'farms'] as const;
const LOGINS = [
  ['owner', loginAsOwner],
  ['member', loginAsMember],
] as const;

const groupApi = (owner: OwnerApi, path: string) => `${API_BASE}/api/static-groups/${owner.groupId}/${path}`;

async function sweepRows(owner: OwnerApi, path: string) {
  const list = await owner.page.request.get(groupApi(owner, path));
  if (!list.ok()) throw new Error(`the ${path} list returned ${list.status()}`);
  for (const row of (await list.json()) as Array<{ id: string; title: string }>) {
    if (!row.title.startsWith(PREFIX)) continue;
    const del = await owner.page.request.delete(groupApi(owner, `${path}/${row.id}`), { headers: owner.headers });
    if (!del.ok() && del.status() !== 404) throw new Error(`deleting ${row.title} returned ${del.status()}`);
  }
}

/** A promoted suggestion only points at its objective (SET NULL), so either order works. */
async function sweep(owner: OwnerApi) {
  await sweepRows(owner, 'content-suggestions');
  await sweepRows(owner, 'objective-goals');
}

const main = (page: Page) => page.getByRole('main');
const dock = (page: Page) => page.getByRole('dialog', { name: 'Static settings' });
const dockTab = (page: Page, name: string) => dock(page).getByRole('button', { name, exact: true });
const gear = (page: Page) => page.getByRole('button', { name: 'Settings' });
const noV2Shell = (page: Page) => expect(page.getByTestId('new-shell')).toHaveCount(0);

/** The first load's `?tier=` write is done, so it can't land on top of a click. */
async function settled(page: Page) {
  await page.waitForURL(/[?&]tier=/, { timeout: 15_000 });
  await page.waitForLoadState('networkidle');
}

async function openV2(page: Page, query: string) {
  await page.goto(`${FRONTEND_BASE}/group/${DEV_SHARE_CODE}?shell=v2&${query}`);
  await page.getByTestId('new-shell').waitFor({ timeout: 15_000 });
  await page.getByRole('button', { name: /User menu for/i }).waitFor({ timeout: 15_000 });
  await settled(page);
}

async function openLegacy(page: Page, query = 'tab=overview') {
  await page.goto(`${FRONTEND_BASE}/group/${DEV_SHARE_CODE}?shell=legacy&${query}`);
  await page.getByRole('button', { name: 'Roster', exact: true }).first().waitFor({ timeout: 15_000 });
  await page.getByRole('button', { name: /User menu for/i }).waitFor({ timeout: 15_000 });
  await noV2Shell(page);
  await settled(page);
}

async function openDock(page: Page) {
  await gear(page).click();
  await expect(dock(page)).toBeVisible({ timeout: 5_000 });
}

/** The tab reads Suggestions, and opening it shows that panel and nothing else from Goals & Farms. */
async function expectSuggestionsAlone(page: Page) {
  await expect(dockTab(page, 'Suggestions')).toBeVisible();
  await expect(dockTab(page, 'Goals & Farms')).toHaveCount(0);
  await dockTab(page, 'Suggestions').click();
  await expect(dock(page).getByRole('heading', { name: 'Content Suggestions' })).toBeVisible();
  await expect(dock(page).getByRole('tablist')).toHaveCount(0);
  await expect(dock(page).getByRole('tab')).toHaveCount(0);
  await expect(dock(page).getByRole('heading', { name: 'Static Objectives' })).toHaveCount(0);
  await expect(dock(page).getByText('Open Suggestions', { exact: true })).toHaveCount(0);
  await expect(dock(page).getByText('Collection Goals', { exact: true })).toHaveCount(0);
  await expect(dock(page).getByRole('button', { name: /^(Add|New) Farm$/ })).toHaveCount(0);
}

/**
 * Legacy only, and after each click: `GroupView` re-reads the tier on every URL change and then
 * writes `?tier=` from that render's params, so a second click before the read lands is undone.
 */
async function openSection(page: Page, name: string) {
  const tierRead = page.waitForResponse((res) => /\/tiers\/[^/?]+(\?|$)/.test(res.url()));
  await dock(page).getByRole('tab', { name, exact: true }).click();
  await tierRead;
}

/** Legacy's tab, its four sections in order, each with its own body. */
async function expectGoalsAndFarms(page: Page) {
  await dockTab(page, 'Goals & Farms').click();
  await expect(dockTab(page, 'Suggestions')).toHaveCount(0);
  await expect(dock(page).getByRole('tab')).toHaveText(['Overview', 'Objectives', 'Farms', 'Suggestions']);

  await expect(dock(page).getByText('Open Suggestions', { exact: true })).toBeVisible();
  await openSection(page, 'Objectives');
  await expect(dock(page).getByRole('heading', { name: 'Static Objectives' })).toBeVisible();
  await openSection(page, 'Farms');
  await expect(dock(page).getByText('Collection Goals', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/[?&]gsub=farms(&|$)/);
  await openSection(page, 'Suggestions');
  await expect(dock(page).getByRole('heading', { name: 'Content Suggestions' })).toBeVisible();
}

/** The innermost div in the dock holding both the suggestion's title and `control`. */
const rowWith = (page: Page, control: Locator) =>
  dock(page)
    .locator('div')
    .filter({ has: page.getByText(TITLE, { exact: true }) })
    .filter({ has: control })
    .last();
const voteRow = (page: Page) => rowWith(page, page.getByRole('button', { name: /^Must Have/ }));
const promoteRow = (page: Page) => rowWith(page, page.getByRole('button', { name: 'Promote to goal' }));

async function suggest(page: Page) {
  await dock(page).getByRole('button', { name: 'Suggest', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Suggest Content' });
  await expect(modal).toBeVisible();
  await modal.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Mount Farm', exact: true }).click();
  await modal.getByPlaceholder('e.g., Farm TOP weapons for everyone').fill(TITLE);
  await modal.getByPlaceholder('Why should the static consider this?').fill(DETAILS);
  await modal.getByRole('button', { name: 'Suggest', exact: true }).click();
  await expect(modal).toHaveCount(0);
}

test.describe('V2: the dock tab is Suggestions', () => {
  for (const [role, login] of LOGINS) {
    test(`${role}: reads "Suggestions" with no sub-tabs`, async ({ page }) => {
      await login(page);
      await openV2(page, 'tab=overview');
      await openDock(page);
      await expectSuggestionsAlone(page);
    });
  }

  for (const gsub of STALE_SECTIONS) {
    test(`owner on ?gsub=${gsub}: Suggestions shows, the param is ignored, and it survives a close (review focus 5)`, async ({ page }) => {
      const stale = new RegExp(`[?&]gsub=${gsub}(&|$)`);
      await loginAsOwner(page);
      await openV2(page, `tab=overview&gsub=${gsub}`);
      await openDock(page);
      await expectSuggestionsAlone(page);
      await expect(page).toHaveURL(stale);

      await gear(page).click();
      await expect(dock(page)).toHaveCount(0);
      await expect(page).toHaveURL(stale);

      await openDock(page);
      await expectSuggestionsAlone(page);
      await expect(page).toHaveURL(stale);
    });
  }

  test('a member suggests and votes; the owner votes and promotes; the objective shows on Listing and Home', async ({ page, browser }) => {
    test.setTimeout(90_000);
    const owner = await ownerSession(browser);
    const memberContext = await freshContext(browser);
    try {
      await sweep(owner);

      // Member: no promote control, and both writes reach the owner's next read.
      const member = await memberContext.newPage();
      await loginAsMember(member);
      await openV2(member, 'tab=overview');
      await openDock(member);
      await expectSuggestionsAlone(member);
      await suggest(member);
      await expect(voteRow(member)).toBeVisible();
      await expect(dock(member).getByRole('button', { name: 'Promote to goal' })).toHaveCount(0);
      await voteRow(member).getByRole('button', { name: /^Want/ }).click();
      await expect(voteRow(member)).toContainText('· 1 vote');

      await loginAsOwner(page);
      await openV2(page, 'tab=overview');
      await openDock(page);
      await expectSuggestionsAlone(page);
      await expect(voteRow(page)).toContainText('· 1 vote');
      await voteRow(page).getByRole('button', { name: /^Must Have/ }).click();
      await expect(voteRow(page)).toContainText('· 2 votes');

      await promoteRow(page).getByRole('button', { name: 'Promote to goal' }).click();
      const modal = page.getByRole('dialog', { name: 'Promote to Objective Goal' });
      await expect(modal).toBeVisible();
      await modal.getByRole('button', { name: 'Promote to Goal', exact: true }).click();
      await expect(modal).toHaveCount(0);

      // It leaves the Open filter and reads as promoted under Promoted.
      await expect(dock(page).getByText(TITLE, { exact: true })).toHaveCount(0);
      await dock(page).getByRole('combobox').click();
      await page.getByRole('option', { name: 'Promoted', exact: true }).click();
      await expect(dock(page).getByText(TITLE, { exact: true })).toBeVisible();
      await expect(dock(page).getByText('Promoted · now used in goal matching', { exact: true })).toBeVisible();

      await page.goto(`${FRONTEND_BASE}/group/${DEV_SHARE_CODE}/recruit?shell=v2&rtab=listing`);
      await expect(page.getByTestId('listing-objectives').getByText(TITLE, { exact: true })).toBeVisible({ timeout: 15_000 });

      await openV2(page, 'tab=overview');
      await expect(main(page).getByRole('heading', { name: 'Objectives', exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(main(page).getByText(TITLE, { exact: true })).toBeVisible();
      await expect(main(page).getByText('Mount Farm · Required', { exact: true })).toBeVisible();
      await expect(main(page).getByText(DETAILS, { exact: true })).toBeVisible();
    } finally {
      await sweep(owner);
      await memberContext.close();
      await owner.context.close();
    }
  });
});

// Regression proof: these redirects shipped before C3, and C3 must not disturb them.
test.describe('V2: the old links show Progress', () => {
  for (const [role, login] of LOGINS) {
    for (const query of ['tab=goals&goal=farms', 'tab=mount-farms', 'tab=collections']) {
      test(`${role}: ?${query} shows Progress, not GoalsPage or CollectionsHub`, async ({ page }) => {
        await login(page);
        await openV2(page, query);
        await expect(page.getByTestId('progress-screen')).toBeVisible({ timeout: 15_000 });
        await expect(page.getByRole('tab', { name: 'Progress', exact: true })).toHaveAttribute('aria-selected', 'true');
        await page.waitForLoadState('networkidle');
        await expect(main(page).getByRole('heading', { name: 'Static Objectives' })).toHaveCount(0);
        await expect(main(page).getByRole('button', { name: 'Objectives', exact: true })).toHaveCount(0);
        await expect(main(page).getByText('Browse Catalog', { exact: true })).toHaveCount(0);
        await expect(main(page).getByText('Still needed', { exact: true })).toHaveCount(0);
      });
    }
  }
});

test.describe('Legacy keeps Goals & Farms', () => {
  // Regression proof: V1 passes neither prop.
  for (const [role, login] of LOGINS) {
    test(`${role}: the tab and its four sections`, async ({ page }) => {
      await login(page);
      await openLegacy(page);
      await openDock(page);
      await expectGoalsAndFarms(page);
    });
  }

  test('owner: ?gsub=farms still opens Farms', async ({ page }) => {
    await loginAsOwner(page);
    await openLegacy(page, 'tab=overview&gsub=farms');
    await openDock(page);
    await dockTab(page, 'Goals & Farms').click();
    await expect(dock(page).getByRole('tab', { name: 'Farms', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(dock(page).getByText('Collection Goals', { exact: true })).toBeVisible();
  });

  test('owner: ?tab=goals&goal=farms still shows CollectionsHub, so the V2 absences above are not vacuous', async ({ page }) => {
    await loginAsOwner(page);
    await openLegacy(page, 'tab=goals&goal=farms');
    await expect(page.getByTestId('progress-screen')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Objectives', exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Browse Catalog', { exact: true })).toBeVisible();
  });

  test('owner: ?tab=goals&goal=objectives still shows GoalsPage\'s panel, so the V2 absence above is not vacuous', async ({ page }) => {
    await loginAsOwner(page);
    await openLegacy(page, 'tab=goals&goal=objectives');
    await expect(page.getByRole('heading', { name: 'Static Objectives' })).toBeVisible({ timeout: 15_000 });
  });

  test('from the same login and tab: V2 has Suggestions, ?shell=legacy has Goals & Farms, ?shell=v2 has Suggestions again', async ({ page }) => {
    await loginAsOwner(page);
    await openV2(page, 'tab=overview');
    await openDock(page);
    await expectSuggestionsAlone(page);

    await openLegacy(page);
    await openDock(page);
    await expectGoalsAndFarms(page);

    await openV2(page, 'tab=overview');
    await openDock(page);
    await expectSuggestionsAlone(page);
  });
});
