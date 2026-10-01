/**
 * GUEST-1 (W0): a signed-out visitor on a PUBLIC static, V2 shell.
 *
 * CI has no Playwright job; run against dev-auth servers:
 *   E2E_API_URL=http://localhost:8001 E2E_FRONTEND_URL=http://localhost:5174 \
 *     pnpm -C frontend test:e2e -- e2e/guest.spec.ts e2e/smoke.spec.ts
 * Every assertion here has a CI-run twin (pytest for the payload and
 * /api/auth/session contracts; vitest for the top-bar gates, the palette, the
 * settings host, Schedule's zero calls and initializeAuth's single request).
 *
 * Baseline on `main` before GUEST-1 (R-G1-9, vet M-5): a guest on V2 Home and
 * Roster made 0 data 4xx and Loot 0; Schedule made 5; and the auth bootstrap
 * added 3 (the /me + refresh 401s) on every page load. So the empty recorders
 * on Home, Roster and Loot are R-G1-3's work alone, and on Schedule they are
 * R-G1-3 plus R-G1-7. Tracking, Plugin and More were palette- or URL-only for
 * guests and are covered by the GUEST-2 describe below.
 */

import { test, expect, type Page } from '@playwright/test';
import { API_BASE, FRONTEND_BASE, DEV_SHARE_CODE, loginAsOwner, pinShell, switchTab } from './helpers/auth';

test.describe('Guest on a public static (V2)', () => {
  test('no bell, no gear, Log in visible, no 401s, no member identity in by-code', async ({ browser }) => {
    test.setTimeout(90_000);

    // 1. dev-auth flips DEVTST to public on every owner login.
    const ownerCtx = await browser.newContext({ baseURL: FRONTEND_BASE });
    const ownerPage = await ownerCtx.newPage();
    await loginAsOwner(ownerPage);

    // 2. A fresh guest context, with both recorders attached before any load.
    const guestCtx = await browser.newContext({ baseURL: FRONTEND_BASE });
    const page = await guestCtx.newPage();
    const denied: string[] = [];
    const consoleNoise: string[] = [];
    page.on('response', (res) => {
      if (res.status() === 401 || res.status() === 403) denied.push(`${res.status()} ${res.url()}`);
    });
    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error' && /401|403|Unauthorized|auth-store/i.test(text)) {
        consoleNoise.push(`error: ${text}`);
      }
      if (msg.type() === 'warning' && /auth-store/i.test(text)) {
        consoleNoise.push(`warning: ${text}`);
      }
    });

    // 3. Landing page, then the static's four Spine tabs.
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.goto(`/group/${DEV_SHARE_CODE}?shell=v2`);
    await page.locator('[data-testid="new-shell"]').waitFor({ timeout: 15_000 });
    await expect(page.getByText('Dev Test Static').first()).toBeVisible({ timeout: 10_000 });
    for (const tab of ['Home', 'Roster', 'Loot', 'Schedule'] as const) {
      await switchTab(page, tab);
      await page.waitForLoadState('networkidle');
    }

    // 4. Top bar: Log in instead of the bell and the gear.
    const slot = page.getByTestId('chrome-topbar-slot');
    await expect(slot.getByRole('button', { name: 'Login with Discord' })).toBeVisible();
    await expect(slot.getByRole('button', { name: /^Notifications/ })).toHaveCount(0);
    await expect(slot.getByRole('button', { name: 'Settings' })).toHaveCount(0);

    // 5. The palette has no Open Settings for a guest.
    await page.keyboard.press('ControlOrMeta+K');
    const search = page.getByPlaceholder('Search commands…');
    await expect(search).toBeVisible();
    await search.fill('settings');
    await expect(page.getByText('No commands found.')).toBeVisible();
    await page.keyboard.press('Escape');

    // 6. Schedule is one members-only card.
    await expect(page.getByTestId('schedule-screen')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Members only' })).toBeVisible();

    // 7. Both recorders are empty.
    expect(denied, `401/403 responses:\n${denied.join('\n')}`).toEqual([]);
    expect(consoleNoise, `auth console noise:\n${consoleNoise.join('\n')}`).toEqual([]);

    // 8. by-code leaves member accounts out for a guest; members keep them.
    const guestBody = await (await guestCtx.request.get(`${API_BASE}/api/static-groups/by-code/${DEV_SHARE_CODE}`)).text();
    expect(guestBody).not.toContain('discordUsername');
    expect(guestBody).not.toContain('discordId');
    const ownerBody = await (await ownerCtx.request.get(`${API_BASE}/api/static-groups/by-code/${DEV_SHARE_CODE}`)).text();
    expect(ownerBody).toContain('discordUsername');

    await guestCtx.close();
    await ownerCtx.close();
  });
});

/**
 * GUEST-2 (W0): the same signed-out visitor on Tracking, Plugin and More, in
 * V2 and in legacy, plus the guest API bodies (R-G2-8).
 *
 * Baseline on `main` (def04893, before GUEST-2), V2 and legacy guest alike:
 * Tracking made 401s on objective-goals (and collection-suggestions and
 * collection-goals on the farms sub-tab), Plugin on auth/api-keys, and More
 * showed the Settings and Integrations cards in V2. After GUEST-2 both shells
 * make none, so the empty recorders below are Task 1 + Task 2's work. Legacy's
 * Roster and Schedule 401s (character-registrations, split-clear, schedule,
 * scheduler/settings) are carried: V1 is frozen, and this walk does not visit
 * them.
 */
const GUEST2_TABS = [
  { label: 'Tracking', path: `/group/${DEV_SHARE_CODE}?tab=goals` },
  { label: 'Tracking (farms)', path: `/group/${DEV_SHARE_CODE}?tab=goals&goal=farms` },
  { label: 'Plugin', path: `/group/${DEV_SHARE_CODE}?tab=plugin` },
  { label: 'More', path: `/group/${DEV_SHARE_CODE}?tab=more` },
] as const;

test.describe('Guest on a public static (GUEST-2)', () => {
  test('Tracking, Plugin and More make no guest 401s in either shell, and the API leaves out member accounts', async ({ browser }) => {
    test.setTimeout(150_000);

    // dev-auth flips DEVTST to public on every owner login.
    const ownerCtx = await browser.newContext({ baseURL: FRONTEND_BASE });
    const ownerPage = await ownerCtx.newPage();
    await loginAsOwner(ownerPage);

    const guestCtx = await browser.newContext({ baseURL: FRONTEND_BASE });

    // One recorder set per page, with a label per URL so a failure names it.
    async function walk(shell: 'v2' | 'legacy', visit: (label: string, page: Page) => Promise<void>) {
      const page = await guestCtx.newPage();
      const denied: Record<string, string[]> = {};
      const consoleNoise: string[] = [];
      let current = '';
      page.on('response', (res) => {
        if (res.status() === 401 || res.status() === 403) {
          (denied[current] ??= []).push(`${res.status()} ${res.url()}`);
        }
      });
      page.on('console', (msg) => {
        const text = msg.text();
        if (msg.type() === 'error' && /401|403|Unauthorized|auth-store/i.test(text)) {
          consoleNoise.push(`${current} error: ${text}`);
        }
        if (msg.type() === 'warning' && /auth-store/i.test(text)) {
          consoleNoise.push(`${current} warning: ${text}`);
        }
      });
      try {
        for (const { label, path } of GUEST2_TABS) {
          current = label;
          denied[label] = [];
          await pinShell(page, shell, path);
          if (shell === 'v2') {
            await page.locator('[data-testid="new-shell"]').waitFor({ timeout: 15_000 });
            await expect(page.getByText('Dev Test Static').first()).toBeVisible({ timeout: 15_000 });
          } else {
            // Legacy's tab bar is up once the group has loaded.
            await page.getByRole('button', { name: 'Roster', exact: true }).first().waitFor({ timeout: 15_000 });
          }
          await page.waitForLoadState('networkidle');
          await visit(label, page);
          await page.waitForLoadState('networkidle');
        }
      } finally {
        for (const [label, lines] of Object.entries(denied)) {
          console.log(`[GUEST-2 ${shell}] ${label}: ${lines.length === 0 ? '0 x 401/403' : lines.join(' | ')}`);
        }
      }
      await page.close();
      return { denied, consoleNoise };
    }

    // V2: every recorder empty, the members-only card, the login prompt, no settings cards.
    const v2 = await walk('v2', async (label, page) => {
      if (label.startsWith('Tracking')) {
        await expect(page.getByTestId('members-only-card')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Members only' })).toBeVisible();
      }
      if (label === 'Plugin') {
        const keys = page.getByTestId('plugin-api-keys');
        await expect(keys.getByRole('button', { name: 'Login with Discord' })).toBeVisible();
        await expect(keys.getByText('Log in to create an API key for the plugin.')).toBeVisible();
        await expect(keys.getByText('Your API keys')).toHaveCount(0);
      }
      if (label === 'More') {
        await expect(page.getByText('Dalamud Plugin', { exact: true })).toBeVisible();
        await expect(page.getByText('Settings', { exact: true })).toHaveCount(0);
        await expect(page.getByText('Integrations', { exact: true })).toHaveCount(0);
      }
    });
    const v2Denied = Object.values(v2.denied).flat();
    expect(v2Denied, `V2 401/403 responses:\n${v2Denied.join('\n')}`).toEqual([]);
    expect(v2.consoleNoise, `V2 auth console noise:\n${v2.consoleNoise.join('\n')}`).toEqual([]);

    // Legacy: no 401/403 from the Tracking or Plugin routes. Roster and Schedule
    // 401s are carried (V1 frozen) and are not visited here.
    const legacy = await walk('legacy', async () => {});
    const legacyDenied = Object.values(legacy.denied).flat();
    const legacyRoutes = legacyDenied.filter((line) => /objective-goals|collection-goals|auth\/api-keys/.test(line));
    expect(legacyRoutes, `legacy Tracking/Plugin 401/403 responses:\n${legacyRoutes.join('\n')}`).toEqual([]);
    expect(legacyDenied, `legacy 401/403 responses:\n${legacyDenied.join('\n')}`).toEqual([]);

    // API: a guest's raw bodies carry no Discord account; the owner's do.
    const groupRes = await guestCtx.request.get(`${API_BASE}/api/static-groups/by-code/${DEV_SHARE_CODE}`);
    const gid = (await groupRes.json() as { id: string }).id;
    const tiers = await (await guestCtx.request.get(`${API_BASE}/api/static-groups/${gid}/tiers`)).json() as { tierId: string }[];
    const tid = tiers[0].tierId;
    const base = `${API_BASE}/api/static-groups/${gid}`;
    const routes = {
      tier: `${base}/tiers/${tid}`,
      players: `${base}/tiers/${tid}/players`,
      members: `${base}/members`,
      linkedPlayers: `${base}/linked-players`,
    };

    for (const [name, url] of Object.entries(routes)) {
      const res = await guestCtx.request.get(url);
      expect(res.status(), `guest ${name}`).toBe(200);
      const body = await res.text();
      expect(body, `guest ${name} discordUsername`).not.toContain('discordUsername');
      expect(body, `guest ${name} discordId`).not.toContain('discordId');
      // Non-vacuity: the owner's body is the same route with accounts in it.
      const ownerRes = await ownerCtx.request.get(url);
      expect(ownerRes.status(), `owner ${name}`).toBe(200);
      expect(await ownerRes.text(), `owner ${name} discordUsername`).toContain('discordUsername');
    }
    expect(await (await guestCtx.request.get(routes.linkedPlayers)).json()).toEqual([]);

    // Loot log: a non-empty guest body, every createdByUsername null.
    const lootUrl = `${base}/tiers/${tid}/loot-log`;
    let ownerLoot = await (await ownerCtx.request.get(lootUrl)).json() as { createdByUsername: string | null }[];
    if (ownerLoot.length === 0) {
      const players = await (await ownerCtx.request.get(routes.players)).json() as { id: string }[];
      const csrf = (await ownerCtx.cookies(API_BASE)).find((c) => c.name === 'csrf_token')?.value ?? '';
      const created = await ownerCtx.request.post(lootUrl, {
        data: { weekNumber: 1, floor: 'M9S', itemSlot: 'earring', recipientPlayerId: players[0].id, method: 'drop' },
        headers: { 'X-CSRF-Token': csrf },
      });
      expect(created.status(), 'owner logs one loot entry').toBe(201);
      ownerLoot = await (await ownerCtx.request.get(lootUrl)).json();
    }
    expect(ownerLoot.some((entry) => entry.createdByUsername), 'owner loot-log carries createdByUsername').toBe(true);
    const guestLootRes = await guestCtx.request.get(lootUrl);
    expect(guestLootRes.status()).toBe(200);
    const guestLootText = await guestLootRes.text();
    expect(guestLootText).not.toContain('discordUsername');
    expect(guestLootText).not.toContain('discordId');
    const guestLoot = JSON.parse(guestLootText) as { createdByUsername: string | null }[];
    expect(guestLoot.length, 'guest loot-log is non-empty').toBeGreaterThan(0);
    expect(guestLoot.filter((entry) => entry.createdByUsername !== null)).toEqual([]);

    await guestCtx.close();
    await ownerCtx.close();
  });
});
