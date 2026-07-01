import { type Page, type BrowserContext, expect } from '@playwright/test';

export const API_BASE = process.env.E2E_API_URL || 'http://localhost:8001';
export const FRONTEND_BASE = process.env.E2E_FRONTEND_URL || 'http://localhost:5174';
export const DEV_SHARE_CODE = 'DEVTST';

/**
 * Log in via dev-auth and set httpOnly cookies in the browser's native store.
 *
 * We run a POST through Playwright's browser-context request API so the backend
 * httpOnly cookies land in the same context used by page navigations.
 *
 * After this call the page is pointing at the backend JSON response; call
 * goToTestStatic() to navigate to the app.
 */
async function loginViaDevAuth(page: Page, index: 0 | 1, expectedRole: 'owner' | 'member'): Promise<void> {
  const response = await page.context().request.post(`${API_BASE}/api/dev-auth/login/${index}`);
  const body = await response.text();
  expect(body.includes(`"${expectedRole}"`), `dev-auth/login/${index} did not return ${expectedRole} role`).toBe(true);

  const cookies = response.headersArray()
    .filter((header) => header.name.toLowerCase() === 'set-cookie')
    .map((header) => {
      const [nameValue] = header.value.split(';');
      const [name, ...valueParts] = nameValue.split('=');
      return {
        name,
        value: valueParts.join('='),
        url: API_BASE,
        sameSite: 'Lax' as const,
      };
    })
    .filter((cookie) => cookie.name && cookie.value);

  if (cookies.length > 0) {
    await page.context().addCookies(cookies);
  }
}

export async function loginAsOwner(page: Page): Promise<void> {
  await loginViaDevAuth(page, 0, 'owner');
}

export async function loginAsMember(page: Page): Promise<void> {
  await loginViaDevAuth(page, 1, 'member');
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
  await page.getByRole('button', { name: 'Roster', exact: true }).first().waitFor({ timeout: 15_000 });
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
