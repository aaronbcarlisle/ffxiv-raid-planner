/**
 * StaticFinder — the V2-native Static Finder body (Stage 4 SF1, R-SF-H/N).
 * Rendered by pages/Discover.tsx's seam under V2 chrome; V1's `Discover`
 * (renamed `LegacyDiscover`) renders unchanged everywhere else.
 */
import { useEffect } from 'react';
import { Search } from 'lucide-react';
import { PageHeader } from '../layout/PageHeader';
import { EmptyState } from '../ui/EmptyState';
import { CardSkeleton } from '../ui/Skeleton';
import { Button } from '../primitives';
import { JoinRequestModal } from '../static-group/JoinRequestModal';
import { useModalWithData } from '../../hooks/useModal';
import { useAuthStore } from '../../stores/authStore';
import { useJoinRequestStore } from '../../stores/joinRequestStore';
import { useFinderQuery } from './useFinderQuery';
import { FinderFilters } from './FinderFilters';
import { FinderSummary } from './FinderSummary';
import { FinderCard } from './FinderCard';
import { FinderNudge } from './FinderNudge';
import { LeadingStaticRow } from './LeadingStaticRow';
import type { FinderItem } from './types';

export function StaticFinder() {
  const user = useAuthStore((s) => s.user);
  const isGuest = !user;
  const fetchMyRequests = useJoinRequestStore((s) => s.fetchMyRequests);

  const {
    state, setters, items, total, fitCounts, viewer, loading, error,
    retry, clearFilters, hasFilters, moreFiltersInitiallyOpen,
  } = useFinderQuery();

  // R-SF-I: never fetched for a guest (F1).
  useEffect(() => {
    if (user) fetchMyRequests();
  }, [user, fetchMyRequests]);

  // One JoinRequestModal per page, not per card (R-SF-I).
  const joinModal = useModalWithData<FinderItem>();

  return (
    <div data-testid="static-finder" className="w-full max-w-[120rem] px-3 sm:px-6 pb-6">
      <PageHeader title="Static Finder" subtitle="Find a static that fits your content, schedule and role." />
      <p className="text-text-muted text-xs -mt-3 mb-6">
        All listings are opt-in. Only public details chosen by the static lead are shown.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-6 items-start">
        <FinderFilters
          state={state}
          setters={setters}
          viewer={viewer}
          isGuest={isGuest}
          hasFilters={hasFilters}
          clearFilters={clearFilters}
          moreFiltersInitiallyOpen={moreFiltersInitiallyOpen}
        />

        <div className="min-w-0">
          {!loading && !error && (
            <FinderSummary
              total={total}
              fitCounts={fitCounts}
              viewer={viewer}
              asRole={state.asRole}
              sort={state.sort}
              onSortChange={setters.setSort}
              isGuest={isGuest}
            />
          )}

          {!loading && !error && <FinderNudge viewer={viewer} />}

          {loading ? (
            <div data-testid="finder-loading" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : error ? (
            <div className="p-6 bg-status-error/10 border border-status-error/30 rounded-lg text-center">
              <p className="text-status-error font-medium">Couldn&apos;t load statics.</p>
              <Button variant="secondary" size="sm" onClick={retry} className="mt-3">Retry</Button>
            </div>
          ) : items.length === 0 ? (
            hasFilters ? (
              <EmptyState
                icon={<Search className="w-8 h-8" />}
                heading="No statics match"
                description="Try another role or loosen your filters."
                action={{ label: 'Clear filters', onClick: clearFilters }}
              />
            ) : (
              <EmptyState
                icon={<Search className="w-8 h-8" />}
                heading="No statics are recruiting yet"
                description="Static leads can post a listing from Settings → Recruitment."
              />
            )
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map((item) => (
                <FinderCard key={item.shareCode} item={item} onRequestJoin={joinModal.open} />
              ))}
            </div>
          )}

          {!loading && !error && <LeadingStaticRow />}
        </div>
      </div>

      <JoinRequestModal
        isOpen={joinModal.isOpen}
        onClose={joinModal.close}
        shareCode={joinModal.data?.shareCode ?? ''}
        staticName={joinModal.data?.name ?? ''}
        neededJobs={joinModal.data?.neededJobs ?? undefined}
        neededRoles={joinModal.data?.neededRoles ?? undefined}
        recruitmentStatus={joinModal.data?.recruitmentStatus}
      />
    </div>
  );
}
