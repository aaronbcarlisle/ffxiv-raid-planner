/**
 * AboutBlock (S2a-3a·G2b Task TG4; design Q-3): content, priority mode and notes, each
 * left out when empty, and "No details yet" when nothing is set.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CollectionGoal } from '../../stores/collectionGoalStore';
import { CONTENT_TYPE_LABELS, PRIORITY_MODE_OPTIONS } from '../../utils/goalTypeMeta';
import { goal } from './__fixtures__/progressFixtures';
import { AboutBlock } from './AboutBlock';

const renderAbout = (overrides: Partial<CollectionGoal>) => render(<AboutBlock goal={goal('g1', overrides)} />);

/** The `dt` → `dd` pairs, as the block reads. */
const details = () =>
  Array.from(document.querySelectorAll('dt')).map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]);

describe('AboutBlock', () => {
  it('shows the content label and key, the mode label and the notes', () => {
    renderAbout({ contentType: 'savage', contentKey: 'm12s', priorityMode: 'free_roll', summary: 'Bring the mount food' });
    expect(details()).toEqual([
      ['Content', 'Savage · m12s'],
      ['Priority mode', 'Free roll'],
      ['Notes', 'Bring the mount food'],
    ]);
  });

  it('labels every content type from CONTENT_TYPE_LABELS', () => {
    for (const [value, label] of Object.entries(CONTENT_TYPE_LABELS)) {
      const { unmount } = renderAbout({ contentType: value as CollectionGoal['contentType'] });
      expect(details()[0]).toEqual(['Content', label]);
      unmount();
    }
  });

  it('labels every priority mode from PRIORITY_MODE_OPTIONS', () => {
    for (const option of PRIORITY_MODE_OPTIONS.filter((o) => o.value !== null)) {
      const { unmount } = renderAbout({ priorityMode: option.value });
      expect(details()).toEqual([['Priority mode', option.label]]);
      unmount();
    }
  });

  it('reads a null mode as "Everyone gets one" beside other details', () => {
    renderAbout({ priorityMode: null, summary: 'Farm it on Tuesdays' });
    expect(details()).toEqual([
      ['Priority mode', 'Everyone gets one'],
      ['Notes', 'Farm it on Tuesdays'],
    ]);
  });

  it('shows the key alone, or the type alone, when only one is set', () => {
    const { unmount } = renderAbout({ contentKey: 'a4s', priorityMode: 'custom' });
    expect(details()[0]).toEqual(['Content', 'a4s']);
    unmount();
    renderAbout({ contentType: 'ultimate', priorityMode: 'custom' });
    expect(details()[0]).toEqual(['Content', 'Ultimate']);
  });

  it('leaves out a blank content, a blank note and (set) mode parts, one by one', () => {
    renderAbout({ contentType: null, contentKey: '  ', priorityMode: 'desired_only', summary: '   ' });
    expect(details()).toEqual([['Priority mode', 'Desired only']]);
  });

  it('says "No details yet" when nothing is set', () => {
    renderAbout({ contentType: null, contentKey: null, priorityMode: null, summary: null });
    expect(screen.getByText('No details yet')).toBeInTheDocument();
    expect(document.querySelector('dl')).toBeNull();
  });
});
