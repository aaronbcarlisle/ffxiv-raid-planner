/**
 * Loot & Priority Math Documentation
 *
 * Explains the priority calculation system, loot distribution formulas,
 * and book/page economy for fair raid loot management.
 *
 * Accessible at: /docs/loot-math
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

// Navigation items grouped by category
const NAV_GROUPS = [
  {
    label: 'Concepts',
    items: [
      { id: 'overview', label: 'How Priority Works' },
      { id: 'role-priority', label: 'Role Priority' },
      { id: 'slot-weights', label: 'Slot Value Weights' },
    ],
  },
  {
    label: 'Gear Priority',
    items: [
      { id: 'gear-scoring', label: 'Gear Priority Scoring' },
      { id: 'loot-adjustment', label: 'Loot Adjustments' },
      { id: 'material-priority', label: 'Material Priority' },
    ],
  },
  {
    label: 'Weapon Priority',
    items: [
      { id: 'weapon-system', label: 'Weapon Priority System' },
      { id: 'main-job-bonus', label: 'Main Job Bonus' },
      { id: 'off-job-weapons', label: 'Off-Job Weapons' },
    ],
  },
  {
    label: 'Book Economy',
    items: [
      { id: 'book-system', label: 'Book/Page System' },
      { id: 'book-costs', label: 'Exchange Costs' },
    ],
  },
  {
    label: 'Technical Reference',
    items: [
      { id: 'formulas', label: 'Formulas & Code' },
      { id: 'reference-tables', label: 'Reference Tables' },
    ],
  },
];

// Flat list for scroll tracking
const NAV_SECTIONS = NAV_GROUPS.flatMap(group => group.items);

// Section header component
function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-12 scroll-mt-6">
      <h2 className="text-2xl font-semibold text-accent mb-6 pb-2 border-b border-border-default">
        {title}
      </h2>
      {children}
    </section>
  );
}

// Subsection component
function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="text-lg font-medium text-text-primary mb-4">{title}</h3>
      {children}
    </div>
  );
}

// Formula display component
function FormulaBlock({
  formula,
  description,
  variables
}: {
  formula: string;
  description?: string;
  variables?: Array<{ name: string; value: string }>;
}) {
  return (
    <div className="bg-surface-elevated border border-border-subtle rounded-lg p-4 my-4">
      <code className="text-lg text-accent font-mono block mb-2">{formula}</code>
      {description && <p className="text-text-secondary text-sm mb-3">{description}</p>}
      {variables && (
        <dl className="text-sm space-y-1">
          {variables.map(v => (
            <div key={v.name} className="flex gap-2">
              <dt className="font-mono text-accent">{v.name}</dt>
              <dd className="text-text-muted">= {v.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

// Code block component
function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="bg-surface-elevated border border-border-subtle rounded-lg p-4 overflow-x-auto">
      <code className="text-sm text-text-primary font-mono whitespace-pre">{code}</code>
    </pre>
  );
}

// Info callout component
function InfoBox({
  type = 'info',
  title,
  children
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

// Sidebar Navigation Component
function NavSidebar({
  activeSection,
  onSectionClick
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
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  const handleClick = (id: string) => {
    onSectionClick(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="sticky top-16 w-56 shrink-0 hidden lg:block self-start h-fit z-30">
      <div className="relative bg-surface-card border border-border-subtle rounded-lg">
        <div
          className={`
            absolute top-0 left-0 right-0 h-6 rounded-t-lg pointer-events-none z-10
            bg-gradient-to-b from-surface-card to-transparent
            transition-opacity duration-150
            ${scrollState.top ? 'opacity-0' : 'opacity-100'}
          `}
        />

        <div
          ref={scrollContainerRef}
          className="p-3 max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-thin"
        >
          {NAV_GROUPS.map((group, groupIndex) => {
            const isCollapsed = collapsedGroups.has(group.label);
            const itemCount = group.items.length;

            return (
              <div key={group.label} className={groupIndex > 0 ? 'mt-3' : ''}>
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="
                    w-full flex items-center justify-between
                    text-[9px] font-semibold text-text-muted/70 uppercase tracking-[0.1em]
                    mb-1 px-1 py-0.5 rounded
                    hover:text-text-muted hover:bg-surface-interactive cursor-pointer
                  "
                >
                  <span>{group.label}</span>
                  <span className="flex items-center gap-1">
                    <span className="text-[9px] font-normal tracking-normal opacity-60">
                      {itemCount}
                    </span>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`}
                    />
                  </span>
                </button>

                {!isCollapsed && (
                  <ul className="space-y-px">
                    {group.items.map((section) => (
                      <li key={section.id}>
                        <button
                          onClick={() => handleClick(section.id)}
                          className={`
                            w-full text-left pl-3 pr-2 py-1.5 text-[13px] rounded transition-colors
                            ${activeSection === section.id
                              ? 'bg-accent/10 text-accent font-medium'
                              : 'text-text-secondary hover:text-text-primary hover:bg-surface-interactive'
                            }
                          `}
                        >
                          {section.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {isCollapsed && (
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className="w-full text-left pl-3 pr-2 py-1.5 text-[12px] text-text-muted hover:text-text-secondary rounded hover:bg-surface-interactive transition-colors"
                  >
                    {itemCount} items...
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div
          className={`
            absolute bottom-0 left-0 right-0 h-6 rounded-b-lg pointer-events-none z-10
            bg-gradient-to-t from-surface-card to-transparent
            transition-opacity duration-150
            ${scrollState.bottom ? 'opacity-0' : 'opacity-100'}
          `}
        />
      </div>
    </nav>
  );
}

export default function LootMathDocs() {
  const location = useLocation();
  const navigate = useNavigate();
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
        if (scrollEndTimeoutRef.current) {
          clearTimeout(scrollEndTimeoutRef.current);
        }
        scrollEndTimeoutRef.current = window.setTimeout(() => {
          isScrollingRef.current = false;
        }, 150);
        return;
      }

      const threshold = 120;
      const viewportHeight = window.innerHeight;

      const sections = NAV_SECTIONS.map(s => ({
        id: s.id,
        element: document.getElementById(s.id)
      })).filter(s => s.element);

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

      if (!bestSection) {
        bestSection = sections[0]?.id || 'overview';
      }

      setActiveSection(prev => {
        if (prev !== bestSection) {
          // Update URL hash when active section changes from scroll
          window.history.replaceState(null, '', `#${bestSection}`);
        }
        return bestSection;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollEndTimeoutRef.current) {
        clearTimeout(scrollEndTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-surface-base">
      {/* Header */}
      <header className="bg-surface-raised border-b border-border-default">
        <div className="max-w-[120rem] mx-auto px-6 lg:px-8 py-8">
          <div className="flex items-center gap-2 text-sm text-text-muted mb-2">
            <a href="/docs" className="hover:text-accent transition-colors">Documentation</a>
            <span>/</span>
            <span className="text-text-secondary">Loot & Priority Math</span>
          </div>
          <h1 className="text-3xl font-bold text-accent">Loot & Priority Math</h1>
          <p className="text-text-secondary mt-2">
            Understanding how loot priority calculations ensure fair distribution across your static
          </p>
        </div>
      </header>

      {/* Content with Sidebar */}
      <div className="max-w-[120rem] mx-auto px-6 lg:px-8 py-8 flex gap-8">
        <NavSidebar activeSection={activeSection} onSectionClick={handleNavClick} />

        <main className="flex-1 min-w-0">
          {/* Overview */}
          <Section id="overview" title="How Priority Works">
            <p className="text-text-secondary mb-6">
              The priority system ensures fair loot distribution by calculating a score for each player
              based on their role, how much gear they still need, and any adjustments for mid-tier roster changes.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="text-2xl font-bold text-accent mb-2">Role</div>
                <p className="text-sm text-text-secondary">
                  DPS roles typically get priority as gear improvements translate to more raid DPS.
                </p>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="text-2xl font-bold text-accent mb-2">Need</div>
                <p className="text-sm text-text-secondary">
                  Players missing more high-value slots get higher priority.
                </p>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="text-2xl font-bold text-accent mb-2">Fairness</div>
                <p className="text-sm text-text-secondary">
                  Adjustments ensure players joining mid-tier aren't disadvantaged.
                </p>
              </div>
            </div>

            <InfoBox type="tip" title="Customizable">
              Static owners can customize the role priority order in Static Settings to match
              their static's loot council philosophy.
            </InfoBox>
          </Section>

          {/* Role Priority */}
          <Section id="role-priority" title="Role Priority">
            <p className="text-text-secondary mb-6">
              Role priority determines the base score a player gets. The default order prioritizes
              DPS roles because gear upgrades on damage dealers typically provide the largest
              raid-wide DPS increase.
            </p>

            <Subsection title="Default Priority Order">
              <div className="space-y-2 mb-6">
                {[
                  { role: 'Melee', score: 125, colorClass: 'bg-role-melee', jobs: 'MNK, DRG, NIN, SAM, RPR, VPR' },
                  { role: 'Ranged', score: 100, colorClass: 'bg-role-ranged', jobs: 'BRD, MCH, DNC' },
                  { role: 'Caster', score: 75, colorClass: 'bg-role-caster', jobs: 'BLM, SMN, RDM, PCT' },
                  { role: 'Tank', score: 50, colorClass: 'bg-role-tank', jobs: 'PLD, WAR, DRK, GNB' },
                  { role: 'Healer', score: 25, colorClass: 'bg-role-healer', jobs: 'WHM, SCH, AST, SGE' },
                ].map((item, index) => (
                  <div key={item.role} className="flex items-center gap-4 bg-surface-card border border-border-subtle rounded-lg p-3">
                    <div className="text-lg font-bold text-text-muted w-8">#{index + 1}</div>
                    <div
                      className={`w-4 h-4 rounded-full ${item.colorClass}`}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-text-primary">{item.role}</div>
                      <div className="text-xs text-text-muted">{item.jobs}</div>
                    </div>
                    <div className="text-accent font-mono">+{item.score} pts</div>
                  </div>
                ))}
              </div>
            </Subsection>

            <FormulaBlock
              formula="rolePriority = (5 - roleIndex) × 25"
              description="Where roleIndex is the position in the priority list (0-4)"
              variables={[
                { name: 'roleIndex', value: '0 for highest priority, 4 for lowest' },
                { name: 'result', value: '125, 100, 75, 50, or 25 points' },
              ]}
            />
          </Section>

          {/* Slot Value Weights */}
          <Section id="slot-weights" title="Slot Value Weights">
            <p className="text-text-secondary mb-6">
              Not all gear slots are created equal. Weapons and left-side gear (body, legs) provide
              more stats than accessories, so they're weighted more heavily in priority calculations.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default">
                    <th className="text-left py-2 text-text-muted font-medium">Slot</th>
                    <th className="text-right py-2 text-text-muted font-medium">Weight</th>
                    <th className="text-left py-2 pl-4 text-text-muted font-medium">Rationale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  <tr>
                    <td className="py-2 text-text-primary font-medium">Weapon</td>
                    <td className="py-2 text-right text-accent font-mono">3.0</td>
                    <td className="py-2 pl-4 text-text-secondary">Highest stat budget, includes weapon damage</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-text-primary font-medium">Body / Legs</td>
                    <td className="py-2 text-right text-accent font-mono">1.5</td>
                    <td className="py-2 pl-4 text-text-secondary">Large left-side pieces with high stat budget</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-text-primary font-medium">Head / Hands / Feet</td>
                    <td className="py-2 text-right text-accent font-mono">1.0</td>
                    <td className="py-2 pl-4 text-text-secondary">Standard left-side pieces</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-text-primary font-medium">Accessories</td>
                    <td className="py-2 text-right text-accent font-mono">0.8</td>
                    <td className="py-2 pl-4 text-text-secondary">Earring, Necklace, Bracelet, Rings</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <InfoBox type="info" title="Total Possible Weight">
              If a player needs all 11 slots (weapon + 5 left-side + 5 accessories), their total
              weighted need would be: 3.0 + 1.5×2 + 1.0×3 + 0.8×5 = <strong>13.0</strong>
            </InfoBox>
          </Section>

          {/* Gear Priority Scoring */}
          <Section id="gear-scoring" title="Gear Priority Scoring">
            <p className="text-text-secondary mb-6">
              The final priority score combines role priority, weighted gear need, and any loot adjustments.
            </p>

            <FormulaBlock
              formula="Priority = rolePriority + (weightedNeed × 10) - (lootAdjustment × 15)"
              description="Higher score = higher priority for loot"
              variables={[
                { name: 'rolePriority', value: '25-125 based on role (see above)' },
                { name: 'weightedNeed', value: 'Sum of slot weights for incomplete slots' },
                { name: 'lootAdjustment', value: 'Manual adjustment for roster changes' },
              ]}
            />

            <Subsection title="Example Calculation">
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <p className="text-text-secondary mb-3">
                  A <span className="text-role-melee font-medium">Melee DPS</span> needs: Body, Hands, Ring
                </p>
                <div className="space-y-1 text-sm font-mono">
                  <div>Role Priority (Melee, index 0): <span className="text-accent">(5 - 0) × 25 = 125</span></div>
                  <div>Weighted Need: <span className="text-accent">1.5 + 1.0 + 0.8 = 3.3</span></div>
                  <div>Weighted Need × 10: <span className="text-accent">33</span></div>
                  <div className="pt-2 border-t border-border-subtle">
                    <span className="text-text-primary font-semibold">Total Priority: </span>
                    <span className="text-accent font-semibold">125 + 33 = 158</span>
                  </div>
                </div>
              </div>
            </Subsection>
          </Section>

          {/* Loot Adjustments */}
          <Section id="loot-adjustment" title="Loot Adjustments">
            <p className="text-text-secondary mb-6">
              When players join mid-tier or bring gear from other sources, adjustments help
              maintain fairness.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <h4 className="font-medium text-text-primary mb-2">Positive Adjustment</h4>
                <p className="text-sm text-text-secondary mb-2">
                  Player came with extra gear (e.g., alt with drops from PF)
                </p>
                <div className="text-sm font-mono text-status-warning">
                  +3 adjustment → -45 priority
                </div>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <h4 className="font-medium text-text-primary mb-2">Negative Adjustment</h4>
                <p className="text-sm text-text-secondary mb-2">
                  Player joined late and missed loot opportunities
                </p>
                <div className="text-sm font-mono text-status-success">
                  -2 adjustment → +30 priority
                </div>
              </div>
            </div>

            <Subsection title="Page Adjustments">
              <p className="text-text-secondary mb-4">
                For book/page tracking, separate adjustments exist for each floor:
              </p>
              <CodeBlock code={`pageAdjustments: {
  I: 0,    // Floor 1 (M9S) books
  II: 0,   // Floor 2 (M10S) books
  III: 0,  // Floor 3 (M11S) books
  IV: 0    // Floor 4 (M12S) books
}`} />
            </Subsection>
          </Section>

          {/* Material Priority */}
          <Section id="material-priority" title="Material Priority">
            <p className="text-text-secondary mb-6">
              Upgrade materials (Twine, Glaze, Solvent) have their own priority calculation
              based on how many unaugmented tome pieces a player has.
            </p>

            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default">
                    <th className="text-left py-2 text-text-muted font-medium">Material</th>
                    <th className="text-left py-2 text-text-muted font-medium">Upgrades</th>
                    <th className="text-left py-2 text-text-muted font-medium">Drops From</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  <tr>
                    <td className="py-2 text-text-primary font-medium">Twine</td>
                    <td className="py-2 text-text-secondary">Head, Body, Hands, Legs, Feet</td>
                    <td className="py-2 text-text-secondary">Floor 3 (M11S)</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-text-primary font-medium">Glaze</td>
                    <td className="py-2 text-text-secondary">Earring, Necklace, Bracelet, Rings</td>
                    <td className="py-2 text-text-secondary">Floor 2 (M10S)</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-text-primary font-medium">Solvent</td>
                    <td className="py-2 text-text-secondary">Weapon</td>
                    <td className="py-2 text-text-secondary">Floor 3 (M11S)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <FormulaBlock
              formula="materialPriority = basePriority + (unaugmentedCount × 15)"
              description="Players with more unaugmented tome pieces get higher material priority"
            />
          </Section>

          {/* Weapon Priority System */}
          <Section id="weapon-system" title="Weapon Priority System">
            <p className="text-text-secondary mb-6">
              Weapon priority is handled separately from gear priority. Each player maintains
              an ordered list of weapons they want, and the system calculates who should get
              each weapon type.
            </p>

            <InfoBox type="info" title="Why Separate?">
              Weapons are unique—players often want weapons for alt jobs, and weapon coffers
              drop from the final floor. This system lets statics plan weapon distribution
              across multiple jobs fairly.
            </InfoBox>
          </Section>

          {/* Main Job Bonus */}
          <Section id="main-job-bonus" title="Main Job Bonus">
            <p className="text-text-secondary mb-6">
              Your main job (the job on your player card) gets a massive priority bonus
              to ensure you always get your main weapon before off-jobs.
            </p>

            <FormulaBlock
              formula="weaponScore = roleScore + rankScore + mainJobBonus"
              description="Main job bonus of 2000 points exceeds any other combination"
              variables={[
                { name: 'roleScore', value: '(5 - roleIndex) × 100 (only for main job)' },
                { name: 'rankScore', value: '1000 - (rank × 100)' },
                { name: 'mainJobBonus', value: '2000 (only for main job)' },
              ]}
            />

            <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
              <p className="text-text-secondary mb-3">Example scores for a Melee DPS:</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-primary">Main job weapon (DRG)</span>
                  <span className="text-accent font-mono">500 + 1000 + 2000 = 3500</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">First off-job (MNK)</span>
                  <span className="text-text-muted font-mono">0 + 1000 + 0 = 1000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Second off-job (SAM)</span>
                  <span className="text-text-muted font-mono">0 + 900 + 0 = 900</span>
                </div>
              </div>
            </div>
          </Section>

          {/* Off-Job Weapons */}
          <Section id="off-job-weapons" title="Off-Job Weapons">
            <p className="text-text-secondary mb-6">
              After all main job weapons are distributed, off-job weapons are assigned
              based on the rank in each player's priority list.
            </p>

            <Subsection title="Rank Scoring">
              <div className="space-y-2">
                {[0, 1, 2, 3, 4].map(rank => (
                  <div key={rank} className="flex items-center gap-4">
                    <span className="w-24 text-text-secondary">Rank {rank + 1}</span>
                    <div className="flex-1 bg-surface-elevated rounded h-4 overflow-hidden">
                      <div
                        className="h-full bg-accent"
                        style={{ width: `${(1000 - rank * 100) / 10}%` }}
                      />
                    </div>
                    <span className="w-20 text-right font-mono text-accent">{1000 - rank * 100} pts</span>
                  </div>
                ))}
              </div>
            </Subsection>

            <InfoBox type="tip" title="Tie Breaking">
              When players have the same score, they're grouped together and marked as tied
              in the UI. The static lead can then decide how to break ties (dice roll, etc.).
            </InfoBox>
          </Section>

          {/* Book System */}
          <Section id="book-system" title="Book/Page System">
            <p className="text-text-secondary mb-6">
              Each savage floor drops books (pages) that can be accumulated and exchanged
              for gear as a bad-luck protection system.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { floor: 'Floor 1', book: 'Book I', gear: 'Accessories' },
                { floor: 'Floor 2', book: 'Book II', gear: 'Head/Hands/Feet' },
                { floor: 'Floor 3', book: 'Book III', gear: 'Body/Legs' },
                { floor: 'Floor 4', book: 'Book IV', gear: 'Weapon' },
              ].map(item => (
                <div key={item.floor} className="bg-surface-card border border-border-subtle rounded-lg p-4 text-center">
                  <div className="text-lg font-bold text-accent mb-1">{item.book}</div>
                  <div className="text-sm text-text-primary mb-1">{item.floor}</div>
                  <div className="text-xs text-text-muted">{item.gear}</div>
                </div>
              ))}
            </div>

            <p className="text-text-secondary">
              The planner tracks earned books (from clearing floors) and spent books
              (exchanged for gear) to show each player's current balance.
            </p>
          </Section>

          {/* Book Costs */}
          <Section id="book-costs" title="Exchange Costs">
            <p className="text-text-secondary mb-6">
              Different slots require different numbers of books to exchange.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default">
                    <th className="text-left py-2 text-text-muted font-medium">Slot</th>
                    <th className="text-right py-2 text-text-muted font-medium">Books Required</th>
                    <th className="text-left py-2 pl-4 text-text-muted font-medium">Book Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  <tr>
                    <td className="py-2 text-text-primary font-medium">Weapon</td>
                    <td className="py-2 text-right text-accent font-mono">8</td>
                    <td className="py-2 pl-4 text-text-secondary">Book IV</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-text-primary font-medium">Body / Legs</td>
                    <td className="py-2 text-right text-accent font-mono">6</td>
                    <td className="py-2 pl-4 text-text-secondary">Book III</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-text-primary font-medium">Head / Hands / Feet</td>
                    <td className="py-2 text-right text-accent font-mono">4</td>
                    <td className="py-2 pl-4 text-text-secondary">Book II</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-text-primary font-medium">Accessories</td>
                    <td className="py-2 text-right text-accent font-mono">3</td>
                    <td className="py-2 pl-4 text-text-secondary">Book I</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* Technical Reference - Formulas */}
          <Section id="formulas" title="Formulas & Code">
            <p className="text-text-secondary mb-6">
              Technical reference for developers and power users. All formulas are implemented
              in the frontend utility files.
            </p>

            <Subsection title="Priority Score (utils/priority.ts)">
              <CodeBlock code={`function calculatePriorityScore(
  player: SnapshotPlayer,
  lootPriority: RoleType[],
  options?: { includeLootAdjustment?: boolean }
): number {
  // Role priority: (5 - roleIndex) × 25
  const roleIndex = lootPriority.indexOf(player.role as RoleType);
  const rolePriority = roleIndex === -1 ? 0 : (5 - roleIndex) * 25;

  // Weighted gear need (sum of slot weights for incomplete slots)
  const weightedNeed = player.gear
    .filter(slot => !isSlotComplete(slot))
    .reduce((sum, slot) => sum + (SLOT_VALUE_WEIGHTS[slot.slot] || 1), 0);

  // Loot adjustment penalty/bonus
  const adjustment = options?.includeLootAdjustment
    ? (player.lootAdjustment || 0) * 15
    : 0;

  return rolePriority + (weightedNeed * 10) - adjustment;
}`} />
            </Subsection>

            <Subsection title="Weapon Priority (utils/weaponPriority.ts)">
              <CodeBlock code={`function calculateWeaponScore(
  player: SnapshotPlayer,
  job: string,
  rank: number,
  lootPriority: RoleType[]
): number {
  const isMainJob = player.job === job;
  const roleIndex = lootPriority.indexOf(player.role as RoleType);

  // Role score (only for main job)
  const roleScore = isMainJob && roleIndex !== -1
    ? (5 - roleIndex) * 100
    : 0;

  // Rank score (position in player's weapon list)
  const rankScore = Math.max(0, 1000 - rank * 100);

  // Main job bonus
  const mainJobBonus = isMainJob ? 2000 : 0;

  return roleScore + rankScore + mainJobBonus;
}`} />
            </Subsection>
          </Section>

          {/* Reference Tables */}
          <Section id="reference-tables" title="Reference Tables">
            <Subsection title="Slot Value Weights">
              <CodeBlock code={`const SLOT_VALUE_WEIGHTS: Record<GearSlot, number> = {
  weapon: 3.0,
  body: 1.5,
  legs: 1.5,
  head: 1.0,
  hands: 1.0,
  feet: 1.0,
  earring: 0.8,
  necklace: 0.8,
  bracelet: 0.8,
  ring1: 0.8,
  ring2: 0.8,
};`} />
            </Subsection>

            <Subsection title="Book Exchange Costs">
              <CodeBlock code={`const BOOK_COSTS: Record<GearSlot, number> = {
  weapon: 8,
  body: 6,
  legs: 6,
  head: 4,
  hands: 4,
  feet: 4,
  earring: 3,
  necklace: 3,
  bracelet: 3,
  ring1: 3,
  ring2: 3,
};`} />
            </Subsection>

            <Subsection title="Tomestone Costs">
              <CodeBlock code={`const TOME_COSTS: Record<GearSlot, number> = {
  weapon: 500,  // + weapon token from normal raid
  body: 825,
  legs: 825,
  head: 495,
  hands: 495,
  feet: 495,
  earring: 375,
  necklace: 375,
  bracelet: 375,
  ring1: 375,
  ring2: 375,
};

const WEEKLY_CAP = 450;  // Tomestones per week`} />
            </Subsection>
          </Section>
        </main>
      </div>
    </div>
  );
}
