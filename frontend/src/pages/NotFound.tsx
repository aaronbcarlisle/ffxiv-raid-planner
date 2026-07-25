/**
 * NotFound — global 404 page for unmatched URLs (Phase A, A7).
 *
 * Registered as the catch-all `path="*"` child INSIDE App.tsx's Layout route,
 * so the app Header/nav chrome mounts around it (an unmatched URL previously
 * matched nothing at all and rendered a blank page). Invalid /group/:shareCode
 * codes are NOT handled here — each shell keeps its own "not found" state.
 *
 * The CTA goes to '/' unconditionally: the index route already routes by auth
 * state, so Home is always a safe landing.
 */

import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '../components/ui';

export function NotFound() {
  const navigate = useNavigate();

  return (
    // Layout's <main> is a flex column; flex-1 centers the state vertically
    // within it (same full-page treatment as the shell content states).
    <div className="flex-1 flex flex-col items-center justify-center px-4">
      <EmptyState
        icon={<Compass className="w-8 h-8" />}
        heading="Page not found"
        description="This page doesn't exist or has moved."
        action={{ label: 'Back to Home', onClick: () => navigate('/') }}
      />
    </div>
  );
}
