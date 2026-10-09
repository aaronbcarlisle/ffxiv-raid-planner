import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';

function Open({ label, labelledBy }: { label?: string; labelledBy?: string }) {
  return (
    <Popover open>
      <PopoverTrigger asChild>
        <button type="button">Open</button>
      </PopoverTrigger>
      <PopoverContent aria-label={label} aria-labelledby={labelledBy}>
        <span id="heading">Heading</span>
      </PopoverContent>
    </Popover>
  );
}

describe('PopoverContent: the dialog\'s accessible name', () => {
  it('forwards aria-label to the dialog', () => {
    render(<Open label="Pick a thing" />);
    expect(screen.getByRole('dialog', { name: 'Pick a thing' })).toBeTruthy();
  });

  it('forwards aria-labelledby to the dialog', () => {
    render(<Open labelledBy="heading" />);
    expect(screen.getByRole('dialog', { name: 'Heading' })).toBeTruthy();
  });

  it('adds no label of its own', () => {
    render(<Open />);
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBeNull();
  });
});
