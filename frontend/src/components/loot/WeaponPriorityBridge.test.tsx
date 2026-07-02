import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WeaponPriorityBridge } from './WeaponPriorityBridge';
import { DEFAULT_SETTINGS } from '../../utils/constants';
import type { SnapshotPlayer } from '../../types';

vi.mock('./WeaponPriorityList', () => ({
  WeaponPriorityList: (props: unknown) => {
    mockWeaponPriorityListProps = props;
    return <div data-testid="wpl" />;
  },
}));

let mockWeaponPriorityListProps: unknown = null;

function makePlayer(id: string, name: string): SnapshotPlayer {
  return {
    id, tierSnapshotId: 't1', name, job: 'PLD', role: 'tank',
    configured: true, sortOrder: 0, isSubstitute: false,
    gear: [], tomeWeapon: {}, weaponPriorities: [],
  } as unknown as SnapshotPlayer;
}

const baseProps = {
  players: [makePlayer('a', 'Alice')],
  settings: { ...DEFAULT_SETTINGS },
  groupId: 'g1',
  tierId: 't1',
  floors: ['M9S', 'M10S', 'M11S', 'M12S'],
  maxWeek: 3,
  canEdit: true,
};

describe('WeaponPriorityBridge', () => {
  it('is collapsed by default: shows the "Weapon priorities" LinkText, not the list', () => {
    render(<WeaponPriorityBridge {...baseProps} />);
    expect(screen.getByText('Weapon priorities')).toBeInTheDocument();
    expect(screen.queryByTestId('wpl')).not.toBeInTheDocument();
  });

  it('expands to render WeaponPriorityList on click', () => {
    render(<WeaponPriorityBridge {...baseProps} />);
    fireEvent.click(screen.getByText('Weapon priorities'));
    expect(screen.getByTestId('wpl')).toBeInTheDocument();
  });

  it('forwards canEdit as showLogButtons to WeaponPriorityList', () => {
    mockWeaponPriorityListProps = null;
    render(<WeaponPriorityBridge {...baseProps} canEdit={false} />);
    fireEvent.click(screen.getByText('Weapon priorities'));
    expect(mockWeaponPriorityListProps).toMatchObject({ showLogButtons: false });
  });

  it('announces expanded state on the toggle via aria-expanded', () => {
    render(<WeaponPriorityBridge {...baseProps} />);
    const toggle = screen.getByText('Weapon priorities');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});
