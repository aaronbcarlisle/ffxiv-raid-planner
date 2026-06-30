import { Suspense, lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GroupView } from './GroupView';
import { PageSkeleton } from '../components/ui/Skeleton';

const NewShell = lazy(() => import('./NewShell').then(m => ({ default: m.NewShell })));

export function GroupRoute() {
  const [searchParams] = useSearchParams();
  if (searchParams.get('shell') !== 'v2') return <GroupView />;
  return <Suspense fallback={<PageSkeleton />}><NewShell /></Suspense>;
}
