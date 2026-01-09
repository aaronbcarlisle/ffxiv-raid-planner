/**
 * Release Notes - Version history and changelog
 *
 * Displays all releases with categorized items.
 * Marks the current version as seen when visiting this page.
 *
 * Accessible at: /docs/release-notes
 */

import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Bug, Zap, AlertTriangle, ChevronLeft } from 'lucide-react';
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

function ReleaseCard({ release, isLatest }: { release: Release; isLatest: boolean }) {
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

  return (
    <article className="bg-surface-card border border-border-subtle rounded-xl p-6">
      {/* Header */}
      <header className="flex items-start justify-between gap-4 mb-6">
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
        <time dateTime={release.date} className="text-sm text-text-muted flex-shrink-0">
          {new Date(release.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </time>
      </header>

      {/* Items by category */}
      <div className="space-y-4">
        {categoryOrder.map((category) => {
          const items = groupedItems[category];
          if (items.length === 0) return null;

          return (
            <div key={category}>
              <ul className="space-y-2">
                {items.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <CategoryBadge category={item.category} />
                    <div className="flex-1 min-w-0">
                      <p className="text-text-primary">{item.title}</p>
                      {item.description && (
                        <p className="text-sm text-text-muted mt-0.5">{item.description}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
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
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-accent-deep flex items-center justify-center">
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
        <div className="space-y-6">
          {RELEASES.map((release, idx) => (
            <ReleaseCard key={release.version} release={release} isLatest={idx === 0} />
          ))}
        </div>

        {RELEASES.length === 0 && (
          <div className="text-center py-12 text-text-muted">No releases yet.</div>
        )}
      </main>
    </div>
  );
}
