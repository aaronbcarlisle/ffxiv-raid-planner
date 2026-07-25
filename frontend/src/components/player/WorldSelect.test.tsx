/** @vitest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// The design-system Select is Radix-based and impractical to drive in jsdom, so
// mock it with a native <select> to exercise WorldSelect's cascade logic.
vi.mock('../ui', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Select: ({ value, onChange, options, disabled, 'aria-label': ariaLabel }: any) => (
    <select aria-label={ariaLabel} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
}));

import { WorldSelect } from './WorldSelect';

describe('WorldSelect', () => {
  it('changing data center resets the world', () => {
    const onWorld = vi.fn();
    const onDc = vi.fn();
    render(
      <WorldSelect showDataCenter dataCenter="Aether" world="Gilgamesh"
        onDataCenterChange={onDc} onWorldChange={onWorld} />,
    );
    fireEvent.change(screen.getByLabelText('Data center'), { target: { value: 'Primal' } });
    expect(onDc).toHaveBeenCalledWith('Primal');
    expect(onWorld).toHaveBeenCalledWith('');
  });

  it('omits the data-center select when showDataCenter is false', () => {
    render(<WorldSelect showDataCenter={false} dataCenter="Aether" world="" onWorldChange={vi.fn()} />);
    expect(screen.queryByLabelText('Data center')).not.toBeInTheDocument();
    expect(screen.getByLabelText('World')).toBeInTheDocument();
  });
});
