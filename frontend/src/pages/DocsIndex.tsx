/**
 * Documentation Index - Central hub for all FFXIV Raid Planner documentation
 *
 * Accessible at: /docs
 */

import { Link } from 'react-router-dom';
import { BookOpen, Palette, Calculator, Layers, FileText, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface DocCategory {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  status: 'available' | 'coming-soon';
  sections?: string[];
}

const DOC_CATEGORIES: DocCategory[] = [
  {
    id: 'design-system',
    title: 'Design System',
    description: 'Complete visual reference for the design system. Colors, typography, components, and patterns.',
    icon: Palette,
    href: '/docs/design-system',
    status: 'available',
    sections: [
      'Design Principles',
      'Color Palette (Surfaces, Roles, Status)',
      'Typography & Spacing',
      'Component Library',
      'Icon Library (100+ icons)',
      'Layout Patterns',
    ],
  },
  {
    id: 'loot-math',
    title: 'Loot & Priority Math',
    description: 'How loot priority calculations work. Formulas, edge cases, and the philosophy behind fair distribution.',
    icon: Calculator,
    href: '/docs/loot-math',
    status: 'coming-soon',
    sections: [
      'Priority Score Formula',
      'Role-Based Weighting',
      'Need vs Greed Logic',
      'Mid-Tier Adjustments',
      'Book/Page Economy',
    ],
  },
  {
    id: 'data-models',
    title: 'Data Models',
    description: 'Technical reference for the data structures. Gear slots, player states, and tier snapshots.',
    icon: Layers,
    href: '/docs/data-models',
    status: 'coming-soon',
    sections: [
      'Player & Gear Schema',
      'Static Group Structure',
      'Tier Snapshots',
      'Loot Log Format',
      'API Endpoints',
    ],
  },
  {
    id: 'api-docs',
    title: 'API Developer Docs',
    description: 'REST API reference for developers. Endpoints, authentication, request/response schemas.',
    icon: FileText,
    href: '/docs/api',
    status: 'coming-soon',
    sections: [
      'Authentication (Discord OAuth)',
      'Static Groups & Memberships',
      'Tier Snapshots & Players',
      'Loot Logging & Page Ledger',
      'BiS Import Endpoints',
    ],
  },
];

export function DocsIndex() {
  const availableDocs = DOC_CATEGORIES.filter(doc => doc.status === 'available');
  const comingSoonDocs = DOC_CATEGORIES.filter(doc => doc.status === 'coming-soon');

  return (
    <div className="min-h-screen bg-surface-base">
      {/* Header */}
      <header className="bg-surface-raised border-b border-border-default">
        <div className="max-w-[80rem] mx-auto px-6 lg:px-8 py-12">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-accent-deep flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-accent">Documentation</h1>
              <p className="text-text-secondary mt-1">
                FFXIV Raid Planner reference guides and technical documentation
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[80rem] mx-auto px-6 lg:px-8 py-12">
        {/* Available Documentation */}
        <section className="mb-16">
          <h2 className="text-lg font-semibold text-text-primary mb-6 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-status-success" />
            Available Documentation
          </h2>
          <div className="grid gap-6">
            {availableDocs.map((doc) => (
              <DocCard key={doc.id} doc={doc} />
            ))}
          </div>
        </section>

        {/* Coming Soon */}
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-6 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-text-muted" />
            Coming Soon
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {comingSoonDocs.map((doc) => (
              <DocCardCompact key={doc.id} doc={doc} />
            ))}
          </div>
        </section>

        {/* Footer Note */}
        <footer className="mt-16 pt-8 border-t border-border-default">
          <p className="text-text-muted text-sm text-center">
            Documentation is continuously updated as features are developed.
          </p>
        </footer>
      </main>
    </div>
  );
}

// Full-width card for available documentation
function DocCard({ doc }: { doc: DocCategory }) {
  const Icon = doc.icon;

  return (
    <Link
      to={doc.href}
      className="group block bg-surface-card border border-border-subtle rounded-xl p-6 hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5 transition-all"
    >
      <div className="flex gap-6">
        {/* Icon */}
        <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
          <Icon className="w-7 h-7 text-accent" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4 mb-2">
            <h3 className="text-xl font-semibold text-text-primary group-hover:text-accent transition-colors">
              {doc.title}
            </h3>
            <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-accent group-hover:translate-x-1 transition-all" />
          </div>
          <p className="text-text-secondary mb-4">{doc.description}</p>

          {/* Sections Preview */}
          {doc.sections && (
            <div className="flex flex-wrap gap-2">
              {doc.sections.slice(0, 4).map((section) => (
                <span
                  key={section}
                  className="px-2 py-1 bg-surface-elevated rounded text-xs text-text-muted"
                >
                  {section}
                </span>
              ))}
              {doc.sections.length > 4 && (
                <span className="px-2 py-1 text-xs text-text-muted">
                  +{doc.sections.length - 4} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

// Compact card for coming soon items
function DocCardCompact({ doc }: { doc: DocCategory }) {
  const Icon = doc.icon;

  return (
    <div className="bg-surface-card border border-border-subtle rounded-xl p-5 opacity-60">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-surface-elevated flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-text-muted" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-text-secondary">{doc.title}</h3>
            <span className="px-2 py-0.5 bg-surface-elevated rounded text-[10px] uppercase tracking-wider text-text-muted">
              Soon
            </span>
          </div>
          <p className="text-sm text-text-muted line-clamp-2">{doc.description}</p>
        </div>
      </div>
    </div>
  );
}

export default DocsIndex;
