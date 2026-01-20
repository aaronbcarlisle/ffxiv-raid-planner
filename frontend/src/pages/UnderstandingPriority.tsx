/**
 * Understanding Priority - Simplified loot priority explanation
 *
 * Restructured from LootMathDocs.tsx to lead with simple explanations
 * and use progressive disclosure for technical details.
 *
 * Accessible at: /docs/understanding-priority
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ArrowRight, ExternalLink, Target } from 'lucide-react';

// Navigation items
const NAV_GROUPS = [
  {
    label: 'The Basics',
    items: [
      { id: 'how-it-works', label: 'How it works' },
      { id: 'your-score', label: 'Your score' },
    ],
  },
  {
    label: 'What Affects Priority',
    items: [
      { id: 'role-priority', label: 'Role priority' },
      { id: 'gear-need', label: 'Gear need' },
      { id: 'loot-received', label: 'Loot received' },
    ],
  },
  {
    label: 'Weapons',
    items: [
      { id: 'weapon-priority', label: 'Weapon priority' },
      { id: 'main-vs-alt', label: 'Main vs alt' },
    ],
  },
  {
    label: 'Books & Pages',
    items: [
      { id: 'book-system', label: 'Book system' },
      { id: 'exchange-costs', label: 'Exchange costs' },
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

function LinkCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  const isExternal = href.startsWith('http');
  const className =
    'group flex items-center gap-3 p-3 rounded-lg bg-surface-card border border-border-subtle hover:border-accent/50 transition-colors';

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

// Sidebar Navigation
function NavSidebar({
  activeSection,
  onSectionClick,
}: {
  activeSection: string;
  onSectionClick: (id: string) => void;
}) {
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
    setCollapsedGroups((prev) => {
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
        <div
          className={`absolute top-0 left-0 right-0 h-6 rounded-t-lg pointer-events-none z-10 bg-gradient-to-b from-surface-card to-transparent transition-opacity duration-150 ${scrollState.top ? 'opacity-0' : 'opacity-100'}`}
        />
        <div
          ref={scrollContainerRef}
          className="p-3 max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-thin"
        >
          {NAV_GROUPS.map((group, groupIndex) => {
            const isCollapsed = collapsedGroups.has(group.label);
            return (
              <div key={group.label} className={groupIndex > 0 ? 'mt-3' : ''}>
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between text-[9px] font-semibold text-text-muted/70 uppercase tracking-[0.1em] mb-1 px-1 py-0.5 rounded hover:text-text-muted hover:bg-surface-interactive cursor-pointer"
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`}
                  />
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
        <div
          className={`absolute bottom-0 left-0 right-0 h-6 rounded-b-lg pointer-events-none z-10 bg-gradient-to-t from-surface-card to-transparent transition-opacity duration-150 ${scrollState.bottom ? 'opacity-0' : 'opacity-100'}`}
        />
      </div>
    </nav>
  );
}

export default function UnderstandingPriority() {
  const location = useLocation();
  const [activeSection, setActiveSection] = useState(() => {
    const hash = window.location.hash;
    if (hash) {
      const id = hash.slice(1);
      if (NAV_SECTIONS.some((s) => s.id === id)) return id;
    }
    return 'how-it-works';
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
      // Detect bottom by checking if we've scrolled past where we could scroll
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
        const newSection = bestSection || 'how-it-works';
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
            <span className="text-text-secondary">Understanding Priority</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center">
              <Target className="w-7 h-7 text-accent" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-accent">Understanding Priority</h1>
              <p className="text-text-secondary mt-1">How loot distribution works</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-[120rem] mx-auto px-6 lg:px-8 py-8 flex gap-8">
        <NavSidebar activeSection={activeSection} onSectionClick={handleNavClick} />

        <main className="flex-1 min-w-0">
          {/* Developer Reference Link */}
          <div className="mb-8">
            <Link
              to="/docs/gear-math"
              className="group flex items-center gap-4 p-4 rounded-lg bg-accent/10 border border-accent/30 hover:bg-accent/20 hover:border-accent/50 transition-all"
            >
              <div className="flex-1">
                <div className="font-semibold text-accent mb-1">Looking for the technical details?</div>
                <div className="text-sm text-text-secondary">
                  See complete formulas, TypeScript source code, and all calculation constants in the Gear Math Reference.
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-accent group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* How It Works */}
          <Section id="how-it-works" title="How priority works">
            <p className="text-text-secondary mb-4">
              Loot priority helps your static decide who gets each drop—fairly and transparently. It
              factors in your role, what you still need, and what you've already picked up.
            </p>

            <p className="text-text-secondary mb-6">
              <strong className="text-text-primary">The simple version:</strong> Higher score =
              higher priority = you get the loot first.
            </p>

            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="text-lg font-bold text-accent mb-2">Role</div>
                <p className="text-sm text-text-secondary">
                  Your static sets a priority order. DPS often go first since gear = more raid
                  damage.
                </p>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="text-lg font-bold text-accent mb-2">Need</div>
                <p className="text-sm text-text-secondary">
                  Missing more gear? You get a boost. Body and legs count more than accessories.
                </p>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="text-lg font-bold text-accent mb-2">Fairness</div>
                <p className="text-sm text-text-secondary">
                  Already got loot this tier? Your priority drops a bit so others catch up.
                </p>
              </div>
            </div>

            <InfoBox type="tip">
              Check your priority score anytime in the Loot Priority tab. It updates as you get gear
              or your needs change.
            </InfoBox>
          </Section>

          {/* Your Score */}
          <Section id="your-score" title="Your priority score">
            <p className="text-text-secondary mb-4">
              Your score is built from three parts. Let's walk through an example.
            </p>

            <div className="bg-surface-card border border-border-subtle rounded-lg p-5 mb-6">
              <p className="text-text-secondary mb-4">
                <strong className="text-text-primary">Example:</strong> You're a{' '}
                <span className="text-role-melee font-medium">Melee DPS</span> and you still need
                Body, Hands, and a Ring.
              </p>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                  <span className="text-text-secondary">Role bonus (Melee is #1 in your static)</span>
                  <span className="text-accent font-mono font-medium">+125</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                  <span className="text-text-secondary">Gear need (Body 1.5 + Hands 1.0 + Ring 0.8) × 10</span>
                  <span className="text-accent font-mono font-medium">+33</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                  <span className="text-text-secondary">Loot received (none yet)</span>
                  <span className="text-text-muted font-mono">-0</span>
                </div>
                <div className="flex justify-between items-center pt-3">
                  <span className="text-text-primary font-medium">Your total priority</span>
                  <span className="text-accent font-mono font-bold text-lg">158</span>
                </div>
              </div>
            </div>

            <p className="text-text-secondary">
              When a Body piece drops, you're compared against everyone else who needs it. Highest
              score wins.
            </p>
          </Section>

          {/* Role Priority */}
          <Section id="role-priority" title="Role priority">
            <p className="text-text-secondary mb-4">
              Your static lead sets the role order. The default prioritizes DPS because gear
              upgrades on damage dealers typically help the most with clearing content.
            </p>

            <div className="space-y-2 mb-6">
              {[
                { role: 'Melee', score: 125, colorClass: 'bg-role-melee', desc: 'MNK, DRG, NIN, SAM, RPR, VPR' },
                { role: 'Ranged', score: 100, colorClass: 'bg-role-ranged', desc: 'BRD, MCH, DNC' },
                { role: 'Caster', score: 75, colorClass: 'bg-role-caster', desc: 'BLM, SMN, RDM, PCT' },
                { role: 'Tank', score: 50, colorClass: 'bg-role-tank', desc: 'PLD, WAR, DRK, GNB' },
                { role: 'Healer', score: 25, colorClass: 'bg-role-healer', desc: 'WHM, SCH, AST, SGE' },
              ].map((item, index) => (
                <div
                  key={item.role}
                  className="flex items-center gap-4 bg-surface-card border border-border-subtle rounded-lg p-3"
                >
                  <div className="text-lg font-bold text-text-muted w-8">#{index + 1}</div>
                  <div className={`w-4 h-4 rounded-full ${item.colorClass}`} />
                  <div className="flex-1">
                    <div className="font-medium text-text-primary">{item.role}</div>
                    <div className="text-xs text-text-muted">{item.desc}</div>
                  </div>
                  <div className="text-accent font-mono">+{item.score}</div>
                </div>
              ))}
            </div>

            <InfoBox type="info">
              This order is customizable. Some statics prioritize tanks or healers—talk to your lead
              if you want to change it.
            </InfoBox>
          </Section>

          {/* Gear Need */}
          <Section id="gear-need" title="Gear need">
            <p className="text-text-secondary mb-4">
              The more slots you're missing, the higher your priority. But not all slots are worth
              the same—body and legs give more stats than accessories.
            </p>

            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default">
                    <th className="text-left py-2 text-text-muted font-medium">Slot</th>
                    <th className="text-right py-2 text-text-muted font-medium">Weight</th>
                    <th className="text-left py-2 pl-4 text-text-muted font-medium">Why</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  <tr>
                    <td className="py-2 text-text-primary font-medium">Weapon</td>
                    <td className="py-2 text-right text-accent font-mono">3.0</td>
                    <td className="py-2 pl-4 text-text-secondary">Biggest stat budget + weapon damage</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-text-primary font-medium">Body / Legs</td>
                    <td className="py-2 text-right text-accent font-mono">1.5</td>
                    <td className="py-2 pl-4 text-text-secondary">Large left-side pieces</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-text-primary font-medium">Head / Hands / Feet</td>
                    <td className="py-2 text-right text-accent font-mono">1.0</td>
                    <td className="py-2 pl-4 text-text-secondary">Standard left-side</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-text-primary font-medium">Accessories</td>
                    <td className="py-2 text-right text-accent font-mono">0.8</td>
                    <td className="py-2 pl-4 text-text-secondary">Smaller stat contribution</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-text-secondary">
              Your total need is the sum of weights for slots you're missing, multiplied by 10. So
              needing Body (1.5) + Hands (1.0) = 2.5 × 10 = <strong>25 points</strong>.
            </p>
          </Section>

          {/* Loot Received */}
          <Section id="loot-received" title="Loot received">
            <p className="text-text-secondary mb-4">
              Each time you get a drop, your priority goes down a bit. This keeps one person from
              scooping up all the loot while others wait.
            </p>

            <div className="bg-surface-card border border-border-subtle rounded-lg p-4 mb-4">
              <p className="text-text-secondary text-sm">
                The penalty is <strong className="text-accent">-15 points</strong> per loot
                adjustment. Your lead can tweak this if someone joins mid-tier with extra gear or
                joins late and needs to catch up.
              </p>
            </div>

            <InfoBox type="tip">
              Adjustments reset each tier. Starting fresh? Everyone's on equal footing again.
            </InfoBox>
          </Section>

          {/* Weapon Priority */}
          <Section id="weapon-priority" title="Weapon priority">
            <p className="text-text-secondary mb-4">
              Weapons work differently. Instead of competing for one weapon type, you build a
              priority list of jobs you want weapons for.
            </p>

            <h3 className="text-lg font-medium text-text-primary mb-3">How it works</h3>

            <ol className="list-decimal list-inside text-text-secondary space-y-2 mb-6">
              <li>Each player sets their weapon priority list (main job first, then alts)</li>
              <li>All main jobs get weapons first, in role priority order</li>
              <li>Once mains are done, alt jobs are considered by rank in each player's list</li>
            </ol>

            <InfoBox type="info">
              The weapon coffer from floor 4 can be opened on any job. Your list tells leads which
              job you'd use it on.
            </InfoBox>
          </Section>

          {/* Main vs Alt */}
          <Section id="main-vs-alt" title="Main job vs alt weapons">
            <p className="text-text-secondary mb-4">
              Your main job (the one on your player card) gets a huge bonus. This guarantees you get
              your main weapon before any alt weapons are distributed.
            </p>

            <div className="bg-surface-card border border-border-subtle rounded-lg p-4 mb-6">
              <p className="text-text-secondary mb-3">Example scores for a Melee DPS:</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-primary">Main job (DRG)</span>
                  <span className="text-accent font-mono font-medium">3,500 pts</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">First alt (MNK)</span>
                  <span className="text-text-muted font-mono">1,000 pts</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Second alt (SAM)</span>
                  <span className="text-text-muted font-mono">900 pts</span>
                </div>
              </div>
            </div>

            <p className="text-text-secondary">
              The 2,000+ point gap means every main job weapon is distributed before any alt
              weapons, regardless of who wants what alt.
            </p>
          </Section>

          {/* Book System */}
          <Section id="book-system" title="The book system">
            <p className="text-text-secondary mb-4">
              Books are bad-luck protection. Each floor clear gives you a book you can save up and
              exchange for gear if drops don't go your way.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { floor: 'Floor 1', book: 'Book I', gear: 'Accessories', color: 'text-status-info' },
                { floor: 'Floor 2', book: 'Book II', gear: 'Head/Hands/Feet', color: 'text-status-success' },
                { floor: 'Floor 3', book: 'Book III', gear: 'Body/Legs', color: 'text-status-warning' },
                { floor: 'Floor 4', book: 'Book IV', gear: 'Weapon', color: 'text-accent' },
              ].map((item) => (
                <div
                  key={item.floor}
                  className="bg-surface-card border border-border-subtle rounded-lg p-4 text-center"
                >
                  <div className={`text-lg font-bold ${item.color} mb-1`}>{item.book}</div>
                  <div className="text-sm text-text-primary mb-1">{item.floor}</div>
                  <div className="text-xs text-text-muted">{item.gear}</div>
                </div>
              ))}
            </div>

            <p className="text-text-secondary">
              One clear = one book. The app tracks how many you've earned vs spent.
            </p>
          </Section>

          {/* Exchange Costs */}
          <Section id="exchange-costs" title="Exchange costs">
            <p className="text-text-secondary mb-4">How many books you need to trade for gear:</p>

            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default">
                    <th className="text-left py-2 text-text-muted font-medium">Slot</th>
                    <th className="text-right py-2 text-text-muted font-medium">Books</th>
                    <th className="text-left py-2 pl-4 text-text-muted font-medium">Book Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  <tr>
                    <td className="py-2 text-text-primary font-medium">Weapon</td>
                    <td className="py-2 text-right text-accent font-mono">8</td>
                    <td className="py-2 pl-4 text-text-secondary">Book IV (Floor 4)</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-text-primary font-medium">Body / Legs</td>
                    <td className="py-2 text-right text-accent font-mono">6</td>
                    <td className="py-2 pl-4 text-text-secondary">Book III (Floor 3)</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-text-primary font-medium">Head / Hands / Feet</td>
                    <td className="py-2 text-right text-accent font-mono">4</td>
                    <td className="py-2 pl-4 text-text-secondary">Book II (Floor 2)</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-text-primary font-medium">Accessories</td>
                    <td className="py-2 text-right text-accent font-mono">3</td>
                    <td className="py-2 pl-4 text-text-secondary">Book I (Floor 1)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4">
              <LinkCard
                href="/docs/how-to#track-balances"
                title="Track your book balance"
                description="See how to check earned vs spent books"
              />
            </div>

          </Section>
        </main>
      </div>
    </div>
  );
}
