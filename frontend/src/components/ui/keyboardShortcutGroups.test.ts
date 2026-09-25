/**
 * keyboardShortcutGroups — the registry itself (D14 Task 3, R-D14-A/H/I).
 *
 * V1's list is pinned to a LITERAL (`keyboardShortcutGroups.fixture.ts`), not
 * to itself: the split into a V1 list and a v2 list may share row constants,
 * but the V1 export must still deep-equal what `main` shipped, flag for flag.
 *
 * v2's list is checked for shape (unique titles, unique keys per card — React
 * keys), for A16's dead rows being gone, for Task 2's rows being present, and
 * for R-D14-H: a row with identical text in both lists is the SAME object.
 */
import { describe, it, expect } from 'vitest';
import { SHORTCUT_GROUPS, V2_SHORTCUT_GROUPS, type ShortcutGroup, type ShortcutItem } from './keyboardShortcutGroups';
import { V1_SHORTCUT_GROUPS_LITERAL } from './keyboardShortcutGroups.fixture';

const rows = (groups: ShortcutGroup[]): ShortcutItem[] => groups.flatMap((g) => g.shortcuts);
const text = (s: ShortcutItem) => `${s.key} → ${s.description}`;

describe('keyboardShortcutGroups — SHORTCUT_GROUPS is byte-identical to the V1 literal (R-D14-I)', () => {
  it('deep-equals the literal fixture, including adminOnly flags and order', () => {
    expect(SHORTCUT_GROUPS).toStrictEqual(V1_SHORTCUT_GROUPS_LITERAL);
  });
});

describe('keyboardShortcutGroups — V2_SHORTCUT_GROUPS (R-D14-A/H)', () => {
  it('has unique card titles and unique keys within each card', () => {
    const titles = V2_SHORTCUT_GROUPS.map((g) => g.title);
    expect(new Set(titles).size).toBe(titles.length);
    for (const g of V2_SHORTCUT_GROUPS) {
      const keys = g.shortcuts.map((s) => s.key);
      expect(new Set(keys).size, g.title).toBe(keys.length);
    }
  });

  it('contains none of A16\'s wrong rows', () => {
    // Review fix (D14a wave, MINOR #3): `.not.toEqual(expect.arrayContaining([...]))`
    // fails ONLY when the actual array contains every listed item — one
    // surviving wrong row among several would pass this vacuously. Assert
    // each item is absent individually instead.
    const v2 = rows(V2_SHORTCUT_GROUPS);
    const keys = v2.map((s) => s.key);
    const descriptions = v2.map((s) => s.description);
    const texts = v2.map(text);

    for (const badKey of ['Alt+1-3', '1-4']) {
      expect(keys).not.toContain(badKey);
    }
    for (const badDescription of [
      'Switch sub tabs', 'Switch main tabs', 'Toggle grid view',
      'Change week', 'Expand/collapse', 'Toggle subs',
    ]) {
      expect(descriptions).not.toContain(badDescription);
    }
    // V1's cross-tab quick actions were narrowed to the Loot screen (R-D14-E);
    // their V1 wording must not survive into v2's list.
    for (const badText of ['Alt+L → Log Loot', 'Alt+U → Log Material', 'Alt+B → Mark Floor Cleared']) {
      expect(texts).not.toContain(badText);
    }
  });

  it('contains Task 2\'s Loot rows, the History search row and the palette row', () => {
    expect(rows(V2_SHORTCUT_GROUPS).map(text)).toEqual(expect.arrayContaining([
      'Alt+L → Log a drop',
      'Alt+U → Log material',
      'Alt+← → → Previous / next week (Log)',
      'Alt+B → Mark floor cleared (Log)',
      'Ctrl+Shift+F → Search history',
      'Ctrl+K → Command palette',
    ]));
  });

  it('keeps exactly one adminOnly row, the Admin Dashboard one', () => {
    const admin = rows(V2_SHORTCUT_GROUPS).filter((s) => s.adminOnly);
    expect(admin.map(text)).toEqual(['Ctrl+Shift+S → Admin Dashboard']);
  });

  it('R-D14-H: a row whose text is identical in both lists is the same object', () => {
    const v1ByText = new Map(rows(SHORTCUT_GROUPS).map((s) => [text(s), s]));
    const shared = rows(V2_SHORTCUT_GROUPS).filter((s) => v1ByText.has(text(s)));
    // The set is non-trivial: the global, static/tier, tier & roster, settings,
    // copy-link and general rows are all shared.
    expect(shared.length).toBeGreaterThanOrEqual(14);
    for (const s of shared) {
      expect(v1ByText.get(text(s)), text(s)).toBe(s);
    }
  });
});
