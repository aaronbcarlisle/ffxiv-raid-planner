import { type Page, type BrowserContext, expect } from '@playwright/test';

export const API_BASE = process.env.E2E_API_URL || 'http://localhost:8001';
export const FRONTEND_BASE = process.env.E2E_FRONTEND_URL || 'http://localhost:5174';
export const DEV_SHARE_CODE = 'DEVTST';

/**
 * Stub the app's proactive session-refresh call so repeated full navigations
 * within this suite don't collide with the backend's "auth" rate-limit bucket
 * (10/minute/IP, shared with the real OAuth endpoints) — discovered live (see
 * task-5-report.md): authStore.initializeAuth() fires an UNCONDITIONAL
 * POST /api/auth/refresh on every full page load/reload (not just on token
 * expiry), and on a 429 the frontend clears its *local* auth state even
 * though the underlying dev-auth session cookie is still perfectly valid —
 * intermittently hiding role-gated UI (e.g. Schedule's "Edit week") on
 * whatever test's navigation lands on the exhausted window. This suite's
 * per-test full navigations (plus a second browser context in the cross-user
 * RSVP tests) comfortably exceed 10 such calls within a real 60s span.
 * Short-circuiting the refresh call itself (rather than spacing requests out,
 * which only reduces — doesn't eliminate — the collision risk) keeps this
 * suite deterministic without touching backend/app or authStore.
 */
async function stubAuthRefresh(page: Page): Promise<void> {
  await page.route('**/api/auth/refresh', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'e2e-stub-access-token',
        refreshToken: 'e2e-stub-refresh-token',
        tokenType: 'bearer',
        expiresIn: 900,
      }),
    });
  });
}

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
  await stubAuthRefresh(page);
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
 * Pin this browser tab to a shell for the rest of the run (Stage-1 T6).
 *
 * Why one navigation is enough: `useShellParamPersistence` records an explicit
 * `?shell=` deep-link as a per-TAB sessionStorage override, and
 * `useResolvedShell` resolves that override ABOVE the stored/account
 * preference. Account hydration (`useShellPreferenceSync`) only ever writes the
 * *preference* tier, so it can never out-resolve a pinned session — which is
 * exactly the contamination vector this guards against: the dev owner dogfoods
 * v2, `/api/auth/me` mirrors `ui_shell: 'v2'` into the store, and a
 * legacy-assuming spec that navigated without a param would silently get v2
 * chrome (see also the defensive `ui_shell` reset in `dev_auth.py`).
 *
 * Navigates to `path` (default `/` — the cheapest route that mounts Layout,
 * and chrome-excluded in both shells, so nothing heavy renders). Pass the
 * spec's actual first destination to pin and arrive in one navigation.
 * `path` may already carry a query string and/or hash — the shell param is
 * merged, not blindly appended.
 */
export async function pinShell(page: Page, shell: 'v2' | 'legacy', path = '/'): Promise<void> {
  // Dummy base: only pathname/search/hash are re-emitted, so the spec's own
  // baseURL config still applies to the relative goto below.
  const url = new URL(path, 'http://placeholder.local');
  url.searchParams.set('shell', shell);
  await page.goto(`${url.pathname}${url.search}${url.hash}`);
}

/**
 * Navigate to the test static group page and wait for the v2 shell to mount.
 *
 * After the shell root is visible, also waits for auth hydration to complete
 * (the UserMenu button replaces the pulsing loading circle). This prevents a race
 * where the group fetch returns before the auth store has hydrated, leaving
 * userRole-dependent UI in a permanently stale "View only" state.
 *
 * Must be called AFTER loginAsOwner / loginAsMember so the user is authenticated.
 * If no login was performed, pass waitForAuth=false.
 */
export async function goToTestStatic(page: Page, waitForAuth = true): Promise<void> {
  // Phase R: the default shell is legacy again; this v2 suite pins `?shell=v2`
  // (mirror of P2's legacy pinning, inverted). Assertions untouched.
  await page.goto(`/group/${DEV_SHARE_CODE}?shell=v2`);
  await page.locator('[data-testid="new-shell"]').waitFor({ timeout: 15_000 });
  // Wait for auth hydration: the UserMenu button (aria-label "User menu for …")
  // appears once the auth store has fetched and stored the current user.
  // Without this, role-dependent props (canRsvp, canSubmit) can be null when
  // callers switch into the Schedule / Availability tab immediately after.
  if (waitForAuth) {
    await page.getByRole('button', { name: /User menu for/i }).waitFor({ timeout: 15_000 }).catch(() => {
      // Best-effort: if auth doesn't hydrate in time, tests will handle it via
      // their own state checks and graceful skips.
    });
  }
  // useGroupViewState's mount effect back-fills a missing `?tab=` once, using
  // a closure over the initial pageMode — if a caller clicks another Spine tab
  // before that effect fires, it can overwrite the click's URL write and the
  // tab silently reverts. Waiting for the URL to already carry `tab=` here
  // means that effect has settled before any switchTab() call races it.
  await page.waitForURL(/[?&]tab=/, { timeout: 15_000 }).catch(() => {
    // Best-effort — some entry points may already carry ?tab= or never need it.
  });
}

/**
 * Navigate to the test static group page (LEGACY shell) and wait for the tab
 * bar to appear.
 *
 * After the Roster button is visible, also waits for auth hydration to complete
 * (the UserMenu button replaces the pulsing loading circle). This prevents a race
 * where the group fetch returns before the auth store has hydrated, leaving
 * userRole-dependent UI in a permanently stale "View only" state.
 *
 * Must be called AFTER loginAsOwner / loginAsMember so the user is authenticated.
 * If no login was performed, pass waitForAuth=false.
 */
export async function goToTestStaticLegacy(page: Page, waitForAuth = true): Promise<void> {
  await page.goto(`/group/${DEV_SHARE_CODE}?shell=legacy`);
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
 * Click a tab in the GroupView (LEGACY shell) header.
 */
export async function switchTabLegacy(page: Page, tabName: string): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`^${tabName}$`, 'i') }).click();
}

/**
 * Click a top-level spine tab (Home / Roster / Loot / Schedule) in the v2 shell.
 *
 * useGroupViewState backfills a missing `?tab=` URL param once on mount from a
 * closure over the pageMode captured at that render — if that effect settles
 * AFTER our click (observed live, intermittently, even once `goToTestStatic`
 * has already waited for an existing `?tab=` param), it can stomp the click's
 * own URL write and the tab silently reverts to whatever it was before.
 * Retry click+verify until the selection actually sticks.
 */
export async function switchTab(page: Page, tabName: 'Home' | 'Roster' | 'Loot' | 'Schedule'): Promise<void> {
  const tab = page.getByRole('tab', { name: tabName, exact: true });
  await expect(async () => {
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 1_000 });
    // The revert (when it happens) lands within one render tick of the click —
    // re-check after a short settle so a since-reverted selection fails this
    // attempt and gets retried, instead of returning green on a false positive.
    await page.waitForTimeout(300);
    await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

/**
 * Flip DEVTST's isPublic via the owner's API session (dev-auth re-flips it to
 * public on every login, so tests that need a private static set it explicitly
 * and restore afterwards).
 *
 * `page.request` shares the browser context's cookies, so call it from a
 * logged-in owner page. The static-groups PUT endpoint is CSRF-protected, so
 * the CSRF token cookie set by dev-auth login must be forwarded as a header.
 */
export async function setStaticPublic(page: Page, isPublic: boolean): Promise<void> {
  const groupRes = await page.request.get(`${API_BASE}/api/static-groups/by-code/${DEV_SHARE_CODE}`);
  if (!groupRes.ok()) {
    throw new Error(`setStaticPublic(${isPublic}): by-code lookup failed: ${groupRes.status()}`);
  }
  const group = await groupRes.json() as { id: string };

  const csrfToken = (await page.context().cookies(API_BASE)).find((cookie) => cookie.name === 'csrf_token')?.value;
  if (!csrfToken) {
    throw new Error(`setStaticPublic(${isPublic}): missing csrf_token cookie — call after loginAsOwner`);
  }

  const putRes = await page.request.put(`${API_BASE}/api/static-groups/${group.id}`, {
    data: { isPublic },
    headers: { 'X-CSRF-Token': csrfToken },
  });
  if (!putRes.ok()) throw new Error(`setStaticPublic(${isPublic}) failed: ${putRes.status()}`);
}

/**
 * Create a fresh browser context with an isolated session.
 */
export async function freshContext(browser: import('@playwright/test').Browser): Promise<BrowserContext> {
  return browser.newContext({ baseURL: FRONTEND_BASE });
}
