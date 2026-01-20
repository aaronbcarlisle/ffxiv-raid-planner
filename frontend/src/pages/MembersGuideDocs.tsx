/**
 * Members Guide - Step-by-step guide for static members
 *
 * Covers joining a static, claiming your player card, and managing your gear.
 * Concise with links to Common Tasks for detailed explanations.
 *
 * Accessible at: /docs/guides/members
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ExternalLink, Check, ArrowRight, Users } from 'lucide-react';

// Navigation items
const NAV_GROUPS = [
  {
    label: 'Getting In',
    items: [
      { id: 'overview', label: 'Overview' },
      { id: 'login', label: '1. Log In' },
      { id: 'join-static', label: '2. Join Static' },
      { id: 'claim-card', label: '3. Claim Your Card' },
    ],
  },
  {
    label: 'Managing Gear',
    items: [
      { id: 'import-bis', label: '4. Import BiS' },
      { id: 'track-gear', label: '5. Track Gear' },
      { id: 'weapon-priority', label: '6. Weapon Priority' },
    ],
  },
  {
    label: 'Reference',
    items: [
      { id: 'permissions', label: 'Your Permissions' },
      { id: 'tips', label: 'Tips & FAQ' },
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

export default function MembersGuideDocs() {
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
      const viewportHeight = window.innerHeight;
      const sections = NAV_SECTIONS.map(s => ({ id: s.id, element: document.getElementById(s.id) })).filter(s => s.element);

      // Check if at bottom of page - select last section
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const documentHeight = document.documentElement.scrollHeight;
      const maxScroll = documentHeight - viewportHeight;
      const scrollRemaining = maxScroll - scrollTop;

      // If less than 100px of scroll remaining, we're at the bottom
      if (scrollRemaining < 100 && sections.length > 0) {
        const lastSection = sections[sections.length - 1];
        setActiveSection(prev => {
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
          <div className="flex items-center gap-2 text-sm text-text-muted mb-4">
            <Link to="/docs" className="hover:text-accent transition-colors">Documentation</Link>
            <span>/</span>
            <Link to="/docs/getting-started" className="hover:text-accent transition-colors">Getting Started</Link>
            <span>/</span>
            <span className="text-text-secondary">For Members</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center">
              <Users className="w-7 h-7 text-accent" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-accent">Guide for Static Members</h1>
              <p className="text-text-secondary mt-1">
                Join your static, claim your card, and track your gear progress
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-[120rem] mx-auto px-6 lg:px-8 py-8 flex gap-8">
        <NavSidebar activeSection={activeSection} onSectionClick={handleNavClick} />

        <main className="flex-1 min-w-0">
          {/* Overview */}
          <Section id="overview" title="Overview">
            <p className="text-text-secondary mb-6">
              Your static lead has set up the raid planner. Now you need to join, claim your player
              card, and keep your gear updated. This guide walks you through the process.
            </p>

            <div className="bg-surface-card border border-border-subtle rounded-lg p-4 mb-6">
              <h3 className="font-medium text-text-primary mb-3">What you'll do:</h3>
              <ol className="list-decimal list-inside text-text-secondary space-y-1 text-sm">
                <li>Log in with Discord</li>
                <li>Join your static via invite link</li>
                <li>Claim your player card</li>
                <li>Import or verify your BiS</li>
                <li>Track gear as you acquire items</li>
                <li>Set weapon priorities for alts (optional)</li>
              </ol>
            </div>

            <InfoBox type="tip" title="Quick start">
              If your lead already set up your BiS, you just need to join, claim your card,
              and start checking off gear as you get it!
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

          {/* Step 2: Join Static */}
          <Section id="join-static" title="2. Join Your Static">
            <p className="text-text-secondary mb-6">
              Your static lead will share an invite link with you. Here's how to use it:
            </p>

            <Step number={1} title="Click the invite link">
              <p>
                Your lead will share something like <code className="text-accent">raidplanner.app/invite/ABC123</code>.
                Click it to open the invite page.
              </p>
            </Step>
            <Step number={2} title="Review and accept">
              <p>
                You'll see the static name and what role you're being invited as (usually "Member").
                Click <strong>Accept Invite</strong>.
              </p>
            </Step>
            <Step number={3} title="You're in!">
              <p>You'll be redirected to the static's page. Your static now appears in your Dashboard.</p>
            </Step>

            <InfoBox type="info" title="Share codes vs invite links">
              If someone gives you a <strong>share code</strong> instead (8 characters like "XYZ98765"),
              that's for read-only viewing. Ask for an <strong>invite link</strong> to get edit permissions.
            </InfoBox>
          </Section>

          {/* Step 3: Claim Card */}
          <Section id="claim-card" title="3. Claim Your Player Card">
            <p className="text-text-secondary mb-6">
              Your lead may have already created a player card for you. Claim it to take ownership.
              Unclaimed cards show a helpful "Take Ownership" button directly on the card.
            </p>

            <Step number={1} title="Find your card">
              <p>Look for a player card with your character name or the job you play. Unclaimed cards are easy to spot - they show a banner with a <strong>"Take Ownership"</strong> button.</p>
            </Step>
            <Step number={2} title="Click 'Take Ownership'">
              <p>
                Click the button on the card, or right-click and choose "Take Ownership" from the menu.
                The card is now yours! You can edit your gear, import BiS, and update your info.
                Your Discord avatar will appear on the card.
              </p>
            </Step>

            <InfoBox type="tip" title="Can't find your card?">
              Ask your static lead. They may need to add you, or the card might have a different name.
              Leads can also assign ownership to you from their end using the "Assign Player" button.
            </InfoBox>
          </Section>

          {/* Step 4: Import BiS */}
          <Section id="import-bis" title="4. Import Your BiS">
            <p className="text-text-secondary mb-6">
              If your lead hasn't already imported your BiS, you can do it yourself.
              Cards without BiS show an "Import BiS" button directly on the card to make this easy.
            </p>

            <Step number={1} title="Click 'Import BiS'">
              <p>If your card doesn't have BiS yet, you'll see an <strong>"Import BiS"</strong> button on the card. Click it, or use the context menu (right-click or 3-dot menu).</p>
            </Step>
            <Step number={2} title="Choose import method">
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>XIVGear URL</strong>: Paste your xivgear.app link</li>
                <li><strong>Etro URL</strong>: Paste your etro.gg link</li>
                <li><strong>Presets</strong>: Choose from curated BiS sets for your job</li>
              </ul>
            </Step>
            <Step number={3} title="Click Import">
              <p>Your gear slots will populate with item names, icons, and sources.</p>
            </Step>

            <LinkCard
              href="/docs/guides/common-tasks#bis-import"
              title="Detailed BiS Import Guide"
              description="Full walkthrough with screenshots and troubleshooting"
            />
          </Section>

          {/* Step 5: Track Gear */}
          <Section id="track-gear" title="5. Track Your Gear">
            <p className="text-text-secondary mb-6">
              As you acquire gear, update your checkboxes to track progress.
            </p>

            <Step number={1} title="Find the gear slot">
              <p>Each row in your gear table represents a slot (weapon, head, body, etc.).</p>
            </Step>
            <Step number={2} title="Click the checkbox">
              <p>
                For <strong>raid BiS</strong>: Check = you have the drop.<br />
                For <strong>tome BiS</strong>: First check = have tome piece, second check = augmented.
              </p>
            </Step>
            <Step number={3} title="Watch your progress update">
              <p>
                Your completion count (e.g., "7/11 BiS") and average iLv update automatically.
              </p>
            </Step>

            <InfoBox type="info" title="Auto-sync with loot log">
              If your lead logs a drop for you, your checkbox is automatically checked.
              You don't need to update it manually.
            </InfoBox>

            <LinkCard
              href="/docs/guides/common-tasks#gear-tracking"
              title="Gear Tracking Details"
              description="Current vs BiS, iLv calculation, and checkbox states"
            />
          </Section>

          {/* Step 6: Weapon Priority */}
          <Section id="weapon-priority" title="6. Set Weapon Priorities (Optional)">
            <p className="text-text-secondary mb-6">
              If you have alt jobs that also need weapons, set their priority order.
            </p>

            <Step number={1} title="Open your player card menu">
              <p>Right-click or click the menu icon on your card.</p>
            </Step>
            <Step number={2} title="Select 'Weapon Priority'">
              <p>This opens the weapon priority editor.</p>
            </Step>
            <Step number={3} title="Add and order your jobs">
              <p>
                Your main job is first. Add alt jobs and drag to reorder.
                This affects who gets weapon drops after mains are done.
              </p>
            </Step>

            <LinkCard
              href="/docs/guides/common-tasks#weapon-priority"
              title="Weapon Priority Guide"
              description="How weapon distribution works for mains and alts"
            />
          </Section>

          {/* Permissions */}
          <Section id="permissions" title="Your Permissions">
            <p className="text-text-secondary mb-6">
              As a Member, here's what you can do:
            </p>

            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default">
                    <th className="text-left py-2 text-text-muted font-medium">Action</th>
                    <th className="text-center py-2 text-text-muted font-medium w-24">Can Do?</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  <tr><td className="py-2 text-text-secondary">View all player cards and gear</td><td className="text-center"><PermissionBadge allowed /></td></tr>
                  <tr><td className="py-2 text-text-secondary">Edit your own claimed card</td><td className="text-center"><PermissionBadge allowed /></td></tr>
                  <tr><td className="py-2 text-text-secondary">Import BiS to your card</td><td className="text-center"><PermissionBadge allowed /></td></tr>
                  <tr><td className="py-2 text-text-secondary">Update your gear checkboxes</td><td className="text-center"><PermissionBadge allowed /></td></tr>
                  <tr><td className="py-2 text-text-secondary">Set your weapon priorities</td><td className="text-center"><PermissionBadge allowed /></td></tr>
                  <tr><td className="py-2 text-text-secondary">View loot priority and history</td><td className="text-center"><PermissionBadge allowed /></td></tr>
                  <tr><td className="py-2 text-text-secondary">Edit other players' cards</td><td className="text-center"><PermissionBadge allowed={false} /></td></tr>
                  <tr><td className="py-2 text-text-secondary">Add/remove players</td><td className="text-center"><PermissionBadge allowed={false} /></td></tr>
                  <tr><td className="py-2 text-text-secondary">Log loot or floor clears</td><td className="text-center"><PermissionBadge allowed={false} /></td></tr>
                  <tr><td className="py-2 text-text-secondary">Change static settings</td><td className="text-center"><PermissionBadge allowed={false} /></td></tr>
                </tbody>
              </table>
            </div>

            <InfoBox type="info" title="Need more access?">
              Ask your static lead to promote you to "Lead" role if you need to help
              manage the roster or log loot.
            </InfoBox>
          </Section>

          {/* Tips & FAQ */}
          <Section id="tips" title="Tips & FAQ">
            <div className="space-y-6">
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <h3 className="font-medium text-text-primary mb-2">
                  What if I switch jobs mid-tier?
                </h3>
                <p className="text-text-secondary text-sm">
                  Ask your lead to update your job on the player card, or do it yourself if you
                  have ownership. You'll need to re-import your BiS for the new job.
                </p>
              </div>

              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <h3 className="font-medium text-text-primary mb-2">
                  Can I be in multiple statics?
                </h3>
                <p className="text-text-secondary text-sm">
                  Yes! You can join as many statics as you want. Use the static switcher in the
                  header to switch between them.
                </p>
              </div>

              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <h3 className="font-medium text-text-primary mb-2">
                  How do I leave a static?
                </h3>
                <p className="text-text-secondary text-sm">
                  Go to Dashboard, find the static, and click "Leave Static" in the menu.
                  Your player card will remain but become unowned.
                </p>
              </div>

              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <h3 className="font-medium text-text-primary mb-2">
                  The priority list says I should get an item, but my lead gave it to someone else?
                </h3>
                <p className="text-text-secondary text-sm">
                  The priority list is a suggestion based on the configured rules. Your lead
                  has final say on loot distribution. Talk to them about adjustments if needed.
                </p>
              </div>

              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <h3 className="font-medium text-text-primary mb-2">
                  Are there keyboard shortcuts?
                </h3>
                <p className="text-text-secondary text-sm mb-3">
                  Yes! Press <kbd className="px-1.5 py-0.5 text-xs bg-surface-elevated border border-border-default rounded">?</kbd> to see all available shortcuts. Quick reference:
                </p>
                <ul className="text-text-secondary text-sm space-y-1 ml-4 list-disc">
                  <li><kbd className="px-1 py-0.5 text-xs bg-surface-elevated border border-border-default rounded">1-4</kbd> Switch tabs (Players/Loot/Log/Summary)</li>
                  <li><kbd className="px-1 py-0.5 text-xs bg-surface-elevated border border-border-default rounded">v</kbd> Toggle compact/expanded view (Players tab)</li>
                  <li><kbd className="px-1 py-0.5 text-xs bg-surface-elevated border border-border-default rounded">g</kbd> Toggle G1/G2 group view (Players tab)</li>
                </ul>
              </div>
            </div>

            <div className="mt-8">
              <h3 className="font-medium text-text-primary mb-4">More Resources</h3>
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
              </div>
            </div>
          </Section>
        </main>
      </div>
    </div>
  );
}
