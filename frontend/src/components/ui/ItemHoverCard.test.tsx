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

  it('renders missing indicator when hasItem is false', () => {
    render(<ItemHoverCard {...baseProps} hasItem={false} />);
    expect(screen.getByText('(missing)')).toBeInTheDocument();
  });

  it('renders needs augment indicator for tome items without augmentation', () => {
    render(<ItemHoverCard {...baseProps} bisSource="tome" hasItem={true} isAugmented={false} />);
    expect(screen.getByText('(needs augment)')).toBeInTheDocument();
  });
});
