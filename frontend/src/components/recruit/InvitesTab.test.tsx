/**
 * InvitesTab — RH1d, R-RH-M. Mount fetch; row fields; Copy link; the
 * double-click Revoke; the create form's defaults and role gate; `?create=1`
 * opens the form and is stripped with `replace`; inactive rows collapse.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { InvitesTab } from './InvitesTab';
import type { Invitation } from '../../types';

const mocks = vi.hoisted(() => ({
  invitations: [] as Invitation[],
  isCreating: false,
  fetchInvitations: vi.fn(),
  createInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
  userRole: 'owner' as string | null,
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  writeText: vi.fn(),
}));

vi.mock('../../stores/invitationStore', () => ({
  useInvitationStore: () => ({
    invitations: mocks.invitations,
    isCreating: mocks.isCreating,
    fetchInvitations: mocks.fetchInvitations,
    createInvitation: mocks.createInvitation,
    revokeInvitation: mocks.revokeInvitation,
  }),
}));

vi.mock('../../hooks/useStaticPermissions', () => ({
  useStaticPermissions: () => ({ userRole: mocks.userRole }),
}));

vi.mock('../../stores/toastStore', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError, info: vi.fn(), warning: vi.fn() },
}));

function invitation(overrides: Partial<Invitation> = {}): Invitation {
  return {
    id: 'i1', staticGroupId: 'g1', inviteCode: 'ABC123', role: 'member',
    useCount: 1, isActive: true, isValid: true, createdAt: '2026-09-01T00:00:00Z', createdById: 'u1',
    ...overrides,
  };
}

// Checkboxes (ui/Checkbox) are a `<label>` wrapping a `div role="checkbox"` —
// the div itself carries no accessible name, so `getByRole('checkbox', {
// name })` can't find it (same pattern as RecipientPicker.test.tsx). Scope to
// the label whose visible text matches instead.
function checkboxByLabelText(text: string): HTMLElement {
  const labelEl = screen.getByText(text).closest('label');
  if (!labelEl) throw new Error(`checkbox label not found for "${text}"`);
  return within(labelEl).getByRole('checkbox');
}

function Location() {
  const loc = useLocation();
  return <div data-testid="search">{loc.search}</div>;
}

function renderTab(props: { createRequested?: boolean } = {}, initialEntry = '/group/abc/recruit?rtab=invites') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Location />
      <Routes>
        <Route path="/group/:shareCode/recruit" element={<InvitesTab groupId="g1" {...props} />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.invitations = [];
  mocks.isCreating = false;
  mocks.fetchInvitations.mockReset();
  mocks.createInvitation.mockReset().mockResolvedValue(invitation());
  mocks.revokeInvitation.mockReset().mockResolvedValue(undefined);
  mocks.userRole = 'owner';
  mocks.toastSuccess.mockReset();
  mocks.toastError.mockReset();
  mocks.writeText.mockReset().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText: mocks.writeText } });
  vi.stubGlobal('location', { origin: 'https://xrp.test' } as unknown as Location);
});

describe('InvitesTab — mount', () => {
  it('fetches invitations for the group on mount', () => {
    renderTab();
    expect(mocks.fetchInvitations).toHaveBeenCalledWith('g1');
  });

  it('no invitations: an empty-state message', () => {
    renderTab();
    expect(screen.getByText('No invitations yet. Create one to invite members.')).toBeInTheDocument();
  });
});

describe('InvitesTab — rows', () => {
  it('renders code, role tag, uses and expiry', () => {
    mocks.invitations = [invitation({ inviteCode: 'XYZ789', role: 'viewer', useCount: 2, maxUses: 5, expiresAt: '2026-12-01T00:00:00Z' })];
    renderTab();
    expect(screen.getByText('XYZ789')).toBeInTheDocument();
    expect(screen.getByText('Viewer')).toBeInTheDocument();
    expect(screen.getByText(/2\/5 uses/)).toBeInTheDocument();
    expect(screen.getByText(/Expires/)).toBeInTheDocument();
  });

  it('no maxUses: "N/∞ uses" and "Never expires"', () => {
    mocks.invitations = [invitation({ useCount: 3 })];
    renderTab();
    expect(screen.getByText(/3\/∞ uses/)).toBeInTheDocument();
    expect(screen.getByText(/Never expires/)).toBeInTheDocument();
  });

  it('Copy link writes the origin + code URL to the clipboard and toasts', async () => {
    mocks.invitations = [invitation({ inviteCode: 'COPYME' })];
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: /copy link/i }));
    await waitFor(() => expect(mocks.writeText).toHaveBeenCalledWith('https://xrp.test/invite/COPYME'));
    expect(mocks.toastSuccess).toHaveBeenCalled();
  });

  it('Revoke needs two clicks before calling revokeInvitation', async () => {
    mocks.invitations = [invitation({ id: 'r1' })];
    renderTab();
    const btn = screen.getByRole('button', { name: /revoke/i });
    fireEvent.click(btn);
    expect(mocks.revokeInvitation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(mocks.revokeInvitation).toHaveBeenCalledWith('g1', 'r1'));
  });

  it('inactive (revoked/expired/exhausted) rows sit under a collapsed "Inactive" toggle', () => {
    mocks.invitations = [
      invitation({ id: 'active', inviteCode: 'ACTIVE1' }),
      invitation({ id: 'revoked', inviteCode: 'REVOKED1', isActive: false, isValid: false }),
    ];
    renderTab();
    expect(screen.getByText('ACTIVE1')).toBeInTheDocument();
    expect(screen.queryByText('REVOKED1')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Inactive (1)' }));
    expect(screen.getByText('REVOKED1')).toBeInTheDocument();
  });

  it('an unlimited invite (API sends maxUses: null) renders in the active list (live bug: 0 >= null coerced true, filing it under Inactive)', () => {
    mocks.invitations = [
      invitation({ id: 'unlimited', inviteCode: 'UNLIM1', maxUses: null as unknown as number, useCount: 0, isActive: true, isValid: true }),
    ];
    renderTab();
    expect(screen.getByText('UNLIM1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Inactive/ })).toBeNull();
  });
});

describe('InvitesTab — inactive reason tags', () => {
  it('a revoked invite shows a Revoked tag in place of the expiry text', () => {
    mocks.invitations = [
      invitation({ id: 'r', inviteCode: 'REV1', isActive: false, isValid: false, expiresAt: '2026-12-01T00:00:00Z' }),
    ];
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Inactive (1)' }));
    expect(screen.getByText('Revoked')).toBeInTheDocument();
    expect(screen.queryByText(/Expires/)).toBeNull();
  });

  it('an expired invite shows an Expired tag, not the expiry date', () => {
    mocks.invitations = [
      invitation({ id: 'e', inviteCode: 'EXP1', isActive: true, isValid: false, expiresAt: '2020-01-01T00:00:00Z' }),
    ];
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Inactive (1)' }));
    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.queryByText(/Expires/)).toBeNull();
  });

  it('an exhausted invite shows a "Used up" tag', () => {
    mocks.invitations = [
      invitation({ id: 'x', inviteCode: 'USED1', isActive: true, isValid: false, maxUses: 3, useCount: 3 }),
    ];
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Inactive (1)' }));
    expect(screen.getByText('Used up')).toBeInTheDocument();
  });
});

describe('InvitesTab — "No active invites."', () => {
  it('shows the line above the create action when some invites exist but none are active', () => {
    mocks.invitations = [invitation({ id: 'r', isActive: false, isValid: false })];
    renderTab();
    expect(screen.getByText('No active invites.')).toBeInTheDocument();
    expect(screen.queryByText('No invitations yet. Create one to invite members.')).toBeNull();
  });

  it('does not show when there are active invites', () => {
    mocks.invitations = [invitation({ id: 'a' })];
    renderTab();
    expect(screen.queryByText('No active invites.')).toBeNull();
  });

  it('does not show (falls back to the totally-empty copy) when there are no invitations at all', () => {
    renderTab();
    expect(screen.queryByText('No active invites.')).toBeNull();
    expect(screen.getByText('No invitations yet. Create one to invite members.')).toBeInTheDocument();
  });
});

describe('InvitesTab — create form', () => {
  it('hidden by default; "+ Create Invitation Link" opens it', () => {
    renderTab();
    expect(screen.queryByRole('combobox', { name: 'Role' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '+ Create Invitation Link' }));
    expect(screen.getByRole('combobox', { name: 'Role' })).toBeInTheDocument();
  });

  it('default submit: member, 7 days, unlimited uses', async () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: '+ Create Invitation Link' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(mocks.createInvitation).toHaveBeenCalledWith('g1', {
      role: 'member', expiresInDays: 7, maxUses: undefined,
    }));
  });

  it('"Never expires" checked submits expiresInDays: null', async () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: '+ Create Invitation Link' }));
    fireEvent.click(checkboxByLabelText('Never expires'));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(mocks.createInvitation).toHaveBeenCalledWith('g1', {
      role: 'member', expiresInDays: null, maxUses: undefined,
    }));
  });

  it('unchecking "Unlimited uses" and entering 5 submits maxUses: 5', async () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: '+ Create Invitation Link' }));
    fireEvent.click(checkboxByLabelText('Unlimited uses'));
    const maxUsesInput = screen.getByLabelText('Max uses');
    fireEvent.change(maxUsesInput, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(mocks.createInvitation).toHaveBeenCalledWith('g1', {
      role: 'member', expiresInDays: 7, maxUses: 5,
    }));
  });

  it('lead appears in the role Select only for an owner', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: '+ Create Invitation Link' }));
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Role' }), { key: 'Enter' });
    expect(screen.getByRole('option', { name: 'Lead' })).toBeInTheDocument();
  });

  it('a non-owner lead never sees the Lead role option', () => {
    mocks.userRole = 'lead';
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: '+ Create Invitation Link' }));
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Role' }), { key: 'Enter' });
    expect(screen.queryByRole('option', { name: 'Lead' })).toBeNull();
  });

  it('every field has a proper label association (role Select, days/max-uses NumberInput, both Checkboxes)', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: '+ Create Invitation Link' }));
    expect(screen.getByRole('combobox', { name: 'Role' })).toBeInTheDocument();
    expect(screen.getByLabelText('Expires in (days)')).toBeInTheDocument();
    expect(checkboxByLabelText('Never expires')).toBeInTheDocument();
    expect(checkboxByLabelText('Unlimited uses')).toBeInTheDocument();
    fireEvent.click(checkboxByLabelText('Unlimited uses'));
    expect(screen.getByLabelText('Max uses')).toBeInTheDocument();
  });
});

describe('InvitesTab — ?create=1', () => {
  it('opens the form on mount', () => {
    renderTab({ createRequested: true });
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });

  it('strips the create param with replace, so it never reappears in history', () => {
    renderTab({ createRequested: true }, '/group/abc/recruit?rtab=invites&create=1');
    expect(screen.getByTestId('search').textContent).not.toContain('create=1');
    expect(screen.getByTestId('search').textContent).toContain('rtab=invites');
  });
});
