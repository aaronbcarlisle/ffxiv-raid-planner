/**
 * Roadmap & Status - Development plan and current state
 *
 * Shows completed features, current work, and future plans.
 *
 * Accessible at: /docs/roadmap
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ChevronDown,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Sparkles,
  Users,
  Shield,
  Database,
  Palette,
  Swords,
  Book,
  Globe,
  Bot,
  Smartphone,
  Target,
  Wrench,
} from 'lucide-react';

// Navigation items
const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { id: 'progress', label: 'Progress' },
      { id: 'current-status', label: 'Current status' },
    ],
  },
  {
    label: 'Development',
    items: [
      { id: 'completed', label: 'Completed' },
      { id: 'in-progress', label: 'In progress' },
      { id: 'planned', label: 'Planned' },
    ],
  },
  {
    label: 'Issues',
    items: [{ id: 'known-issues', label: 'Known issues' }],
  },
];

const NAV_SECTIONS = NAV_GROUPS.flatMap((group) => group.items);

// Phase data
interface PhaseItem {
  title: string;
  description?: string;
}

interface Phase {
  id: string;
  number: string;
  title: string;
  status: 'complete' | 'in-progress' | 'planned';
  icon: React.ElementType;
  items: PhaseItem[];
}

const PHASES: Phase[] = [
  {
    id: 'phase-1',
    number: '1',
    title: 'Core Gear Tracking',
    status: 'complete',
    icon: Target,
    items: [
      { title: 'Player cards with job/role display' },
      { title: 'Manual BiS slot selection' },
      { title: 'Gear progress checkboxes' },
      { title: 'Party composition view' },
    ],
  },
  {
    id: 'phase-2',
    number: '2',
    title: 'UX Enhancements',
    status: 'complete',
    icon: Palette,
    items: [
      { title: 'Tab-based navigation' },
      { title: 'Context menu actions' },
      { title: 'Raid position assignment (T1, H1, M1, etc.)' },
      { title: 'Drag-and-drop reordering' },
    ],
  },
  {
    id: 'phase-3',
    number: '3',
    title: 'Backend & Persistence',
    status: 'complete',
    icon: Database,
    items: [
      { title: 'FastAPI REST backend' },
      { title: 'SQLAlchemy ORM with SQLite/PostgreSQL' },
      { title: 'Data persistence across sessions' },
      { title: 'API endpoints for all operations' },
    ],
  },
  {
    id: 'phase-4',
    number: '4',
    title: 'Multi-User Support',
    status: 'complete',
    icon: Users,
    items: [
      { title: 'Discord OAuth authentication' },
      { title: 'Multiple static groups per user' },
      { title: 'Role-based permissions (Owner/Lead/Member/Viewer)' },
      { title: 'Tier snapshots for different raid tiers' },
      { title: 'Invitation system with links' },
      { title: 'Player ownership linking' },
    ],
  },
  {
    id: 'phase-5',
    number: '5',
    title: 'Advanced Features',
    status: 'complete',
    icon: Sparkles,
    items: [
      { title: 'BiS import from xivgear.app and etro.gg' },
      { title: 'Loot priority calculations' },
      { title: 'Weapon priority system' },
      { title: 'Weekly loot history and books tracking' },
      { title: 'Static duplication' },
      { title: 'Dark theme polish' },
    ],
  },
  {
    id: 'phase-6',
    number: '6',
    title: 'Production Ready',
    status: 'complete',
    icon: Shield,
    items: [
      { title: 'Comprehensive test coverage' },
      { title: 'Admin dashboard and impersonation' },
      { title: 'Share codes for read-only access' },
      { title: 'Documentation and release notes' },
      { title: 'Performance optimization' },
    ],
  },
  {
    id: 'phase-7',
    number: '7',
    title: 'Lodestone Sync',
    status: 'planned',
    icon: Globe,
    items: [
      { title: 'Character lookup by name/server' },
      { title: 'Auto-import equipped gear from Lodestone' },
      { title: 'Periodic refresh of gear data' },
      { title: 'Detect gear changes automatically' },
    ],
  },
  {
    id: 'phase-8',
    number: '8',
    title: 'FFLogs Integration',
    status: 'planned',
    icon: Swords,
    items: [
      { title: 'Link FFLogs reports to static' },
      { title: 'Pull parse percentiles' },
      { title: 'Track progress over time' },
      { title: 'Best parse highlighting' },
    ],
  },
  {
    id: 'phase-9',
    number: '9',
    title: 'Mobile Optimization',
    status: 'planned',
    icon: Smartphone,
    items: [
      { title: 'Responsive layouts for phone screens' },
      { title: 'Touch-friendly controls' },
      { title: 'PWA support for home screen install' },
      { title: 'Offline data access' },
    ],
  },
  {
    id: 'phase-10',
    number: '10',
    title: 'Discord Bot',
    status: 'planned',
    icon: Bot,
    items: [
      { title: 'Slash commands for common actions' },
      { title: 'Loot notifications in Discord' },
      { title: 'Priority queries from chat' },
      { title: 'Weekly summary posts' },
    ],
  },
  {
    id: 'phase-future',
    number: '∞',
    title: 'Future Considerations',
    status: 'planned',
    icon: Book,
    items: [
      { title: 'Alt job tracking per player' },
      { title: 'Raid schedule integration' },
      { title: 'Crafting material tracking' },
      { title: 'Cross-static loot sharing' },
    ],
  },
];

interface Issue {
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium';
}

const KNOWN_ISSUES: Issue[] = [
  {
    title: 'No database migrations',
    description: 'Schema changes require manual database updates. Alembic migrations planned.',
    priority: 'high',
  },
  {
    title: 'Large component files',
    description: 'Some view components exceed 500 lines. Refactoring into smaller components planned.',
    priority: 'medium',
  },
];

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

function StatusBadge({ status }: { status: Phase['status'] }) {
  const config = {
    complete: {
      icon: CheckCircle2,
      label: 'Complete',
      classes: 'bg-status-success/20 text-status-success border-status-success/30',
    },
    'in-progress': {
      icon: Clock,
      label: 'In Progress',
      classes: 'bg-accent/20 text-accent border-accent/30',
    },
    planned: {
      icon: Circle,
      label: 'Planned',
      classes: 'bg-surface-elevated text-text-muted border-border-subtle',
    },
  };

  const { icon: Icon, label, classes } = config[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${classes}`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Issue['priority'] }) {
  const config = {
    critical: 'bg-status-error/20 text-status-error border-status-error/30',
    high: 'bg-status-warning/20 text-status-warning border-status-warning/30',
    medium: 'bg-accent/20 text-accent border-accent/30',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded border ${config[priority]}`}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
}

function PhaseCard({ phase, defaultExpanded = false }: { phase: Phase; defaultExpanded?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const Icon = phase.icon;

  return (
    <div className="bg-surface-card border border-border-subtle rounded-xl overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left p-5 hover:bg-surface-elevated/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              phase.status === 'complete'
                ? 'bg-status-success/10 text-status-success'
                : phase.status === 'in-progress'
                ? 'bg-accent/10 text-accent'
                : 'bg-surface-elevated text-text-muted'
            }`}
          >
            <Icon className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-sm font-medium text-text-muted">Phase {phase.number}</span>
              <StatusBadge status={phase.status} />
            </div>
            <h3 className="text-lg font-semibold text-text-primary">{phase.title}</h3>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-text-muted transition-transform ${isExpanded ? '' : '-rotate-90'}`}
          />
        </div>
      </button>

      {isExpanded && (
        <div className="px-5 pb-5 pt-0">
          <ul className="space-y-2 ml-16">
            {phase.items.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3">
                {phase.status === 'complete' ? (
                  <CheckCircle2 className="w-4 h-4 text-status-success mt-0.5 shrink-0" />
                ) : phase.status === 'in-progress' ? (
                  <Clock className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-text-muted mt-0.5 shrink-0" />
                )}
                <div>
                  <p className="text-text-primary">{item.title}</p>
                  {item.description && (
                    <p className="text-sm text-text-muted">{item.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function RoadmapDocs() {
  const location = useLocation();
  const [activeSection, setActiveSection] = useState(() => {
    const hash = window.location.hash;
    if (hash) {
      const id = hash.slice(1);
      if (NAV_SECTIONS.some((s) => s.id === id)) return id;
    }
    return 'progress';
  });
  const isScrollingRef = useRef(false);
  const scrollEndTimeoutRef = useRef<number | null>(null);

  const completedPhases = PHASES.filter((p) => p.status === 'complete');
  const inProgressPhases = PHASES.filter((p) => p.status === 'in-progress');
  const plannedPhases = PHASES.filter((p) => p.status === 'planned');

  const completedCount = completedPhases.length;
  const totalCount = PHASES.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

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
        if (activeSection !== lastSection.id) {
          setActiveSection(lastSection.id);
          window.history.replaceState(null, '', `#${lastSection.id}`);
        }
        return;
      }

      for (const section of sections) {
        const rect = section.element!.getBoundingClientRect();
        if (rect.top <= threshold && rect.bottom > threshold) {
          if (activeSection !== section.id) {
            setActiveSection(section.id);
            window.history.replaceState(null, '', `#${section.id}`);
          }
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeSection]);

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
            <span className="text-text-secondary">Roadmap</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center">
              <Wrench className="w-7 h-7 text-accent" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-accent">Roadmap & Status</h1>
              <p className="text-text-secondary mt-1">Development plan and current state</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content with Sidebar */}
      <div className="max-w-[120rem] mx-auto px-6 lg:px-8 py-8 flex gap-8">
        <NavSidebar activeSection={activeSection} onSectionClick={handleNavClick} />

        <main className="flex-1 min-w-0">
          {/* Progress Overview */}
          <section id="progress" className="mb-12 scroll-mt-20">
            <h2 className="text-2xl font-semibold text-accent mb-6 pb-2 border-b border-border-default">
              Progress Overview
            </h2>
            <div className="bg-surface-card border border-border-subtle rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-semibold text-text-primary">Overall Progress</span>
                <span className="text-2xl font-bold text-accent">{progressPercent}%</span>
              </div>
              <div className="h-3 bg-surface-elevated rounded-full overflow-hidden mb-4">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-status-success" />
                  <span className="text-text-secondary">{completedCount} completed</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-accent" />
                  <span className="text-text-secondary">{inProgressPhases.length} in progress</span>
                </div>
                <div className="flex items-center gap-2">
                  <Circle className="w-4 h-4 text-text-muted" />
                  <span className="text-text-secondary">{plannedPhases.length} planned</span>
                </div>
              </div>
            </div>
          </section>

          {/* Current Status */}
          <section id="current-status" className="mb-12 scroll-mt-20">
            <h2 className="text-2xl font-semibold text-accent mb-6 pb-2 border-b border-border-default">
              Current Status
            </h2>
            <div className="bg-surface-card border border-accent/30 rounded-xl p-6">
              <p className="text-text-secondary mb-4">
                FFXIV Raid Planner is fully functional for managing static raid groups. Core features
                including gear tracking, loot priority, BiS import, and multi-user support are complete
                and in active use.
              </p>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-surface-elevated rounded-lg p-4">
                  <div className="text-2xl font-bold text-accent mb-1">21</div>
                  <div className="text-sm text-text-muted">Jobs Supported</div>
                </div>
                <div className="bg-surface-elevated rounded-lg p-4">
                  <div className="text-2xl font-bold text-accent mb-1">5</div>
                  <div className="text-sm text-text-muted">Permission Levels</div>
                </div>
                <div className="bg-surface-elevated rounded-lg p-4">
                  <div className="text-2xl font-bold text-accent mb-1">4</div>
                  <div className="text-sm text-text-muted">BiS Import Sources</div>
                </div>
              </div>
            </div>
          </section>

          {/* Completed Phases */}
          <section id="completed" className="mb-12 scroll-mt-20">
            <h2 className="text-2xl font-semibold text-accent mb-6 pb-2 border-b border-border-default">
              Completed Phases
            </h2>
            <div className="space-y-4">
              {completedPhases.map((phase) => (
                <PhaseCard key={phase.id} phase={phase} />
              ))}
            </div>
          </section>

          {/* In Progress */}
          {inProgressPhases.length > 0 && (
            <section id="in-progress" className="mb-12 scroll-mt-20">
              <h2 className="text-2xl font-semibold text-accent mb-6 pb-2 border-b border-border-default">
                In Progress
              </h2>
              <div className="space-y-4">
                {inProgressPhases.map((phase) => (
                  <PhaseCard key={phase.id} phase={phase} defaultExpanded />
                ))}
              </div>
            </section>
          )}

          {/* Planned */}
          <section id="planned" className="mb-12 scroll-mt-20">
            <h2 className="text-2xl font-semibold text-accent mb-6 pb-2 border-b border-border-default">
              Planned Features
            </h2>
            <div className="space-y-4">
              {plannedPhases.map((phase) => (
                <PhaseCard key={phase.id} phase={phase} />
              ))}
            </div>
          </section>

          {/* Known Issues */}
          <section id="known-issues" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold text-accent mb-6 pb-2 border-b border-border-default">
              Known Issues
            </h2>
            <div className="bg-surface-card border border-border-subtle rounded-xl overflow-hidden">
              <div className="divide-y divide-border-subtle">
                {KNOWN_ISSUES.map((issue, idx) => (
                  <div key={idx} className="p-4 flex items-start gap-4">
                    <PriorityBadge priority={issue.priority} />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-text-primary">{issue.title}</h3>
                      <p className="text-sm text-text-muted mt-1">{issue.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-sm text-text-muted mt-4">
              These issues are tracked internally and will be addressed before public launch.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
