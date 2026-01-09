/**
 * Documentation Index - Central hub for all FFXIV Raid Planner documentation
 *
 * Organized by audience: Users vs Developers
 *
 * Accessible at: /docs
 */

import { Link } from 'react-router-dom';
import {
  BookOpen,
  Palette,
  Calculator,
  Code,
  ChevronRight,
  Sparkles,
  Download,
  ListOrdered,
  Swords,
  Users,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Quick links for common tasks
const QUICK_LINKS = [
  { label: 'Import BiS', href: '/docs/guides/common-tasks#bis-import', icon: Download },
  { label: 'Priority Calc', href: '/docs/loot-math#gear-scoring', icon: ListOrdered },
  { label: 'Weapon Priority', href: '/docs/loot-math#weapon-system', icon: Swords },
  { label: 'API Reference', href: '/docs/api', icon: Code },
];

interface DocItem {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  sections?: string[];
}

// User-facing documentation
const USER_DOCS: DocItem[] = [
  {
    id: 'release-notes',
    title: 'Release Notes',
    description: 'Latest updates, features, and bug fixes',
    icon: Sparkles,
    href: '/docs/release-notes',
    sections: ['Latest Updates', 'New Features', 'Bug Fixes'],
  },
  {
    id: 'roadmap',
    title: 'Roadmap & Status',
    description: 'Development plan, completed features, and what\'s next',
    icon: Wrench,
    href: '/docs/roadmap',
    sections: ['Current Status', 'Completed Phases', 'Planned Features'],
  },
];

// Developer/Technical documentation
const DEVELOPER_DOCS: DocItem[] = [
  {
    id: 'loot-math',
    title: 'Loot & Priority Math',
    description: 'Priority calculations, formulas, and the philosophy behind fair distribution',
    icon: Calculator,
    href: '/docs/loot-math',
    sections: ['Priority Formula', 'Role Weighting', 'Weapon Priority', 'Book Economy'],
  },
  {
    id: 'api-docs',
    title: 'API Reference',
    description: 'REST API endpoints, authentication, and request/response schemas',
    icon: Code,
    href: '/docs/api',
    sections: ['Authentication', 'Static Groups', 'Tier Snapshots', 'Loot Logging'],
  },
  {
    id: 'design-system',
    title: 'Design System',
    description: 'Colors, typography, components, and visual patterns',
    icon: Palette,
    href: '/docs/design-system',
    sections: ['Color Palette', 'Typography', 'Components', 'Icon Library'],
  },
];

export function DocsIndex() {
  return (
    <div className="min-h-screen bg-surface-base">
      {/* Header */}
      <header className="bg-surface-raised border-b border-border-default">
        <div className="max-w-[80rem] mx-auto px-6 lg:px-8 py-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-accent">Documentation</h1>
              <p className="text-text-secondary mt-1">
                Guides, references, and technical documentation
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[80rem] mx-auto px-6 lg:px-8 py-10">
        {/* Quick Links */}
        <section className="mb-10">
          <div className="flex flex-wrap gap-3">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.label}
                  to={link.href}
                  className="group flex items-center gap-2 px-4 py-2 bg-surface-card border border-border-subtle rounded-lg hover:border-accent/50 hover:bg-surface-elevated transition-all"
                >
                  <Icon className="w-4 h-4 text-accent" />
                  <span className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors">
                    {link.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Getting Started - Featured */}
        <section className="mb-10">
          <Link
            to="/docs/getting-started"
            className="group block bg-surface-card border border-border-subtle rounded-xl p-6 hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5 transition-all"
          >
            <div className="flex items-start gap-5">
              <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center shrink-0">
                <Users className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <div>
                    <span className="text-xs font-medium text-accent uppercase tracking-wider">Start Here</span>
                    <h2 className="text-xl font-semibold text-text-primary group-hover:text-accent transition-colors">
                      Getting Started
                    </h2>
                  </div>
                  <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-accent group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-text-secondary mb-4">
                  New to FFXIV Raid Planner? Choose your role and follow our step-by-step guides.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1.5 bg-accent/10 rounded-lg text-sm text-accent font-medium">
                    Guide for Leads
                  </span>
                  <span className="px-3 py-1.5 bg-blue-500/10 rounded-lg text-sm text-blue-400 font-medium">
                    Guide for Members
                  </span>
                  <span className="px-3 py-1.5 bg-surface-elevated rounded-lg text-sm text-text-secondary">
                    Common Tasks
                  </span>
                  <span className="px-3 py-1.5 bg-surface-elevated rounded-lg text-sm text-text-secondary">
                    Permissions
                  </span>
                </div>
              </div>
            </div>
          </Link>
        </section>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-10">
          {/* Technical Reference */}
          <section>
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
              Technical Reference
            </h2>
            <div className="space-y-4">
              {DEVELOPER_DOCS.map((doc) => (
                <DocCard key={doc.id} doc={doc} />
              ))}
            </div>
          </section>

          {/* Updates */}
          <section>
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
              Updates
            </h2>
            <div className="space-y-4">
              {USER_DOCS.map((doc) => (
                <DocCard key={doc.id} doc={doc} />
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

// Documentation card component
function DocCard({ doc }: { doc: DocItem }) {
  const Icon = doc.icon;

  return (
    <Link
      to={doc.href}
      className="group block bg-surface-card border border-border-subtle rounded-xl p-5 hover:border-accent/50 hover:shadow-md transition-all"
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
          <Icon className="w-5 h-5 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="font-semibold text-text-primary group-hover:text-accent transition-colors">
              {doc.title}
            </h3>
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0" />
          </div>
          <p className="text-sm text-text-secondary mb-3">{doc.description}</p>
          {doc.sections && (
            <div className="flex flex-wrap gap-1.5">
              {doc.sections.slice(0, 3).map((section) => (
                <span
                  key={section}
                  className="px-2 py-0.5 bg-surface-elevated rounded text-xs text-text-muted"
                >
                  {section}
                </span>
              ))}
              {doc.sections.length > 3 && (
                <span className="px-2 py-0.5 text-xs text-text-muted">
                  +{doc.sections.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default DocsIndex;
