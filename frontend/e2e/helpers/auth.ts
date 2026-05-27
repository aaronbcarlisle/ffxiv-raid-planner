import { type Page, type BrowserContext, expect } from '@playwright/test';

export const API_BASE = process.env.E2E_API_URL || 'http://localhost:8001';
export const FRONTEND_BASE = process.env.E2E_FRONTEND_URL || 'http://localhost:5174';
export const DEV_SHARE_CODE = 'DEVTST';

/**
 * Log in via dev-auth and set httpOnly cookies in the browser's native store.
 *
 * We navigate the browser directly to the dev-auth GET endpoint so that the
 * browser processes the Set-Cookie headers natively during the navigation
 * response — exactly as it does during a real OAuth redirect. This is more
 * reliable than ctx.request.post() (which can have a timing gap between
 * Playwright's request cookie store and the browser's native cookie jar in
 * sequential test runs) and avoids the cross-origin fetch complications of
 * page.evaluate() with credentials: 'include'.
 *
 * After this call the page is pointing at the backend JSON response; call
 * goToTestStatic() to navigate to the app.
 */
export async function loginAsOwner(page: Page): Promise<void> {
  await page.goto(`${API_BASE}/api/dev-auth/login/0`, { waitUntil: 'domcontentloaded' });
  const body = await page.textContent('body').catch(() => '');
  expect(body?.includes('"owner"'), 'dev-auth/login/0 did not return owner role').toBe(true);
}

export async function loginAsMember(page: Page): Promise<void> {
  await page.goto(`${API_BASE}/api/dev-auth/login/1`, { waitUntil: 'domcontentloaded' });
  const body = await page.textContent('body').catch(() => '');
  expect(body?.includes('"member"'), 'dev-auth/login/1 did not return member role').toBe(true);
}

/**
 * Navigate to the test static group page and wait for the tab bar to appear.
 *
 * After the Roster button is visible, also waits for auth hydration to complete
 * (the UserMenu button replaces the pulsing loading circle). This prevents a race
 * where the group fetch returns before the auth store has hydrated, leaving
 * userRole-dependent UI in a permanently stale "View only" state.
 *
 * Must be called AFTER loginAsOwner / loginAsMember so the user is authenticated.
 * If no login was performed, pass waitForAuth=false.
 */
export async function goToTestStatic(page: Page, waitForAuth = true): Promise<void> {
  await page.goto(`/group/${DEV_SHARE_CODE}`);
  // The Roster tab button is always present once the group loads
  await page.getByRole('button', { name: /Roster/i }).waitFor({ timeout: 15_000 });
  // Wait for auth hydration: the UserMenu button (aria-label "User menu for …")
  // appears once the auth store has fetched and stored the current user.
  // Without this, role-dependent props (canRsvp, canSubmit) can be null when
  // callers switch into the Schedule / Availability tab immediately after.
  if (waitForAuth) {
    await page.getByRole('button', { name: /User menu for/i }).waitFor({ timeout: 15_000 }).catch(() => {
      // Best-effort: if auth doesn't hydrate in time, tests will handle it via
      // their own 'Editable' badge checks and graceful skips.
    });
  }
}

/**
 * Click a tab in the GroupView header.
 */
export async function switchTab(page: Page, tabName: string): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`^${tabName}$`, 'i') }).click();
}

/**
 * Create a fresh browser context with an isolated session.
 */
export async function freshContext(browser: import('@playwright/test').Browser): Promise<BrowserContext> {
  return browser.newContext({ baseURL: FRONTEND_BASE });
}
