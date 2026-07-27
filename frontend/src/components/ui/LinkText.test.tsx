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

  it('opens external links in a new tab with rel protection (C5)', () => {
    render(
      <LinkText href="https://xivgear.app/?page=x" external aria-label="Open in XIVGear">
        BiS
      </LinkText>
    );
    const link = screen.getByRole('link', { name: 'Open in XIVGear' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('stays same-tab without the external flag', () => {
    render(<LinkText href="/docs">Read more</LinkText>);
    expect(screen.getByText('Read more').closest('a')).not.toHaveAttribute('target');
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
