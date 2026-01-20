/**
 * Common Tasks - Reference guide for tasks used by all roles
 *
 * Detailed documentation for BiS import, gear tracking, loot priority,
 * weapon priority, book tracking, and permissions.
 *
 * Accessible at: /docs/guides/common-tasks
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ExternalLink, Check, ListChecks } from 'lucide-react';

// Navigation items
const NAV_GROUPS = [
  {
    label: 'BiS & Gear',
    items: [
      { id: 'bis-import', label: 'Importing BiS' },
      { id: 'gear-tracking', label: 'Gear Tracking' },
      { id: 'ilvl', label: 'iLv Calculation' },
    ],
  },
  {
    label: 'Loot System',
    items: [
      { id: 'loot-priority', label: 'Loot Priority' },
      { id: 'quick-log', label: 'Quick Log' },
      { id: 'weapon-priority', label: 'Weapon Priority' },
    ],
  },
  {
    label: 'Book System',
    items: [
      { id: 'book-tracking', label: 'Book Tracking' },
      { id: 'page-balances', label: 'Page Balances' },
    ],
  },
  {
    label: 'Access Control',
    items: [
      { id: 'permissions', label: 'Permissions Matrix' },
      { id: 'share-codes', label: 'Share Codes' },
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

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="text-lg font-medium text-text-primary mb-4">{title}</h3>
      {children}
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

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
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

function PermissionBadge({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <span className="inline-flex items-center gap-1 text-status-success text-sm">
      <Check className="w-3.5 h-3.5" />
    </span>
  ) : (
    <span className="text-text-muted text-sm">-</span>
  );
}

// Image placeholder for screenshots (commented out until images are ready)
// function ImagePlaceholder({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
//   return (
//     <figure className="my-6">
//       <div className="bg-surface-card border border-border-subtle rounded-lg overflow-hidden">
//         <img
//           src={src}
//           alt={alt}
//           className="w-full h-auto"
//           loading="lazy"
//           onError={(e) => {
//             const target = e.target as HTMLImageElement;
//             target.style.display = 'none';
//             const placeholder = target.nextElementSibling as HTMLElement;
//             if (placeholder) placeholder.style.display = 'flex';
//           }}
//         />
//         <div
//           className="hidden items-center justify-center h-48 bg-surface-elevated text-text-muted text-sm"
//           role="img"
//           aria-label={alt}
//         >
//           <div className="text-center p-4">
//             <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
//             </svg>
//             <p>{alt}</p>
//             <p className="text-xs text-text-muted/70 mt-1">Image coming soon</p>
//           </div>
//         </div>
//       </div>
//       {caption && (
//         <figcaption className="mt-2 text-sm text-text-muted text-center italic">{caption}</figcaption>
//       )}
//     </figure>
//   );
// }

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

export default function CommonTasksDocs() {
  const location = useLocation();
  const navigate = useNavigate();
  // Initialize from URL hash if present
  const [activeSection, setActiveSection] = useState(() => {
    const hash = window.location.hash;
    if (hash) {
      const id = hash.slice(1);
      if (NAV_SECTIONS.some(s => s.id === id)) return id;
    }
    return 'bis-import';
  });
  const isScrollingRef = useRef(false);
  const scrollEndTimeoutRef = useRef<number | null>(null);

  // Handle URL hash anchor scrolling on mount/change
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.slice(1); // Remove #
      const element = document.getElementById(id);
      if (element) {
        // State is already set via initializer or handleNavClick
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  }, [location.hash]);

  const handleNavClick = useCallback((sectionId: string) => {
    setActiveSection(sectionId);
    isScrollingRef.current = true;
    // Update URL hash
    navigate(`#${sectionId}`, { replace: true });
  }, [navigate]);

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
        const newSection = bestSection || 'bis-import';
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
            <span className="text-text-secondary">Common Tasks</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center">
              <ListChecks className="w-7 h-7 text-accent" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-accent">Common Tasks Reference</h1>
              <p className="text-text-secondary mt-1">
                Detailed guides for tasks used by both leads and members
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-[120rem] mx-auto px-6 lg:px-8 py-8 flex gap-8">
        <NavSidebar activeSection={activeSection} onSectionClick={handleNavClick} />

        <main className="flex-1 min-w-0">
          {/* BiS Import */}
          <Section id="bis-import" title="Importing BiS">
            <p className="text-text-secondary mb-6">
              Import your Best-in-Slot gearset to populate slot data with item names, icons, and sources.
            </p>

            <Subsection title="From XIVGear">
              <Step number={1} title="Get your XIVGear link">
                <p>
                  Open your set on{' '}
                  <a href="https://xivgear.app" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline inline-flex items-center gap-1">
                    xivgear.app <ExternalLink className="w-3 h-3" />
                  </a>{' '}
                  and copy the URL from your browser.
                </p>
              </Step>
              <Step number={2} title="Open the import modal">
                <p>Click the 3-dot menu (⋮) on your player card and select "Import BiS", or right-click the card to access the context menu.</p>
              </Step>
              <Step number={3} title="Paste and import">
                <p>Paste your XIVGear URL in the input field and click <strong>Import</strong>.</p>
              </Step>

              {/* <ImagePlaceholder
                src="/docs/images/import-bis.gif"
                alt="Importing BiS from XIVGear"
                caption="Importing a BiS set from XIVGear"
              /> */}
            </Subsection>

            <Subsection title="From Etro">
              <p className="text-text-secondary mb-4">
                The process is the same as XIVGear. Just paste your{' '}
                <a href="https://etro.gg" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline inline-flex items-center gap-1">
                  etro.gg <ExternalLink className="w-3 h-3" />
                </a>{' '}
                link and the app will detect the source automatically.
              </p>
            </Subsection>

            <Subsection title="From Presets">
              <p className="text-text-secondary mb-4">
                Don't have a custom gearset? Choose from curated community BiS presets.
              </p>
              <Step number={1} title="Open the import modal">
                <p>Click the 3-dot menu (⋮) on your player card and select "Import BiS".</p>
              </Step>
              <Step number={2} title="Select the Presets tab">
                <p>Switch from "URL" to "Presets" tab.</p>
              </Step>
              <Step number={3} title="Choose a preset">
                <p>
                  Select from available presets for your job. Presets show GCD speed and are
                  sourced from The Balance Discord.
                </p>
              </Step>
            </Subsection>

            <InfoBox type="info" title="What gets imported">
              Importing populates: item name, item icon, item level, and source (raid or tome).
              Your checkboxes start unchecked - you'll update them as you acquire gear.
            </InfoBox>
          </Section>

          {/* Gear Tracking */}
          <Section id="gear-tracking" title="Gear Tracking">
            <p className="text-text-secondary mb-6">
              Track your gear acquisition with checkboxes on each slot.
            </p>

            <Subsection title="Raid BiS Slots">
              <p className="text-text-secondary mb-4">
                For slots where BiS comes from savage drops (weapon, some accessories):
              </p>
              <ul className="list-disc list-inside text-text-secondary space-y-1 mb-4">
                <li><strong>Unchecked</strong> = Don't have it yet</li>
                <li><strong>Checked</strong> = Got the raid drop</li>
              </ul>
            </Subsection>

            <Subsection title="Tome BiS Slots">
              <p className="text-text-secondary mb-4">
                For slots where BiS is augmented tomestone gear (most armor, some accessories):
              </p>
              <ul className="list-disc list-inside text-text-secondary space-y-1 mb-4">
                <li><strong>Unchecked</strong> = Don't have tome piece</li>
                <li><strong>Partially checked</strong> = Have tome piece, not yet augmented</li>
                <li><strong>Fully checked</strong> = Augmented (BiS complete)</li>
              </ul>

              {/* <ImagePlaceholder
                src="/docs/images/gear-checkboxes.gif"
                alt="Gear checkbox states"
                caption="Three states for tome BiS slots"
              /> */}
            </Subsection>

            <Subsection title="Current vs BiS">
              <p className="text-text-secondary mb-4">
                The planner tracks two things for each slot:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                  <h4 className="font-medium text-accent mb-2">BiS Target</h4>
                  <p className="text-sm text-text-secondary">
                    The item you want (raid drop or augmented tome). Set by BiS import.
                  </p>
                </div>
                <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                  <h4 className="font-medium text-accent mb-2">Current Source</h4>
                  <p className="text-sm text-text-secondary">
                    What you actually have equipped. Auto-inferred from checkboxes.
                  </p>
                </div>
              </div>
              <p className="text-text-secondary">
                Current source affects iLv calculation and is shown as a badge on each slot.
              </p>
            </Subsection>
          </Section>

          {/* iLv Calculation */}
          <Section id="ilvl" title="iLv Calculation">
            <p className="text-text-secondary mb-6">
              Average item level is calculated from your current gear, not your BiS target.
            </p>

            <Subsection title="How It Works">
              <ul className="list-disc list-inside text-text-secondary space-y-2 mb-4">
                <li>
                  <strong>Checked slots</strong>: Uses the item level from BiS import
                </li>
                <li>
                  <strong>Tome BiS, not augmented</strong>: Uses base tome iLv (e.g., i780 instead of i790)
                </li>
                <li>
                  <strong>No BiS import</strong>: Falls back to tier-based estimates based on current source
                </li>
              </ul>
            </Subsection>

            <Subsection title="Current Source Categories">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-default">
                      <th className="text-left py-2 text-text-muted font-medium">Source</th>
                      <th className="text-left py-2 text-text-muted font-medium">Description</th>
                      <th className="text-right py-2 text-text-muted font-medium">Typical iLv</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    <tr><td className="py-2 text-accent font-medium">savage</td><td className="py-2 text-text-secondary">Raid drop</td><td className="py-2 text-text-secondary text-right">i790</td></tr>
                    <tr><td className="py-2 text-accent font-medium">tome_up</td><td className="py-2 text-text-secondary">Augmented tomestone</td><td className="py-2 text-text-secondary text-right">i790</td></tr>
                    <tr><td className="py-2 text-accent font-medium">tome</td><td className="py-2 text-text-secondary">Unaugmented tomestone</td><td className="py-2 text-text-secondary text-right">i780</td></tr>
                    <tr><td className="py-2 text-accent font-medium">catchup</td><td className="py-2 text-text-secondary">Catchup gear (alliance raid, etc.)</td><td className="py-2 text-text-secondary text-right">i780</td></tr>
                    <tr><td className="py-2 text-accent font-medium">crafted</td><td className="py-2 text-text-secondary">Crafted/pentamelded</td><td className="py-2 text-text-secondary text-right">i770</td></tr>
                    <tr><td className="py-2 text-accent font-medium">normal</td><td className="py-2 text-text-secondary">Normal raid</td><td className="py-2 text-text-secondary text-right">i770</td></tr>
                  </tbody>
                </table>
              </div>
            </Subsection>
          </Section>

          {/* Loot Priority */}
          <Section id="loot-priority" title="Loot Priority">
            <p className="text-text-secondary mb-6">
              The loot priority system calculates who should get each drop based on role and need.
            </p>

            <Subsection title="Priority Score Formula">
              <p className="text-text-secondary mb-4">
                Priority = <strong>Role Weight</strong> + <strong>Need Score</strong> - <strong>Loot Received</strong>
              </p>
              <ul className="list-disc list-inside text-text-secondary space-y-2 mb-4">
                <li><strong>Role Weight</strong>: Based on your role priority order (configurable)</li>
                <li><strong>Need Score</strong>: Higher if you're missing valuable slots</li>
                <li><strong>Loot Received</strong>: Reduced for each drop you've already gotten</li>
              </ul>
            </Subsection>

            <Subsection title="Slot Value Weights">
              <p className="text-text-secondary mb-4">
                Not all slots are weighted equally. Body and legs are worth more than accessories.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-default">
                      <th className="text-left py-2 text-text-muted font-medium">Slot</th>
                      <th className="text-right py-2 text-text-muted font-medium">Weight</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    <tr><td className="py-2 text-text-secondary">Weapon</td><td className="py-2 text-accent text-right">5</td></tr>
                    <tr><td className="py-2 text-text-secondary">Body, Legs</td><td className="py-2 text-accent text-right">3</td></tr>
                    <tr><td className="py-2 text-text-secondary">Head, Hands, Feet</td><td className="py-2 text-accent text-right">2</td></tr>
                    <tr><td className="py-2 text-text-secondary">Accessories</td><td className="py-2 text-accent text-right">1</td></tr>
                  </tbody>
                </table>
              </div>
            </Subsection>

            <InfoBox type="info" title="Learn more">
              For the complete math breakdown, see{' '}
              <Link to="/docs/loot-math" className="text-accent hover:underline">Loot & Priority Math</Link>.
            </InfoBox>
          </Section>

          {/* Quick Log */}
          <Section id="quick-log" title="Quick Log">
            <p className="text-text-secondary mb-6">
              Quick Log is the fastest way to record loot drops during your raid.
            </p>

            <Step number={1} title="Go to Loot Priority tab">
              <p>This shows priority lists for each floor's drops.</p>
            </Step>
            <Step number={2} title="Select the floor">
              <p>Use the floor selector (M9S, M10S, etc.).</p>
            </Step>
            <Step number={3} title="Click on an item">
              <p>Click any item in the priority list to open Quick Log.</p>
            </Step>
            <Step number={4} title="Confirm recipient">
              <p>
                The highest-priority player is pre-selected. Confirm or change, then save.
                The player's gear checkbox is automatically updated.
              </p>
            </Step>

            {/* <ImagePlaceholder
              src="/docs/images/quick-log.gif"
              alt="Quick Log modal"
              caption="Quick Log pre-fills floor, slot, and week"
            /> */}
          </Section>

          {/* Weapon Priority */}
          <Section id="weapon-priority" title="Weapon Priority">
            <p className="text-text-secondary mb-6">
              Track weapon priority for main jobs and alts. Weapons are distributed in order.
            </p>

            <Subsection title="How It Works">
              <ol className="list-decimal list-inside text-text-secondary space-y-2 mb-4">
                <li>Each player sets their weapon priority list (main job first, then alts)</li>
                <li>Main job weapons are distributed first based on loot priority</li>
                <li>Once all mains have weapons, alt priorities are considered</li>
                <li>Your position in the priority list determines order within each tier</li>
              </ol>
            </Subsection>

            <Subsection title="Setting Your Priority">
              <Step number={1} title="Open player card menu">
                <p>Right-click or click the menu icon on your card.</p>
              </Step>
              <Step number={2} title="Select 'Weapon Priority'">
                <p>Opens the weapon priority editor.</p>
              </Step>
              <Step number={3} title="Add and reorder jobs">
                <p>Your main job is first. Add alts and drag to reorder.</p>
              </Step>
            </Subsection>
          </Section>

          {/* Book Tracking */}
          <Section id="book-tracking" title="Book Tracking">
            <p className="text-text-secondary mb-6">
              Track weekly floor clears and book earnings for the page exchange system.
            </p>

            <Subsection title="Book Types">
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-default">
                      <th className="text-left py-2 text-text-muted font-medium">Book</th>
                      <th className="text-left py-2 text-text-muted font-medium">From Floor</th>
                      <th className="text-left py-2 text-text-muted font-medium">Exchangeable For</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    <tr><td className="py-2 text-accent font-medium">Book I</td><td className="py-2 text-text-secondary">Floor 1 (M9S)</td><td className="py-2 text-text-secondary">Accessories (3 books each)</td></tr>
                    <tr><td className="py-2 text-accent font-medium">Book II</td><td className="py-2 text-text-secondary">Floor 2 (M10S)</td><td className="py-2 text-text-secondary">Head/Hands/Feet (4 books each)</td></tr>
                    <tr><td className="py-2 text-accent font-medium">Book III</td><td className="py-2 text-text-secondary">Floor 3 (M11S)</td><td className="py-2 text-text-secondary">Body/Legs (6 books each)</td></tr>
                    <tr><td className="py-2 text-accent font-medium">Book IV</td><td className="py-2 text-text-secondary">Floor 4 (M12S)</td><td className="py-2 text-text-secondary">Weapon (8 books)</td></tr>
                  </tbody>
                </table>
              </div>
            </Subsection>

            <Subsection title="Marking Floor Clears">
              <p className="text-text-secondary mb-4">
                When your group clears a floor, mark it to credit book earnings:
              </p>
              <Step number={1} title="Go to History tab">
                <p>Shows loot log and page ledger.</p>
              </Step>
              <Step number={2} title="Click 'Mark Floor Cleared'">
                <p>Select the floor and week.</p>
              </Step>
              <Step number={3} title="Select players who cleared">
                <p>Check off players present. Each gets +1 book for that floor.</p>
              </Step>

              {/* <ImagePlaceholder
                src="/docs/images/history-tab.png"
                alt="History tab"
                caption="History tab with loot log and floor clear tracking"
              /> */}
            </Subsection>
          </Section>

          {/* Page Balances */}
          <Section id="page-balances" title="Page Balances">
            <p className="text-text-secondary mb-6">
              View accumulated book balances for each player.
            </p>

            <Subsection title="Reading Balances">
              <p className="text-text-secondary mb-4">
                Balance = Books Earned - Books Spent
              </p>
              <ul className="list-disc list-inside text-text-secondary space-y-1 mb-4">
                <li><strong>Earned</strong>: From floor clears (1 per clear)</li>
                <li><strong>Spent</strong>: When exchanging for gear</li>
              </ul>
              <p className="text-text-secondary">
                Balances are shown in the History tab's Page Balances panel.
              </p>
            </Subsection>
          </Section>

          {/* Permissions Matrix */}
          <Section id="permissions" title="Permissions Matrix">
            <p className="text-text-secondary mb-6">
              Different roles have different access levels.
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
                  <tr><td className="py-2 text-text-secondary">View static and gear</td><td className="text-center"><PermissionBadge allowed /></td><td className="text-center"><PermissionBadge allowed /></td><td className="text-center"><PermissionBadge allowed /></td><td className="text-center"><PermissionBadge allowed /></td></tr>
                  <tr><td className="py-2 text-text-secondary">Edit own claimed card</td><td className="text-center"><PermissionBadge allowed /></td><td className="text-center"><PermissionBadge allowed /></td><td className="text-center"><PermissionBadge allowed /></td><td className="text-center"><PermissionBadge allowed={false} /></td></tr>
                  <tr><td className="py-2 text-text-secondary">Edit any player card</td><td className="text-center"><PermissionBadge allowed /></td><td className="text-center"><PermissionBadge allowed /></td><td className="text-center"><PermissionBadge allowed={false} /></td><td className="text-center"><PermissionBadge allowed={false} /></td></tr>
                  <tr><td className="py-2 text-text-secondary">Add/remove players</td><td className="text-center"><PermissionBadge allowed /></td><td className="text-center"><PermissionBadge allowed /></td><td className="text-center"><PermissionBadge allowed={false} /></td><td className="text-center"><PermissionBadge allowed={false} /></td></tr>
                  <tr><td className="py-2 text-text-secondary">Create/delete tiers</td><td className="text-center"><PermissionBadge allowed /></td><td className="text-center"><PermissionBadge allowed /></td><td className="text-center"><PermissionBadge allowed={false} /></td><td className="text-center"><PermissionBadge allowed={false} /></td></tr>
                  <tr><td className="py-2 text-text-secondary">Log loot and clears</td><td className="text-center"><PermissionBadge allowed /></td><td className="text-center"><PermissionBadge allowed /></td><td className="text-center"><PermissionBadge allowed={false} /></td><td className="text-center"><PermissionBadge allowed={false} /></td></tr>
                  <tr><td className="py-2 text-text-secondary">Create invites</td><td className="text-center"><PermissionBadge allowed /></td><td className="text-center"><PermissionBadge allowed /></td><td className="text-center"><PermissionBadge allowed={false} /></td><td className="text-center"><PermissionBadge allowed={false} /></td></tr>
                  <tr><td className="py-2 text-text-secondary">Change settings</td><td className="text-center"><PermissionBadge allowed /></td><td className="text-center"><PermissionBadge allowed={false} /></td><td className="text-center"><PermissionBadge allowed={false} /></td><td className="text-center"><PermissionBadge allowed={false} /></td></tr>
                  <tr><td className="py-2 text-text-secondary">Delete static</td><td className="text-center"><PermissionBadge allowed /></td><td className="text-center"><PermissionBadge allowed={false} /></td><td className="text-center"><PermissionBadge allowed={false} /></td><td className="text-center"><PermissionBadge allowed={false} /></td></tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* Share Codes */}
          <Section id="share-codes" title="Share Codes">
            <p className="text-text-secondary mb-6">
              Share codes provide read-only access to your static.
            </p>

            <Subsection title="How They Work">
              <ul className="list-disc list-inside text-text-secondary space-y-2 mb-4">
                <li>Every static has a unique 8-character share code (e.g., "ABC12345")</li>
                <li>Anyone with the code can view the static read-only</li>
                <li>They get "Viewer" role - can see everything but can't edit</li>
                <li>Useful for sharing progress publicly or with applicants</li>
              </ul>
            </Subsection>

            <Subsection title="Share Codes vs Invite Links">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                  <h4 className="font-medium text-text-primary mb-2">Share Code</h4>
                  <ul className="text-sm text-text-secondary space-y-1">
                    <li>Read-only (Viewer role)</li>
                    <li>Never expires</li>
                    <li>Unlimited uses</li>
                    <li>Good for public sharing</li>
                  </ul>
                </div>
                <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                  <h4 className="font-medium text-text-primary mb-2">Invite Link</h4>
                  <ul className="text-sm text-text-secondary space-y-1">
                    <li>Configurable role (Member/Lead)</li>
                    <li>Can set expiration</li>
                    <li>Can limit uses</li>
                    <li>Good for adding teammates</li>
                  </ul>
                </div>
              </div>
            </Subsection>

            <InfoBox type="tip" title="Tier-specific links">
              Shift+click the share code to copy a URL with a specific tier pre-selected.
              Great for sharing a particular tier's progress.
            </InfoBox>
          </Section>
        </main>
      </div>
    </div>
  );
}
