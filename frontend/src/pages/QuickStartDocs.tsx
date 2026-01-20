/**
 * Quick Start - Landing page for Getting Started documentation
 *
 * Helps users identify their role and navigate to the appropriate guide.
 *
 * Accessible at: /docs/getting-started
 */

import { Link } from 'react-router-dom';
import {
  Users,
  UserPlus,
  BookOpen,
  ChevronRight,
  Download,
  CheckSquare,
  ListOrdered,
  Swords,
  Book,
  Shield,
  Rocket,
} from 'lucide-react';

// Role path card component
function RoleCard({
  icon: Icon,
  title,
  description,
  features,
  href,
  color,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  features: string[];
  href: string;
  color: 'teal' | 'blue';
}) {
  const colorClasses = {
    teal: { bg: 'bg-accent', border: 'hover:border-accent/50' },
    blue: { bg: 'bg-membership-member', border: 'hover:border-membership-member/50' },
  };

  return (
    <Link
      to={href}
      className={`group block bg-surface-card border border-border-subtle rounded-xl p-6 hover:shadow-lg transition-all ${colorClasses[color].border}`}
    >
      <div className="flex items-start gap-4 mb-4">
        <div className={`w-12 h-12 rounded-xl ${colorClasses[color].bg} flex items-center justify-center shrink-0`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-text-primary group-hover:text-accent transition-colors">
              {title}
            </h3>
            <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-accent group-hover:translate-x-1 transition-all" />
          </div>
          <p className="text-text-secondary mt-1">{description}</p>
        </div>
      </div>

      <ul className="space-y-2">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-text-secondary">
            <div className="w-1.5 h-1.5 rounded-full bg-accent/50" />
            {feature}
          </li>
        ))}
      </ul>
    </Link>
  );
}

// Quick link component
function QuickLink({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <Link
      to={href}
      className="group flex items-center gap-3 p-3 rounded-lg bg-surface-elevated hover:bg-surface-interactive transition-colors"
    >
      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
        <Icon className="w-4 h-4 text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-text-primary group-hover:text-accent transition-colors">
          {title}
        </div>
        <div className="text-sm text-text-muted">{description}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors shrink-0" />
    </Link>
  );
}

export default function QuickStartDocs() {
  return (
    <div className="min-h-screen bg-surface-base">
      {/* Header */}
      <header className="bg-surface-raised border-b border-border-default">
        <div className="max-w-[80rem] mx-auto px-6 lg:px-8 py-12">
          <div className="flex items-center gap-2 text-sm text-text-muted mb-4">
            <a href="/docs" className="hover:text-accent transition-colors">Documentation</a>
            <span>/</span>
            <span className="text-text-secondary">Getting Started</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
              <Rocket className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-accent">Getting Started</h1>
              <p className="text-text-secondary mt-1">
                Welcome to FFXIV Raid Planner! Choose your path to get started.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[80rem] mx-auto px-6 lg:px-8 py-12">
        {/* Role Selection */}
        <section className="mb-16">
          <h2 className="text-xl font-semibold text-text-primary mb-2">
            What's your role?
          </h2>
          <p className="text-text-secondary mb-8">
            Select the guide that matches how you'll be using the raid planner.
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            <RoleCard
              icon={Users}
              title="I'm a Static Lead"
              description="You're creating or managing a static group"
              features={[
                'Create and configure your static',
                'Set up raid tiers and add players',
                'Configure loot priority settings',
                'Invite and manage members',
              ]}
              href="/docs/guides/leads"
              color="teal"
            />

            <RoleCard
              icon={UserPlus}
              title="I'm a Static Member"
              description="You're joining an existing static"
              features={[
                'Join via invite link or share code',
                'Claim your player card',
                'Import your BiS and track gear',
                'Set weapon priorities for alts',
              ]}
              href="/docs/guides/members"
              color="blue"
            />
          </div>
        </section>

        {/* Common Tasks */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Common Tasks</h2>
              <p className="text-text-secondary text-sm">
                Reference guides for tasks everyone uses
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <QuickLink
              href="/docs/guides/common-tasks#bis-import"
              title="Importing BiS"
              description="Import from XIVGear, Etro, or presets"
              icon={Download}
            />
            <QuickLink
              href="/docs/guides/common-tasks#gear-tracking"
              title="Tracking Gear Progress"
              description="Checkboxes, iLv, and current vs BiS"
              icon={CheckSquare}
            />
            <QuickLink
              href="/docs/guides/common-tasks#loot-priority"
              title="Understanding Loot Priority"
              description="How priority scores are calculated"
              icon={ListOrdered}
            />
            <QuickLink
              href="/docs/guides/common-tasks#weapon-priority"
              title="Weapon Priority"
              description="Track weapons for main and alt jobs"
              icon={Swords}
            />
            <QuickLink
              href="/docs/guides/common-tasks#book-tracking"
              title="Book & Page Tracking"
              description="Floor clears and page balances"
              icon={Book}
            />
            <QuickLink
              href="/docs/guides/common-tasks#permissions"
              title="Permissions Reference"
              description="What each role can do"
              icon={Shield}
            />
          </div>
        </section>

        {/* Quick Overview */}
        <section className="bg-surface-card border border-border-subtle rounded-xl p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">
            What is FFXIV Raid Planner?
          </h2>
          <p className="text-text-secondary mb-4">
            FFXIV Raid Planner helps your static track gear progress toward Best-in-Slot (BiS),
            manage fair loot distribution, and stay organized throughout a raid tier.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 bg-surface-elevated rounded-lg">
              <h3 className="font-medium text-text-primary mb-1">Gear Tracking</h3>
              <p className="text-sm text-text-muted">
                Track current gear and BiS targets for every slot
              </p>
            </div>
            <div className="p-4 bg-surface-elevated rounded-lg">
              <h3 className="font-medium text-text-primary mb-1">Loot Priority</h3>
              <p className="text-sm text-text-muted">
                Fair, transparent priority based on role and need
              </p>
            </div>
            <div className="p-4 bg-surface-elevated rounded-lg">
              <h3 className="font-medium text-text-primary mb-1">Book Tracking</h3>
              <p className="text-sm text-text-muted">
                Track floor clears and page balances automatically
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
