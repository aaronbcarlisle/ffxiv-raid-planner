import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Button } from './Button';

describe('Button trailing element', () => {
  it('renders a chevron glyph for trailing="chevron"', () => {
    const { container } = render(<Button trailing="chevron">Open</Button>);
    expect(container.querySelector('svg.lucide-chevron-down')).toBeTruthy();
  });
  it('renders an external glyph for trailing="external"', () => {
    const { container } = render(<Button trailing="external">Docs</Button>);
    expect(container.querySelector('svg.lucide-external-link')).toBeTruthy();
  });
  it('renders no trailing glyph by default', () => {
    const { container } = render(<Button>Save</Button>);
    expect(container.querySelector('svg.lucide-chevron-down,svg.lucide-external-link')).toBeNull();
  });
});
