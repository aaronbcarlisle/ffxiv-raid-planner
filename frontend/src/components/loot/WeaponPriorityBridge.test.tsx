// Phase-D R-3: the bridge is the Weapons switcher segment's body — the old
// collapse/expand disclosure is GONE (weapon priority stopped being a
// collapsible text link in the Floor-4 card's footer). This suite pins the new
// contract: list always rendered inside the floor-4-identified card, canEdit
// forwarded, and the shared `WeaponPriorityList` mounted verbatim (it is V1's
// component too — LootPriorityPanel.tsx:25 — and must not be edited).
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  it('renders WeaponPriorityList immediately — no disclosure to click through (R-3)', () => {
    render(<WeaponPriorityBridge {...baseProps} />);
    expect(screen.getByTestId('wpl')).toBeInTheDocument();
    expect(screen.queryByText('Weapon priorities')).not.toBeInTheDocument();
  });

  it('states the fixed floor-4 scope in its card header', () => {
    const { container } = render(<WeaponPriorityBridge {...baseProps} />);
    // Duty chip + floor-coloured floor name (mockup .duty/.fname treatment).
    expect(screen.getByText('M12S')).toBeInTheDocument();
    expect(screen.getByText('Floor 4').className).toContain('text-floor-4');
    // The card carries the floor-4 accent stripe (R-45).
    expect(container.firstElementChild?.className).toContain('border-l-floor-4');
  });

  it('forwards canEdit as showLogButtons to WeaponPriorityList', () => {
    mockWeaponPriorityListProps = null;
    render(<WeaponPriorityBridge {...baseProps} canEdit={false} />);
    expect(mockWeaponPriorityListProps).toMatchObject({ showLogButtons: false });
  });

  it('drops the duty chip (not doubling "Floor 4") when tier gamedata has no floor names', () => {
    render(<WeaponPriorityBridge {...baseProps} floors={[]} />);
    // Exactly ONE "Floor 4" — a "Floor 4" chip beside the "Floor 4" heading
    // is the redundancy Copilot flagged on the R-5 label (PR #224).
    expect(screen.getAllByText('Floor 4')).toHaveLength(1);
    expect(screen.getByTestId('wpl')).toBeInTheDocument();
  });
});
