/**
 * Admin Sidebar - Vertical navigation for admin dashboard
 *
 * Fixed-width sidebar on desktop, collapsible on mobile.
 * Uses NavLink for active state with teal accent indicator.
 */

import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../../services/api';
import { Badge } from '../primitives/Badge';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/admin/overview', label: 'Overview', icon: '\u{1F4CA}', end: true },
  { to: '/admin/statics', label: 'Statics', icon: '\u{1F465}' },
  { to: '/admin/usage', label: 'Usage Analytics', icon: '\u{1F4C8}' },
  { to: '/admin/errors', label: 'Error Log', icon: '\u{26A0}\u{FE0F}' },
];

interface ErrorListResponse {
  total: number;
}

export function AdminSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreviewedErrors, setUnreviewedErrors] = useState<number>(0);

  // Fetch unreviewed error count on mount
  useEffect(() => {
    let cancelled = false;
    api
      .get<ErrorListResponse>('/api/admin/analytics/errors?status=unreviewed&page_size=1')
      .then((data) => {
        if (!cancelled) {
          setUnreviewedErrors(data.total);
        }
      })
      .catch(() => {
        // Silently ignore - badge just won't show
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const navContent = (
    <nav className="flex flex-col gap-1 py-4 px-3">
      <h2 className="font-display text-sm font-bold text-status-warning uppercase tracking-wider px-3 mb-3">
        Admin
      </h2>
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'text-accent bg-accent/10 border-l-2 border-accent -ml-px'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-interactive'
            }`
          }
        >
          <span className="text-base" aria-hidden="true">
            {item.icon}
          </span>
          <span className="flex-1">{item.label}</span>
          {item.to === '/admin/errors' && unreviewedErrors > 0 && (
            <Badge variant="error" size="sm">
              {unreviewedErrors}
            </Badge>
          )}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile toggle button */}
      {/* design-system-ignore: Minimal hamburger toggle for sidebar, not a primary action */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed bottom-4 left-4 z-50 bg-accent text-accent-contrast w-10 h-10 rounded-full shadow-lg flex items-center justify-center"
        aria-label={mobileOpen ? 'Close admin menu' : 'Open admin menu'}
      >
        {mobileOpen ? '\u2715' : '\u2630'}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          bg-surface-card border-r border-border-default w-[220px] flex-shrink-0
          lg:relative lg:translate-x-0
          fixed top-0 left-0 z-40 h-full transition-transform duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {navContent}
      </aside>
    </>
  );
}
