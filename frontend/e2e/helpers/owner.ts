import { type Browser, type BrowserContext, type Page } from '@playwright/test';
import { API_BASE, freshContext, loginAsOwner, ownerApiContext } from './auth';

/**
 * The owner's API session and the settings the e2e specs flip through it (DEVTST's split clears,
 * a member's role). Every flip is read first and put back by the caller in `finally`/afterAll.
 */
export type ApiHeaders = { 'X-CSRF-Token': string };
export type OwnerApi = { page: Page; groupId: string; headers: ApiHeaders };
export type OwnerSession = OwnerApi & { context: BrowserContext };

export async function ownerSession(browser: Browser): Promise<OwnerSession> {
  const context = await freshContext(browser);
  const page = await context.newPage();
  await loginAsOwner(page);
  const { groupId, csrfToken } = await ownerApiContext(page);
  return { context, page, groupId, headers: { 'X-CSRF-Token': csrfToken } };
}

/** The signed-in user's id (DEVTST has other members, so a role change must target this one). */
export async function currentUserId(page: Page): Promise<string> {
  const res = await page.request.get(`${API_BASE}/api/auth/me`);
  if (!res.ok()) throw new Error(`auth/me returned ${res.status()}`);
  return ((await res.json()) as { id: string }).id;
}

export async function setRole(owner: OwnerApi, userId: string, role: 'member' | 'viewer'): Promise<void> {
  const res = await owner.page.request.put(`${API_BASE}/api/static-groups/${owner.groupId}/members/${userId}`, {
    headers: owner.headers,
    data: { role },
  });
  if (!res.ok()) throw new Error(`setting the role to ${role} returned ${res.status()}`);
}

export async function splitEnabled(owner: Pick<OwnerApi, 'page' | 'groupId'>): Promise<boolean> {
  const res = await owner.page.request.get(`${API_BASE}/api/static-groups/${owner.groupId}/split-clear`);
  if (!res.ok()) throw new Error(`reading DEVTST's split clears returned ${res.status()}`);
  return ((await res.json()) as { enabled: boolean }).enabled;
}

export async function setSplit(owner: OwnerApi, enabled: boolean): Promise<void> {
  const res = await owner.page.request.put(`${API_BASE}/api/static-groups/${owner.groupId}/split-clear/settings`, {
    headers: owner.headers,
    data: { enabled },
  });
  if (!res.ok()) throw new Error(`setting split clears to ${enabled} returned ${res.status()}`);
}

/** Run `body` with DEVTST's split clears set to `enabled`, put back after. */
export async function withSplit(browser: Browser, enabled: boolean, body: (owner: OwnerSession) => Promise<void>): Promise<void> {
  const owner = await ownerSession(browser);
  const before = await splitEnabled(owner);
  try {
    await setSplit(owner, enabled);
    await body(owner);
  } finally {
    await setSplit(owner, before);
    await owner.context.close();
  }
}

/**
 * Light-theme contrast debt inside the V1 split planner (`components/split-clear/**`, not edited
 * in S2a-3b), excluded from the `color-contrast` rule only, in the tier panel only. Dark passes.
 */
export const SPLIT_PLANNER_LIGHT_DEBT = [
  // text-status-success on bg-status-success/15 (the source chips, TONE_CHIP_CLASS.success): tracked in #403.
  '[data-testid="progress-tier-expansion"] .text-status-success.bg-status-success\\/15',
  // Button variant="accent-subtle" (text-accent on bg-accent/10), "Generate draft plan": tracked in #394.
  '[data-testid="progress-tier-expansion"] button[aria-label="Generate draft plan"]',
];

/**
 * Drop the nodes of `color-contrast` violations that sit inside `SPLIT_PLANNER_LIGHT_DEBT` (every
 * other rule still sees those nodes), and any violation left with no node. Call it in the light
 * theme on a scan run with the tier panel open.
 */
export async function withoutSplitPlannerDebt<V extends { id: string; nodes: Array<{ target: unknown }> }>(
  page: Page,
  violations: V[],
): Promise<V[]> {
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
        (await page.evaluate(
          ({ sel, debt }) => {
            const el = document.querySelector(sel);
            return !!el && debt.some((d) => el.matches(d));
          },
          { sel: selector, debt: SPLIT_PLANNER_LIGHT_DEBT },
        ));
      if (!inDebt) nodes.push(node);
    }
    if (nodes.length > 0) kept.push({ ...violation, nodes });
  }
  return kept;
}
