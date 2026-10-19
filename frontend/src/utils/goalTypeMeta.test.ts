/**
 * goalTypeMeta — the option lists Edit offers (S2a-3a·G5 Task TG8, R-S3-10). The mode list is
 * exhaustive over `CollectionPriorityMode`: the `Record` below stops compiling when a mode is added
 * or removed, and the runtime check fails when the options miss or add one.
 */
import { describe, expect, it } from 'vitest';
import type { CollectionPriorityMode } from '../stores/collectionGoalStore';
import { buildDiscordPlan } from './discordPlan';
import { GOAL_STATUS_OPTIONS, PRIORITY_MODE_OPTIONS } from './goalTypeMeta';
import { goal } from '../components/progress/__fixtures__/progressFixtures';

const EVERY_MODE: Record<CollectionPriorityMode, true> = {
  everyone_gets_one: true,
  priority_order: true,
  free_roll: true,
  desired_only: true,
  custom: true,
};

describe('PRIORITY_MODE_OPTIONS', () => {
  it('is "Not set" first, then every mode exactly once', () => {
    const values = PRIORITY_MODE_OPTIONS.map((option) => option.value);
    expect(values[0]).toBeNull();
    expect(values.slice(1).sort()).toEqual(Object.keys(EVERY_MODE).sort());
  });

  it('keeps the labels V1 shows', () => {
    expect(PRIORITY_MODE_OPTIONS.map((option) => option.label)).toEqual([
      'Not set',
      'Everyone gets one',
      'Priority order',
      'Free roll',
      'Desired only',
      'Custom',
    ]);
  });
});

describe('the Copy plan text names a mode as its option does', () => {
  it.each(PRIORITY_MODE_OPTIONS.filter((option) => option.value !== null))('%s', (option) => {
    const text = buildDiscordPlan(goal('g', { title: 'Wings', priorityMode: option.value, tokenCost: null }), []);
    expect(text.split('\n')[1]).toBe(`Mode: ${option.label}`);
  });
});

describe('GOAL_STATUS_OPTIONS', () => {
  it('offers Wanted, Farming and Scheduled, never complete', () => {
    expect(GOAL_STATUS_OPTIONS).toEqual([
      { value: 'wanted', label: 'Wanted' },
      { value: 'farming', label: 'Farming' },
      { value: 'scheduled', label: 'Scheduled' },
    ]);
  });
});
