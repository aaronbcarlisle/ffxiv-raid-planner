/**
 * FAQ - Frequently Asked Questions
 *
 * Consolidated Q&A from MembersGuideDocs and scattered InfoBoxes.
 * Organized by topic with brief, direct answers.
 *
 * Accessible at: /docs/faq
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { NavSidebar } from '../components/docs';

// Navigation items
const NAV_GROUPS = [
  {
    label: 'Topics',
    items: [
      { id: 'getting-started', label: 'Getting started' },
      { id: 'gear-bis', label: 'Gear & BiS' },
      { id: 'loot-priority', label: 'Loot & priority' },
      { id: 'permissions', label: 'Permissions' },
      { id: 'troubleshooting', label: 'Troubleshooting' },
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

function Question({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 bg-surface-card border border-border-subtle rounded-lg p-5 hover:border-accent/30 transition-colors">
      <h3 className="text-lg font-medium text-accent mb-3">{question}</h3>
      <div className="text-text-secondary">{children}</div>
    </div>
  );
}

export default function FAQDocs() {
  const location = useLocation();
  const [activeSection, setActiveSection] = useState(() => {
    const hash = window.location.hash;
    if (hash) {
      const id = hash.slice(1);
      if (NAV_SECTIONS.some((s) => s.id === id)) return id;
    }
    return 'getting-started';
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
        const newSection = bestSection || 'getting-started';
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
            <span className="text-text-secondary">FAQ</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-accent">Frequently Asked Questions</h1>
            <p className="text-text-secondary mt-1">Quick answers to common questions</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-[120rem] mx-auto px-6 lg:px-8 py-8 flex gap-8">
        <NavSidebar groups={NAV_GROUPS} activeSection={activeSection} onSectionClick={handleNavClick} />

        <main className="flex-1 min-w-0">
          {/* Getting Started */}
          <Section id="getting-started" title="Getting started">
            <Question question="What is XIV Raid Planner?">
              <p>
                A web app for tracking your static's gear progress and managing loot fairly. No
                spreadsheets required.
              </p>
            </Question>

            <Question question="Is it free?">
              <p>Yes, completely free. No ads, no premium tier, no hidden costs.</p>
            </Question>

            <Question question="Do I need to create an account?">
              <p>
                You'll log in with Discord, but we only use it for authentication. We don't access
                your servers or messages—just your username and avatar.
              </p>
            </Question>

            <Question question="Can I be in multiple statics?">
              <p>
                Yes! Join as many as you want. Switch between them using the dropdown in the header.
              </p>
            </Question>

            <Question question="Does it work on mobile?">
              <p>
                The app is designed for desktop use. While it's technically accessible on mobile,
                the interface hasn't been optimized for smaller screens yet. Mobile optimization
                is on the roadmap.
              </p>
            </Question>
          </Section>

          {/* Gear & BiS */}
          <Section id="gear-bis" title="Gear & BiS">
            <Question question="What BiS sources are supported?">
              <p>
                XIVGear, Etro, and curated presets from The Balance. Just paste a link or pick a
                preset.
              </p>
            </Question>

            <Question question="I don't have a custom BiS. What should I use?">
              <p>
                Use one of The Balance presets—they're solid starting points for any job. You can
                always update later.
              </p>
            </Question>

            <Question question="What if I switch jobs mid-tier?">
              <p>
                Update your job on your player card and re-import BiS for the new job. Your gear
                progress will reset for that card.
              </p>
            </Question>

            <Question question="What do the checkbox states mean?">
              <p className="mb-2">For raid BiS slots:</p>
              <ul className="list-disc list-inside mb-2">
                <li>Unchecked = Don't have it</li>
                <li>Checked = Got the raid drop</li>
              </ul>
              <p className="mb-2">For tome BiS slots:</p>
              <ul className="list-disc list-inside">
                <li>Unchecked = Don't have tome piece</li>
                <li>Half-checked = Have tome piece, not augmented</li>
                <li>Fully checked = Augmented (BiS complete)</li>
              </ul>
            </Question>

            <Question question="Why does my iLv look wrong?">
              <p>
                iLv is calculated from your current gear based on checkboxes, not your BiS target.
                Make sure your checkboxes accurately reflect what you have equipped.
              </p>
            </Question>

            <Question question="Can I track multiple gearsets?">
              <p>
                Each tier tracks one gearset per player. If you want to track a different job,
                you'll need to update your card or have your lead create a separate tier snapshot.
              </p>
            </Question>
          </Section>

          {/* Loot & Priority */}
          <Section id="loot-priority" title="Loot & priority">
            <Question question="How is priority calculated?">
              <p>
                Based on your role, what gear you need, and what you've already received. See{' '}
                <Link to="/docs/understanding-priority" className="text-accent hover:underline">
                  Understanding Priority
                </Link>{' '}
                for the full breakdown.
              </p>
            </Question>

            <Question question="The priority list said I should get an item, but my lead gave it to someone else?">
              <p>
                Priority is a suggestion, not a rule. Your lead has final say on loot distribution.
                If you have concerns, talk to them directly.
              </p>
            </Question>

            <Question question="How do weapons work differently?">
              <p>
                Weapons use a separate priority system. Each player ranks which jobs they want
                weapons for. Main jobs get priority first, then alts.
              </p>
            </Question>

            <Question question="What are books/pages?">
              <p>
                Bad-luck protection. You earn one book per floor clear, and can exchange books for
                gear if drops don't go your way. Different floors give different book types.
              </p>
            </Question>

            <Question question="Why did my priority change after getting loot?">
              <p>
                Each time you receive loot, your priority goes down slightly. This keeps one person
                from getting all the drops while others wait.
              </p>
            </Question>

            <Question question="Can our static use a different priority order?">
              <p>
                Yes! The role priority order is customizable. Your static owner can change it in
                Static Settings to match your loot council philosophy.
              </p>
            </Question>
          </Section>

          {/* Permissions */}
          <Section id="permissions" title="Permissions">
            <Question question="What can members do vs leads?">
              <p>
                Members can edit their own claimed card. Leads can edit anyone's card and log loot.
                See the{' '}
                <Link to="/docs/how-to#permissions" className="text-accent hover:underline">
                  permissions table
                </Link>{' '}
                for the full breakdown.
              </p>
            </Question>

            <Question question="How do I become a lead?">
              <p>Ask your static owner to promote you in Static Settings → Members.</p>
            </Question>

            <Question question="What's the difference between share codes and invite links?">
              <p>
                Share codes give read-only access (Viewer role). Invite links let people join as
                Members or Leads with edit permissions.
              </p>
            </Question>

            <Question question="Can I transfer ownership of my static?">
              <p>
                Yes, the owner can transfer ownership to another member in Static Settings. Only one
                person can be owner at a time.
              </p>
            </Question>

            <Question question="I accidentally claimed the wrong card. How do I fix it?">
              <p>
                Ask your lead or owner to reassign the card. They can do this from the player card's
                context menu.
              </p>
            </Question>
          </Section>

          {/* Troubleshooting */}
          <Section id="troubleshooting" title="Troubleshooting">
            <Question question="My BiS import isn't working">
              <p>
                Make sure you're using a valid XIVGear or Etro URL. The link should contain the
                gearset ID. Private/unlisted sets should still work—just copy the full URL from your
                browser.
              </p>
            </Question>

            <Question question="I can't edit my player card">
              <p>
                You need to claim the card first. Find your card and click "Take Ownership." If
                someone else claimed it by mistake, ask your lead to reassign it.
              </p>
            </Question>

            <Question question="My gear progress looks wrong">
              <p>
                Check that your BiS is imported correctly. The app compares your checkboxes against
                your BiS to calculate progress. Try re-importing if things look off.
              </p>
            </Question>

            <Question question="The page isn't loading / shows an error">
              <p>
                Try refreshing. If the problem persists, clear your browser cache or try a different
                browser. Still stuck? Report the issue on our GitHub.
              </p>
            </Question>

            <Question question="I got logged out unexpectedly">
              <p>
                Sessions expire after a period of inactivity. Just log in again with Discord—your
                data is safe.
              </p>
            </Question>

            <Question question="My static disappeared from my dashboard">
              <p>
                You might have been removed by the owner, or the static may have been deleted. Check
                with your static lead. If you have the share code, you can still view it as a
                viewer.
              </p>
            </Question>

            <Question question="Changes aren't saving">
              <p>
                Check your internet connection. The app auto-saves, but changes won't persist if
                you're offline. Refresh and try again once you're back online.
              </p>
            </Question>
          </Section>
        </main>
      </div>
    </div>
  );
}
