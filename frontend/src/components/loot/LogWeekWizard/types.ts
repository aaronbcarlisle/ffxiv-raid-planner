import type { ReactNode } from 'react';
import type { GearSlot, LootMethod } from '../../../types';
import type { FloorNumber } from '../../../gamedata/loot-tables';

export type WizardStep = 'gear' | 'books' | 'confirm';

export const STEP_TITLES: Record<WizardStep, string> = {
  gear: 'Gear Drops',
  books: 'Books',
  confirm: 'Confirm',
};

export const STEP_ORDER: WizardStep[] = ['gear', 'books', 'confirm'];

/** A same-slot entry the week already holds; who got it and how it was logged. */
interface LoggedRecipient {
  recipientName: string;
  method: LootMethod;
}

export interface SlotEntry {
  slot: string;
  playerId: string | null;
  previousPlayerId?: string | null;
  didNotDrop: boolean;
  updateGear: boolean;
  selectedSlot?: GearSlot | null;
  augmentTomeWeapon?: boolean;
  /**
   * LOG-1 (R-P0-9): the week's log already holds this slot's drop, so the row
   * is read-only and the submit never sends it. A locked entry always has
   * `playerId: null, didNotDrop: true`; every handler and filter checks this
   * flag on top of that (V1).
   */
  locked?: LoggedRecipient;
  /** Same-slot entries logged another way (tome, book, purchase): shown as a hint, never a lock (V4). */
  alsoLogged?: LoggedRecipient[];
}

export interface FloorEntries {
  gear: Record<string, SlotEntry>;
  materials: Record<string, SlotEntry>;
  booksCleared: string[];
}

export interface SelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

export interface Summary {
  gearDrops: number;
  materialDrops: number;
  bookClears: number;
  skipped: number;
  /** Locked gear + material slots on the cleared floors (already in the week's log). */
  alreadyLogged: number;
  total: number;
}

export type { FloorNumber };
