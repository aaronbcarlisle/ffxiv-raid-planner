/**
 * Compile-time contract tests for RecipientPicker's discriminated props. This
 * file is never imported at runtime; `tsc -b` (pnpm build) type-checks it.
 * Each `@ts-expect-error` MUST error — if the guarantee regresses, the unused
 * directive makes the build fail.
 *
 * Variables are exported so `noUnusedLocals` doesn't suppress errors; the
 * `@ts-expect-error` directive itself is intentional and allowed.
 *
 * R-4/D2 carry-forward: `initialRecipientId` is assign-only — a matrix-cell
 * click (D3) prefills the recipient without bypassing the ranked list or its
 * explanations (see RecipientPicker.tsx's own JSDoc + RecipientPickerProps).
 */
import { createElement } from 'react';
import { RecipientPicker, type DropItemContext } from './RecipientPicker';
import { DEFAULT_SETTINGS } from '../../utils/constants';
import type { SnapshotPlayer, LootLogEntry } from '../../types';

const dropItem: DropItemContext = { slot: 'ring', floorName: 'M9S', floorNumber: 1, label: 'Ring' };
const entry = {} as LootLogEntry;

const common = {
  isOpen: true,
  onClose: () => {},
  groupId: 'g1',
  tierId: 't1',
  players: [] as SnapshotPlayer[],
  settings: DEFAULT_SETTINGS,
  floors: ['M9S', 'M10S', 'M11S', 'M12S'],
  lootLog: [] as LootLogEntry[],
  currentWeek: 1,
  maxWeek: 5,
};

export const assignAcceptsInitialRecipient = createElement(RecipientPicker, {
  ...common, mode: 'assign', item: dropItem, initialRecipientId: 'p1',
});
// @ts-expect-error — initialRecipientId is not accepted in log mode
export const logRejectsInitialRecipient = createElement(RecipientPicker, { ...common, mode: 'log', initialRecipientId: 'p1' });
// @ts-expect-error — initialRecipientId is not accepted in edit mode
export const editRejectsInitialRecipient = createElement(RecipientPicker, { ...common, mode: 'edit', editEntry: entry, initialRecipientId: 'p1' });
