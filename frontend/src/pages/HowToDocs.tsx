/**
 * How-To Guides - Task-oriented guides for common tasks
 *
 * Restructured from CommonTasksDocs.tsx to focus on "How do I...?" questions.
 * Technical details moved to UnderstandingPriority.tsx.
 *
 * Accessible at: /docs/how-to
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Check, ExternalLink, ListChecks } from 'lucide-react';
import { LinkCard, NavSidebar } from '../components/docs';

// Navigation items
const NAV_GROUPS = [
  {
    label: 'Gear & BiS',
    items: [
      { id: 'import-bis', label: 'Import BiS' },
      { id: 'track-gear', label: 'Track gear' },
      { id: 'checkboxes', label: 'Checkbox states' },
    ],
  },
  {
    label: 'Loot Tracking',
    items: [
      { id: 'log-loot', label: 'Log a drop' },
      { id: 'quick-log', label: 'Use Quick Log' },
      { id: 'weapon-priority', label: 'Set weapon priority' },
    ],
  },
  {
    label: 'Books & Pages',
    items: [
      { id: 'mark-clears', label: 'Mark clears' },
      { id: 'track-balances', label: 'Track balances' },
    ],
  },
  {
    label: 'Sharing & Access',
    items: [
      { id: 'invite-members', label: 'Invite members' },
      { id: 'share-codes', label: 'Use share codes' },
      { id: 'permissions', label: 'Permissions' },
    ],
  },
];

const NAV_SECTIONS = NAV_GROUPS.flatMap((group) => group.items);

// Components
function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-12 scroll-mt-20">
      <h2 className="text-2xl font-semibold text-accent mb-6 pb-2 border-b border-border-default">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 mb-4">
      <div className="w-7 h-7 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold text-xs shrink-0">
        {number}
      </div>
      <div className="flex-1 pt-0.5">
        <div className="font-medium text-text-primary mb-1 text-sm">{title}</div>
        <div className="text-text-secondary text-sm">{children}</div>
      </div>
    </div>
  );
}

function InfoBox({
  type = 'info',
  title,
  children,
}: {
  type?: 'info' | 'tip' | 'warning';
  title?: string;
  children: React.ReactNode;
}) {
  const colors = {
    info: 'bg-status-info/10 border-status-info/30 text-status-info',
    tip: 'bg-status-success/10 border-status-success/30 text-status-success',
    warning: 'bg-status-warning/10 border-status-warning/30 text-status-warning',
  };

  return (
    <div className={`p-4 rounded-lg border ${colors[type]} my-4`}>
      {title && <h4 className="font-medium mb-2">{title}</h4>}
      <div className="text-text-secondary text-sm">{children}</div>
    </div>
  );
}

function PermissionBadge({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <span className="inline-flex items-center gap-1 text-status-success text-sm">
      <Check className="w-3.5 h-3.5" />
    </span>
  ) : (
    <span className="text-text-muted text-sm">-</span>
  );
}

export default function HowToDocs() {
  const location = useLocation();
  const [activeSection, setActiveSection] = useState(() => {
    const hash = window.location.hash;
    if (hash) {
      const id = hash.slice(1);
      if (NAV_SECTIONS.some((s) => s.id === id)) return id;
    }
    return 'import-bis';
  });
  const isScrollingRef = useRef(false);
  const scrollEndTimeoutRef = useRef<number | null>(null);

  const handleNavClick = useCallback((sectionId: string) => {
    setActiveSection(sectionId);
    isScrollingRef.current = true;
    window.history.replaceState(null, '', `#${sectionId}`);
  }, []);

  useEffect(() => {
    if (location.hash) {
      const sectionId = location.hash.slice(1);
      const section = NAV_SECTIONS.find((s) => s.id === sectionId);
      if (section) {
        setTimeout(() => {
          document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } else {
      // No hash - scroll to top to prevent browser scroll restoration from jumping to wrong section
      window.scrollTo(0, 0);
    }
  }, [location.hash]);

  useEffect(() => {
    const handleScroll = () => {
      if (isScrollingRef.current) {
        if (scrollEndTimeoutRef.current) clearTimeout(scrollEndTimeoutRef.current);
        scrollEndTimeoutRef.current = window.setTimeout(() => {
          isScrollingRef.current = false;
        }, 150);
        return;
      }

      const threshold = 120;
      const viewportHeight = window.innerHeight;
      const sections = NAV_SECTIONS.map((s) => ({
        id: s.id,
        element: document.getElementById(s.id),
      })).filter((s) => s.element);

      // Check if at bottom of page - select last section
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const documentHeight = document.documentElement.scrollHeight;
      const maxScroll = documentHeight - viewportHeight;
      const scrollRemaining = maxScroll - scrollTop;

      // If less than 100px of scroll remaining, we're at the bottom
      if (scrollRemaining < 100 && sections.length > 0) {
        const lastSection = sections[sections.length - 1];
        setActiveSection((prev) => {
          if (prev !== lastSection.id) {
            window.history.replaceState(null, '', `#${lastSection.id}`);
          }
          return lastSection.id;
        });
        return;
      }

      let bestSection: string | null = null;
      let bestTop = -Infinity;

      for (const section of sections) {
        if (section.element) {
          const rect = section.element.getBoundingClientRect();
          if (rect.top <= threshold && rect.top > bestTop) {
            bestTop = rect.top;
            bestSection = section.id;
          }
        }
      }

      if (!bestSection) {
        for (const section of sections) {
          if (section.element) {
            const rect = section.element.getBoundingClientRect();
            if (rect.top >= 0 && rect.top < viewportHeight) {
              bestSection = section.id;
              break;
            }
          }
        }
      }

      setActiveSection((prev) => {
        const newSection = bestSection || 'import-bis';
        if (prev !== newSection) {
          window.history.replaceState(null, '', `#${newSection}`);
        }
        return newSection;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollEndTimeoutRef.current) clearTimeout(scrollEndTimeoutRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-surface-base">
      {/* Header */}
      <header className="bg-surface-raised border-b border-border-default">
        <div className="max-w-[120rem] mx-auto px-6 lg:px-8 py-8">
          <div className="flex items-center gap-2 text-sm text-text-muted mb-4">
            <Link to="/docs" className="hover:text-accent transition-colors">
              Documentation
            </Link>
            <span>/</span>
            <span className="text-text-secondary">How-To Guides</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center">
              <ListChecks className="w-7 h-7 text-accent" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-accent">How-To Guides</h1>
              <p className="text-text-secondary mt-1">Step-by-step guides for common tasks</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-[120rem] mx-auto px-6 lg:px-8 py-8 flex gap-8">
        <NavSidebar groups={NAV_GROUPS} activeSection={activeSection} onSectionClick={handleNavClick} />

        <main className="flex-1 min-w-0">
          {/* Import BiS */}
          <Section id="import-bis" title="Import your BiS set">
            <p className="text-text-secondary mb-4">
              BiS (Best-in-Slot) tells the app what gear you need. Import it to enable priority
              calculations and progress tracking.
            </p>

            <h3 className="text-lg font-medium text-text-primary mb-4">From XIVGear or Etro</h3>

            <Step number={1} title="Get your gearset link">
              <p>
                Open your set on{' '}
                <a
                  href="https://xivgear.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline inline-flex items-center gap-1"
                >
                  XIVGear <ExternalLink className="w-3 h-3" />
                </a>{' '}
                or{' '}
                <a
                  href="https://etro.gg"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline inline-flex items-center gap-1"
                >
                  Etro <ExternalLink className="w-3 h-3" />
                </a>{' '}
                and copy the URL.
              </p>
            </Step>

            <Step number={2} title="Open the import modal">
              <p>
                Click the menu on your player card (⋮) and select <strong>Import BiS</strong>. Cards
                without BiS also show an "Import BiS" button directly.
              </p>
            </Step>

            <Step number={3} title="Paste and import">
              <p>
                Paste the URL and click <strong>Import</strong>. The app detects the source
                automatically.
              </p>
            </Step>

            <h3 className="text-lg font-medium text-text-primary mb-4 mt-8">From presets</h3>

            <p className="text-text-secondary mb-4">
              Don't have a custom set? Use a preset from The Balance.
            </p>

            <Step number={1} title="Open import and switch to Presets tab">
              <p>In the import modal, click the Presets tab instead of URL.</p>
            </Step>

            <Step number={2} title="Choose a preset">
              <p>
                Select from available presets for your job. Each shows GCD speed to help you pick.
              </p>
            </Step>

            <InfoBox type="tip">
              Presets are curated by The Balance community and updated each tier. They're a solid
              starting point for any job.
            </InfoBox>
          </Section>

          {/* Track Gear */}
          <Section id="track-gear" title="Track your gear progress">
            <p className="text-text-secondary mb-4">
              Use checkboxes on each slot to track what you've acquired. Your progress shows as a
              percentage on the player card.
            </p>

            <Step number={1} title="Find a slot to update">
              <p>Look at your gear table. Each row shows a slot with its BiS item and a checkbox.</p>
            </Step>

            <Step number={2} title="Check the box when you get the item">
              <p>
                Click the checkbox to mark it complete. For tome pieces, you'll see intermediate
                states (see Checkbox States below).
              </p>
            </Step>

            <Step number={3} title="Watch your progress update">
              <p>
                Your iLv and completion percentage update automatically. The Loot Priority tab also
                reflects your new gear state.
              </p>
            </Step>

            <InfoBox type="info">
              When you log loot via Quick Log, checkboxes update automatically. You only need to
              manually check for gear acquired outside the tool (books, etc.).
            </InfoBox>
          </Section>

          {/* Checkbox States */}
          <Section id="checkboxes" title="Understand checkbox states">
            <p className="text-text-secondary mb-6">
              Checkboxes have different states depending on whether BiS is a raid drop or augmented
              tome piece.
            </p>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <h3 className="font-medium text-text-primary mb-3">Raid BiS slots</h3>
                <p className="text-sm text-text-secondary mb-3">
                  For weapon and some accessories where BiS drops directly from savage:
                </p>
                <ul className="text-sm text-text-secondary space-y-2">
                  <li className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-border-default rounded" />
                    <span>Unchecked = Don't have it</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-accent rounded flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </span>
                    <span>Checked = Got the raid drop</span>
                  </li>
                </ul>
              </div>

              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <h3 className="font-medium text-text-primary mb-3">Tome BiS slots</h3>
                <p className="text-sm text-text-secondary mb-3">
                  For armor and accessories where BiS is augmented tomestone:
                </p>
                <ul className="text-sm text-text-secondary space-y-2">
                  <li className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-border-default rounded" />
                    <span>Unchecked = Don't have tome piece</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-accent bg-accent/30 rounded" />
                    <span>Half = Have tome, not augmented</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-accent rounded flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </span>
                    <span>Full = Augmented (BiS complete)</span>
                  </li>
                </ul>
              </div>
            </div>

            <InfoBox type="tip">
              Click once to half-check (tome acquired), click again to fully check (augmented).
              Click a third time to uncheck.
            </InfoBox>
          </Section>

          {/* Log Loot */}
          <Section id="log-loot" title="Log a loot drop">
            <p className="text-text-secondary mb-4">
              Recording drops keeps history accurate and updates priority calculations.
            </p>

            <Step number={1} title="Go to the Loot Priority tab">
              <p>This shows priority lists for each item from each floor.</p>
            </Step>

            <Step number={2} title="Select the floor">
              <p>Click the floor button (M9S, M10S, etc.) that matches where the drop came from.</p>
            </Step>

            <Step number={3} title="Click the item that dropped">
              <p>
                Find the item in the priority list and click it. This opens the Quick Log modal with
                the highest-priority player pre-selected.
              </p>
            </Step>

            <Step number={4} title="Confirm and save">
              <p>
                Verify or change the recipient, then click <strong>Log</strong>. The player's gear
                checkbox updates automatically.
              </p>
            </Step>

            <div className="mt-6">
              <LinkCard
                href="/docs/understanding-priority"
                title="Understanding priority"
                description="Learn how priority scores are calculated"
              />
            </div>
          </Section>

          {/* Quick Log */}
          <Section id="quick-log" title="Use Quick Log">
            <p className="text-text-secondary mb-4">
              Quick Log is the fastest way to record drops during raid. It pre-fills most fields so
              you just confirm and save.
            </p>

            <h3 className="text-lg font-medium text-text-primary mb-4">What Quick Log does</h3>

            <ul className="list-disc list-inside text-text-secondary space-y-2 mb-6">
              <li>Pre-selects the highest priority player for that item</li>
              <li>Auto-fills the current week</li>
              <li>Updates the player's gear checkbox when you save</li>
              <li>Adds an entry to the loot history</li>
            </ul>

            <h3 className="text-lg font-medium text-text-primary mb-4">
              When to use manual logging instead
            </h3>

            <p className="text-text-secondary mb-4">
              Use the History tab's manual log form when you need to:
            </p>

            <ul className="list-disc list-inside text-text-secondary space-y-1">
              <li>Log drops from a previous week</li>
              <li>Correct a mistake in loot history</li>
              <li>Log materials (twine, glaze, solvent)</li>
            </ul>
          </Section>

          {/* Weapon Priority */}
          <Section id="weapon-priority" title="Set your weapon priority">
            <p className="text-text-secondary mb-4">
              Weapons use a separate priority system. Set your main job and alts so the static knows
              your weapon preferences.
            </p>

            <Step number={1} title="Open your player card menu">
              <p>Right-click or click the ⋮ menu on your card.</p>
            </Step>

            <Step number={2} title="Select Weapon Priority">
              <p>Opens the weapon priority editor.</p>
            </Step>

            <Step number={3} title="Set your main job first">
              <p>
                Your first entry is your main job. This gets highest priority for weapons across the
                static.
              </p>
            </Step>

            <Step number={4} title="Add alt jobs in order">
              <p>
                Add any alt jobs you'd want weapons for. Drag to reorder. Alts are only considered
                after all mains have weapons.
              </p>
            </Step>

            <InfoBox type="info">
              The weapon coffer from floor 4 can be opened on any job. Your priority list tells
              leads which job you'd open it on.
            </InfoBox>
          </Section>

          {/* Mark Clears */}
          <Section id="mark-clears" title="Mark floor clears">
            <p className="text-text-secondary mb-4">
              Marking clears tracks book earnings for the page exchange system. Each clear gives +1
              book of that floor's type.
            </p>

            <Step number={1} title="Go to the History tab">
              <p>Find it next to Loot Priority on your static's page.</p>
            </Step>

            <Step number={2} title="Click Mark Floor Cleared">
              <p>Opens a dialog to record the clear.</p>
            </Step>

            <Step number={3} title="Select floor and week">
              <p>Choose which floor was cleared and which week (defaults to current).</p>
            </Step>

            <Step number={4} title="Check off players who were present">
              <p>
                Only checked players get credit. Useful when you have subs or someone misses a
                clear.
              </p>
            </Step>

            <div className="bg-surface-card border border-border-subtle rounded-lg p-4 mt-6">
              <h3 className="font-medium text-text-primary mb-3">Book types by floor</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-default">
                      <th className="text-left py-2 text-text-muted font-medium">Floor</th>
                      <th className="text-left py-2 text-text-muted font-medium">Book</th>
                      <th className="text-left py-2 text-text-muted font-medium">Exchanges for</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    <tr>
                      <td className="py-2 text-text-secondary">Floor 1</td>
                      <td className="py-2 text-accent">Book I</td>
                      <td className="py-2 text-text-secondary">Accessories (3 books)</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-text-secondary">Floor 2</td>
                      <td className="py-2 text-accent">Book II</td>
                      <td className="py-2 text-text-secondary">Head/Hands/Feet (4 books)</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-text-secondary">Floor 3</td>
                      <td className="py-2 text-accent">Book III</td>
                      <td className="py-2 text-text-secondary">Body/Legs (6 books)</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-text-secondary">Floor 4</td>
                      <td className="py-2 text-accent">Book IV</td>
                      <td className="py-2 text-text-secondary">Weapon (8 books)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </Section>

          {/* Track Balances */}
          <Section id="track-balances" title="Track page balances">
            <p className="text-text-secondary mb-4">
              Page balances show how many books each player has accumulated minus what they've
              spent.
            </p>

            <Step number={1} title="Go to the History tab">
              <p>Find the Page Balances panel showing each player's book counts.</p>
            </Step>

            <Step number={2} title="Read the balances">
              <p>
                Each column (I, II, III, IV) shows books of that type. Positive means books
                available; negative means they've spent more than earned (borrowed ahead).
              </p>
            </Step>

            <InfoBox type="tip">
              Balance = Books Earned (from clears) - Books Spent (on gear exchanges). The app tracks
              this automatically as you mark clears and log book exchanges.
            </InfoBox>
          </Section>

          {/* Invite Members */}
          <Section id="invite-members" title="Invite members to your static">
            <p className="text-text-secondary mb-4">
              Create invite links to add teammates. You control what role they join with and how
              long the link stays valid.
            </p>

            <Step number={1} title="Open Static Settings">
              <p>Click the gear icon next to your static name.</p>
            </Step>

            <Step number={2} title="Go to the Invitations tab">
              <p>Shows existing invites and lets you create new ones.</p>
            </Step>

            <Step number={3} title="Click Create Invite">
              <p>Configure the invite:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>
                  <strong>Role</strong>: Member (can edit own card) or Lead (can edit all)
                </li>
                <li>
                  <strong>Expiration</strong>: 1 hour to 7 days, or never
                </li>
                <li>
                  <strong>Max uses</strong>: Limit how many people can use it
                </li>
              </ul>
            </Step>

            <Step number={4} title="Share the link">
              <p>Copy and send to your teammates via Discord or wherever you coordinate.</p>
            </Step>

            <InfoBox type="info">
              After joining, members can claim their player card to link it to their account. You
              can also assign cards from the player menu.
            </InfoBox>
          </Section>

          {/* Share Codes */}
          <Section id="share-codes" title="Use share codes">
            <p className="text-text-secondary mb-4">
              Share codes give read-only access. Great for showing progress publicly or to
              applicants without giving edit access.
            </p>

            <h3 className="text-lg font-medium text-text-primary mb-4">How to share</h3>

            <Step number={1} title="Find your share code">
              <p>
                It's displayed in the static header—an 8-character code like "ABC12345". Click to
                copy.
              </p>
            </Step>

            <Step number={2} title="Share the link">
              <p>
                The URL format is <code className="text-accent">xiv-planner.com/group/ABC12345</code>
                . Anyone with this link can view your static.
              </p>
            </Step>

            <h3 className="text-lg font-medium text-text-primary mb-4 mt-8">
              Share codes vs invite links
            </h3>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <h4 className="font-medium text-text-primary mb-2">Share code</h4>
                <ul className="text-sm text-text-secondary space-y-1">
                  <li>Read-only (Viewer role)</li>
                  <li>Never expires</li>
                  <li>Unlimited uses</li>
                  <li>Good for public sharing</li>
                </ul>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <h4 className="font-medium text-text-primary mb-2">Invite link</h4>
                <ul className="text-sm text-text-secondary space-y-1">
                  <li>Grants Member or Lead role</li>
                  <li>Configurable expiration</li>
                  <li>Can limit uses</li>
                  <li>Good for adding teammates</li>
                </ul>
              </div>
            </div>

            <InfoBox type="tip" title="Tier-specific sharing">
              Shift+click the share code to copy a URL with a specific tier pre-selected. Handy when
              sharing progress for a particular raid tier.
            </InfoBox>
          </Section>

          {/* Permissions */}
          <Section id="permissions" title="Understand permissions">
            <p className="text-text-secondary mb-6">
              Four roles with different access levels. Your role is shown as a badge in the static
              header.
            </p>

            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default">
                    <th className="text-left py-2 text-text-muted font-medium">Action</th>
                    <th className="text-center py-2 text-text-muted font-medium w-16">Owner</th>
                    <th className="text-center py-2 text-text-muted font-medium w-16">Lead</th>
                    <th className="text-center py-2 text-text-muted font-medium w-16">Member</th>
                    <th className="text-center py-2 text-text-muted font-medium w-16">Viewer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  <tr>
                    <td className="py-2 text-text-secondary">View static and gear</td>
                    <td className="text-center">
                      <PermissionBadge allowed />
                    </td>
                    <td className="text-center">
                      <PermissionBadge allowed />
                    </td>
                    <td className="text-center">
                      <PermissionBadge allowed />
                    </td>
                    <td className="text-center">
                      <PermissionBadge allowed />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-text-secondary">Edit own claimed card</td>
                    <td className="text-center">
                      <PermissionBadge allowed />
                    </td>
                    <td className="text-center">
                      <PermissionBadge allowed />
                    </td>
                    <td className="text-center">
                      <PermissionBadge allowed />
                    </td>
                    <td className="text-center">
                      <PermissionBadge allowed={false} />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-text-secondary">Edit any player card</td>
                    <td className="text-center">
                      <PermissionBadge allowed />
                    </td>
                    <td className="text-center">
                      <PermissionBadge allowed />
                    </td>
                    <td className="text-center">
                      <PermissionBadge allowed={false} />
                    </td>
                    <td className="text-center">
                      <PermissionBadge allowed={false} />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-text-secondary">Add/remove players</td>
                    <td className="text-center">
                      <PermissionBadge allowed />
                    </td>
                    <td className="text-center">
                      <PermissionBadge allowed />
                    </td>
                    <td className="text-center">
                      <PermissionBadge allowed={false} />
                    </td>
                    <td className="text-center">
                      <PermissionBadge allowed={false} />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-text-secondary">Log loot and clears</td>
                    <td className="text-center">
                      <PermissionBadge allowed />
                    </td>
                    <td className="text-center">
                      <PermissionBadge allowed />
                    </td>
                    <td className="text-center">
                      <PermissionBadge allowed={false} />
                    </td>
                    <td className="text-center">
                      <PermissionBadge allowed={false} />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-text-secondary">Create invites</td>
                    <td className="text-center">
                      <PermissionBadge allowed />
                    </td>
                    <td className="text-center">
                      <PermissionBadge allowed />
                    </td>
                    <td className="text-center">
                      <PermissionBadge allowed={false} />
                    </td>
                    <td className="text-center">
                      <PermissionBadge allowed={false} />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-text-secondary">Change static settings</td>
                    <td className="text-center">
                      <PermissionBadge allowed />
                    </td>
                    <td className="text-center">
                      <PermissionBadge allowed={false} />
                    </td>
                    <td className="text-center">
                      <PermissionBadge allowed={false} />
                    </td>
                    <td className="text-center">
                      <PermissionBadge allowed={false} />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-text-secondary">Delete static</td>
                    <td className="text-center">
                      <PermissionBadge allowed />
                    </td>
                    <td className="text-center">
                      <PermissionBadge allowed={false} />
                    </td>
                    <td className="text-center">
                      <PermissionBadge allowed={false} />
                    </td>
                    <td className="text-center">
                      <PermissionBadge allowed={false} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-lg font-medium text-text-primary mb-4">Changing roles</h3>

            <p className="text-text-secondary mb-4">
              Only the owner can change member roles. Go to Static Settings → Members, find the
              person, and select their new role from the dropdown.
            </p>

            <InfoBox type="info">
              To become a lead, ask your static owner to promote you. Ownership can only be
              transferred by the current owner.
            </InfoBox>
          </Section>
        </main>
      </div>
    </div>
  );
}
