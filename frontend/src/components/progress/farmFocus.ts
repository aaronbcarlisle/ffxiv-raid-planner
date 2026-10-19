/**
 * Where focus goes when a farm row changes under it (S2a-3a·G4 fix wave; R-S3-4, R-S3-17). Mark
 * finished and Reopen move a row to the other `<tbody>`, where it remounts, and Delete removes
 * it; the control that held focus is gone either way and the browser drops focus on <body>.
 * So a write that moves a row first `expectFarmFocus`es its goal. The row's new `FarmRow` claims
 * it as it mounts (`claimFarmFocus`) and focuses its own name button, in the same commit that
 * removed the old one, so the grid's fallback never gets to pick another row. A Finished
 * section that is collapsed or still loading shows no row to claim it: `FinishedFarms` claims
 * it and focuses its "Finished (n)" disclosure instead. What nobody claimed by the time the
 * write has settled falls to `settleFarmFocus`'s fallback id. Delete has no row to land on, so
 * it focuses the neighbour that was beside the deleted row (`focusAfterDelete`).
 */

/** The row's name button id: the panel's id plus `-name`. */
export const farmNameId = (goalId: string) => `progress-expansion-${goalId}-name`;

/** The row's ⋯ menu button id (where focus returns when Edit ends). */
export const farmMenuId = (goalId: string) => `progress-expansion-${goalId}-menu`;

/** The "Finished (n)" disclosure's id. */
export const FINISHED_TOGGLE_ID = 'progress-finished-toggle';

/** Where a write is about to put the goal's row. */
export type FarmSection = 'active' | 'finished';

const expected = new Map<string, { section: FarmSection; ifLost: boolean }>();

/**
 * A write is about to move this goal's row into `section`: whoever shows it there focuses it.
 * `ifLost` (an Undo) takes the focus only if it has fallen to <body>, never from a control the
 * user has since moved to.
 */
export function expectFarmFocus(goalId: string, section: FarmSection, ifLost = false): void {
  expected.set(goalId, { section, ifLost });
}

/** The write failed: nothing moved, so nothing is owed focus. */
export function cancelFarmFocus(goalId: string): void {
  expected.delete(goalId);
}

/**
 * A toast's own controls (`ToastContainer`: a `role="alert"` inside its `aria-live` region). A toast
 * button the user pressed keeps focus for the 150 ms its exit animation takes, then unmounts and
 * drops focus on <body>, so focus held there is as good as lost for an Undo's restored row.
 */
const inToast = (el: Element) => el.closest('[aria-live="polite"] [role="alert"]') !== null;

const focusIsLost = () => {
  const active = document.activeElement;
  return active === null || active === document.body || inToast(active);
};

/** Takes the claim on a goal's focus, once, for the first row of the expected section that asks: true when it should focus now. */
export function claimFarmFocus(goalId: string, section: FarmSection): boolean {
  const owed = expected.get(goalId);
  if (owed?.section !== section) return false;
  expected.delete(goalId);
  return !owed.ifLost || focusIsLost();
}

/** The goals whose rows are expected in `section`. */
export function expectedFarmFocus(section: FarmSection): string[] {
  return [...expected].filter(([, owed]) => owed.section === section).map(([goalId]) => goalId);
}

/** The write has settled: an unclaimed expectation falls to `fallbackId` when it is on screen. */
export function settleFarmFocus(goalId: string, fallbackId?: string): void {
  if (!expected.delete(goalId) || fallbackId === undefined) return;
  document.getElementById(fallbackId)?.focus();
}

/** The goal id of the farm row beside this one in its section (next, else previous), or null. */
export function neighbourFarmId(from: Element): string | null {
  const isFarmRow = (el: Element | null) => el !== null && el.getAttribute('data-testid') === 'progress-farm-row';
  const seek = (step: (el: Element) => Element | null) => {
    for (let el = step(from.closest('tr') ?? from); el !== null; el = step(el)) {
      if (isFarmRow(el)) return el.getAttribute('data-goal-id');
    }
    return null;
  };
  return seek((el) => el.nextElementSibling) ?? seek((el) => el.previousElementSibling);
}

/**
 * After a delete: the neighbour's name, else "Finished (n)", else the grid's stop, the first
 * active row's name (deleting the only finished farm removes the disclosure with it).
 */
export function focusAfterDelete(neighbourId: string | null): void {
  const firstActive = document.querySelector(
    '[data-testid="progress-matrix"] tbody:not([data-testid="progress-finished"]) [data-testid="progress-farm-row"]',
  );
  const firstActiveId = firstActive?.getAttribute('data-goal-id') ?? null;
  const target =
    (neighbourId !== null ? document.getElementById(farmNameId(neighbourId)) : null) ??
    document.getElementById(FINISHED_TOGGLE_ID) ??
    (firstActiveId !== null ? document.getElementById(farmNameId(firstActiveId)) : null);
  target?.focus();
}
