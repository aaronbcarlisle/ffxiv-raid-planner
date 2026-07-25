/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LinkText, NavRow } from './LinkText';

describe('LinkText', () => {
  it('renders an anchor when given href', () => {
    render(<LinkText href="/docs">Read more</LinkText>);
    expect(screen.getByText('Read more').closest('a')).toHaveAttribute('href', '/docs');
  });

  it('renders a button that fires onClick when given onClick', () => {
    const onClick = vi.fn();
    render(<LinkText onClick={onClick}>Sync now</LinkText>);
    fireEvent.click(screen.getByRole('button', { name: /Sync now/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('NavRow', () => {
  it('renders the label and fires onClick', () => {
    const onClick = vi.fn();
    render(<NavRow label="Settings" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: /Settings/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders an anchor when given href', () => {
    render(<NavRow label="Discover" href="/discover" />);
    expect(screen.getByText('Discover').closest('a')).toHaveAttribute('href', '/discover');
  });
});
