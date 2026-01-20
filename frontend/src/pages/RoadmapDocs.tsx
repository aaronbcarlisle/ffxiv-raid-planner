/**
 * Roadmap & Status - Development plan and current state
 *
 * Shows completed features, current work, and future plans.
 *
 * Accessible at: /docs/roadmap
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
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
    title: 'BiS Import System',
    status: 'complete',
    icon: Sparkles,
    items: [
      { title: 'XIVGear set import' },
      { title: 'Etro gearset import' },
      { title: 'The Balance community presets (all 21 jobs)' },
      { title: 'Item icons and stats from XIVAPI' },
      { title: 'Gear hover cards with item details' },
    ],
  },
  {
    id: 'phase-6',
    number: '6',
    title: 'Permission-Aware UI',
    status: 'complete',
    icon: Shield,
    items: [
      { title: 'Actions disabled based on role' },
      { title: 'Tooltips explaining restrictions' },
      { title: 'Reset gear options (3 presets)' },
      { title: 'Defensive validation on all operations' },
    ],
  },
  {
    id: 'phase-6-5',
    number: '6.5',
    title: 'Loot Management',
    status: 'complete',
    icon: Swords,
    items: [
      { title: 'Loot priority calculations' },
      { title: 'Weapon priority system with multi-job support' },
      { title: 'Historical loot logging with week navigation' },
      { title: 'Book/page tracking and balances' },
      { title: 'Quick log modal with priority-sorted recipients' },
      { title: 'UI state persistence (tabs, weeks, tiers)' },
    ],
  },
  {
    id: 'phase-parity',
    number: '6.6',
    title: 'Spreadsheet Parity',
    status: 'complete',
    icon: Book,
    items: [
      { title: '9-category gear source tracking' },
      { title: 'Average iLv calculation and display' },
      { title: 'Loot and page adjustments for mid-tier joins' },
      { title: 'Priority formula refinements' },
    ],
  },
  {
    id: 'phase-7',
    number: '7',
    title: 'Lodestone Integration',
    status: 'planned',
    icon: Globe,
    items: [
      { title: 'Link FFXIV characters to player cards' },
      { title: 'Auto-sync gear from Lodestone' },
      { title: 'Scheduled background updates' },
      { title: 'Manual refresh option' },
    ],
  },
  {
    id: 'phase-8',
    number: '8',
    title: 'Extended Features',
    status: 'planned',
    icon: Bot,
    items: [
      { title: 'FFLogs integration for parse data' },
      { title: 'Week-over-week progress tracking' },
      { title: 'Discord bot for notifications' },
    ],
  },
  {
    id: 'phase-9',
    number: '9',
    title: 'Mobile Optimization',
    status: 'planned',
    icon: Smartphone,
    items: [
      { title: 'Responsive layouts for phones and tablets' },
      { title: 'Touch-friendly interactions', description: 'Larger tap targets, swipe gestures' },
      { title: 'Mobile-specific navigation' },
      { title: 'PWA support', description: 'Install to home screen, offline mode' },
    ],
  },
];

// Known issues data
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
  const completedPhases = PHASES.filter((p) => p.status === 'complete');
  const inProgressPhases = PHASES.filter((p) => p.status === 'in-progress');
  const plannedPhases = PHASES.filter((p) => p.status === 'planned');

  const completedCount = completedPhases.length;
  const totalCount = PHASES.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="min-h-screen bg-surface-base">
      {/* Header */}
      <header className="bg-surface-raised border-b border-border-default">
        <div className="max-w-[80rem] mx-auto px-6 lg:px-8 py-12">
          <div className="flex items-center gap-2 text-sm text-text-muted mb-4">
            <Link
              to="/docs"
              className="hover:text-accent transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Documentation
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
              <Wrench className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-accent">Roadmap & Status</h1>
              <p className="text-text-secondary mt-1">Development plan and current state</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[80rem] mx-auto px-6 lg:px-8 py-12">
        {/* Progress Overview */}
        <section className="mb-12">
          <div className="bg-surface-card border border-border-subtle rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">Overall Progress</h2>
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
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-text-primary mb-6 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-accent" />
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
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-text-primary mb-6 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-status-success" />
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
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-text-primary mb-6 flex items-center gap-2">
              <Clock className="w-5 h-5 text-accent" />
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
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-text-primary mb-6 flex items-center gap-2">
            <Circle className="w-5 h-5 text-text-muted" />
            Planned Features
          </h2>
          <div className="space-y-4">
            {plannedPhases.map((phase) => (
              <PhaseCard key={phase.id} phase={phase} />
            ))}
          </div>
        </section>

        {/* Known Issues */}
        <section>
          <h2 className="text-xl font-semibold text-text-primary mb-6 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-status-warning" />
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
  );
}
