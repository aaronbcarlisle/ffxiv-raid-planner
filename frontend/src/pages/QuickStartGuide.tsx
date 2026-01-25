/**
 * Quick Start Guide - Unified getting started guide
 *
 * Replaces the three-page flow (QuickStartDocs → LeadsGuide/MembersGuide)
 * with a single streamlined guide for all users.
 *
 * Accessible at: /docs/quick-start
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LinkCard, NavSidebar } from '../components/docs';

// Navigation items
const NAV_GROUPS = [
  {
    label: 'Getting Started',
    items: [
      { id: 'overview', label: 'Overview' },
      { id: 'login', label: 'Log in' },
    ],
  },
  {
    label: 'Create Your Static',
    items: [
      { id: 'create-static', label: 'Create static' },
      { id: 'add-roster', label: 'Add roster' },
    ],
  },
  {
    label: 'Set Up Gear',
    items: [
      { id: 'import-bis', label: 'Import BiS' },
      { id: 'claim-cards', label: 'Claim cards' },
    ],
  },
  {
    label: 'Start Tracking',
    items: [
      { id: 'log-loot', label: 'Log loot' },
      { id: 'next-steps', label: 'Next steps' },
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

function RoleCallout() {
  return (
    <div className="grid md:grid-cols-2 gap-4 my-6">
      <div className="bg-accent/10 border border-accent/30 rounded-lg p-4">
        <h4 className="font-medium text-accent mb-2">For static leads</h4>
        <p className="text-sm text-text-secondary">
          You'll create the static and set up the roster. Your members will claim their cards after
          you invite them.
        </p>
      </div>
      <div className="bg-membership-member/10 border border-membership-member/30 rounded-lg p-4">
        <h4 className="font-medium text-membership-member mb-2">For members</h4>
        <p className="text-sm text-text-secondary">
          Your lead will set things up. Once you get an invite, just join and claim your player
          card.
        </p>
      </div>
    </div>
  );
}

export default function QuickStartGuide() {
  const location = useLocation();
  const [activeSection, setActiveSection] = useState(() => {
    const hash = window.location.hash;
    if (hash) {
      const id = hash.slice(1);
      if (NAV_SECTIONS.some((s) => s.id === id)) return id;
    }
    return 'overview';
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
        const newSection = bestSection || 'overview';
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
            <span className="text-text-secondary">Quick Start</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-accent">Get Started with XIV Raid Planner</h1>
            <p className="text-text-secondary mt-1">Set up your static in under 5 minutes</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-[120rem] mx-auto px-6 lg:px-8 py-8 flex gap-8">
        <NavSidebar groups={NAV_GROUPS} activeSection={activeSection} onSectionClick={handleNavClick} />

        <main className="flex-1 min-w-0">
          {/* Overview */}
          <Section id="overview" title="Overview">
            <p className="text-text-secondary mb-4">
              XIV Raid Planner helps your static track gear, manage loot fairly, and stay organized
              throughout a raid tier. No more spreadsheets, no more arguments about who gets what.
            </p>

            <div className="bg-surface-card border border-border-subtle rounded-lg p-4 mb-6">
              <h3 className="font-medium text-text-primary mb-3">What you'll set up:</h3>
              <ul className="list-disc list-inside text-text-secondary space-y-1 text-sm">
                <li>Your static with a full 8-player roster</li>
                <li>BiS (Best-in-Slot) sets for each player</li>
                <li>Loot tracking and priority calculations</li>
              </ul>
            </div>

            <RoleCallout />
          </Section>

          {/* Login */}
          <Section id="login" title="1. Log in with Discord">
            <Step number={1} title="Click Login with Discord">
              <p>
                Find the <strong>Login</strong> button in the top-right corner. We only ask for your
                basic Discord profile—no access to your servers or messages.
              </p>
            </Step>

            <Step number={2} title="Authorize the app">
              <p>Discord will ask you to authorize XIV Raid Planner. Click Accept to continue.</p>
            </Step>

            <Step number={3} title="You're in!">
              <p>
                You'll be redirected back to the app, now logged in. Your Discord username and
                avatar will appear in the header.
              </p>
            </Step>
          </Section>

          {/* Create Static */}
          <Section id="create-static" title="2. Create your static">
            <p className="text-text-secondary mb-6">
              The Setup Wizard guides you through creating your static step by step.
            </p>

            <Step number={1} title="Go to Dashboard">
              <p>
                Click <strong>Dashboard</strong> in the navigation bar. If this is your first time,
                you'll see a welcome message.
              </p>
            </Step>

            <Step number={2} title="Click Create Static">
              <p>This opens the Setup Wizard. You'll complete 4 quick steps to create your static.</p>
            </Step>

            <Step number={3} title="Enter static details">
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>
                  <strong>Name</strong>: Give your static a memorable name
                </li>
                <li>
                  <strong>Tier</strong>: Select your current raid tier
                </li>
                <li>
                  <strong>Content type</strong>: Choose Savage or Ultimate
                </li>
              </ul>
            </Step>

            <InfoBox type="info">
              You can add more tiers later. Each tier tracks gear and loot separately.
            </InfoBox>
          </Section>

          {/* Add Roster */}
          <Section id="add-roster" title="3. Set up your roster">
            <p className="text-text-secondary mb-6">
              Add your 8 players in the roster step of the wizard.
            </p>

            <Step number={1} title="Fill in player slots">
              <p>Each slot has a position (T1, H1, M1, etc.) already assigned. Enter:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>
                  <strong>Name</strong>: Character name or nickname
                </li>
                <li>
                  <strong>Job</strong>: Click the quick-select buttons for common jobs, or "Other"
                  for a full list
                </li>
              </ul>
            </Step>

            <Step number={2} title="Review and create">
              <p>
                Check your roster in the preview, then click <strong>Create Static</strong>. You'll
                land on your new static's page with all 8 player cards ready.
              </p>
            </Step>

            <RoleCallout />

            <InfoBox type="tip" title="Keyboard shortcut">
              Press Tab to move between fields and Enter to advance to the next slot. The wizard is
              fully keyboard-accessible.
            </InfoBox>
          </Section>

          {/* Import BiS */}
          <Section id="import-bis" title="4. Import BiS sets">
            <p className="text-text-secondary mb-6">
              BiS (Best-in-Slot) tells the app what gear each player needs. This powers the priority
              calculations.
            </p>

            <Step number={1} title="Open the import modal">
              <p>
                Click the menu on a player card (three dots, or right-click) and select{' '}
                <strong>Import BiS</strong>. Cards without BiS show an "Import BiS" button directly
                on the card.
              </p>
            </Step>

            <Step number={2} title="Choose your source">
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>
                  <strong>XIVGear or Etro link</strong>: Paste the URL to a gearset
                </li>
                <li>
                  <strong>Presets</strong>: Pick a pre-made set from The Balance
                </li>
              </ul>
            </Step>

            <Step number={3} title="Click Import">
              <p>
                The gear table fills in with item names, icons, and whether each piece comes from
                raid or tomes.
              </p>
            </Step>

            <InfoBox type="tip">
              The Balance presets are great if you don't have a custom set yet. They're curated by
              the community and updated each tier.
            </InfoBox>

            <div className="mt-4">
              <LinkCard
                href="/docs/how-to#import-bis"
                title="More import options"
                description="XIVGear, Etro, presets, and troubleshooting"
              />
            </div>
          </Section>

          {/* Claim Cards / Invite Team */}
          <Section id="claim-cards" title="5. Invite your team & claim cards">
            <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-accent mb-3">If you're a static lead</h3>
              <Step number={1} title="Open Static Settings">
                <p>
                  Click the gear icon next to your static name and go to the{' '}
                  <strong>Invitations</strong> tab.
                </p>
              </Step>

              <Step number={2} title="Create an invite link">
                <p>Choose the role (Member or Lead), expiration, and usage limit.</p>
              </Step>

              <Step number={3} title="Share in Discord">
                <p>
                  Copy the link and share it with your static. Members click the link to join and
                  can then claim their player cards.
                </p>
              </Step>
            </div>

            <div className="bg-membership-member/10 border border-membership-member/30 rounded-lg p-4">
              <h3 className="font-medium text-membership-member mb-3">
                If you're joining a static
              </h3>
              <Step number={1} title="Click the invite link">
                <p>Your lead will share this in Discord. Clicking it opens the join page.</p>
              </Step>

              <Step number={2} title="Accept the invitation">
                <p>You'll see the static name and details. Click Accept to join.</p>
              </Step>

              <Step number={3} title="Claim your player card">
                <p>
                  Find your card in the roster and click <strong>Take Ownership</strong>. This lets
                  you edit your own gear.
                </p>
              </Step>
            </div>

            <InfoBox type="info">
              Claiming a card links it to your account. You can only claim one card per static, but
              leads can reassign cards if needed.
            </InfoBox>
          </Section>

          {/* Log Loot */}
          <Section id="log-loot" title="6. Start tracking loot">
            <p className="text-text-secondary mb-6">
              The Loot Priority tab shows who should get each drop based on role and need.
            </p>

            <Step number={1} title="Go to the Loot Priority tab">
              <p>Click the Loot Priority tab on your static's page.</p>
            </Step>

            <Step number={2} title="Select a floor">
              <p>Use the floor buttons (M9S, M10S, etc.) to see what drops from each boss.</p>
            </Step>

            <Step number={3} title="Log a drop">
              <p>
                Click an item to open Quick Log. The highest-priority player is pre-selected.
                Confirm or change the recipient, then save.
              </p>
            </Step>

            <InfoBox type="tip">
              When you log a drop, the player's gear checkbox updates automatically. No need to mark
              it manually.
            </InfoBox>

            <div className="mt-4">
              <LinkCard
                href="/docs/understanding-priority"
                title="Understanding priority"
                description="How loot distribution calculations work"
              />
            </div>
          </Section>

          {/* Next Steps */}
          <Section id="next-steps" title="Next steps">
            <p className="text-text-secondary mb-6">
              You're all set up! Here's where to go next:
            </p>

            <div className="grid gap-3 md:grid-cols-2">
              <LinkCard
                href="/docs/how-to"
                title="How-To Guides"
                description="Step-by-step guides for common tasks"
              />
              <LinkCard
                href="/docs/understanding-priority"
                title="Understanding Priority"
                description="How loot distribution works under the hood"
              />
              <LinkCard
                href="/docs/faq"
                title="FAQ"
                description="Quick answers to common questions"
              />
              <LinkCard
                href="/docs/api"
                title="API Documentation"
                description="Build integrations and automations"
              />
            </div>
          </Section>
        </main>
      </div>
    </div>
  );
}
