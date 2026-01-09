/**
 * Release Notes - Version history and changelog
 *
 * Displays all releases with categorized items.
 * Items are expandable to show detailed information and commit history.
 *
 * Accessible at: /docs/release-notes
 */

import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Bug,
  Zap,
  AlertTriangle,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  GitCommit,
} from 'lucide-react';
import {
  CURRENT_VERSION,
  RELEASES,
  type Release,
  type ReleaseCategory,
  type ReleaseItem,
} from '../data/releaseNotes';

const STORAGE_KEY = 'last-seen-version';

// Category styling configuration
const CATEGORY_CONFIG: Record<
  ReleaseCategory,
  {
    label: string;
    icon: React.ElementType;
    color: string;
  }
> = {
  feature: {
    label: 'New',
    icon: Sparkles,
    color: 'bg-status-success/20 text-status-success border-status-success/30',
  },
  fix: {
    label: 'Fix',
    icon: Bug,
    color: 'bg-status-error/20 text-status-error border-status-error/30',
  },
  improvement: {
    label: 'Improved',
    icon: Zap,
    color: 'bg-accent/20 text-accent border-accent/30',
  },
  breaking: {
    label: 'Breaking',
    icon: AlertTriangle,
    color: 'bg-status-warning/20 text-status-warning border-status-warning/30',
  },
};

function CategoryBadge({ category }: { category: ReleaseCategory }) {
  const config = CATEGORY_CONFIG[category];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${config.color}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function ReleaseItemRow({ item }: { item: ReleaseItem }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasExpandableContent = item.details || (item.commits && item.commits.length > 0);

  return (
    <li className="group">
      <button
        onClick={() => hasExpandableContent && setIsExpanded(!isExpanded)}
        className={`w-full text-left flex items-start gap-3 p-3 rounded-lg transition-colors ${
          hasExpandableContent
            ? 'hover:bg-surface-elevated cursor-pointer'
            : 'cursor-default'
        }`}
        disabled={!hasExpandableContent}
      >
        <CategoryBadge category={item.category} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-text-primary font-medium">{item.title}</p>
            {hasExpandableContent && (
              <ChevronRight
                className={`w-4 h-4 text-text-muted transition-transform ${
                  isExpanded ? 'rotate-90' : ''
                }`}
              />
            )}
          </div>
          {item.description && (
            <p className="text-sm text-text-muted mt-0.5">{item.description}</p>
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && hasExpandableContent && (
        <div className="ml-[88px] mr-3 mb-3 p-4 bg-surface-elevated rounded-lg border border-border-subtle">
          {item.details && (
            <p className="text-sm text-text-secondary mb-4">{item.details}</p>
          )}

          {item.commits && item.commits.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <GitCommit className="w-3 h-3" />
                Related Commits
              </h4>
              <ul className="space-y-1.5">
                {item.commits.map((commit) => (
                  <li
                    key={commit.hash}
                    className="flex items-center gap-2 text-sm"
                  >
                    <code className="px-1.5 py-0.5 bg-surface-card rounded text-xs font-mono text-accent">
                      {commit.hash}
                    </code>
                    <span className="text-text-secondary">{commit.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function ReleaseCard({ release, isLatest, defaultExpanded = false }: { release: Release; isLatest: boolean; defaultExpanded?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<ReleaseCategory, ReleaseItem[]> = {
      feature: [],
      improvement: [],
      fix: [],
      breaking: [],
    };
    release.items.forEach((item) => {
      groups[item.category].push(item);
    });
    return groups;
  }, [release.items]);

  const categoryOrder: ReleaseCategory[] = ['feature', 'improvement', 'fix', 'breaking'];
  const totalItems = release.items.length;

  return (
    <article className="bg-surface-card border border-border-subtle rounded-xl overflow-hidden">
      {/* Header - Always visible, clickable */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left p-6 hover:bg-surface-elevated/50 transition-colors"
      >
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                isExpanded ? 'bg-accent text-white' : 'bg-accent/10 text-accent'
              }`}
            >
              <ChevronDown
                className={`w-5 h-5 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
              />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl font-semibold text-text-primary">v{release.version}</h2>
                {isLatest && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-accent text-white rounded">
                    LATEST
                  </span>
                )}
              </div>
              {release.title && <p className="text-text-secondary">{release.title}</p>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <time dateTime={release.date} className="text-sm text-text-muted block">
              {new Date(release.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
            <span className="text-xs text-text-muted">{totalItems} changes</span>
          </div>
        </header>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border-subtle">
          {categoryOrder.map((category) => {
            const items = groupedItems[category];
            if (items.length === 0) return null;

            const config = CATEGORY_CONFIG[category];

            return (
              <div key={category} className="border-b border-border-subtle last:border-b-0">
                <div className="px-6 py-3 bg-surface-elevated/30">
                  <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2">
                    <config.icon className="w-4 h-4" />
                    {category === 'feature' && 'New Features'}
                    {category === 'improvement' && 'Improvements'}
                    {category === 'fix' && 'Bug Fixes'}
                    {category === 'breaking' && 'Breaking Changes'}
                    <span className="text-text-muted font-normal">({items.length})</span>
                  </h3>
                </div>
                <ul className="px-3 py-2">
                  {items.map((item, idx) => (
                    <ReleaseItemRow key={idx} item={item} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

export default function ReleaseNotes() {
  // Mark version as seen when visiting this page
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
    } catch {
      // Ignore storage errors
    }
  }, []);

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
            <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-accent">Release Notes</h1>
              <p className="text-text-secondary mt-1">What's new in FFXIV Raid Planner</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[80rem] mx-auto px-6 lg:px-8 py-12">
        {/* Tip */}
        <div className="mb-8 p-4 bg-accent/5 border border-accent/20 rounded-lg">
          <p className="text-sm text-text-secondary">
            <span className="font-medium text-accent">Tip:</span> Click on any release to expand it,
            then click individual items to see detailed information and related commits.
          </p>
        </div>

        <div className="space-y-4">
          {RELEASES.map((release, idx) => (
            <ReleaseCard
              key={release.version}
              release={release}
              isLatest={idx === 0}
              defaultExpanded={idx === 0}
            />
          ))}
        </div>

        {RELEASES.length === 0 && (
          <div className="text-center py-12 text-text-muted">No releases yet.</div>
        )}
      </main>
    </div>
  );
}
