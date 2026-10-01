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
 * R-G1-3 plus R-G1-7. Tracking, Plugin and More are palette- or URL-only for
 * guests and belong to GUEST-2.
 */

import { test, expect } from '@playwright/test';
import { API_BASE, FRONTEND_BASE, DEV_SHARE_CODE, loginAsOwner, switchTab } from './helpers/auth';

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
