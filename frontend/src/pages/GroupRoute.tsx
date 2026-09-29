/**
 * GroupRoute — the dual-shell gate (Phase R, ROLLOUT_ROADMAP §2).
 *
 * Renders exactly ONE shell for /group/:shareCode, resolved by
 * useResolvedShell(): `?shell=` param → persisted preference → default legacy.
 * GroupView (the classic chrome, restored at its f45a241 state) loads eagerly
 * as the default experience; NewShell stays code-split. Subscribing to the
 * preference store means the "Try the new UI" / "Switch to classic UI" toggles
 * remount the shell in place — no reload. The single-mount contract holds:
 * both shells call useViewAsUrlSync/useStaticNavMemory, but only one renders.
 *
 * The V2 Recruiting sub-route `/group/:shareCode/recruit` (R-RH-G) shares this
 * gate: under V2 NewShell swaps its body for the page; under V1 the path is not
 * a page, so it redirects to the static and GroupView never renders it.
 */
import { Suspense, lazy } from 'react';
import { Navigate, useLocation, useMatch } from 'react-router-dom';
import { GroupView } from './GroupView';
import { PageSkeleton } from '../components/ui/Skeleton';
import { useResolvedShell } from '../lib/shellPreference';

const NewShell = lazy(() => import('./NewShell').then(m => ({ default: m.NewShell })));

export function GroupRoute() {
  const shell = useResolvedShell();
  const recruit = useMatch('/group/:shareCode/recruit');
  const location = useLocation();
  if (shell !== 'v2' && recruit) {
    // Carry the search (`?shell=legacy`, `?viewAs=`, `?tier=`) minus the
    // route's own params, so an explicit shell or tier on the link survives.
    const params = new URLSearchParams(location.search);
    params.delete('rtab');
    params.delete('create');
    const search = params.toString();
    return (
      <Navigate
        to={{ pathname: `/group/${recruit.params.shareCode}`, search: search ? `?${search}` : '' }}
        replace
      />
    );
  }
  if (shell === 'v2') {
    return <Suspense fallback={<PageSkeleton />}><NewShell /></Suspense>;
  }
  return <GroupView />;
}
