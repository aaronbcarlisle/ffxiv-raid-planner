/**
 * Type-level test for BookLedgerCard's markClearedOpen/onMarkClearedOpenChange
 * controlled pair. This file is never imported at runtime; `tsc -b`
 * (pnpm build) type-checks it. Each `@ts-expect-error` MUST error — if the
 * guarantee regresses, the unused directive makes the build fail.
 *
 * Variables are exported so `noUnusedLocals` doesn't suppress errors; the
 * `@ts-expect-error` directive itself is intentional and allowed.
 *
 * Fix wave (D14a review, MINOR #4): a HALF-controlled pair (one prop present,
 * the other omitted) used to compile and yield a dead button. This is a
 * compile-time assertion, not a runtime one — it exists to fail `pnpm
 * build`'s `tsc -b` if the props type ever regresses to plain optionals.
 */
import { createElement } from 'react';
import { BookLedgerCard } from './BookLedgerCard';
import type { SnapshotPlayer } from '../../types';

const players: SnapshotPlayer[] = [
  {
    id: 'p1',
    tierSnapshotId: 't1',
    name: 'Alice',
    job: 'PLD',
    role: 'tank',
    configured: true,
    sortOrder: 0,
    isSubstitute: false,
    gear: [],
    tomeWeapon: {},
    weaponPriorities: [],
  } as unknown as SnapshotPlayer,
];

const baseProps = {
  groupId: 'g1',
  tierId: 't1',
  players,
  floors: ['M9S', 'M10S', 'M11S', 'M12S'],
  currentWeek: 3,
  clockWeek: 3,
  canEdit: true,
  onResetConfig: () => {},
};

// @ts-expect-error - onMarkClearedOpenChange is required once markClearedOpen is passed
export const _halfControlled = createElement(BookLedgerCard, { ...baseProps, markClearedOpen: false });
// @ts-expect-error - markClearedOpen is required once onMarkClearedOpenChange is passed
export const _otherHalfControlled = createElement(BookLedgerCard, { ...baseProps, onMarkClearedOpenChange: () => {} });
