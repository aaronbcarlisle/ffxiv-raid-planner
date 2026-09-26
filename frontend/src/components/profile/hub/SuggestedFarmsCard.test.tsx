import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SuggestedFarmsCard } from './SuggestedFarmsCard';
import type { CollectionSuggestion } from '../../../stores/playerProfileStore';

function makeSuggestion(overrides: Partial<CollectionSuggestion> = {}): CollectionSuggestion {
  return {
    trialId: 'trial-1', mountName: 'Gwiber', dutyName: 'Shadowbringer EX',
    totemName: 'Totem', totemTarget: 99, currentCount: 42, hasMount: false, source: 'suggestion',
    ...overrides,
  };
}

describe('SuggestedFarmsCard', () => {
  it('renders nothing with no suggestions', () => {
    const { container } = render(<SuggestedFarmsCard collectionSuggestions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders up to 3 rows with mount name, duty, and count', () => {
    const suggestions = [
      makeSuggestion({ trialId: 't1', mountName: 'Mount A', dutyName: 'Duty A', currentCount: 10, totemTarget: 99 }),
      makeSuggestion({ trialId: 't2', mountName: 'Mount B', dutyName: 'Duty B', currentCount: 50, totemTarget: 99 }),
      makeSuggestion({ trialId: 't3', mountName: 'Mount C', dutyName: 'Duty C', currentCount: 90, totemTarget: 99 }),
      makeSuggestion({ trialId: 't4', mountName: 'Mount D', dutyName: 'Duty D', currentCount: 99, totemTarget: 99 }),
    ];
    render(<SuggestedFarmsCard collectionSuggestions={suggestions} />);
    expect(screen.getByText('Mount A')).toBeInTheDocument();
    expect(screen.getByText('Mount B')).toBeInTheDocument();
    expect(screen.getByText('Mount C')).toBeInTheDocument();
    expect(screen.queryByText('Mount D')).toBeNull();
    expect(screen.getByText('+1 more')).toBeInTheDocument();
    expect(screen.getByText('10/99')).toBeInTheDocument();
  });

  it('shows "Owned" when hasMount is true', () => {
    render(<SuggestedFarmsCard collectionSuggestions={[makeSuggestion({ hasMount: true })]} />);
    expect(screen.getByText('Owned')).toBeInTheDocument();
  });

  it('shows count when hasMount is false', () => {
    render(<SuggestedFarmsCard collectionSuggestions={[makeSuggestion({ hasMount: false, currentCount: 7, totemTarget: 99 })]} />);
    expect(screen.getByText('7/99')).toBeInTheDocument();
  });

  it('no +N more when exactly 3 suggestions', () => {
    const suggestions = [1, 2, 3].map((n) => makeSuggestion({ trialId: `t${n}`, mountName: `M${n}`, dutyName: `D${n}` }));
    render(<SuggestedFarmsCard collectionSuggestions={suggestions} />);
    expect(screen.queryByText(/more/)).toBeNull();
  });
});
