/**
 * Release Notes - Version history and changelog
 *
 * Displays all releases with categorized items.
 * Items are expandable to show detailed information and commit history.
 * Includes sidebar navigation for quick version jumping.
 *
 * Accessible at: /docs/release-notes
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Bug,
  Zap,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  GitCommit,
  Link2,
} from 'lucide-react';
import { toast } from '../stores/toastStore';
import { Button } from '../components/primitives/Button';
import { IconButton } from '../components/primitives/IconButton';
import {
  CURRENT_VERSION,
  RELEASES,
  type Release,
  type ReleaseCategory,
  type ReleaseItem,
} from '../data/releaseNotes';

const STORAGE_KEY = 'last-seen-version';

/** Pixels from viewport top to consider a section "active" during scroll */
const SCROLL_THRESHOLD_PX = 120;

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

/** Number of recent releases to show before grouping by month */
const RECENT_RELEASES_COUNT = 10;

/** Group releases by month for the "older" section */
function groupReleasesByMonth(releases: Release[]): Map<string, Release[]> {
  const groups = new Map<string, Release[]>();

  for (const release of releases) {
    // Use string slice to avoid timezone issues with Date parsing
    // release.date is a YYYY-MM-DD string
    const key = release.date.slice(0, 7);
    const existing = groups.get(key) || [];
    existing.push(release);
    groups.set(key, existing);
  }

  return groups;
}

/** Format month key to display string */
function formatMonthKey(key: string): string {
  const [year, month] = key.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// Single version item in the nav
function VersionNavItem({
  release,
  isActive,
  isLatest,
  onClick,
}: {
  release: Release;
  isActive: boolean;
  isLatest: boolean;
  onClick: () => void;
}) {
  return (
    <li id={`nav-v${release.version}`}>
      <button
        onClick={onClick}
        className={`
          w-full text-left px-2 py-1.5 rounded transition-colors
          ${isActive
            ? 'bg-accent/10 text-accent font-medium'
            : 'text-text-secondary hover:text-text-primary hover:bg-surface-interactive'
          }
        `}
        aria-label={`Jump to version ${release.version}${isLatest ? ' (latest)' : ''}`}
        aria-current={isActive ? 'true' : undefined}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px]">v{release.version}</span>
          {isLatest && (
            <span className="px-1 py-0.5 text-[9px] font-medium bg-accent/20 text-accent rounded">
              NEW
            </span>
          )}
        </div>
        <div className="text-[10px] text-text-muted mt-0.5">
          {new Date(release.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </div>
      </button>
    </li>
  );
}

// Sidebar Navigation Component
function VersionNav({
  activeVersion,
  onVersionClick,
  shouldScrollToActive,
}: {
  activeVersion: string;
  onVersionClick: (version: string) => void;
  shouldScrollToActive: boolean;
}) {
  const [scrollState, setScrollState] = useState({ top: true, bottom: false });
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const scrollContainerNodeRef = useRef<HTMLDivElement | null>(null);

  // Split releases into recent and older
  const { recentReleases, olderReleases, olderByMonth } = useMemo(() => {
    const recent = RELEASES.slice(0, RECENT_RELEASES_COUNT);
    const older = RELEASES.slice(RECENT_RELEASES_COUNT);
    const byMonth = groupReleasesByMonth(older);
    return { recentReleases: recent, olderReleases: older, olderByMonth: byMonth };
  }, []);

  // Auto-expand month containing active version if it's in older releases
  // Note: Using queueMicrotask to defer setState and avoid react-hooks/set-state-in-effect lint error.
  // This is a legitimate use case: expanding a section when the active version changes from scrolling.
  useEffect(() => {
    const olderRelease = olderReleases.find(r => r.version === activeVersion);
    if (olderRelease) {
      // Use string slice to avoid timezone issues with Date parsing
      const monthKey = olderRelease.date.slice(0, 7);
      queueMicrotask(() => {
        setExpandedMonths(prev => {
          if (prev.has(monthKey)) return prev;
          const next = new Set(prev);
          next.add(monthKey);
          return next;
        });
      });
    }
  }, [activeVersion, olderReleases]);

  // Store the node reference via callback ref
  const scrollContainerRef = useCallback((node: HTMLDivElement | null) => {
    scrollContainerNodeRef.current = node;
  }, []);

  // Set up scroll listener with proper cleanup
  useEffect(() => {
    const node = scrollContainerNodeRef.current;
    if (!node) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = node;
      setScrollState({
        top: scrollTop < 10,
        bottom: scrollTop + clientHeight >= scrollHeight - 10,
      });
    };

    node.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    return () => {
      node.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Scroll nav to show active version when it changes (only when triggered by main content scroll)
  useEffect(() => {
    if (!shouldScrollToActive) return;

    const navItem = document.getElementById(`nav-v${activeVersion}`);
    const container = scrollContainerNodeRef.current;
    if (navItem && container) {
      // Scroll the nav item to the top of the container
      const itemTop = navItem.offsetTop;
      container.scrollTo({ top: itemTop - 8, behavior: 'smooth' });
    }
  }, [activeVersion, shouldScrollToActive]);

  const handleClick = (version: string) => {
    onVersionClick(version);
    // Delay scroll until after React re-renders the expanded content
    // Using requestAnimationFrame + setTimeout to ensure DOM has updated
    requestAnimationFrame(() => {
      setTimeout(() => {
        const element = document.getElementById(`v${version}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
    });
  };

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(monthKey)) {
        next.delete(monthKey);
      } else {
        next.add(monthKey);
      }
      return next;
    });
  };

  return (
    <nav className="sticky top-16 w-48 shrink-0 hidden lg:block self-start h-fit z-30">
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
          className="p-3 max-h-[calc(100dvh-8rem)] overflow-y-auto scrollbar-thin"
        >
          {/* Recent Versions */}
          <div className="text-[9px] font-semibold text-text-muted/70 uppercase tracking-[0.1em] mb-2 px-1">
            Recent
          </div>
          <ul className="space-y-px">
            {recentReleases.map((release, idx) => (
              <VersionNavItem
                key={release.version}
                release={release}
                isActive={activeVersion === release.version}
                isLatest={idx === 0}
                onClick={() => handleClick(release.version)}
              />
            ))}
          </ul>

          {/* Older Versions by Month */}
          {olderReleases.length > 0 && (
            <>
              <div className="text-[9px] font-semibold text-text-muted/70 uppercase tracking-[0.1em] mt-4 mb-2 px-1">
                Older
              </div>
              <div className="space-y-1">
                {Array.from(olderByMonth.entries()).map(([monthKey, releases]) => {
                  const isExpanded = expandedMonths.has(monthKey);
                  const hasActiveVersion = releases.some(r => r.version === activeVersion);

                  const monthListId = `month-list-${monthKey}`;

                  return (
                    <div key={monthKey}>
                      {/* design-system-ignore - Collapsible month header, Button would add complexity */}
                      <button
                        onClick={() => toggleMonth(monthKey)}
                        aria-expanded={isExpanded}
                        aria-controls={monthListId}
                        className={`
                          w-full text-left px-2 py-1.5 rounded transition-colors flex items-center justify-between
                          ${hasActiveVersion
                            ? 'text-accent'
                            : 'text-text-muted hover:text-text-secondary hover:bg-surface-interactive'
                          }
                        `}
                      >
                        <span className="text-[11px] font-medium">{formatMonthKey(monthKey)}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-text-muted">({releases.length})</span>
                          <ChevronRight
                            className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          />
                        </div>
                      </button>
                      {isExpanded && (
                        <ul
                          id={monthListId}
                          className="space-y-px ml-2 mt-1 border-l border-border-subtle pl-2"
                        >
                          {releases.map((release) => (
                            <VersionNavItem
                              key={release.version}
                              release={release}
                              isActive={activeVersion === release.version}
                              isLatest={false}
                              onClick={() => handleClick(release.version)}
                            />
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
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
  const hasExpandableContent = item.details || (item.commits && item.commits.length > 0) || item.image || item.link;

  return (
    <li className="group">
      {/* hover:bg-surface-elevated intentionally overrides ghost variant for subtle elevated effect */}
      <Button
        variant="ghost"
        onClick={() => hasExpandableContent && setIsExpanded(!isExpanded)}
        className={`w-full text-left flex items-start gap-3 p-3 rounded-lg transition-colors h-auto justify-start ${
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
            <p className="text-sm text-text-muted mt-0.5 font-normal whitespace-normal">{item.description}</p>
          )}
        </div>
      </Button>

      {/* Expanded Content */}
      {isExpanded && hasExpandableContent && (
        <div className="ml-[88px] mr-3 mb-3 p-4 bg-surface-elevated rounded-lg border border-border-subtle">
          {item.image && (
            <div className="mb-4 rounded-lg overflow-hidden border border-border-subtle">
              <img
                src={item.image}
                alt={`${item.title} demonstration`}
                className="w-full h-auto"
              />
            </div>
          )}

          {item.details && (
            <p className="text-sm text-text-secondary mb-4">{item.details}</p>
          )}

          {item.link && (
            <div className="mb-4">
              <Link
                to={item.link.href}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent text-sm font-medium rounded-lg transition-colors"
              >
                {item.link.label}
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
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
                    <a
                      href={`https://github.com/aaronbcarlisle/ffxiv-raid-planner-dev/commit/${commit.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-1.5 py-0.5 bg-surface-card rounded text-xs font-mono text-accent hover:underline"
                    >
                      {commit.hash}
                    </a>
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

function ReleaseCard({
  release,
  isLatest,
  defaultExpanded = false,
  forceExpanded,
  onToggle,
}: {
  release: Release;
  isLatest: boolean;
  defaultExpanded?: boolean;
  forceExpanded?: boolean;
  onToggle?: (version: string) => void;
}) {
  const [localExpanded, setLocalExpanded] = useState(defaultExpanded);

  // Use forceExpanded if provided (for URL hash), otherwise local state
  const isExpanded = forceExpanded ?? localExpanded;

  const handleToggle = () => {
    if (onToggle) {
      onToggle(release.version);
    } else {
      setLocalExpanded(!localExpanded);
    }
  };

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
    <article id={`v${release.version}`} className="bg-surface-card border border-border-subtle rounded-xl overflow-hidden scroll-mt-20">
      {/* Header - Always visible, clickable */}
      {/* hover:bg-surface-elevated/50 intentionally overrides ghost variant for subtle card hover */}
      <Button
        variant="ghost"
        onClick={handleToggle}
        className="w-full text-left p-6 hover:bg-surface-elevated/50 transition-colors h-auto justify-start rounded-none"
      >
        <header className="flex items-start justify-between gap-4 w-full">
          <div className="flex items-center gap-4">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                isExpanded ? 'bg-accent text-accent-contrast' : 'bg-accent/10 text-accent'
              }`}
            >
              <ChevronDown
                className={`w-5 h-5 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
              />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl font-semibold text-text-primary">v{release.version}</h2>
                <IconButton
                  icon={<Link2 className="w-4 h-4" />}
                  onClick={(e) => {
                    e.stopPropagation();
                    const url = `${window.location.origin}/docs/release-notes#v${release.version}`;
                    navigator.clipboard.writeText(url);
                    toast.success('Link copied to clipboard');
                  }}
                  variant="ghost"
                  className="text-text-muted hover:text-accent hover:bg-accent/10"
                  aria-label="Copy link to this version"
                  size="sm"
                />
                {isLatest && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-accent text-accent-contrast rounded">
                    LATEST
                  </span>
                )}
              </div>
              {/* font-normal and whitespace-normal override Button's inherited styles */}
              {release.title && <p className="text-text-secondary font-normal whitespace-normal">{release.title}</p>}
            </div>
          </div>
          <div className="text-right shrink-0 font-normal">
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
      </Button>

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
  const location = useLocation();
  const navigate = useNavigate();

  // Initialize from URL hash if present (e.g., #v1.0.5)
  // Note: Direct window.location.hash access is safe here as this is a client-only SPA (no SSR).
  // useLocation().hash could be used but requires an extra re-render on initial load.
  const initialVersion = (() => {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#v')) {
      return hash.slice(2); // Remove #v
    }
    return RELEASES[0]?.version || '';
  })();

  const [activeVersion, setActiveVersion] = useState(initialVersion);
  const [shouldScrollNav, setShouldScrollNav] = useState(false);
  const isScrollingRef = useRef(false);
  const scrollEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track expanded versions - Set allows multiple to be expanded
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(() => {
    // Include hash version in initial expanded set
    const versions = [RELEASES[0]?.version, initialVersion].filter(Boolean);
    return new Set(versions);
  });

  // Handle URL hash anchor scrolling on mount/change
  useEffect(() => {
    if (location.hash && location.hash.startsWith('#v')) {
      // State is already set via initializers or handleVersionClick
      // Just scroll to the element
      setTimeout(() => {
        const element = document.getElementById(location.hash.slice(1));
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  }, [location.hash]);

  // Handle sidebar version click - collapse others, expand only clicked
  const handleVersionClick = useCallback((version: string) => {
    setShouldScrollNav(false); // Don't scroll nav when user clicked on it
    setActiveVersion(version);
    // Collapse all others, expand only the clicked version
    setExpandedVersions(new Set([version]));
    isScrollingRef.current = true;
    // Update URL hash
    navigate(`#v${version}`, { replace: true });
  }, [navigate]);

  // Scroll-based active version tracking
  useEffect(() => {
    const handleScroll = () => {
      // Skip if we're in the middle of a programmatic scroll
      if (isScrollingRef.current) {
        if (scrollEndTimeoutRef.current) {
          clearTimeout(scrollEndTimeoutRef.current);
        }
        scrollEndTimeoutRef.current = window.setTimeout(() => {
          isScrollingRef.current = false;
        }, 150);
        return;
      }

      const threshold = SCROLL_THRESHOLD_PX;
      const viewportHeight = window.innerHeight;

      // Get all version sections
      const sections = RELEASES.map(r => ({
        version: r.version,
        element: document.getElementById(`v${r.version}`),
      })).filter(s => s.element);

      let bestVersion: string | null = null;
      let bestTop = -Infinity;

      // Find the section that's closest to the top of the viewport but still visible
      for (const section of sections) {
        if (section.element) {
          const rect = section.element.getBoundingClientRect();
          if (rect.top <= threshold && rect.top > bestTop) {
            bestTop = rect.top;
            bestVersion = section.version;
          }
        }
      }

      // If no section is above threshold, find the first visible one
      if (!bestVersion) {
        for (const section of sections) {
          if (section.element) {
            const rect = section.element.getBoundingClientRect();
            if (rect.top >= 0 && rect.top < viewportHeight) {
              bestVersion = section.version;
              break;
            }
          }
        }
      }

      // Fallback to first section
      if (!bestVersion) {
        bestVersion = sections[0]?.version || RELEASES[0]?.version;
      }

      if (bestVersion) {
        setShouldScrollNav(true); // Scroll nav when active version changes from scrolling
        setActiveVersion(prev => {
          if (prev !== bestVersion) {
            // Update URL hash when active version changes from scroll
            window.history.replaceState(null, '', `#v${bestVersion}`);
          }
          return bestVersion;
        });
      }
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

  // Toggle a version's expanded state
  const handleToggle = (version: string) => {
    setExpandedVersions(prev => {
      const next = new Set(prev);
      if (next.has(version)) {
        next.delete(version);
      } else {
        next.add(version);
      }
      return next;
    });
  };

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
        <div className="max-w-[120rem] mx-auto px-6 lg:px-8 py-8">
          <div className="flex items-center gap-2 text-sm text-text-muted mb-4">
            <Link to="/docs" className="hover:text-accent transition-colors">
              Documentation
            </Link>
            <span>/</span>
            <span className="text-text-secondary">Release Notes</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-accent">Release Notes</h1>
            <p className="text-text-secondary mt-1">What's new in FFXIV Raid Planner</p>
          </div>
        </div>
      </header>

      {/* Content with Sidebar */}
      <div className="max-w-[120rem] mx-auto px-6 lg:px-8 py-12 flex gap-8">
        <VersionNav
          activeVersion={activeVersion}
          onVersionClick={handleVersionClick}
          shouldScrollToActive={shouldScrollNav}
        />

        <main className="flex-1 min-w-0">
          <div className="space-y-4">
            {RELEASES.map((release, idx) => (
              <ReleaseCard
                key={release.version}
                release={release}
                isLatest={idx === 0}
                forceExpanded={expandedVersions.has(release.version)}
                onToggle={handleToggle}
              />
            ))}
          </div>

          {RELEASES.length === 0 && (
            <div className="text-center py-12 text-text-muted">No releases yet.</div>
          )}
        </main>
      </div>
    </div>
  );
}
