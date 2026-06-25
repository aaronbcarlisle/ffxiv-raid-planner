/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GoalsTab } from './GoalsTab';

describe('GoalsTab', () => {
  it('frames goals as private tasks rather than collection farm tracking', () => {
    render(<GoalsTab goals={[]} />);

    expect(screen.getByText('Tasks & Goals')).toBeInTheDocument();
    expect(screen.getByText('No tasks yet')).toBeInTheDocument();
    expect(screen.getByText(/Add a task to track gearing/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Task' })).toBeInTheDocument();
    expect(screen.queryByText('Add Collection Goal')).toBeNull();
  });
});
