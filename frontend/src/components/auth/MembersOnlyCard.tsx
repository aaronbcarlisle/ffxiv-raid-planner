/**
 * MembersOnlyCard - the shared gate for member-only screens (Schedule, Tracking).
 *
 * One card, three states: a guest gets a Login action that returns to the
 * current path; a signed-in non-member gets the invite copy and no action; before
 * the auth bootstrap resolves (no user yet) it shows the shared line alone.
 * The heading must never contain "schedule" (smoke test 10's strict-mode
 * locator matches the PageHeader h1 only).
 */

import { Lock } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuthStore, useAuthHydrated } from '../../stores/authStore';
import { EmptyState } from '../ui/EmptyState';

interface MembersOnlyCardProps {
  /** The static's name, for the copy. */
  staticName: string;
  /** What is shared, capitalised and plural, e.g. "Objectives and farms". */
  subject: string;
}

export function MembersOnlyCard({ staticName, subject }: MembersOnlyCardProps) {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const authInitialized = useAuthStore((s) => s.authInitialized);
  const hydrated = useAuthHydrated();
  const login = useAuthStore((s) => s.login);
  const { pathname, search } = useLocation();

  // No user is only a confirmed guest once the bootstrap has finished.
  const authUnknown = !user && (!hydrated || !authInitialized);
  const shared = `${subject} are shared with members of ${staticName}.`;

  return (
    <div data-testid="members-only-card">
      <EmptyState
        icon={<Lock size={24} />}
        heading="Members only"
        description={
          user
            ? `${shared} Ask a lead for an invite, or send a join request if the static is recruiting.`
            : authUnknown
              ? shared
              : `${shared} Log in to ask to join.`
        }
        action={
          user || authUnknown
            ? undefined
            : {
                label: isLoading ? 'Connecting...' : 'Login with Discord',
                onClick: () => {
                  // EmptyState's action can't be disabled; LoginButton prevents
                  // a second click restarting OAuth by disabling itself.
                  if (!isLoading) login(pathname + search);
                },
              }
        }
      />
    </div>
  );
}
