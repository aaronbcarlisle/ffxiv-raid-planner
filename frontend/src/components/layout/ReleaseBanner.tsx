/**
 * Release Banner - Temporary notification for new releases
 *
 * Shows when CURRENT_VERSION differs from localStorage 'last-seen-version'.
 * Dismissed by clicking X or visiting the release notes page.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, X } from 'lucide-react';
import {
  CURRENT_VERSION,
  getLatestRelease,
  isNewerVersion,
} from '../../data/releaseNotes';

const STORAGE_KEY = 'last-seen-version';

function getLastSeenVersion(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function setLastSeenVersion(version: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, version);
  } catch {
    // Ignore storage errors
  }
}

export function ReleaseBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const lastSeen = getLastSeenVersion();
    if (isNewerVersion(CURRENT_VERSION, lastSeen)) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      setLastSeenVersion(CURRENT_VERSION);
      setIsVisible(false);
    }, 200);
  };

  const handleViewNotes = () => {
    setLastSeenVersion(CURRENT_VERSION);
  };

  if (!isVisible) return null;

  const latestRelease = getLatestRelease();
  const highlight = latestRelease?.highlights?.[0] || 'New updates available';

  return (
    <div
      className={`
        bg-accent/10 border-b border-accent/20
        transition-all duration-200
        ${isExiting ? 'opacity-0 -translate-y-2' : 'opacity-100 translate-y-0'}
      `}
      role="banner"
      aria-label="New release notification"
    >
      <div className="max-w-[120rem] mx-auto px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Sparkles className="w-4 h-4 text-accent flex-shrink-0" />
          <span className="text-sm text-text-primary truncate">
            <span className="font-medium text-accent">v{CURRENT_VERSION}</span>
            <span className="mx-2 text-text-muted">|</span>
            <span className="text-text-secondary">{highlight}</span>
          </span>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <Link
            to="/docs/release-notes"
            onClick={handleViewNotes}
            className="text-sm text-accent hover:text-accent-hover underline underline-offset-2 transition-colors"
          >
            See what's new
          </Link>
          <button
            onClick={handleDismiss}
            className="p-1 rounded hover:bg-surface-interactive transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4 text-text-muted hover:text-text-primary" />
          </button>
        </div>
      </div>
    </div>
  );
}
