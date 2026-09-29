/**
 * LeadingStaticRow — "Leading a static?" (R-SF-J). Renders only when signed
 * in.
 *
 * Reads `groups` but never fetches them itself: `AppChrome` (mounted by
 * `Layout`'s v2 branch on every v2 route, including this page) already runs
 * the identical guarded cold-load fetch (`if (user && groups.length === 0)
 * fetchGroups()`, AppChrome.tsx:115-125) to populate the rail avatars, so a
 * second copy here duplicated `GET /api/static-groups` on every cold load.
 * `stores/*` is read-only, so this can't add its own in-flight guard either
 * — it just relies on the store AppChrome already keeps warm (PR-review fix
 * wave item 6).
 *
 * "Post a listing" under V2 is one navigation to the Recruiting route's Listing
 * tab (R-RH-N); the route owns that section, and its interim Listing
 * placeholder hands off to the dock itself (R-RH-J). `/discover` is not
 * shell-gated, so a legacy-shell user (still the default) reaches this row too:
 * for them the route only redirects back to the static, so they keep the
 * pre-RH1b pair — navigate to `?rcsub=listing` and open the Settings dock on
 * Recruitment → Listing.
 */
import { useNavigate } from 'react-router-dom';
import { Button } from '../primitives';
import { Select } from '../ui/Select';
import { SetupWizard } from '../wizard';
import { useModal } from '../../hooks/useModal';
import { useResolvedShell } from '../../lib/shellPreference';
import { useAuthStore } from '../../stores/authStore';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { useSettingsPanelStore } from '../../stores/settingsPanelStore';
import { recruitUrl } from '../recruit/recruitTabs';

export function LeadingStaticRow() {
  const user = useAuthStore((s) => s.user);
  const groups = useStaticGroupStore((s) => s.groups);
  const openSettings = useSettingsPanelStore((s) => s.open);
  const shell = useResolvedShell();
  const navigate = useNavigate();
  const wizard = useModal();

  if (!user) return null;

  const led = groups.filter((g) => g.userRole === 'owner' || g.userRole === 'lead');

  const postListing = (shareCode: string) => {
    if (shell === 'v2') {
      navigate(recruitUrl(shareCode, 'listing'));
      return;
    }
    // Legacy: `rcsub=listing` goes straight in the URL: RecruitmentTab's
    // sub-tab is URL-derived (useUrlTabState), and a fresh cross-static
    // navigation's own tab/tier-establishing effects settle the URL after this
    // call returns — openSettings's `recruitmentSection` alone loses that race
    // live (browser walk, R-SF-J). Both still run: the store drives `tab`, the
    // URL drives `rcsub`, and RecruitmentTab reads whichever gets there.
    navigate(`/group/${shareCode}?rcsub=listing`);
    openSettings({ tab: 'recruitment', section: 'listing' });
  };

  return (
    <div data-testid="leading-static-row" className="mt-6 bg-surface-card border border-border-default rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap">
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
            id="leading-static-choose"
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
