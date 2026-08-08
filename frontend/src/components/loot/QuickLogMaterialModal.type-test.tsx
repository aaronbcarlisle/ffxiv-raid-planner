/**
 * Compile-time contract tests for QuickLogMaterialModal's pinned/free-form props union
 * (Phase D8, Task 3B). This file is never imported at runtime; `tsc -b` (pnpm build)
 * type-checks it. Each `@ts-expect-error` MUST error — if the guarantee regresses, the
 * unused directive makes the build fail.
 *
 * Variables are exported so `noUnusedLocals` doesn't suppress errors; the `@ts-expect-error`
 * directive itself is intentional and allowed.
 */
import type { QuickLogMaterialModalProps as Props } from './QuickLogMaterialModal';
import type { SnapshotPlayer, MaterialLogEntry } from '../../types';

const base = {
  isOpen: true,
  onClose: () => {},
  groupId: 'g1',
  tierId: 't1',
  maxWeek: 5,
  allPlayers: [] as SnapshotPlayer[],
};
const player = {} as SnapshotPlayer;
const entry = {} as MaterialLogEntry;

// V1's call-site shape (LootPriorityPanel.tsx:770) must stay assignable, verbatim:
export const _pinnedV1Shape = ({ ...base, floor: 'M11S', material: 'twine', suggestedPlayer: player }) satisfies Props;
// Pinned may now name its week (D5's Log-cell door):
export const _pinnedWithInitialWeek = ({ ...base, floor: 'M11S', material: 'twine', suggestedPlayer: player, initialWeek: 2 }) satisfies Props;
export const _freeform = ({ ...base, floors: ['a', 'b', 'c', 'd'], initialWeek: 2 }) satisfies Props;
// @ts-expect-error — floor without material is not a mode
export const _floorWithoutMaterial = ({ ...base, floor: 'M11S', suggestedPlayer: player }) satisfies Props;
// @ts-expect-error — free-form must name its week (R-20: displayed week, explicit)
export const _freeformWithoutWeek = ({ ...base, floors: ['a'] }) satisfies Props;
// D8 Task 6: edit — R-21. No initialWeek; the week comes from the entry.
export const _edit = ({ ...base, floors: ['a'], editEntry: entry }) satisfies Props;
// @ts-expect-error — an edit cannot carry a pinned floor/material
export const _editWithPinnedFields = ({ ...base, floors: ['a'], editEntry: entry, floor: 'M11S', material: 'twine' }) satisfies Props;
// @ts-expect-error — an edit's week comes from the entry
export const _editWithInitialWeek = ({ ...base, floors: ['a'], editEntry: entry, initialWeek: 2 }) satisfies Props;
