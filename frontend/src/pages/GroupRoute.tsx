import { Suspense, lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GroupView } from './GroupView';
import { PageSkeleton } from '../components/ui/Skeleton';

const NewShell = lazy(() => import('./NewShell').then(m => ({ default: m.NewShell })));

export function GroupRoute() {
  const [searchParams] = useSearchParams();
  // FLIP P2: v2 NewShell is the default group experience. `?shell=legacy` is the
  // soak-window escape hatch back to GroupView; `?shell=v2` stays a no-op alias.
  if (searchParams.get('shell') === 'legacy') return <GroupView />;
  return <Suspense fallback={<PageSkeleton />}><NewShell /></Suspense>;
}
