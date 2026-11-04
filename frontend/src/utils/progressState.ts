/**
 * progressState — the state tables the Progress matrix and Home's farm pips share (S2a-4b·B1 Task
 * TB1; R-F-8, E-10, S-7). `home/` is Ring 0 and can't import `progress/`, so the tables live here.
 * `STATE_TEXT` and `STATE_TONE` moved in unchanged from `progressModel.ts` and `ProgressCell.tsx`.
 */
import type { ParticipantState } from '../stores/collectionGoalStore';

/** Glyph plus word in every state; no state is told by colour alone. */
export const STATE_TEXT: Record<ParticipantState, string> = {
  have: '✓ Have',
  need: 'Need',
  want: '★ Want',
  pass: '– Pass',
};

/** Semantic tones only. The glyph/word carries each state; colour never tells it alone. */
export const STATE_TONE: Record<ParticipantState, string> = {
  have: 'text-status-success',
  need: 'text-status-error',
  want: 'text-status-warning',
  pass: 'text-text-secondary',
};

/** One mark per state, Need and no-status included: a pip's colour is its role, so its state is this. */
export const PIP_GLYPH: Record<'need' | 'want' | 'have' | 'pass' | 'none', string> = {
  need: '!',
  want: '★',
  have: '✓',
  pass: '–',
  none: '?',
};
