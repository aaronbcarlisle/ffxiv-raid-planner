/**
 * Wizard Type Definitions
 *
 * Types for the static setup wizard flow.
 * Wizard uses local React state (not Zustand) because state is transient and discarded on cancel.
 */

import type { GearSlotStatus, RaidPosition } from '../../types';

export type WizardStep = 1 | 2 | 3 | 4;

export interface WizardState {
  step: WizardStep;
  staticName: string;
  tierId: string;
  isPublic: boolean;
  players: WizardPlayer[];
  inviteCode: string | null;
}

export interface WizardPlayer {
  position: RaidPosition; // T1, T2, H1, H2, M1, M2, R1, R2
  name: string;
  job: string; // Job abbreviation (e.g., 'DRG', 'WHM')
  role: string; // Role ('tank', 'healer', 'melee', 'ranged', 'caster')
  bisLink?: string; // XIVGear or Etro link
  gear?: GearSlotStatus[]; // Populated after BiS import
}

// Initial empty roster (8 slots)
export const INITIAL_ROSTER: WizardPlayer[] = [
  { position: 'T1', name: '', job: '', role: 'tank' },
  { position: 'T2', name: '', job: '', role: 'tank' },
  { position: 'H1', name: '', job: '', role: 'healer' },
  { position: 'H2', name: '', job: '', role: 'healer' },
  { position: 'M1', name: '', job: '', role: 'melee' },
  { position: 'M2', name: '', job: '', role: 'melee' },
  { position: 'R1', name: '', job: '', role: 'ranged' },
  { position: 'R2', name: '', job: '', role: 'caster' },
];

// Step titles for progress indicator
export const STEP_TITLES: Record<WizardStep, string> = {
  1: 'Details',
  2: 'Roster',
  3: 'Invite',
  4: 'Review',
};
