/**
 * progressState (S2a-4b·B1 Task TB1; R-F-8, E-10, S-7): the state tables that the Progress matrix
 * and Home's pips share. `STATE_TEXT` and `STATE_TONE` are a pure move, so their values are pinned
 * here as literals copied from the old sites (`progressModel.ts`, `ProgressCell.tsx:28-33`).
 */
import { describe, expect, it } from 'vitest';
import type { ParticipantState } from '../stores/collectionGoalStore';
import { cellText, type ProgressCell } from './progressModel';
import { PIP_GLYPH, STATE_TEXT, STATE_TONE } from './progressState';

describe('STATE_TEXT (moved, unchanged)', () => {
  it('keeps every value, glyphs included', () => {
    expect(STATE_TEXT).toEqual({ have: '✓ Have', need: 'Need', want: '★ Want', pass: '– Pass' });
  });

  it('is the table cellText reads', () => {
    const states: ParticipantState[] = ['have', 'need', 'want', 'pass'];
    for (const state of states) {
      const cell = { state, count: null } as ProgressCell;
      expect(cellText(cell, { tokenCost: 99 })).toBe(STATE_TEXT[state]);
    }
  });
});

describe('STATE_TONE (moved, unchanged)', () => {
  it('keeps every class string', () => {
    expect(STATE_TONE).toEqual({
      have: 'text-status-success',
      need: 'text-status-error',
      want: 'text-status-warning',
      pass: 'text-text-secondary',
    });
  });
});

describe('PIP_GLYPH', () => {
  it('has exactly the four states and no-status', () => {
    expect(Object.keys(PIP_GLYPH).sort()).toEqual(['have', 'need', 'none', 'pass', 'want']);
  });

  it('gives every state a non-empty glyph, whitespace not counting', () => {
    for (const glyph of Object.values(PIP_GLYPH)) {
      expect(glyph.trim()).not.toBe('');
    }
  });

  it('gives every state a distinct glyph, Need and no-status included', () => {
    const glyphs = Object.values(PIP_GLYPH).map((g) => g.trim());
    expect(new Set(glyphs).size).toBe(5);
  });

  it('never makes one glyph part of another, so a pip reads as one state', () => {
    const glyphs = Object.values(PIP_GLYPH).map((g) => g.trim());
    for (const a of glyphs) {
      for (const b of glyphs) {
        if (a !== b) expect(a.includes(b)).toBe(false);
      }
    }
  });
});
