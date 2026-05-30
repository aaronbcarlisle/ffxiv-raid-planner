import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ItemHoverCard } from './ItemHoverCard';

describe('ItemHoverCard', () => {
  const baseProps = {
    itemName: 'Grand Champion Claymore',
    itemLevel: 795,
    bisSource: 'raid' as const,
  };

  it('renders item name and level', () => {
    render(<ItemHoverCard {...baseProps} />);
    expect(screen.getByText('Grand Champion Claymore')).toBeInTheDocument();
    expect(screen.getByText('Item Level 795')).toBeInTheDocument();
  });

  it('renders source badge for raid items', () => {
    render(<ItemHoverCard {...baseProps} />);
    expect(screen.getByText('Savage')).toBeInTheDocument();
  });

  it('renders source badge for tome items', () => {
    render(<ItemHoverCard {...baseProps} bisSource="tome" />);
    expect(screen.getByText('Tome (Aug.)')).toBeInTheDocument();
  });

  it('does not render materia section when materia is undefined', () => {
    render(<ItemHoverCard {...baseProps} />);
    expect(screen.queryByText('Materia')).not.toBeInTheDocument();
  });

  it('does not render materia section when materia is empty array', () => {
    render(<ItemHoverCard {...baseProps} materia={[]} />);
    expect(screen.queryByText('Materia')).not.toBeInTheDocument();
  });

  it('renders materia section when materia is provided', () => {
    const materia = [
      { itemId: 33942, itemName: 'Savage Might Materia XII', stat: 'Determination', tier: 12 },
      { itemId: 33938, itemName: 'Savage Aim Materia XII', stat: 'Critical Hit', tier: 12 },
    ];
    render(<ItemHoverCard {...baseProps} materia={materia} />);
    // Stat abbreviations should be displayed with values
    expect(screen.getByText('DET')).toBeInTheDocument();
    expect(screen.getByText('CRT')).toBeInTheDocument();
    // Stat values should be displayed (54 for tier XII)
    expect(screen.getAllByText('54')).toHaveLength(2);
    // Tooltips should have full materia names
    expect(screen.getByTitle('Savage Might Materia XII: +54 Determination')).toBeInTheDocument();
    expect(screen.getByTitle('Savage Aim Materia XII: +54 Critical Hit')).toBeInTheDocument();
  });

  it('renders materia with icons when provided', () => {
    const materia = [
      {
        itemId: 33942,
        itemName: 'Savage Might Materia XII',
        stat: 'Determination',
        tier: 12,
        icon: 'https://xivapi.com/i/020000/020292.png',
      },
    ];
    render(<ItemHoverCard {...baseProps} materia={materia} />);
    const img = screen.getByAltText('Savage Might Materia XII');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://xivapi.com/i/020000/020292.png');
  });

  it('falls back to item name when stat is not provided', () => {
    const materia = [
      { itemId: 33942, itemName: 'Unknown Materia', tier: 10 },
    ];
    render(<ItemHoverCard {...baseProps} materia={materia} />);
    // When stat is missing, the tooltip still shows item name and stat value
    expect(screen.getByTitle('Unknown Materia: +18 Unknown Materia')).toBeInTheDocument();
    // Stat value for tier 10 is 18
    expect(screen.getByText('18')).toBeInTheDocument();
  });

  // Comparison state tests

  it('shows "Not currently detected" when BiS exists but no equipped data', () => {
    render(<ItemHoverCard {...baseProps} itemId={44091} />);
    expect(screen.getByText('Not currently detected')).toBeInTheDocument();
    expect(screen.queryByText('BiS matched ✓')).not.toBeInTheDocument();
  });

  it('shows "BiS matched ✓" when equippedItemId matches itemId', () => {
    render(
      <ItemHoverCard
        {...baseProps}
        itemId={44091}
        equippedItemId={44091}
        equippedItemName="Grand Champion Claymore"
        equippedItemLevel={795}
      />
    );
    expect(screen.getByText('BiS matched ✓')).toBeInTheDocument();
    expect(screen.queryByText('Currently wearing')).not.toBeInTheDocument();
  });

  it('shows "Upgrade needed" and "Currently wearing" section when equipped differs from BiS', () => {
    render(
      <ItemHoverCard
        {...baseProps}
        itemId={44091}
        equippedItemId={40001}
        equippedItemName="Archfiend Blade"
        equippedItemLevel={660}
      />
    );
    expect(screen.getByText('Upgrade needed')).toBeInTheDocument();
    expect(screen.getByText('Currently wearing')).toBeInTheDocument();
    expect(screen.getAllByText('Archfiend Blade').length).toBeGreaterThan(0);
    expect(screen.getByText(/iLv 660/)).toBeInTheDocument();
  });

  it('shows item level diff vs BiS when equipped has different iLv', () => {
    render(
      <ItemHoverCard
        {...baseProps}
        itemId={44091}
        itemLevel={795}
        equippedItemId={40001}
        equippedItemName="Archfiend Blade"
        equippedItemLevel={660}
      />
    );
    // 795 - 660 = +135
    expect(screen.getByText(/\+135 vs BiS/)).toBeInTheDocument();
  });

  it('shows "No BiS target configured" when equipped data exists but no BiS target', () => {
    render(
      <ItemHoverCard
        bisSource={null}
        equippedItemId={40001}
        equippedItemName="Archfiend Blade"
        equippedItemLevel={660}
      />
    );
    expect(screen.getByText('No BiS target configured')).toBeInTheDocument();
    expect(screen.getByText('Currently wearing')).toBeInTheDocument();
    expect(screen.getByText('Archfiend Blade')).toBeInTheDocument();
  });

  it('shows "BiS target" label on BiS section when both BiS and equipped sections are present', () => {
    render(
      <ItemHoverCard
        {...baseProps}
        itemId={44091}
        equippedItemId={40001}
        equippedItemName="Archfiend Blade"
        equippedItemLevel={660}
      />
    );
    expect(screen.getByText('BiS target')).toBeInTheDocument();
  });

  it('does not show "BiS target" label when only BiS data present (no equipped)', () => {
    render(<ItemHoverCard {...baseProps} itemId={44091} />);
    expect(screen.queryByText('BiS target')).not.toBeInTheDocument();
  });

  it('source badge shows clean "Tome (Aug.)" label for unaugmented tome items', () => {
    render(<ItemHoverCard {...baseProps} bisSource="tome" isAugmented={false} />);
    expect(screen.getByText('Tome (Aug.)')).toBeInTheDocument();
    // Augmentation state is surfaced via comparison badges, not inside the source badge
    expect(screen.queryByText(/needs aug/i)).not.toBeInTheDocument();
  });

  it('source badge shows clean "Tome (Aug.)" label for augmented tome items', () => {
    render(<ItemHoverCard {...baseProps} bisSource="tome" isAugmented={true} />);
    expect(screen.getByText('Tome (Aug.)')).toBeInTheDocument();
    expect(screen.queryByText(/needs aug/i)).not.toBeInTheDocument();
  });

  it('renders equipped item icon when provided', () => {
    render(
      <ItemHoverCard
        {...baseProps}
        itemId={44091}
        equippedItemId={40001}
        equippedItemName="Archfiend Blade"
        equippedItemLevel={660}
        equippedItemIcon="https://xivapi.com/i/040000/040001.png"
      />
    );
    const equippedImg = screen.getByAltText('Archfiend Blade');
    expect(equippedImg).toHaveAttribute('src', 'https://xivapi.com/i/040000/040001.png');
  });
});
