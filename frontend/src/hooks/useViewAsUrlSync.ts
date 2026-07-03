/**
 * useViewAsUrlSync — shared `?viewAs=` URL-sync hook (admin "View As")
 *
 * Promoted verbatim from GroupView.tsx (the legacy chrome), which previously
 * ran these three effects on its own — meaning admin "View As" was inert in
 * the v2 shell (NewShell never ran them). This hook is now the single source
 * of the viewAs URL-sync behavior; NewShell (the sole shell since flip-P3) calls it.
 */

import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useViewAsStore } from '../stores/viewAsStore';

export function useViewAsUrlSync(currentGroupId: string | undefined): void {
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const { viewAsUser, startViewAs, stopViewAs } = useViewAsStore();

  // Handle viewAs URL parameter
  useEffect(() => {
    const viewAsUserId = searchParams.get('viewAs');
    if (viewAsUserId && currentGroupId && user?.isAdmin) {
      if (!viewAsUser || viewAsUser.userId !== viewAsUserId || viewAsUser.groupId !== currentGroupId) {
        startViewAs(currentGroupId, viewAsUserId);
      }
    } else if (!viewAsUserId && viewAsUser) {
      stopViewAs();
    }
  }, [searchParams, currentGroupId, user?.isAdmin, startViewAs, stopViewAs, viewAsUser]);

  // Clear stale viewAs state if group changed
  useEffect(() => {
    if (viewAsUser && currentGroupId && viewAsUser.groupId !== currentGroupId) {
      stopViewAs();
    }
  }, [viewAsUser, currentGroupId, stopViewAs]);

  // Clean up viewAs state when unmounting
  useEffect(() => {
    return () => {
      stopViewAs();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
