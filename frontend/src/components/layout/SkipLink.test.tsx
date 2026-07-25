import { it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkipLink } from './SkipLink';
it('renders an anchor to the main content target', () => {
  render(<SkipLink />);
  const link = screen.getByText('Skip to content');
  expect(link).toHaveAttribute('href', '#main-content');
  expect(link).toHaveClass('sr-only');
});
