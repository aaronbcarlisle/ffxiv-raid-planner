/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';

import { ErrorFallback } from './App';

describe('App error fallback', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('shows stale chunk recovery copy after an automatic reload has already been attempted', () => {
    window.sessionStorage.setItem('xrp_chunk_reload_attempted', '1');

    render(
      <ErrorFallback
        error={new Error('error loading dynamically imported module: https://www.xivraidplanner.app/assets/GroupView-D4tlpFl.js')}
        resetErrorBoundary={() => {}}
      />,
    );

    expect(screen.getByText('The app was updated')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload app' })).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('keeps normal errors on the generic fallback', () => {
    render(
      <ErrorFallback
        error={new Error('Cannot read properties of undefined')}
        resetErrorBoundary={() => {}}
      />,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
