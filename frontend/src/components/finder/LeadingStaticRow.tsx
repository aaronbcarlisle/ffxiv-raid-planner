/**
 * LeadingStaticRow — "Leading a static?" (R-SF-J). Renders only when signed
 * in; `fetchGroups()` is never called for a guest (F1).
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../primitives';
import { Select } from '../ui/Select';
import { SetupWizard } from '../wizard';
import { useModal } from '../../hooks/useModal';
import { useAuthStore } from '../../stores/authStore';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { useSettingsPanelStore } from '../../stores/settingsPanelStore';

export function LeadingStaticRow() {
  const user = useAuthStore((s) => s.user);
  const groups = useStaticGroupStore((s) => s.groups);
  const fetchGroups = useStaticGroupStore((s) => s.fetchGroups);
  const openSettings = useSettingsPanelStore((s) => s.open);
  const navigate = useNavigate();
  const wizard = useModal();

  useEffect(() => {
    if (user && groups.length === 0) fetchGroups();
  }, [user, groups.length, fetchGroups]);

  if (!user) return null;

  const led = groups.filter((g) => g.userRole === 'owner' || g.userRole === 'lead');

  const postListing = (shareCode: string) => {
    // `rcsub=listing` goes straight in the URL: RecruitmentTab's sub-tab is
    // URL-derived (useUrlTabState), and a fresh cross-static navigation's own
    // tab/tier-establishing effects settle the URL after this call returns —
    // openSettings's `recruitmentSection` alone loses that race live (browser
    // walk, R-SF-J). Both still run: the store drives `tab`, the URL drives
    // `rcsub`, and RecruitmentTab reads whichever gets there.
    navigate(`/group/${shareCode}?rcsub=listing`);
    openSettings({ tab: 'recruitment', section: 'listing' });
  };

  return (
    <div data-testid="leading-static-row" className="bg-surface-card border border-border-default rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-text-primary">Leading a static?</h2>
        <p className="text-xs text-text-muted mt-0.5">Post a recruitment listing so matching players can find you.</p>
      </div>
      {led.length === 0 ? (
        <Button variant="secondary" size="sm" onClick={wizard.open}>Create a static</Button>
      ) : led.length === 1 ? (
        <Button variant="secondary" size="sm" onClick={() => postListing(led[0].shareCode)}>Post a listing</Button>
      ) : (
        <div className="w-56 flex-shrink-0">
          <Select
            value=""
            onChange={postListing}
            options={led.map((g) => ({ value: g.shareCode, label: g.name }))}
            placeholder="Choose a static"
            aria-label="Choose a static"
          />
        </div>
      )}
      <SetupWizard
        isOpen={wizard.isOpen}
        onClose={wizard.close}
        onComplete={(_groupId, shareCode) => navigate(`/group/${shareCode}`)}
      />
    </div>
  );
}
