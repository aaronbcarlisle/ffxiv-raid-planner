import { type Browser, type BrowserContext, type Page } from '@playwright/test';
import { API_BASE, freshContext, loginAsMember } from './auth';
import type { ApiHeaders } from './owner';

/**
 * S2a-4a·A4: DevMember's Hub wants, seeded through the member's own API for the Find specs.
 *
 * Two catalog items are chosen at run time: one the static's members have no signal for at all
 * (not tracked by any DEVTST farm, absent from the static's suggestions, and no DevMember row), so
 * the only thing that puts it in "Wanted by your static" is the seeded want. `shared` gets a shared
 * want (hunting, high, static_only); `private` a private one (hunting, private), which Find must
 * never list as wanted. Every touched row is read first and put back by `restoreWants`.
 */
export interface FindItemRef {
  id: string;
  name: string;
  category: string;
}
export interface FindSeed {
  shared: FindItemRef;
  private: FindItemRef;
}
interface IntentRow {
  catalog_item_id: string;
  intent: string;
  priority: string;
  visibility: string;
  notes: string | null;
}
export type PriorWants = Record<string, IntentRow | null>;
export type MemberSession = { context: BrowserContext; page: Page; headers: ApiHeaders };

export async function memberSession(browser: Browser): Promise<MemberSession> {
  const context = await freshContext(browser);
  const page = await context.newPage();
  await loginAsMember(page);
  const csrf = (await context.cookies(API_BASE)).find((c) => c.name === 'csrf_token')?.value;
  if (!csrf) throw new Error('missing csrf_token cookie after the member login');
  return { context, page, headers: { 'X-CSRF-Token': csrf } };
}

async function getJson<T>(page: Page, url: string): Promise<T> {
  const res = await page.request.get(url);
  if (!res.ok()) throw new Error(`GET ${url} returned ${res.status()}`);
  return (await res.json()) as T;
}

/** Pick two catalog items nobody in DEVTST has any signal for, with names unique in the catalog. */
export async function pickFindItems(member: MemberSession, groupId: string): Promise<FindSeed> {
  const { page } = member;
  const catalog = await getJson<Array<{ id: string; name: string; category: string }>>(page, `${API_BASE}/api/collection-catalog`);
  const goals = await getJson<Array<{ catalog_item_id?: string | null; catalogItemId?: string | null }>>(
    page,
    `${API_BASE}/api/static-groups/${groupId}/collection-goals`,
  );
  const suggestions = await getJson<Array<{ catalog_item_id: string }>>(page, `${API_BASE}/api/static-groups/${groupId}/collection-suggestions`);
  const intents = await getJson<IntentRow[]>(page, `${API_BASE}/api/me/collection-intent`);
  const taken = new Set<string>([
    ...goals.map((g) => g.catalog_item_id ?? g.catalogItemId ?? ''),
    ...suggestions.map((s) => s.catalog_item_id),
    ...intents.map((i) => i.catalog_item_id),
  ]);
  const lower = catalog.map((c) => c.name.toLowerCase());
  // A name no other catalog name contains (and that contains no other), so a search for it is exact.
  const free = catalog.filter(
    (c) => !taken.has(c.id) && lower.filter((n) => n.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(n)).length === 1,
  );
  if (free.length < 2) throw new Error(`only ${free.length} catalog items are free of every DEVTST signal`);
  const [a, b] = free;
  return { shared: { id: a.id, name: a.name, category: a.category }, private: { id: b.id, name: b.name, category: b.category } };
}

/** DevMember's rows for these items as they are now (null where there is none). */
export async function readWants(member: MemberSession, ids: string[]): Promise<PriorWants> {
  const intents = await getJson<IntentRow[]>(member.page, `${API_BASE}/api/me/collection-intent`);
  return Object.fromEntries(ids.map((id) => [id, intents.find((i) => i.catalog_item_id === id) ?? null]));
}

export async function putWant(member: MemberSession, itemId: string, data: Omit<IntentRow, 'catalog_item_id'>): Promise<void> {
  const res = await member.page.request.put(`${API_BASE}/api/me/collection-intent/${itemId}`, { headers: member.headers, data });
  if (!res.ok()) throw new Error(`seeding the want on ${itemId} returned ${res.status()}`);
}

/** The shared want and the private want. */
export async function seedWants(member: MemberSession, seed: FindSeed): Promise<void> {
  await putWant(member, seed.shared.id, { intent: 'hunting', priority: 'high', visibility: 'static_only', notes: null });
  await putWant(member, seed.private.id, { intent: 'hunting', priority: 'low', visibility: 'private', notes: 'E2E Find private' });
}

/** Put every row in `prior` back: re-PUT the ones that existed, DELETE the ones that did not. */
export async function restoreWants(member: MemberSession, prior: PriorWants): Promise<void> {
  for (const [id, row] of Object.entries(prior)) {
    if (row) {
      await putWant(member, id, { intent: row.intent, priority: row.priority, visibility: row.visibility, notes: row.notes });
    } else {
      const res = await member.page.request.delete(`${API_BASE}/api/me/collection-intent/${id}`, { headers: member.headers });
      if (!res.ok() && res.status() !== 404) throw new Error(`deleting the want on ${id} returned ${res.status()}`);
    }
  }
}
