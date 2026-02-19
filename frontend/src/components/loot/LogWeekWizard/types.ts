import type { ReactNode } from 'react';
import type { GearSlot } from '../../../types';
import type { FloorNumber } from '../../../gamedata/loot-tables';

export type WizardStep = 'gear' | 'books' | 'confirm';

export const STEP_TITLES: Record<WizardStep, string> = {
  gear: 'Gear Drops',
  books: 'Books',
  confirm: 'Confirm',
};

export const STEP_ORDER: WizardStep[] = ['gear', 'books', 'confirm'];

export interface SlotEntry {
  slot: string;
  playerId: string | null;
  previousPlayerId?: string | null;
  didNotDrop: boolean;
  updateGear: boolean;
  selectedSlot?: GearSlot | null;
  augmentTomeWeapon?: boolean;
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
  total: number;
}

export type { FloorNumber };
