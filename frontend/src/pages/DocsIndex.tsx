/**
 * Documentation Index - Simplified landing page
 *
 * Clear paths for different user needs. Quick Start and FAQ most prominent.
 *
 * Accessible at: /docs
 */

import { Link } from 'react-router-dom';
import {
  BookOpen,
  Rocket,
  HelpCircle,
  ListChecks,
  Target,
  Code,
  Palette,
  FileText,
  Map,
  ChevronRight,
  Calculator,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface DocCard {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

// Primary action cards (large, prominent)
const PRIMARY_CARDS: DocCard[] = [
  {
    title: 'Quick Start',
    description: 'New here? Get set up in 5 minutes.',
    href: '/docs/quick-start',
    icon: Rocket,
  },
  {
    title: 'FAQ',
    description: 'Got questions? We\'ve got answers.',
    href: '/docs/faq',
    icon: HelpCircle,
  },
];

// Guide cards (medium)
const GUIDE_CARDS: DocCard[] = [
  {
    title: 'How-To Guides',
    description: 'Step-by-step guides for common tasks',
    href: '/docs/how-to',
    icon: ListChecks,
  },
  {
    title: 'Understanding Priority',
    description: 'How loot distribution works under the hood',
    href: '/docs/understanding-priority',
    icon: Target,
  },
];

// Developer reference cards
const DEVELOPER_CARDS: DocCard[] = [
  {
    title: 'API Reference',
    description: 'REST endpoints and schemas',
    href: '/docs/api',
    icon: Code,
  },
  {
    title: 'API Cookbook',
    description: 'Common integration patterns',
    href: '/docs/api/cookbook',
    icon: FileText,
  },
  {
    title: 'Gear Math Reference',
    description: 'Calculation formulas and source code',
    href: '/docs/gear-math',
    icon: Calculator,
  },
];

// Project info cards
const PROJECT_CARDS: DocCard[] = [
  {
    title: 'Release Notes',
    description: 'Latest updates and changes',
    href: '/docs/release-notes',
    icon: FileText,
  },
  {
    title: 'Roadmap',
    description: 'What\'s planned next',
    href: '/docs/roadmap',
    icon: Map,
  },
  {
    title: 'Design System',
    description: 'Colors, components, patterns',
    href: '/docs/design-system',
    icon: Palette,
  },
];

function PrimaryCard({ card }: { card: DocCard }) {
  const Icon = card.icon;
  return (
    <Link
      to={card.href}
      className="group flex flex-col items-center text-center p-8 bg-surface-card border border-border-subtle rounded-xl hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5 transition-all"
    >
      <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-accent/20 transition-all">
        <Icon className="w-8 h-8 text-accent" />
      </div>
      <h2 className="text-xl font-semibold text-text-primary group-hover:text-accent transition-colors mb-2">
        {card.title}
      </h2>
      <p className="text-text-secondary">{card.description}</p>
    </Link>
  );
}

function GuideCard({ card }: { card: DocCard }) {
  const Icon = card.icon;
  return (
    <Link
      to={card.href}
      className="group flex items-center gap-4 p-5 bg-surface-card border border-border-subtle rounded-xl hover:border-accent/50 transition-all"
    >
      <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
        <Icon className="w-6 h-6 text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-text-primary group-hover:text-accent transition-colors">
          {card.title}
        </h3>
        <p className="text-sm text-text-secondary">{card.description}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0" />
    </Link>
  );
}

function SmallCard({ card }: { card: DocCard }) {
  const Icon = card.icon;
  return (
    <Link
      to={card.href}
      className="group flex items-center gap-3 p-3 rounded-lg hover:bg-surface-interactive transition-colors"
    >
      <div className="w-8 h-8 rounded-lg bg-surface-elevated flex items-center justify-center shrink-0 group-hover:bg-accent/10 transition-colors">
        <Icon className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-text-primary group-hover:text-accent transition-colors text-sm">
          {card.title}
        </div>
        <div className="text-xs text-text-muted">{card.description}</div>
      </div>
    </Link>
  );
}

export function DocsIndex() {
  return (
    <div className="bg-surface-base">
      {/* Header */}
      <header className="bg-surface-raised border-b border-border-default">
        <div className="max-w-[80rem] mx-auto px-6 lg:px-8 py-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-accent">Documentation</h1>
              <p className="text-text-secondary mt-1">
                Everything you need to use XIV Raid Planner
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[80rem] mx-auto px-6 lg:px-8 py-10">
        {/* Primary Cards */}
        <section className="mb-10">
          <div className="grid md:grid-cols-2 gap-6">
            {PRIMARY_CARDS.map((card) => (
              <PrimaryCard key={card.href} card={card} />
            ))}
          </div>
        </section>

        {/* Guide Cards */}
        <section className="mb-10">
          <div className="grid md:grid-cols-2 gap-4">
            {GUIDE_CARDS.map((card) => (
              <GuideCard key={card.href} card={card} />
            ))}
          </div>
        </section>

        {/* Reference Sections */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* For Developers */}
          <section>
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
              For Developers
            </h2>
            <div className="bg-surface-card border border-border-subtle rounded-xl p-2">
              {DEVELOPER_CARDS.map((card) => (
                <SmallCard key={card.href} card={card} />
              ))}
            </div>
          </section>

          {/* Project Info */}
          <section>
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
              Project Info
            </h2>
            <div className="bg-surface-card border border-border-subtle rounded-xl p-2">
              {PROJECT_CARDS.map((card) => (
                <SmallCard key={card.href} card={card} />
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default DocsIndex;
