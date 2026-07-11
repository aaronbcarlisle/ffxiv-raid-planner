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
 */
import { Suspense, lazy } from 'react';
import { GroupView } from './GroupView';
import { PageSkeleton } from '../components/ui/Skeleton';
import { useResolvedShell } from '../lib/shellPreference';

const NewShell = lazy(() => import('./NewShell').then(m => ({ default: m.NewShell })));

export function GroupRoute() {
  const shell = useResolvedShell();
  if (shell === 'v2') {
    return <Suspense fallback={<PageSkeleton />}><NewShell /></Suspense>;
  }
  return <GroupView />;
}
