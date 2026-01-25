/**
 * NavSidebar - Shared documentation sidebar navigation component
 *
 * Features:
 * - Collapsible section groups
 * - Scroll shadow indicators
 * - Active section highlighting
 * - ARIA accessibility attributes
 * - Proper event listener cleanup
 * - Mobile toggle button and slide-out panel
 */

import { useState, useEffect, useRef, useId } from 'react';
import { ChevronDown, Menu, X } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

interface NavSidebarProps {
  groups: NavGroup[];
  activeSection: string;
  onSectionClick: (id: string) => void;
}

export function NavSidebar({ groups, activeSection, onSectionClick }: NavSidebarProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [scrollState, setScrollState] = useState({ top: true, bottom: false });
  const [mobileOpen, setMobileOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const baseId = useId();

  // Proper scroll event listener with cleanup
  useEffect(() => {
    const node = scrollContainerRef.current;
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

    return () => node.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const handleClick = (id: string) => {
    onSectionClick(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileOpen(false); // Close mobile nav when section clicked
  };

  // Close mobile nav on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [mobileOpen]);

  // Render navigation groups - used by both mobile and desktop
  const renderGroups = (idPrefix: string) =>
    groups.map((group, groupIndex) => {
      const isCollapsed = collapsedGroups.has(group.label);
      const groupContentId = `${idPrefix}-group-${groupIndex}`;

      return (
        <div key={group.label} className={groupIndex > 0 ? 'mt-3' : ''}>
          {/* design-system-ignore: navigation toggle buttons use specialized styling */}
          <button
            onClick={() => toggleGroup(group.label)}
            className="w-full flex items-center justify-between text-[9px] font-semibold text-text-muted/70 uppercase tracking-[0.1em] mb-1 px-1 py-0.5 rounded hover:text-text-muted hover:bg-surface-interactive cursor-pointer"
            aria-expanded={!isCollapsed}
            aria-controls={groupContentId}
          >
            <span>{group.label}</span>
            <ChevronDown
              className={`w-3 h-3 transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`}
              aria-hidden="true"
            />
          </button>
          {!isCollapsed && (
            <ul id={groupContentId} className="space-y-px" role="list">
              {group.items.map((section) => (
                <li key={section.id}>
                  {/* design-system-ignore: navigation link buttons use specialized styling */}
                  <button
                    onClick={() => handleClick(section.id)}
                    className={`w-full text-left pl-3 pr-2 py-1.5 text-[13px] rounded transition-colors ${
                      activeSection === section.id
                        ? 'bg-accent/10 text-accent font-medium'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-interactive'
                    }`}
                    aria-current={activeSection === section.id ? 'location' : undefined}
                  >
                    {section.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    });

  return (
    <>
      {/* Mobile toggle button - fixed position bottom left */}
      {/* design-system-ignore: FAB-style mobile toggle uses specialized styling */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed bottom-20 left-4 z-40 w-12 h-12 bg-accent rounded-full shadow-lg flex items-center justify-center text-accent-contrast hover:bg-accent-bright transition-colors"
        aria-label="Open navigation"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile slide-out panel */}
      <div
        className={`lg:hidden fixed top-0 left-0 bottom-0 w-72 z-50 bg-surface-base transform transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-border-default">
          <span className="font-semibold text-accent">Navigation</span>
          {/* design-system-ignore: close button uses specialized styling */}
          <button
            onClick={() => setMobileOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-interactive transition-colors"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>
        <div className="p-4">
          <div className="bg-surface-card border border-border-subtle rounded-lg p-3 max-h-[calc(100dvh-8rem)] overflow-y-auto scrollbar-thin">
            {renderGroups(`${baseId}-mobile`)}
          </div>
        </div>
      </div>

      {/* Desktop sticky sidebar */}
      <nav
        className="sticky top-16 w-56 shrink-0 hidden lg:block self-start h-fit z-30"
        aria-label="Documentation sections"
      >
        <div className="relative bg-surface-card border border-border-subtle rounded-lg">
          <div
            className={`absolute top-0 left-0 right-0 h-6 rounded-t-lg pointer-events-none z-10 bg-gradient-to-b from-surface-card to-transparent transition-opacity duration-150 ${scrollState.top ? 'opacity-0' : 'opacity-100'}`}
            aria-hidden="true"
          />
          <div
            ref={scrollContainerRef}
            className="p-3 max-h-[calc(100dvh-8rem)] overflow-y-auto scrollbar-thin"
          >
            {renderGroups(baseId)}
          </div>
          <div
            className={`absolute bottom-0 left-0 right-0 h-6 rounded-b-lg pointer-events-none z-10 bg-gradient-to-t from-surface-card to-transparent transition-opacity duration-150 ${scrollState.bottom ? 'opacity-0' : 'opacity-100'}`}
            aria-hidden="true"
          />
        </div>
      </nav>
    </>
  );
}
