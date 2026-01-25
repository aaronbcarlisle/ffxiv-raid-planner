/**
 * Gear Math Reference - Developer technical documentation
 *
 * Comprehensive reference for all calculation systems: priority, gear state,
 * item level, costs, and loot tables.
 *
 * Accessible at: /docs/gear-math
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CodeBlock, LinkCard, NavSidebar } from '../components/docs';

// Navigation items
const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { id: 'introduction', label: 'Introduction' },
      { id: 'architecture', label: 'Architecture' },
    ],
  },
  {
    label: 'Priority System',
    items: [
      { id: 'base-priority', label: 'Base priority score' },
      { id: 'score-breakdown', label: 'Score breakdown' },
      { id: 'enhanced-priority', label: 'Enhanced priority' },
      { id: 'material-priority', label: 'Material priority' },
      { id: 'weapon-priority', label: 'Weapon priority' },
    ],
  },
  {
    label: 'Gear State',
    items: [
      { id: 'three-state-model', label: 'Three-state model' },
      { id: 'slot-completion', label: 'Slot completion' },
      { id: 'augmentation-logic', label: 'Augmentation logic' },
    ],
  },
  {
    label: 'Item Level',
    items: [
      { id: 'ilv-calculation', label: 'iLv calculation' },
      { id: 'source-categories', label: 'Source categories' },
      { id: 'tier-configuration', label: 'Tier configuration' },
    ],
  },
  {
    label: 'Cost Systems',
    items: [
      { id: 'book-exchange', label: 'Book exchange' },
      { id: 'tomestone-costs', label: 'Tomestone costs' },
      { id: 'weeks-calculation', label: 'Weeks to complete' },
    ],
  },
  {
    label: 'Loot Tables',
    items: [
      { id: 'floor-drops', label: 'Floor drops' },
      { id: 'material-mapping', label: 'Material mapping' },
      { id: 'ring-selection', label: 'Ring selection' },
    ],
  },
  {
    label: 'Reference',
    items: [
      { id: 'type-definitions', label: 'Type definitions' },
      { id: 'constants', label: 'Constants' },
      { id: 'source-files', label: 'Source files' },
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

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="text-lg font-medium text-text-primary mb-4">{title}</h3>
      {children}
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

// Formula display components
function FormulaDisplay({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-border-subtle rounded-lg p-4 font-mono text-sm overflow-x-auto mb-4" style={{ backgroundColor: 'rgba(6, 6, 8, 1)' }}>
      {children}
    </div>
  );
}

function FormulaLine({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 last:mb-0">{children}</div>;
}

function Variable({ children }: { children: React.ReactNode }) {
  return <span className="text-accent font-medium">{children}</span>;
}

function Operator({ children }: { children: React.ReactNode }) {
  return <span className="text-text-muted">{children}</span>;
}

function Num({ children }: { children: React.ReactNode }) {
  return <span className="text-status-warning">{children}</span>;
}

function Comment({ children }: { children: React.ReactNode }) {
  return <div className="text-text-muted mt-3 first:mt-0">{children}</div>;
}

export default function GearMathDocs() {
  const location = useLocation();
  const [activeSection, setActiveSection] = useState(() => {
    const hash = window.location.hash;
    if (hash) {
      const id = hash.slice(1);
      if (NAV_SECTIONS.some((s) => s.id === id)) return id;
    }
    return 'introduction';
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

      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const documentHeight = document.documentElement.scrollHeight;
      const maxScroll = documentHeight - viewportHeight;
      const scrollRemaining = maxScroll - scrollTop;

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
        const newSection = bestSection || 'introduction';
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
            <span className="text-text-secondary">Gear Math Reference</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-accent">Gear Math Reference</h1>
            <p className="text-text-secondary mt-1">Technical documentation for calculation systems</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-[120rem] mx-auto px-6 lg:px-8 py-8 flex gap-8">
        <NavSidebar groups={NAV_GROUPS} activeSection={activeSection} onSectionClick={handleNavClick} />

        <main className="flex-1 min-w-0">
          {/* Introduction */}
          <Section id="introduction" title="Introduction">
            <p className="text-text-secondary mb-4">
              This reference documents the calculation systems that power XIV Raid Planner's loot
              distribution and gear tracking features. It covers priority scoring, gear state
              management, item level calculations, and cost systems.
            </p>

            <p className="text-text-secondary mb-6">
              All calculations are performed client-side in TypeScript. The source code is organized
              into utility modules under <code className="text-accent">frontend/src/utils/</code> and
              game data under <code className="text-accent">frontend/src/gamedata/</code>.
            </p>

            <InfoBox type="info">
              This documentation is for developers who want to understand, modify, or integrate with
              the calculation systems. For user-facing explanations, see{' '}
              <Link to="/docs/understanding-priority" className="text-accent hover:underline">
                Understanding Priority
              </Link>.
            </InfoBox>
          </Section>

          {/* Architecture */}
          <Section id="architecture" title="Architecture">
            <p className="text-text-secondary mb-4">
              The calculation systems are split into several modules with clear responsibilities:
            </p>

            <div className="space-y-3 mb-6">
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="font-medium text-accent mb-1">utils/priority.ts</div>
                <p className="text-sm text-text-secondary">
                  Priority score calculations for loot distribution. Includes base priority, item
                  priority, ring priority, and upgrade material priority.
                </p>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="font-medium text-accent mb-1">utils/calculations.ts</div>
                <p className="text-sm text-text-secondary">
                  Gear state management, completion tracking, material calculations, book needs, and
                  item level calculations.
                </p>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="font-medium text-accent mb-1">utils/lootCoordination.ts</div>
                <p className="text-sm text-text-secondary">
                  Cross-store coordination for loot actions. Enhanced priority with loot history,
                  drought bonuses, and balance penalties.
                </p>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="font-medium text-accent mb-1">gamedata/costs.ts</div>
                <p className="text-sm text-text-secondary">
                  Book exchange costs, tomestone costs, slot value weights, and weekly caps.
                </p>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="font-medium text-accent mb-1">gamedata/loot-tables.ts</div>
                <p className="text-sm text-text-secondary">
                  Floor-to-slot mappings, upgrade material slots, and floor parsing utilities.
                </p>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="font-medium text-accent mb-1">gamedata/raid-tiers.ts</div>
                <p className="text-sm text-text-secondary">
                  Tier definitions, item level mappings, and gear source category to iLv conversion.
                </p>
              </div>
            </div>
          </Section>

          {/* Base Priority Score */}
          <Section id="base-priority" title="Base priority score">
            <p className="text-text-secondary mb-4">
              The base priority score determines loot distribution order. Higher scores receive loot
              first. The formula combines role priority, gear need, and optional loot adjustment.
            </p>

            <FormulaDisplay>
              <FormulaLine>
                <Variable>Priority</Variable> <Operator>=</Operator> <Variable>rolePriority</Variable>{' '}
                <Operator>+</Operator> <Operator>(</Operator><Variable>weightedNeed</Variable>{' '}
                <Operator>×</Operator> <Num>10</Num><Operator>)</Operator> <Operator>-</Operator>{' '}
                <Operator>(</Operator><Variable>lootAdjustment</Variable> <Operator>×</Operator>{' '}
                <Num>15</Num><Operator>)</Operator>
              </FormulaLine>

              <Comment>Where:</Comment>
              <FormulaLine>
                <Variable>rolePriority</Variable> <Operator>=</Operator> <Operator>(</Operator>
                <Num>5</Num> <Operator>-</Operator> <Variable>roleIndex</Variable><Operator>)</Operator>{' '}
                <Operator>×</Operator> <Num>25</Num>
              </FormulaLine>
              <FormulaLine>
                <Variable>roleIndex</Variable> <Operator>=</Operator>{' '}
                <span className="text-text-secondary">position in lootPriority array (0-4)</span>
              </FormulaLine>
              <FormulaLine>
                <Variable>weightedNeed</Variable> <Operator>=</Operator>{' '}
                <span className="text-text-secondary">sum of SLOT_VALUE_WEIGHTS for incomplete slots</span>
              </FormulaLine>
              <FormulaLine>
                <Variable>lootAdjustment</Variable> <Operator>=</Operator>{' '}
                <span className="text-text-secondary">manual adjustment for mid-tier roster changes</span>
              </FormulaLine>
            </FormulaDisplay>

            <Subsection title="Role priority values (default order)">
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-default">
                      <th className="text-left py-2 text-text-muted font-medium">Role</th>
                      <th className="text-center py-2 text-text-muted font-medium">Index</th>
                      <th className="text-right py-2 text-text-muted font-medium">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    <tr>
                      <td className="py-2 text-role-melee font-medium">Melee</td>
                      <td className="py-2 text-center text-text-secondary">0</td>
                      <td className="py-2 text-right text-accent font-mono">(5-0) × 25 = 125</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-role-ranged font-medium">Ranged</td>
                      <td className="py-2 text-center text-text-secondary">1</td>
                      <td className="py-2 text-right text-accent font-mono">(5-1) × 25 = 100</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-role-caster font-medium">Caster</td>
                      <td className="py-2 text-center text-text-secondary">2</td>
                      <td className="py-2 text-right text-accent font-mono">(5-2) × 25 = 75</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-role-tank font-medium">Tank</td>
                      <td className="py-2 text-center text-text-secondary">3</td>
                      <td className="py-2 text-right text-accent font-mono">(5-3) × 25 = 50</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-role-healer font-medium">Healer</td>
                      <td className="py-2 text-center text-text-secondary">4</td>
                      <td className="py-2 text-right text-accent font-mono">(5-4) × 25 = 25</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Subsection>

            <Subsection title="Implementation">
              <CodeBlock
                language="typescript"
                title="utils/priority.ts:48-70"
                code={`export function calculatePriorityScore(
  player: SnapshotPlayer,
  settings: StaticSettings,
  options?: PriorityScoreOptions
): number {
  const roleIndex = settings.lootPriority.indexOf(player.role);
  const rolePriority = roleIndex === -1 ? 0 : (5 - roleIndex) * 25;

  const weightedNeed = player.gear
    .filter((g) => !isSlotComplete(g))
    .reduce((sum, g) => sum + (SLOT_VALUE_WEIGHTS[g.slot] || 1), 0);

  let score = Math.round(rolePriority + weightedNeed * 10);

  // Apply loot adjustment for mid-tier roster changes
  if (options?.includeLootAdjustment && player.lootAdjustment) {
    score -= player.lootAdjustment * 15;
  }

  return score;
}`}
              />
            </Subsection>
          </Section>

          {/* Score Breakdown */}
          <Section id="score-breakdown" title="Score breakdown">
            <p className="text-text-secondary mb-4">
              The <code className="text-accent">calculatePriorityScoreWithBreakdown</code> function
              returns a detailed breakdown of each component for UI tooltips:
            </p>

            <CodeBlock
              language="typescript"
              title="PriorityScoreBreakdown interface"
              code={`interface PriorityScoreBreakdown {
  score: number;              // Final computed score
  rolePriority: number;       // (5 - roleIndex) * 25
  weightedNeed: number;       // Sum of slot weights for incomplete slots
  weightedNeedBonus: number;  // weightedNeed * 10
  lootAdjustmentPenalty: number; // lootAdjustment * 15
}`}
            />

            <p className="text-text-secondary mt-4">
              This is used by the Loot Priority panel to show users how their score is calculated.
            </p>
          </Section>

          {/* Enhanced Priority */}
          <Section id="enhanced-priority" title="Enhanced priority">
            <p className="text-text-secondary mb-4">
              Enhanced priority adds loot history adjustments to the base score. This system rewards
              players who haven't received drops recently and penalizes those who are ahead.
            </p>

            <FormulaDisplay>
              <FormulaLine>
                <Variable>enhancedScore</Variable> <Operator>=</Operator> <Variable>baseScore</Variable>{' '}
                <Operator>+</Operator> <Variable>droughtBonus</Variable> <Operator>-</Operator>{' '}
                <Variable>balancePenalty</Variable>
              </FormulaLine>

              <Comment>Where:</Comment>
              <FormulaLine>
                <Variable>droughtBonus</Variable> <Operator>=</Operator> <span className="text-text-secondary">min(</span>
                <Variable>weeksSinceLastDrop</Variable> <Operator>×</Operator> <Num>10</Num>
                <span className="text-text-secondary">, 50)</span>
              </FormulaLine>
              <FormulaLine>
                <Variable>balancePenalty</Variable> <Operator>=</Operator> <span className="text-text-secondary">min(</span>
                <Variable>excessDrops</Variable> <Operator>×</Operator> <Num>15</Num>
                <span className="text-text-secondary">, 45)</span>
              </FormulaLine>
              <FormulaLine>
                <Variable>excessDrops</Variable> <Operator>=</Operator> <Variable>totalDrops</Variable>{' '}
                <Operator>-</Operator> <Variable>averageDrops</Variable>
              </FormulaLine>
            </FormulaDisplay>

            <div className="grid md:grid-cols-2 gap-4 mt-6 mb-6">
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="text-status-success font-medium mb-2">Drought Bonus</div>
                <p className="text-sm text-text-secondary">
                  +10 points per week without drops, capped at +50 (5 weeks). Rewards patience.
                </p>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="text-status-warning font-medium mb-2">Balance Penalty</div>
                <p className="text-sm text-text-secondary">
                  -15 points per drop above team average, capped at -45 (3 excess). Prevents hoarding.
                </p>
              </div>
            </div>

            <CodeBlock
              language="typescript"
              title="utils/lootCoordination.ts:414-427"
              code={`export function calculateEnhancedPriorityScore(
  baseScore: number,
  stats: PlayerLootStats,
  averageDrops: number
): number {
  // Drought bonus: reward players who haven't received loot recently
  const droughtBonus = Math.min(stats.weeksSinceLastDrop * 10, 50);

  // Balance penalty: penalize players who are ahead of the curve
  const excessDrops = stats.totalDrops - averageDrops;
  const balancePenalty = excessDrops > 0 ? Math.min(excessDrops * 15, 45) : 0;

  return Math.round(baseScore + droughtBonus - balancePenalty);
}`}
            />
          </Section>

          {/* Material Priority */}
          <Section id="material-priority" title="Material priority">
            <p className="text-text-secondary mb-4">
              Material priority determines who should receive upgrade materials (twine, glaze, solvent).
              It boosts the base score by the number of unaugmented tome pieces the player has.
            </p>

            <FormulaDisplay>
              <FormulaLine>
                <Variable>materialPriority</Variable> <Operator>=</Operator> <Variable>basePriority</Variable>{' '}
                <Operator>+</Operator> <Operator>(</Operator><Variable>effectiveNeed</Variable>{' '}
                <Operator>×</Operator> <Num>15</Num><Operator>)</Operator>
              </FormulaLine>

              <Comment>Where:</Comment>
              <FormulaLine>
                <Variable>effectiveNeed</Variable> <Operator>=</Operator> <Variable>unaugmentedCount</Variable>{' '}
                <Operator>-</Operator> <Variable>receivedCount</Variable>
              </FormulaLine>
              <FormulaLine>
                <Variable>unaugmentedCount</Variable> <Operator>=</Operator>{' '}
                <span className="text-text-secondary">tome BiS pieces with hasItem=true, isAugmented=false</span>
              </FormulaLine>
              <FormulaLine>
                <Variable>receivedCount</Variable> <Operator>=</Operator>{' '}
                <span className="text-text-secondary">materials of this type already received (from log)</span>
              </FormulaLine>
            </FormulaDisplay>

            <InfoBox type="info">
              For solvent, the tome weapon is included if the player is pursuing it
              (<code className="text-accent">tomeWeapon.pursuing</code>) and has it unaugmented.
            </InfoBox>

            <CodeBlock
              language="typescript"
              title="Material to slot mapping"
              code={`// gamedata/loot-tables.ts:119-123

export const UPGRADE_MATERIAL_SLOTS: Record<'twine' | 'glaze' | 'solvent', GearSlot[]> = {
  twine: ['head', 'body', 'hands', 'legs', 'feet'],  // Left-side armor
  glaze: ['earring', 'necklace', 'bracelet', 'ring1', 'ring2'],  // Accessories
  solvent: ['weapon'],  // Weapon only
};`}
            />
          </Section>

          {/* Weapon Priority */}
          <Section id="weapon-priority" title="Weapon priority">
            <p className="text-text-secondary mb-4">
              Weapon priority uses a separate scoring system that ensures main jobs receive weapons
              before any alt jobs, regardless of role priority.
            </p>

            <FormulaDisplay>
              <FormulaLine>
                <Variable>weaponScore</Variable> <Operator>=</Operator> <Variable>roleScore</Variable>{' '}
                <Operator>+</Operator> <Variable>rankScore</Variable> <Operator>+</Operator>{' '}
                <Variable>mainJobBonus</Variable>
              </FormulaLine>

              <Comment>Where:</Comment>
              <FormulaLine>
                <Variable>roleScore</Variable> <Operator>=</Operator> <Operator>(</Operator>
                <Num>5</Num> <Operator>-</Operator> <Variable>roleIndex</Variable><Operator>)</Operator>{' '}
                <Operator>×</Operator> <Num>100</Num>{' '}
                <span className="text-text-muted italic text-xs">(main job only)</span>
              </FormulaLine>
              <FormulaLine>
                <Variable>rankScore</Variable> <Operator>=</Operator> <Num>1000</Num> <Operator>-</Operator>{' '}
                <Operator>(</Operator><Variable>rank</Variable> <Operator>×</Operator> <Num>100</Num>
                <Operator>)</Operator>
              </FormulaLine>
              <FormulaLine>
                <Variable>mainJobBonus</Variable> <Operator>=</Operator> <Num>2000</Num>{' '}
                <span className="text-text-muted italic text-xs">(main job only)</span>
              </FormulaLine>
              <FormulaLine>
                <Variable>rank</Variable> <Operator>=</Operator>{' '}
                <span className="text-text-secondary">position in player's weapon priority list (0-based)</span>
              </FormulaLine>
            </FormulaDisplay>

            <p className="text-text-secondary mt-4 mb-4">
              The 2000-point main job bonus creates a clear separation:
            </p>

            <div className="bg-surface-card border border-border-subtle rounded-lg p-4 mb-6">
              <div className="space-y-2 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-text-primary">Main job (rank 0, melee)</span>
                  <span className="text-accent">500 + 1000 + 2000 = 3500</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Alt #1 (rank 1, no bonus)</span>
                  <span className="text-text-muted">0 + 900 + 0 = 900</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Alt #2 (rank 2, no bonus)</span>
                  <span className="text-text-muted">0 + 800 + 0 = 800</span>
                </div>
              </div>
            </div>
          </Section>

          {/* Three-State Model */}
          <Section id="three-state-model" title="Three-state model">
            <p className="text-text-secondary mb-4">
              Gear slots use a three-state model to track progress:
            </p>

            <CodeBlock
              language="typescript"
              title="Gear state conversion"
              code={`type GearState = 'missing' | 'have' | 'augmented';

// Convert from stored booleans to state
function toGearState(hasItem: boolean, isAugmented: boolean): GearState {
  if (!hasItem) return 'missing';
  if (isAugmented) return 'augmented';
  return 'have';
}

// Convert from state to stored booleans
function fromGearState(state: GearState): { hasItem: boolean; isAugmented: boolean } {
  return {
    hasItem: state !== 'missing',
    isAugmented: state === 'augmented',
  };
}`}
            />

            <div className="grid md:grid-cols-3 gap-4 mt-6">
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="text-status-error font-medium mb-2">Missing</div>
                <p className="text-sm text-text-secondary">
                  <code>hasItem: false</code><br />
                  Player doesn't have this piece yet.
                </p>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="text-status-warning font-medium mb-2">Have</div>
                <p className="text-sm text-text-secondary">
                  <code>hasItem: true, isAugmented: false</code><br />
                  Has item, may need augmentation.
                </p>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="text-status-success font-medium mb-2">Augmented</div>
                <p className="text-sm text-text-secondary">
                  <code>hasItem: true, isAugmented: true</code><br />
                  Fully complete (for tome BiS).
                </p>
              </div>
            </div>
          </Section>

          {/* Slot Completion */}
          <Section id="slot-completion" title="Slot completion">
            <p className="text-text-secondary mb-4">
              A slot is considered complete when the player has achieved their BiS for that slot.
              The logic varies by <code className="text-accent">bisSource</code>:
            </p>

            <CodeBlock
              language="typescript"
              title="utils/calculations.ts:84-99"
              code={`export function isSlotComplete(status: GearSlotStatus): boolean {
  // Unset bisSource = incomplete (must set BiS first)
  if (!status.bisSource) return false;

  // Must have the item
  if (!status.hasItem) return false;

  // Raid, base_tome, and crafted are complete when you have the item
  if (status.bisSource === 'raid') return true;
  if (status.bisSource === 'base_tome') return true;
  if (status.bisSource === 'crafted') return true;

  // Tome BiS - check if augmentation is required
  if (!requiresAugmentation(status)) return true;
  return status.isAugmented;
}`}
            />

            <div className="overflow-x-auto mt-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default">
                    <th className="text-left py-2 text-text-muted font-medium">bisSource</th>
                    <th className="text-left py-2 text-text-muted font-medium">Complete When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  <tr>
                    <td className="py-2 text-accent font-mono">raid</td>
                    <td className="py-2 text-text-secondary">hasItem = true (2-state)</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-accent font-mono">base_tome</td>
                    <td className="py-2 text-text-secondary">hasItem = true (2-state, no augmentation)</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-accent font-mono">crafted</td>
                    <td className="py-2 text-text-secondary">hasItem = true (2-state)</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-accent font-mono">tome</td>
                    <td className="py-2 text-text-secondary">hasItem = true AND isAugmented = true (3-state)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* Augmentation Logic */}
          <Section id="augmentation-logic" title="Augmentation logic">
            <p className="text-text-secondary mb-4">
              Not all tome BiS requires augmentation. The <code className="text-accent">requiresAugmentation</code>{' '}
              function checks whether a slot needs to be augmented to be complete:
            </p>

            <CodeBlock
              language="typescript"
              title="utils/calculations.ts:56-77"
              code={`export function requiresAugmentation(slot: GearSlotStatus): boolean {
  // Null/unset bisSource - no augmentation possible
  if (!slot.bisSource) return false;

  // Only 'tome' requires augmentation
  // base_tome, raid, and crafted are all 2-state
  if (slot.bisSource !== 'tome') return false;

  // BACKWARD COMPATIBILITY: Check item name prefix for legacy data
  // New imports correctly set bisSource='base_tome' for unaugmented items
  if (slot.itemName) {
    const name = slot.itemName.toLowerCase();
    // "Aug. Item Name" or "Augmented Item Name" = BiS is augmented version
    return name.startsWith('aug.') || name.startsWith('augmented');
  }

  // 'tome' bisSource with no item name - assume augmented is target
  return true;
}`}
            />

            <InfoBox type="tip">
              The <code className="text-accent">base_tome</code> bisSource was added to handle cases
              where the unaugmented tome piece is BiS (e.g., when it has better substats than the
              augmented version). Legacy data uses item name prefix detection for backward compatibility.
            </InfoBox>
          </Section>

          {/* iLv Calculation */}
          <Section id="ilv-calculation" title="iLv calculation">
            <p className="text-text-secondary mb-4">
              Average item level is calculated using a priority cascade:
            </p>

            <ol className="list-decimal list-inside text-text-secondary space-y-2 mb-6">
              <li>
                <strong className="text-text-primary">BiS import itemLevel</strong> - If the player has
                the item and <code className="text-accent">itemLevel</code> is set from import
              </li>
              <li>
                <strong className="text-text-primary">Calculated from currentSource</strong> - Using
                tier iLv mappings when itemLevel is unavailable
              </li>
              <li>
                <strong className="text-text-primary">Fallback to crafted</strong> - For{' '}
                <code className="text-accent">unknown</code> source, assumes crafted gear
              </li>
            </ol>

            <InfoBox type="warning">
              Special case: For <code className="text-accent">tome</code> BiS where the player has the
              item but it's NOT augmented, use the base tome iLv rather than the augmented iLv from
              the BiS import.
            </InfoBox>

            <CodeBlock
              language="typescript"
              title="utils/calculations.ts:372-428"
              code={`export function calculateAverageItemLevel(
  gear: GearSlotStatus[],
  tierId: string
): number {
  if (gear.length === 0) return 0;

  let totalILv = 0;
  let validSlots = 0;

  for (const slot of gear) {
    // Special case: 'tome' BiS with item but NOT augmented
    if (slot.hasItem && slot.bisSource === 'tome' && !slot.isAugmented) {
      const isWeapon = slot.slot === 'weapon';
      const iLv = getItemLevelForCategory(tierId, 'tome', isWeapon);
      if (iLv > 0) {
        totalILv += iLv;
        validSlots++;
      }
      continue;
    }

    // Use itemLevel from BiS import if player has the item
    if (slot.hasItem && slot.itemLevel && slot.itemLevel > 0) {
      totalILv += slot.itemLevel;
      validSlots++;
      continue;
    }

    // Calculate from currentSource
    const currentSource = getEffectiveCurrentSource(slot);
    const isWeapon = slot.slot === 'weapon';
    const effectiveSource = currentSource === 'unknown' ? 'crafted' : currentSource;
    const iLv = getItemLevelForCategory(tierId, effectiveSource, isWeapon);
    if (iLv > 0) {
      totalILv += iLv;
      validSlots++;
    }
  }

  return validSlots > 0 ? Math.round(totalILv / validSlots) : 0;
}`}
            />
          </Section>

          {/* Source Categories */}
          <Section id="source-categories" title="Source categories">
            <p className="text-text-secondary mb-4">
              The <code className="text-accent">GearSourceCategory</code> type defines the 9 possible
              sources for currently-equipped gear:
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default">
                    <th className="text-left py-2 text-text-muted font-medium">Category</th>
                    <th className="text-left py-2 text-text-muted font-medium">Description</th>
                    <th className="text-right py-2 text-text-muted font-medium">iLv (7.2 example)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  <tr>
                    <td className="py-2 text-accent font-mono">savage</td>
                    <td className="py-2 text-text-secondary">Raid drops</td>
                    <td className="py-2 text-right font-mono">760 / 765 (weapon)</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-accent font-mono">tome_up</td>
                    <td className="py-2 text-text-secondary">Augmented tomestone</td>
                    <td className="py-2 text-right font-mono">760</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-accent font-mono">catchup</td>
                    <td className="py-2 text-text-secondary">Alliance/catch-up gear</td>
                    <td className="py-2 text-right font-mono">750</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-accent font-mono">tome</td>
                    <td className="py-2 text-text-secondary">Unaugmented tomestone</td>
                    <td className="py-2 text-right font-mono">750 / 755 (weapon)</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-accent font-mono">relic</td>
                    <td className="py-2 text-text-secondary">Relic weapons/gear</td>
                    <td className="py-2 text-right font-mono">745 / 750 (weapon)</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-accent font-mono">crafted</td>
                    <td className="py-2 text-text-secondary">Crafted pentamelded</td>
                    <td className="py-2 text-right font-mono">740 / 745 (weapon)</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-accent font-mono">prep</td>
                    <td className="py-2 text-text-secondary">Previous tier BiS</td>
                    <td className="py-2 text-right font-mono">740 / 745 (weapon)</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-accent font-mono">normal</td>
                    <td className="py-2 text-text-secondary">Normal raid</td>
                    <td className="py-2 text-right font-mono">740 / 745 (weapon)</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-accent font-mono">unknown</td>
                    <td className="py-2 text-text-secondary">Unknown (defaults to crafted)</td>
                    <td className="py-2 text-right font-mono">0</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* Tier Configuration */}
          <Section id="tier-configuration" title="Tier configuration">
            <p className="text-text-secondary mb-4">
              Each raid tier is defined with item level mappings in{' '}
              <code className="text-accent">gamedata/raid-tiers.ts</code>:
            </p>

            <CodeBlock
              language="typescript"
              title="RaidTier interface"
              code={`interface RaidTier {
  id: string;           // Internal identifier
  name: string;         // Display name
  shortName: string;    // Dropdown label (e.g., "M5S-M8S")
  patch: string;        // Game patch version
  floors: string[];     // Floor identifiers
  itemLevels: {
    savage: number;       // Savage armor iLv
    savageWeapon: number; // Savage weapon iLv (+5 from armor)
    tome: number;         // Base tomestone iLv
    tomeAugmented: number; // Augmented tome (matches savage armor)
    crafted: number;      // Crafted gear iLv
    minimum: number;      // Minimum iLv to enter
  };
  gearPrefixes: { ... }; // For item identification
  upgradeMaterials: { ... }; // Material names
  isCurrent: boolean;   // Active tier flag
}`}
            />

            <CodeBlock
              language="typescript"
              title="Example tier definition"
              code={`{
  id: 'aac-cruiserweight',
  name: 'AAC Cruiserweight (Savage)',
  shortName: 'M5S-M8S',
  patch: '7.2',
  floors: ['M5S', 'M6S', 'M7S', 'M8S'],
  itemLevels: {
    savage: 760,
    savageWeapon: 765,
    tome: 750,
    tomeAugmented: 760,
    crafted: 740,
    minimum: 735,
  },
  gearPrefixes: {
    savage: 'Cruiserweight Champion',
    tome: 'Quetzalli',
    crafted: 'Agonist',
  },
  upgradeMaterials: {
    twine: 'Cruiserweight Twine',
    glaze: 'Cruiserweight Glaze',
    solvent: 'Cruiserweight Solvent',
  },
  isCurrent: false,
}`}
            />
          </Section>

          {/* Book Exchange */}
          <Section id="book-exchange" title="Book exchange">
            <p className="text-text-secondary mb-4">
              Books are the fallback currency for raid gear. Each floor clear awards one book, which
              can be exchanged for gear or upgrade materials.
            </p>

            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default">
                    <th className="text-left py-2 text-text-muted font-medium">Slot</th>
                    <th className="text-center py-2 text-text-muted font-medium">Books</th>
                    <th className="text-center py-2 text-text-muted font-medium">Book Type</th>
                    <th className="text-left py-2 text-text-muted font-medium">Floor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  <tr>
                    <td className="py-2 text-text-primary font-medium">Weapon</td>
                    <td className="py-2 text-center text-accent font-mono">8</td>
                    <td className="py-2 text-center text-text-secondary">IV</td>
                    <td className="py-2 text-text-secondary">Floor 4</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-text-primary font-medium">Body / Legs</td>
                    <td className="py-2 text-center text-accent font-mono">6</td>
                    <td className="py-2 text-center text-text-secondary">III</td>
                    <td className="py-2 text-text-secondary">Floor 3</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-text-primary font-medium">Head / Hands / Feet</td>
                    <td className="py-2 text-center text-accent font-mono">4</td>
                    <td className="py-2 text-center text-text-secondary">II</td>
                    <td className="py-2 text-text-secondary">Floor 2</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-text-primary font-medium">Accessories</td>
                    <td className="py-2 text-center text-accent font-mono">3</td>
                    <td className="py-2 text-center text-text-secondary">I</td>
                    <td className="py-2 text-text-secondary">Floor 1</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <InfoBox type="info">
              Upgrade materials can also be purchased with books: Twine costs 4 Book III, Glaze costs
              4 Book II. Solvent cannot be purchased (drops only from Floor 3).
            </InfoBox>
          </Section>

          {/* Tomestone Costs */}
          <Section id="tomestone-costs" title="Tomestone costs">
            <p className="text-text-secondary mb-4">
              Tomestone gear is purchased with weekly-capped currency:
            </p>

            <CodeBlock
              language="typescript"
              title="gamedata/costs.ts:59-76"
              code={`export const TOMESTONE_COSTS: Record<GearSlot, number> = {
  weapon: 500,   // Also requires 7 weekly tokens from normal mode
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

export const WEEKLY_TOMESTONE_CAP = 450;`}
            />

            <div className="bg-surface-card border border-border-subtle rounded-lg p-4 mt-6">
              <p className="text-text-secondary text-sm">
                <strong className="text-text-primary">Full set cost:</strong> 500 + 825 + 825 + 495 +
                495 + 495 + 375 + 375 + 375 + 375 + 375 = <strong className="text-accent">5,510 tomestones</strong>
                <br />
                <strong className="text-text-primary">Weeks to cap:</strong> 5510 ÷ 450 ={' '}
                <strong className="text-accent">13 weeks</strong> (rounded up)
              </p>
            </div>
          </Section>

          {/* Weeks Calculation */}
          <Section id="weeks-calculation" title="Weeks to complete">
            <p className="text-text-secondary mb-4">
              The team summary calculates worst-case weeks to complete based on book requirements:
            </p>

            <FormulaDisplay>
              <FormulaLine>
                <Variable>weeksToComplete</Variable> <Operator>=</Operator>{' '}
                <span className="text-text-secondary">max(</span>
                <Variable>booksNeeded</Variable><Operator>[</Operator>floor<Operator>]</Operator>{' '}
                <Operator>÷</Operator> <Variable>totalPlayers</Variable>
                <span className="text-text-secondary">) for each floor</span>
              </FormulaLine>
            </FormulaDisplay>

            <p className="text-text-secondary mt-4 mb-4">
              This assumes worst-case scenario where no one wins drops and everyone must exchange books.
              One book per floor per week per player.
            </p>

            <CodeBlock
              language="typescript"
              title="utils/calculations.ts:214-221"
              code={`// Estimate weeks to complete (worst case: max books needed for any floor)
// Each floor gives 1 book per week per player
const maxBooksPerFloor = Math.max(
  Math.ceil(books.floor1 / Math.max(totalPlayers, 1)),
  Math.ceil(books.floor2 / Math.max(totalPlayers, 1)),
  Math.ceil(books.floor3 / Math.max(totalPlayers, 1)),
  Math.ceil(books.floor4 / Math.max(totalPlayers, 1))
);`}
            />
          </Section>

          {/* Floor Drops */}
          <Section id="floor-drops" title="Floor drops">
            <p className="text-text-secondary mb-4">
              Each savage floor drops specific gear types. These mechanics are consistent across all
              savage tiers:
            </p>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="bg-surface-card border border-green-500/30 rounded-lg p-4">
                <div className="text-green-400 font-medium mb-2">Floor 1</div>
                <p className="text-sm text-text-secondary mb-2">
                  <strong>Gear:</strong> Earring, Necklace, Bracelet, Ring
                </p>
                <p className="text-sm text-text-secondary">
                  <strong>Materials:</strong> None
                </p>
              </div>
              <div className="bg-surface-card border border-blue-500/30 rounded-lg p-4">
                <div className="text-blue-400 font-medium mb-2">Floor 2</div>
                <p className="text-sm text-text-secondary mb-2">
                  <strong>Gear:</strong> Head, Hands, Feet
                </p>
                <p className="text-sm text-text-secondary">
                  <strong>Materials:</strong> Glaze, Universal Tomestone
                </p>
              </div>
              <div className="bg-surface-card border border-purple-500/30 rounded-lg p-4">
                <div className="text-purple-400 font-medium mb-2">Floor 3</div>
                <p className="text-sm text-text-secondary mb-2">
                  <strong>Gear:</strong> Body, Legs
                </p>
                <p className="text-sm text-text-secondary">
                  <strong>Materials:</strong> Twine, Solvent
                </p>
              </div>
              <div className="bg-surface-card border border-amber-500/30 rounded-lg p-4">
                <div className="text-amber-400 font-medium mb-2">Floor 4</div>
                <p className="text-sm text-text-secondary mb-2">
                  <strong>Gear:</strong> Weapon Coffer
                </p>
                <p className="text-sm text-text-secondary">
                  <strong>Materials:</strong> None
                </p>
              </div>
            </div>

            <CodeBlock
              language="typescript"
              title="gamedata/loot-tables.ts:32-61"
              code={`export const FLOOR_LOOT_TABLES: Record<FloorNumber, FloorLootTable> = {
  1: {
    floor: 1,
    gearDrops: ['earring', 'necklace', 'bracelet', 'ring1'],
    upgradeMaterials: [],
    bookType: 'I',
    cofferCount: 2,
  },
  2: {
    floor: 2,
    gearDrops: ['head', 'hands', 'feet'],
    upgradeMaterials: ['glaze', 'universal_tomestone'],
    bookType: 'II',
    cofferCount: 2,
  },
  3: {
    floor: 3,
    gearDrops: ['body', 'legs'],
    upgradeMaterials: ['twine', 'solvent'],
    bookType: 'III',
    cofferCount: 2,
  },
  4: {
    floor: 4,
    gearDrops: ['weapon'],
    upgradeMaterials: [],
    bookType: 'IV',
    cofferCount: 1,
  },
};`}
            />
          </Section>

          {/* Material Mapping */}
          <Section id="material-mapping" title="Material mapping">
            <p className="text-text-secondary mb-4">
              Upgrade materials are used to augment tomestone gear to match savage iLv:
            </p>

            <CodeBlock
              language="typescript"
              title="Material slot mapping and lookup"
              code={`export const UPGRADE_MATERIAL_SLOTS = {
  twine: ['head', 'body', 'hands', 'legs', 'feet'],  // Left-side armor
  glaze: ['earring', 'necklace', 'bracelet', 'ring1', 'ring2'],  // Accessories
  solvent: ['weapon'],  // Weapon only
};

// Get which material is needed for a slot
export function getUpgradeMaterialForSlot(slot: GearSlot): 'twine' | 'glaze' | 'solvent' {
  if (UPGRADE_MATERIAL_SLOTS.twine.includes(slot)) return 'twine';
  if (UPGRADE_MATERIAL_SLOTS.glaze.includes(slot)) return 'glaze';
  if (UPGRADE_MATERIAL_SLOTS.solvent.includes(slot)) return 'solvent';
  throw new Error(\`Unknown slot for upgrade material: \${slot}\`);
}`}
            />

            <InfoBox type="info">
              The <code className="text-accent">universal_tomestone</code> is a special material from
              Floor 2 used to upgrade the tomestone weapon. It's tracked separately from solvent.
            </InfoBox>
          </Section>

          {/* Ring Selection */}
          <Section id="ring-selection" title="Ring selection">
            <p className="text-text-secondary mb-4">
              Floor 1 drops a generic "Ring" coffer. When logging the drop, the system determines
              which ring slot to mark based on the player's BiS configuration:
            </p>

            <CodeBlock
              language="typescript"
              title="Ring slot selection logic"
              code={`// Special handling for ring drops
if (slot === 'ring1' || slot === 'ring2') {
  const ring1 = player.gear.find((g) => g.slot === 'ring1');
  const ring2 = player.gear.find((g) => g.slot === 'ring2');
  const needsRing1 = ring1?.bisSource === 'raid' && !ring1?.hasItem;
  const needsRing2 = ring2?.bisSource === 'raid' && !ring2?.hasItem;

  // Prefer ring1 if both need it, otherwise use the one that needs raid
  if (needsRing1) {
    slot = 'ring1';
  } else if (needsRing2) {
    slot = 'ring2';
  }
  // If neither needs raid, fall back to ring1
}`}
            />

            <p className="text-text-secondary mt-4">
              For priority calculations, <code className="text-accent">getPriorityForRing</code>{' '}
              includes any player who needs either ring1 OR ring2 as raid BiS.
            </p>
          </Section>

          {/* Type Definitions */}
          <Section id="type-definitions" title="Type definitions">
            <p className="text-text-secondary mb-4">
              Key interfaces used throughout the calculation system:
            </p>

            <Subsection title="GearSlotStatus">
              <CodeBlock
                language="typescript"
                code={`interface GearSlotStatus {
  slot: GearSlot;  // 'weapon' | 'head' | 'body' | ... | 'ring2'
  bisSource: 'raid' | 'tome' | 'base_tome' | 'crafted' | null;
  currentSource?: GearSourceCategory;  // What's currently equipped
  hasItem: boolean;      // Player has this item
  isAugmented: boolean;  // Item has been augmented (tome only)
  itemLevel?: number;    // From BiS import
  itemName?: string;     // From BiS import
  itemIcon?: string;     // Icon URL from BiS import
}`}
              />
            </Subsection>

            <Subsection title="SnapshotPlayer (gear-related fields)">
              <CodeBlock
                language="typescript"
                code={`interface SnapshotPlayer {
  id: string;
  name: string;
  job: string;
  role: string;
  configured: boolean;
  gear: GearSlotStatus[];
  tomeWeapon?: TomeWeaponStatus;
  weaponPriorities?: WeaponPriority[];
  lootAdjustment?: number;  // Mid-tier roster fairness
  pageAdjustments?: { I: number; II: number; III: number; IV: number };
  bisLink?: string;
}`}
              />
            </Subsection>

            <Subsection title="WeaponPriority">
              <CodeBlock
                language="typescript"
                code={`interface WeaponPriority {
  job: string;           // Job abbreviation (e.g., 'DRG', 'MNK')
  rank: number;          // Priority rank (0 = highest)
  received: boolean;     // Whether weapon was received
  receivedDate?: string; // ISO date string
}`}
              />
            </Subsection>

            <Subsection title="TomeWeaponStatus">
              <CodeBlock
                language="typescript"
                code={`interface TomeWeaponStatus {
  pursuing: boolean;    // Player is working toward tome weapon
  hasItem: boolean;     // Has the base tome weapon
  isAugmented: boolean; // Weapon has been augmented
}`}
              />
            </Subsection>
          </Section>

          {/* Constants */}
          <Section id="constants" title="Constants">
            <p className="text-text-secondary mb-4">
              All calculation constants are defined in <code className="text-accent">gamedata/costs.ts</code>:
            </p>

            <Subsection title="Slot value weights">
              <CodeBlock
                language="typescript"
                title="SLOT_VALUE_WEIGHTS"
                code={`export const SLOT_VALUE_WEIGHTS: Record<GearSlot, number> = {
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
};`}
              />
            </Subsection>

            <Subsection title="Book costs">
              <CodeBlock
                language="typescript"
                title="BOOK_COSTS"
                code={`export const BOOK_COSTS: Record<GearSlot, number> = {
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
};`}
              />
            </Subsection>

            <Subsection title="Tomestone costs">
              <CodeBlock
                language="typescript"
                title="TOMESTONE_COSTS"
                code={`export const TOMESTONE_COSTS: Record<GearSlot, number> = {
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

export const WEEKLY_TOMESTONE_CAP = 450;`}
              />
            </Subsection>
          </Section>

          {/* Source Files */}
          <Section id="source-files" title="Source files">
            <p className="text-text-secondary mb-4">
              Quick reference for finding specific functionality:
            </p>

            <div className="space-y-2">
              <LinkCard
                href="https://github.com/aaronbcarlisle/ffxiv-raid-planner-dev/blob/main/frontend/src/utils/priority.ts"
                title="utils/priority.ts"
                description="Priority score formulas, item/ring/material priority"
              />
              <LinkCard
                href="https://github.com/aaronbcarlisle/ffxiv-raid-planner-dev/blob/main/frontend/src/utils/calculations.ts"
                title="utils/calculations.ts"
                description="Gear state, completion, iLv, team summary"
              />
              <LinkCard
                href="https://github.com/aaronbcarlisle/ffxiv-raid-planner-dev/blob/main/frontend/src/utils/lootCoordination.ts"
                title="utils/lootCoordination.ts"
                description="Enhanced priority, loot stats, cross-store coordination"
              />
              <LinkCard
                href="https://github.com/aaronbcarlisle/ffxiv-raid-planner-dev/blob/main/frontend/src/gamedata/costs.ts"
                title="gamedata/costs.ts"
                description="Book/tome costs, slot weights, weekly cap"
              />
              <LinkCard
                href="https://github.com/aaronbcarlisle/ffxiv-raid-planner-dev/blob/main/frontend/src/gamedata/loot-tables.ts"
                title="gamedata/loot-tables.ts"
                description="Floor drops, materials, slot mappings"
              />
              <LinkCard
                href="https://github.com/aaronbcarlisle/ffxiv-raid-planner-dev/blob/main/frontend/src/gamedata/raid-tiers.ts"
                title="gamedata/raid-tiers.ts"
                description="Tier definitions, iLv mappings"
              />
            </div>
          </Section>
        </main>
      </div>
    </div>
  );
}
