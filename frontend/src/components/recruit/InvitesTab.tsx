/**
 * InvitesTab — the Recruiting page's Invites tab (RH1d, R-RH-M).
 *
 * Fetches on mount, lists every invitation (code, role, uses, expiry, Copy
 * link, a double-click Revoke), and a create form (role — `lead` only for an
 * owner — days, unlimited/limited uses). `?create=1` opens the form and is
 * stripped from the URL with `replace` — keyed on the live search param
 * (review wave, Important 2), not just on mount: the tab stays mounted across
 * a same-tab re-navigation (TopBar's Invite button while already here), and a
 * `useState(createRequested)` read once at mount missed that re-arrival,
 * leaving `?create=1` stuck in the URL with the form never opening. Expired/
 * exhausted/revoked rows sit under a collapsed "Inactive" toggle, mirroring
 * the Applicants tab's Resolved pattern.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy, XCircle, Check } from 'lucide-react';
import { Button } from '../primitives';
import { CardShell } from '../ui/CardShell';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';
import { NumberInput } from '../ui/NumberInput';
import { Checkbox } from '../ui/Checkbox';
import { Tag } from '../ui/Tag';
import { CardSkeleton } from '../ui/Skeleton';
import { useInvitationStore } from '../../stores/invitationStore';
import { useStaticPermissions } from '../../hooks/useStaticPermissions';
import { useDoubleClickConfirm } from '../../hooks/useDoubleClickConfirm';
import { toast } from '../../stores/toastStore';
import type { Invitation, MemberRole } from '../../types';

interface InvitesTabProps {
  groupId: string;
}

const ROLE_LABEL: Record<MemberRole, string> = {
  owner: 'Owner',
  lead: 'Lead',
  member: 'Member',
  viewer: 'Viewer',
};

// `isValid` is the backend's own `isActive && !isExpired && !isExhausted`
// (models/invitation.py) — using it directly (rather than re-deriving with
// `useCount >= maxUses`) avoids the unlimited-invite bug live-found here:
// the API sends `maxUses: null` for "no limit", and `0 >= null` coerces to
// `0 >= 0` (true) in JS, so re-deriving filed every unlimited invite under
// Inactive regardless of use count.
function isInactive(inv: Invitation): boolean {
  return !inv.isValid;
}

type InactiveReason = 'Revoked' | 'Expired' | 'Used up';

/** Same precedence as V1's `InvitationsPanel` badge (Revoked, then Expired,
 *  then exhausted) — `maxUses != null` (not `!== undefined`) treats the
 *  backend's `null` the same as "unset", so an unlimited invite is never
 *  read as exhausted. */
function inactiveReason(inv: Invitation): InactiveReason | null {
  if (!inv.isActive) return 'Revoked';
  if (inv.expiresAt && new Date(inv.expiresAt) < new Date()) return 'Expired';
  if (inv.maxUses != null && inv.useCount >= inv.maxUses) return 'Used up';
  return null;
}

const INACTIVE_REASON_TONE: Record<InactiveReason, 'error' | 'warning' | 'muted'> = {
  Revoked: 'error',
  Expired: 'warning',
  'Used up': 'muted',
};

function formatExpiry(inv: Invitation): string {
  if (!inv.expiresAt) return 'Never expires';
  const date = new Date(inv.expiresAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `Expires ${date}`;
}

export function InvitesTab({ groupId }: InvitesTabProps) {
  const { invitations, isLoading, isCreating, fetchInvitations, createInvitation, revokeInvitation } = useInvitationStore();
  const { userRole } = useStaticPermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    fetchInvitations(groupId);
  }, [groupId, fetchInvitations]);

  // Open the create form and strip `?create=1`, keyed on the LIVE param value
  // (Important 2) rather than a mount-only ref: the tab does not remount for
  // a same-tab re-navigation (e.g. TopBar's Invite button while already on
  // Invites), so a later arrival with `?create=1` must open the form again,
  // not just once at mount.
  const createRequested = searchParams.get('create') === '1';
  useEffect(() => {
    if (!createRequested) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing local UI state to a URL param that is then stripped in the same effect (matches ShellContentStates.tsx's "reset derived state" precedent)
    setShowCreateForm(true);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('create');
        return next;
      },
      { replace: true },
    );
  }, [createRequested, setSearchParams]);

  // `invitationStore` is a single global list with no per-group scope; guard
  // on `staticGroupId` so a previous static's rows never flash while this
  // group's fetch is in flight (review wave, batched item 4).
  const groupInvitations = invitations.filter((inv) => inv.staticGroupId === groupId);
  const showLoadingSkeleton = isLoading && groupInvitations.length === 0;
  const active = groupInvitations.filter((inv) => !isInactive(inv));
  const inactive = groupInvitations.filter(isInactive);

  if (showLoadingSkeleton) {
    return (
      <div data-testid="invites-loading" className="flex flex-col gap-3">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const copyLink = async (code: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${code}`);
      toast.success('Invite link copied.');
    } catch {
      toast.error("Couldn't copy the invite link.");
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await revokeInvitation(groupId, id);
      toast.success('Invitation revoked.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to revoke invitation');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {active.length === 0 && inactive.length === 0 && (
        <p className="text-sm text-text-muted py-4 text-center">No invitations yet. Create one to invite members.</p>
      )}
      {active.length === 0 && inactive.length > 0 && (
        <p className="text-sm text-text-muted">No active invites.</p>
      )}

      {!showCreateForm ? (
        <Button variant="secondary" onClick={() => setShowCreateForm(true)} className="self-start">
          + Create Invitation Link
        </Button>
      ) : (
        <CreateInviteForm
          userRole={userRole}
          isCreating={isCreating}
          onCancel={() => setShowCreateForm(false)}
          onCreate={async (data) => {
            try {
              await createInvitation(groupId, data);
              setShowCreateForm(false);
            } catch {
              toast.error('Failed to create invitation.');
            }
          }}
        />
      )}

      {active.map((inv) => (
        <InviteRow key={inv.id} invitation={inv} onCopy={copyLink} onRevoke={handleRevoke} />
      ))}

      {inactive.length > 0 && (
        <div className="flex flex-col gap-3">
          <Button variant="link" onClick={() => setShowInactive((v) => !v)}>
            {showInactive ? 'Hide inactive' : `Inactive (${inactive.length})`}
          </Button>
          {showInactive && inactive.map((inv) => (
            <InviteRow key={inv.id} invitation={inv} onCopy={copyLink} onRevoke={handleRevoke} />
          ))}
        </div>
      )}
    </div>
  );
}

function InviteRow({
  invitation,
  onCopy,
  onRevoke,
}: {
  invitation: Invitation;
  onCopy: (code: string) => void;
  onRevoke: (id: string) => Promise<void>;
}) {
  const { isArmed, isLoading, handleClick, handleBlur } = useDoubleClickConfirm({
    onConfirm: () => onRevoke(invitation.id),
    timeout: 3000,
  });
  const reason = inactiveReason(invitation);

  return (
    <CardShell as="div" className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <code className="text-accent font-mono text-sm">{invitation.inviteCode}</code>
          <Tag variant="label" tone="muted">{ROLE_LABEL[invitation.role]}</Tag>
          {reason && <Tag variant="label" tone={INACTIVE_REASON_TONE[reason]}>{reason}</Tag>}
        </div>
        <div className="text-xs text-text-muted">
          {invitation.useCount}/{invitation.maxUses ?? '∞'} uses
          {!reason && ` · ${formatExpiry(invitation)}`}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {invitation.isValid && (
          <Button variant="secondary" size="sm" leftIcon={<Copy className="w-3.5 h-3.5" />} onClick={() => onCopy(invitation.inviteCode)}>
            Copy link
          </Button>
        )}
        {invitation.isActive && (
          <Button
            variant={isArmed ? 'warning' : 'danger'}
            size="sm"
            loading={isLoading}
            leftIcon={isArmed ? <Check className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            onClick={handleClick}
            onBlur={handleBlur}
          >
            {isArmed ? 'Confirm?' : 'Revoke'}
          </Button>
        )}
      </div>
    </CardShell>
  );
}

function CreateInviteForm({
  userRole,
  isCreating,
  onCancel,
  onCreate,
}: {
  userRole: MemberRole | null | undefined;
  isCreating: boolean;
  onCancel: () => void;
  onCreate: (data: { role: MemberRole; expiresInDays: number | null; maxUses: number | undefined }) => void;
}) {
  const [role, setRole] = useState<MemberRole>('member');
  const [days, setDays] = useState<number | null>(7);
  const [neverExpires, setNeverExpires] = useState(false);
  const [unlimited, setUnlimited] = useState(true);
  const [maxUses, setMaxUses] = useState<number | null>(null);

  const roleOptions = [
    { value: 'member', label: 'Member' },
    { value: 'viewer', label: 'Viewer' },
    ...(userRole === 'owner' ? [{ value: 'lead', label: 'Lead' }] : []),
  ];

  return (
    <CardShell as="div" className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="invite-role">Role</Label>
          {/* Radix's Select trigger is a button, which an htmlFor-only Label alone
              does not reliably name (the V1 InvitationsPanel form left this
              unassociated per DevTools) — pair it with an explicit aria-label. */}
          <Select
            id="invite-role"
            aria-label="Role"
            value={role}
            onChange={(v) => setRole(v as MemberRole)}
            options={roleOptions}
          />
        </div>

        <div>
          <Checkbox
            id="invite-never-expires"
            checked={neverExpires}
            onChange={setNeverExpires}
            label="Never expires"
          />
          {!neverExpires && (
            <div className="mt-2">
              <Label htmlFor="invite-days">Expires in (days)</Label>
              <NumberInput id="invite-days" value={days} onChange={setDays} min={1} max={30} size="sm" />
            </div>
          )}
        </div>

        <div className="col-span-2">
          <Checkbox
            id="invite-unlimited-uses"
            checked={unlimited}
            onChange={(next) => {
              setUnlimited(next);
              if (!next && maxUses === null) setMaxUses(1);
            }}
            label="Unlimited uses"
          />
          {!unlimited && (
            <div className="mt-2">
              <Label htmlFor="invite-max-uses">Max uses</Label>
              <NumberInput id="invite-max-uses" value={maxUses ?? 1} onChange={(v) => setMaxUses(v ?? 1)} min={1} max={100} size="sm" />
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button
          loading={isCreating}
          onClick={() =>
            onCreate({
              role,
              expiresInDays: neverExpires ? null : (days ?? 7),
              maxUses: unlimited ? undefined : (maxUses ?? 1),
            })
          }
        >
          Create
        </Button>
      </div>
    </CardShell>
  );
}
