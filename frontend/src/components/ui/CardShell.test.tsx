/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CardShell } from './CardShell';

describe('CardShell', () => {
  it('renders children', () => {
    render(<CardShell>body</CardShell>);
    expect(screen.getByText('body')).toBeInTheDocument();
  });
  it('renders a heading + headerRight when title set', () => {
    render(<CardShell title="Recent activity" headerRight={<span>this week</span>}>x</CardShell>);
    expect(screen.getByRole('heading', { name: /recent activity/i })).toBeInTheDocument();
    expect(screen.getByText('this week')).toBeInTheDocument();
  });
});
