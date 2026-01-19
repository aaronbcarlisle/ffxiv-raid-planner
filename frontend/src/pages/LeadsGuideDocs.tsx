/**
 * Leads Guide - Step-by-step guide for static owners and leads
 *
 * Covers creating statics, setting up tiers, inviting members, and managing loot.
 * Concise with links to Common Tasks for detailed explanations.
 *
 * Accessible at: /docs/guides/leads
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ExternalLink, Check, ArrowRight } from 'lucide-react';

// Navigation items
const NAV_GROUPS = [
  {
    label: 'Setup',
    items: [
      { id: 'overview', label: 'Overview' },
      { id: 'login', label: '1. Log In' },
      { id: 'create-static', label: '2. Create Static' },
    ],
  },
  {
    label: 'Roster',
    items: [
      { id: 'import-bis', label: '3. Import BiS' },
      { id: 'invite-members', label: '4. Invite Members' },
    ],
  },
  {
    label: 'Loot Management',
    items: [
      { id: 'loot-priority', label: '5. Configure Priority' },
      { id: 'logging-loot', label: '6. Log Loot' },
      { id: 'track-clears', label: '7. Track Clears' },
    ],
  },
  {
    label: 'Reference',
    items: [
      { id: 'permissions', label: 'Your Permissions' },
      { id: 'next-steps', label: 'Next Steps' },
    ],
  },
];

const NAV_SECTIONS = NAV_GROUPS.flatMap(group => group.items);

// Components
function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-12 scroll-mt-20">
      <h2 className="text-2xl font-semibold text-accent mb-6 pb-2 border-b border-border-default">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 mb-6">
      <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold text-sm shrink-0">
        {number}
      </div>
      <div className="flex-1 pt-0.5">
        <div className="font-medium text-text-primary mb-2">{title}</div>
        <div className="text-text-secondary text-sm space-y-2">{children}</div>
      </div>
    </div>
  );
}

function InfoBox({ type = 'info', title, children }: { type?: 'info' | 'tip' | 'warning'; title?: string; children: React.ReactNode }) {
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

function LinkCard({ href, title, description }: { href: string; title: string; description: string }) {
  const isExternal = href.startsWith('http');
  const className = "group flex items-center gap-3 p-3 rounded-lg bg-surface-card border border-border-subtle hover:border-accent/50 transition-colors";

  const content = (
    <>
      <div className="flex-1">
        <div className="font-medium text-text-primary group-hover:text-accent transition-colors flex items-center gap-1">
          {title}
          {isExternal && <ExternalLink className="w-3 h-3" />}
        </div>
        <div className="text-sm text-text-muted">{description}</div>
      </div>
      <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors" />
    </>
  );

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {content}
      </a>
    );
  }

  return (
    <Link to={href} className={className}>
      {content}
    </Link>
  );
}

function PermissionBadge({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <span className="inline-flex items-center gap-1 text-status-success text-sm">
      <Check className="w-4 h-4" /> Yes
    </span>
  ) : (
    <span className="text-text-muted text-sm">No</span>
  );
}

// Sidebar Navigation
function NavSidebar({ activeSection, onSectionClick }: { activeSection: string; onSectionClick: (id: string) => void }) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [scrollState, setScrollState] = useState({ top: true, bottom: false });
  const scrollContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const handleScroll = () => {
        const { scrollTop, scrollHeight, clientHeight } = node;
        setScrollState({
          top: scrollTop < 10,
          bottom: scrollTop + clientHeight >= scrollHeight - 10,
        });
      };
      node.addEventListener('scroll', handleScroll);
      handleScroll();
    }
  }, []);

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const handleClick = (id: string) => {
    onSectionClick(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav className="sticky top-16 w-56 shrink-0 hidden lg:block self-start h-fit z-30">
      <div className="relative bg-surface-card border border-border-subtle rounded-lg">
        <div className={`absolute top-0 left-0 right-0 h-6 rounded-t-lg pointer-events-none z-10 bg-gradient-to-b from-surface-card to-transparent transition-opacity duration-150 ${scrollState.top ? 'opacity-0' : 'opacity-100'}`} />
        <div ref={scrollContainerRef} className="p-3 max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-thin">
          {NAV_GROUPS.map((group, groupIndex) => {
            const isCollapsed = collapsedGroups.has(group.label);
            return (
              <div key={group.label} className={groupIndex > 0 ? 'mt-3' : ''}>
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between text-[9px] font-semibold text-text-muted/70 uppercase tracking-[0.1em] mb-1 px-1 py-0.5 rounded hover:text-text-muted hover:bg-surface-interactive cursor-pointer"
                >
                  <span>{group.label}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`} />
                </button>
                {!isCollapsed && (
                  <ul className="space-y-px">
                    {group.items.map((section) => (
                      <li key={section.id}>
                        <button
                          onClick={() => handleClick(section.id)}
                          className={`w-full text-left pl-3 pr-2 py-1.5 text-[13px] rounded transition-colors ${
                            activeSection === section.id
                              ? 'bg-accent/10 text-accent font-medium'
                              : 'text-text-secondary hover:text-text-primary hover:bg-surface-interactive'
                          }`}
                        >
                          {section.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
        <div className={`absolute bottom-0 left-0 right-0 h-6 rounded-b-lg pointer-events-none z-10 bg-gradient-to-t from-surface-card to-transparent transition-opacity duration-150 ${scrollState.bottom ? 'opacity-0' : 'opacity-100'}`} />
      </div>
    </nav>
  );
}

export default function LeadsGuideDocs() {
  const location = useLocation();
  // Initialize from URL hash if present
  const [activeSection, setActiveSection] = useState(() => {
    const hash = window.location.hash;
    if (hash) {
      const id = hash.slice(1);
      if (NAV_SECTIONS.some(s => s.id === id)) return id;
    }
    return 'overview';
  });
  const isScrollingRef = useRef(false);
  const scrollEndTimeoutRef = useRef<number | null>(null);

  const handleNavClick = useCallback((sectionId: string) => {
    setActiveSection(sectionId);
    isScrollingRef.current = true;
    // Update URL hash for shareable links
    window.history.replaceState(null, '', `#${sectionId}`);
  }, []);

  // Handle URL hash scrolling on mount/change
  useEffect(() => {
    if (location.hash) {
      const sectionId = location.hash.slice(1); // Remove #
      const section = NAV_SECTIONS.find(s => s.id === sectionId);
      if (section) {
        // State is already set via initializer or handleNavClick
        setTimeout(() => {
          document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  }, [location.hash]);

  useEffect(() => {
    const handleScroll = () => {
      if (isScrollingRef.current) {
        if (scrollEndTimeoutRef.current) clearTimeout(scrollEndTimeoutRef.current);
        scrollEndTimeoutRef.current = window.setTimeout(() => { isScrollingRef.current = false; }, 150);
        return;
      }

      const threshold = 120;
      const sections = NAV_SECTIONS.map(s => ({ id: s.id, element: document.getElementById(s.id) })).filter(s => s.element);
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
            if (rect.top >= 0 && rect.top < window.innerHeight) {
              bestSection = section.id;
              break;
            }
          }
        }
      }

      setActiveSection(prev => {
        const newSection = bestSection || 'overview';
        if (prev !== newSection) {
          // Update URL hash when active section changes from scroll
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
          <div className="flex items-center gap-2 text-sm text-text-muted mb-2">
            <Link to="/docs" className="hover:text-accent transition-colors">Documentation</Link>
            <span>/</span>
            <Link to="/docs/getting-started" className="hover:text-accent transition-colors">Getting Started</Link>
            <span>/</span>
            <span className="text-text-secondary">For Leads</span>
          </div>
          <h1 className="text-3xl font-bold text-accent">Guide for Static Leads</h1>
          <p className="text-text-secondary mt-2">
            Create your static, set up your roster, and start tracking loot
          </p>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-[120rem] mx-auto px-6 lg:px-8 py-8 flex gap-8">
        <NavSidebar activeSection={activeSection} onSectionClick={handleNavClick} />

        <main className="flex-1 min-w-0">
          {/* Overview */}
          <Section id="overview" title="Overview">
            <p className="text-text-secondary mb-6">
              As a static lead, you'll set up the infrastructure for your raid group. The new Setup
              Wizard makes this quick and easy - just follow the guided steps to create your static
              with your full roster in one flow.
            </p>

            <div className="bg-surface-card border border-border-subtle rounded-lg p-4 mb-6">
              <h3 className="font-medium text-text-primary mb-3">What you'll set up:</h3>
              <ol className="list-decimal list-inside text-text-secondary space-y-1 text-sm">
                <li>Create your static with the Setup Wizard (name, tier, and roster all at once)</li>
                <li>Import BiS sets for each player</li>
                <li>Invite members to take ownership of their cards</li>
                <li>Configure loot priority and start tracking</li>
              </ol>
            </div>

            <InfoBox type="tip" title="Quick start">
              The Setup Wizard handles static creation, tier selection, and roster setup all in one
              flow. You can set up your entire roster in under 5 minutes, then import BiS sets afterward.
            </InfoBox>
          </Section>

          {/* Step 1: Login */}
          <Section id="login" title="1. Log In with Discord">
            <Step number={1} title="Click 'Login with Discord'">
              <p>Find the login button in the top-right corner of the page.</p>
            </Step>
            <Step number={2} title="Authorize the application">
              <p>
                Discord will ask you to authorize FFXIV Raid Planner. We only request access to
                your basic profile (username and avatar).
              </p>
            </Step>
            <Step number={3} title="You're logged in!">
              <p>You'll be redirected back to the app, now logged in with your Discord account.</p>
            </Step>
          </Section>

          {/* Step 2: Create Static */}
          <Section id="create-static" title="2. Create Your Static">
            <p className="text-text-secondary mb-6">
              The Setup Wizard guides you through creating your static in 4 simple steps.
            </p>

            <Step number={1} title="Go to Dashboard and click 'Create Static'">
              <p>Click <strong>Dashboard</strong> in the navigation bar, then click the <strong>Create Static</strong> button. This opens the Setup Wizard.</p>
            </Step>

            <Step number={2} title="Step 1: Static Details">
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>Name</strong>: Give your static a memorable name</li>
                <li><strong>Tier</strong>: Select the raid tier (defaults to current savage tier)</li>
                <li><strong>Content type</strong>: Ultimate or Savage</li>
              </ul>
            </Step>

            <Step number={3} title="Step 2: Roster Setup">
              <p className="mb-2">Configure your 8 player slots. Each slot shows:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>Position</strong>: T1, T2, H1, H2, M1, M2, R1, R2 (auto-assigned)</li>
                <li><strong>Name</strong>: Character name or nickname</li>
                <li><strong>Job</strong>: Click the quick-select buttons for your role, or "Other" for a full job picker</li>
              </ul>
              <p className="mt-2 text-text-muted">You can leave slots empty - they'll be created as unconfigured placeholders.</p>
            </Step>

            <Step number={4} title="Step 3: Share Link">
              <p>Copy the share code to let others view your static. You'll set up proper invitations after creation.</p>
            </Step>

            <Step number={5} title="Step 4: Review & Create">
              <p>Review your configuration and click <strong>Create Static</strong>. You'll be redirected to your new static's page.</p>
            </Step>

            <InfoBox type="tip" title="Keyboard navigation">
              Use Tab to move between fields and Enter to select a job and advance to the next slot.
              The wizard is fully keyboard-accessible.
            </InfoBox>

            <InfoBox type="info" title="Multiple tiers">
              You can add more tiers later from the tier selector dropdown. Each tier tracks gear and loot separately.
            </InfoBox>
          </Section>

          {/* Step 3: Import BiS */}
          <Section id="import-bis" title="3. Import BiS Sets">
            <p className="text-text-secondary mb-6">
              After creating your static, import BiS sets to populate gear slots with item data.
              Player cards without BiS show a helpful setup banner prompting you to import.
            </p>

            <Step number={1} title="Find a player card that needs BiS">
              <p>Cards without BiS show an <strong>"Import BiS"</strong> button directly on the card. You can also use the context menu (right-click or 3-dot menu).</p>
            </Step>
            <Step number={2} title="Choose import method">
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>XIVGear/Etro URL</strong>: Paste a link to their gearset</li>
                <li><strong>Presets</strong>: Choose from curated community BiS sets by job</li>
              </ul>
            </Step>
            <Step number={3} title="Click Import">
              <p>The gear slots will populate with item names, icons, and sources (raid vs tome).</p>
            </Step>

            <InfoBox type="tip" title="Setup banner">
              Unclaimed cards show an "Assign Player" button, and cards without BiS show
              an "Import BiS" button. These prompts help you complete setup quickly.
            </InfoBox>

            <LinkCard
              href="/docs/guides/common-tasks#bis-import"
              title="Detailed BiS Import Guide"
              description="Full walkthrough with screenshots and troubleshooting"
            />
          </Section>

          {/* Step 4: Invite Members */}
          <Section id="invite-members" title="4. Invite Members">
            <Step number={1} title="Open Static Settings">
              <p>Click the gear icon next to your static name.</p>
            </Step>
            <Step number={2} title="Go to Invitations">
              <p>Select the <strong>Invitations</strong> tab.</p>
            </Step>
            <Step number={3} title="Create an invite">
              <p>Click <strong>Create Invite</strong> and configure:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>Role</strong>: "Member" for regular raiders, "Lead" for co-leads</li>
                <li><strong>Expiration</strong>: How long the link stays valid</li>
                <li><strong>Max uses</strong>: Limit to 1 per person, or leave open</li>
              </ul>
            </Step>
            <Step number={4} title="Share the link">
              <p>Copy the invite link and share it with your static members in Discord.</p>
            </Step>

            <InfoBox type="info" title="After they join">
              Members can "Take Ownership" of their player card to edit their own gear.
              You can also assign ownership from the player context menu.
            </InfoBox>
          </Section>

          {/* Step 5: Configure Loot Priority */}
          <Section id="loot-priority" title="5. Configure Loot Priority">
            <p className="text-text-secondary mb-6">
              The loot priority system calculates who should get each drop based on role and need.
            </p>

            <Step number={1} title="Open Static Settings">
              <p>Click the gear icon next to your static name.</p>
            </Step>
            <Step number={2} title="Go to Loot Priority">
              <p>Configure the role priority order (default: melee &gt; ranged &gt; caster &gt; tank &gt; healer).</p>
            </Step>
            <Step number={3} title="Understand the system">
              <p>Priority is calculated from role weight + need score. Higher = gets loot first.</p>
            </Step>

            <LinkCard
              href="/docs/loot-math"
              title="Loot Priority Math"
              description="Full breakdown of formulas, weights, and edge cases"
            />
          </Section>

          {/* Step 6: Log Loot */}
          <Section id="logging-loot" title="6. Log Loot Drops">
            <p className="text-text-secondary mb-6">
              During raid, log drops to track history and update priority scores.
            </p>

            <Step number={1} title="Go to Loot Priority tab">
              <p>This shows who has priority for each item from each floor.</p>
            </Step>
            <Step number={2} title="Select the floor">
              <p>Use the floor selector (M9S, M10S, etc.) to see drops for that boss.</p>
            </Step>
            <Step number={3} title="Quick Log a drop">
              <p>
                Click on an item to open Quick Log. The highest-priority player is pre-selected.
                Confirm or change the recipient, then save.
              </p>
            </Step>

            <InfoBox type="tip" title="Gear sync">
              When you log a drop, the player's gear checkbox is automatically checked.
              No need to update it manually!
            </InfoBox>
          </Section>

          {/* Step 7: Track Clears */}
          <Section id="track-clears" title="7. Track Floor Clears">
            <Step number={1} title="Go to History tab">
              <p>Switch to the <strong>History</strong> tab on your static's page.</p>
            </Step>
            <Step number={2} title="Click 'Mark Floor Cleared'">
              <p>Select the floor and check off players who were present for the clear.</p>
            </Step>
            <Step number={3} title="Confirm">
              <p>Each player gets +1 book for that floor, tracked in their page balance.</p>
            </Step>

            <LinkCard
              href="/docs/guides/common-tasks#book-tracking"
              title="Book & Page Tracking"
              description="How the page economy works and how to manage it"
            />
          </Section>

          {/* Permissions */}
          <Section id="permissions" title="Your Permissions">
            <p className="text-text-secondary mb-6">
              As an Owner or Lead, here's what you can do:
            </p>

            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default">
                    <th className="text-left py-2 text-text-muted font-medium">Action</th>
                    <th className="text-center py-2 text-text-muted font-medium w-20">Owner</th>
                    <th className="text-center py-2 text-text-muted font-medium w-20">Lead</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  <tr><td className="py-2 text-text-secondary">Create/delete tiers</td><td className="text-center"><PermissionBadge allowed /></td><td className="text-center"><PermissionBadge allowed /></td></tr>
                  <tr><td className="py-2 text-text-secondary">Add/remove/reorder players</td><td className="text-center"><PermissionBadge allowed /></td><td className="text-center"><PermissionBadge allowed /></td></tr>
                  <tr><td className="py-2 text-text-secondary">Edit any player card</td><td className="text-center"><PermissionBadge allowed /></td><td className="text-center"><PermissionBadge allowed /></td></tr>
                  <tr><td className="py-2 text-text-secondary">Log loot and floor clears</td><td className="text-center"><PermissionBadge allowed /></td><td className="text-center"><PermissionBadge allowed /></td></tr>
                  <tr><td className="py-2 text-text-secondary">Create invite links</td><td className="text-center"><PermissionBadge allowed /></td><td className="text-center"><PermissionBadge allowed /></td></tr>
                  <tr><td className="py-2 text-text-secondary">Change static settings</td><td className="text-center"><PermissionBadge allowed /></td><td className="text-center"><PermissionBadge allowed={false} /></td></tr>
                  <tr><td className="py-2 text-text-secondary">Delete the static</td><td className="text-center"><PermissionBadge allowed /></td><td className="text-center"><PermissionBadge allowed={false} /></td></tr>
                  <tr><td className="py-2 text-text-secondary">Transfer ownership</td><td className="text-center"><PermissionBadge allowed /></td><td className="text-center"><PermissionBadge allowed={false} /></td></tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* Next Steps */}
          <Section id="next-steps" title="Next Steps">
            <p className="text-text-secondary mb-6">
              Your static is set up! Here are some helpful resources:
            </p>

            <div className="grid gap-3 md:grid-cols-2">
              <LinkCard
                href="/docs/guides/common-tasks"
                title="Common Tasks Reference"
                description="Detailed guides for BiS import, gear tracking, and more"
              />
              <LinkCard
                href="/docs/loot-math"
                title="Loot Priority Math"
                description="Understand how priority scores are calculated"
              />
              <LinkCard
                href="/docs/api"
                title="API Documentation"
                description="Integrate with external tools and automations"
              />
              <LinkCard
                href="/docs/design-system"
                title="Design System"
                description="Visual reference for the UI components"
              />
            </div>
          </Section>
        </main>
      </div>
    </div>
  );
}
