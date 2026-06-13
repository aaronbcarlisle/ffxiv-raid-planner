/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CollectionsTab } from './CollectionsTab';
import type { CollectionSuggestion, PlayerGoal } from '../../stores/playerProfileStore';

const createGoal = vi.fn();
const updateGoal = vi.fn();
const fetchCollectionSuggestions = vi.fn();

vi.mock('../../stores/playerProfileStore', async () => {
  const actual = await vi.importActual<typeof import('../../stores/playerProfileStore')>('../../stores/playerProfileStore');
  return {
    ...actual,
    usePlayerProfileStore: () => ({
      createGoal,
      updateGoal,
      fetchCollectionSuggestions,
    }),
  };
});

const goals: PlayerGoal[] = [
  {
    id: 'goal-1',
    title: 'Wings of Ruin farm',
    description: null,
    goalType: 'mount_farm',
    category: null,
    status: 'active',
    currentCount: 42,
    targetCount: 99,
    sourceContent: 'dt-valigarmanda',
    sourceItem: 'Skyruin Totem',
    linkedCharacterId: null,
    linkedJob: null,
    dueDate: null,
    intentLevel: null,
    isPublic: false,
    objectiveCategory: null,
    createdAt: '2026-06-08T00:00:00Z',
    updatedAt: '2026-06-08T00:00:00Z',
  },
];

const suggestions: CollectionSuggestion[] = [
  {
    trialId: 'dt-windward-wilds',
    mountName: 'Felyne Support Team Cart Horn',
    dutyName: 'The Windward Wilds (Extreme)',
    totemName: 'Guardian Arkveld Certificate',
    totemTarget: 99,
    currentCount: 99,
    hasMount: false,
    source: 'Plugin',
  },
];

describe('CollectionsTab', () => {
  beforeEach(() => {
    createGoal.mockReset();
    updateGoal.mockReset();
    fetchCollectionSuggestions.mockReset();
    localStorage.clear();
  });

  it('uses the curated farm catalog language and player-side farm states', () => {
    render(<CollectionsTab goals={goals} suggestions={suggestions} />);

    expect(screen.getByText('Reward farms')).toBeInTheDocument();
    expect(screen.getByText(/Track mounts, tokens, and rewards using the same catalog as Static Mount Farms/i)).toBeInTheDocument();
    expect(screen.getAllByText('Dawntrail').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Endwalker').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ultimate / Rare rewards').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ready to buy').length).toBeGreaterThan(0);
    expect(screen.getByText('Farming now')).toBeInTheDocument();
    expect(screen.queryByText('Wanted later')).toBeNull();
    expect(screen.getAllByText('Wings of Ruin').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Worqor Lar Dor (Extreme)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('42 / 99').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Owned').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Want').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Farming').length).toBeGreaterThan(0);
  });

  it('renders shared farm labels and keeps matching as one compact hint', () => {
    render(<CollectionsTab goals={goals} suggestions={[]} />);

    expect(screen.getByText(/Static farm matching will use your Wanted and Farming rewards later/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Static farm matching will use your Wanted and Farming rewards later/i)).toHaveLength(1);
    expect(screen.getByText('Collaboration')).toBeInTheDocument();
    expect(screen.getAllByText('Pending exchange').length).toBeGreaterThan(0);
    expect(screen.getByText('Ultimate')).toBeInTheDocument();
    expect(screen.getAllByText('Weapon/token farm').length).toBeGreaterThan(0);
  });
});
