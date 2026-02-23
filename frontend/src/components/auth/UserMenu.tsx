/**
 * User Menu - Shows user avatar with dropdown for logout
 *
 * Migrated to Radix DropdownMenu for accessibility and consistent styling.
 */

import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownSub,
  DropdownSubContent,
  DropdownSubTrigger,
  DropdownTrigger,
} from '../primitives';
import {
  Rocket,
  CircleHelp,
  ListChecks,
  Calculator,
  Code,
  Palette,
  Sparkles,
  Wrench,
  Shield,
  Keyboard,
  BookOpen,
  Sun,
  Moon,
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { Toggle } from '../ui';

interface UserMenuProps {
  className?: string;
}

export function UserMenu({ className = '' }: UserMenuProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  if (!user) return null;

  const displayName = user.displayName || user.discordUsername;
  const avatarUrl = user.avatarUrl || getDefaultAvatar(user.discordId);

  return (
    <Dropdown>
      <DropdownTrigger>
        {/* design-system-ignore - Radix DropdownTrigger requires native button with asChild */}
        {/* a11y-exception: Focus ring intentionally removed per user request - avatar border provides sufficient visual indicator */}
        <button
          className={`flex items-center gap-2 p-1 rounded-full hover:bg-surface-interactive transition-colors focus:outline-none ${className}`}
          aria-label={`User menu for ${displayName}`}
        >
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-8 h-8 rounded-full border-2 border-accent/50"
          />
          <svg
            className="w-4 h-4 text-text-secondary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </DropdownTrigger>

      <DropdownContent align="end" className="w-48">
        {/* User Info */}
        <DropdownLabel className="normal-case tracking-normal">
          <p className="text-sm font-medium text-text-primary truncate">{displayName}</p>
          <p className="text-xs text-text-muted truncate font-normal">@{user.discordUsername}</p>
        </DropdownLabel>

        <DropdownSeparator />

        {/* Menu Items */}
        <DropdownItem
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          }
          onSelect={() => navigate('/dashboard')}
          shortcut="Shift+S"
        >
          My Statics
        </DropdownItem>

        {/* Admin Dashboard - only for admins */}
        {user.isAdmin && (
          <DropdownItem
            icon={<Shield className="w-4 h-4 text-status-warning" />}
            onSelect={() => navigate('/admin/statics')}
          >
            <span className="text-status-warning">Admin Dashboard</span>
          </DropdownItem>
        )}

        <DropdownSub>
          <DropdownSubTrigger
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            }
          >
            Documentation
          </DropdownSubTrigger>
          <DropdownSubContent>
            <DropdownItem icon={<BookOpen className="w-4 h-4" />} href="/docs">
              All Documentation
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem icon={<Rocket className="w-4 h-4" />} href="/docs/quick-start">
              Quick Start
            </DropdownItem>
            <DropdownItem icon={<CircleHelp className="w-4 h-4" />} href="/docs/faq">
              FAQ
            </DropdownItem>
            <DropdownItem icon={<ListChecks className="w-4 h-4" />} href="/docs/how-to">
              How-To Guides
            </DropdownItem>
            <DropdownItem icon={<Calculator className="w-4 h-4" />} href="/docs/understanding-priority">
              Understanding Priority
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem icon={<Code className="w-4 h-4" />} href="/docs/api">
              API Reference
            </DropdownItem>
            <DropdownItem icon={<Palette className="w-4 h-4" />} href="/docs/design-system">
              Design System
            </DropdownItem>
            <DropdownItem icon={<Sparkles className="w-4 h-4" />} href="/docs/release-notes">
              Release Notes
            </DropdownItem>
            <DropdownItem icon={<Wrench className="w-4 h-4" />} href="/docs/roadmap">
              Roadmap
            </DropdownItem>
            <DropdownItem icon={<Shield className="w-4 h-4" />} href="/docs/privacy">
              Privacy & Security
            </DropdownItem>
          </DropdownSubContent>
        </DropdownSub>

        <DropdownItem
          icon={<Keyboard className="w-4 h-4" />}
          onSelect={() => window.dispatchEvent(new CustomEvent('show-keyboard-shortcuts'))}
          shortcut="Shift+?"
        >
          Shortcuts
        </DropdownItem>

        {/* Theme toggle — standalone row, not a Radix DropdownMenu.Item.
            This means arrow-key navigation skips this row; the Toggle is still
            reachable via Tab. Using a plain div avoids Radix's onSelect closing
            the menu and prevents nesting interactive elements (button inside menuitem).
            Off-state orb colors are overridden so the handle is visible against the dark menu. */}
        <div
          className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary"
          style={{
            '--color-toggle-orb-off-start': 'var(--color-accent)',
            '--color-toggle-orb-off-end': 'var(--color-accent-muted)',
          } as React.CSSProperties}
        >
          <span className="w-4 h-4 flex items-center justify-center">
            {theme === 'light' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </span>
          <span className="flex-1">{theme === 'light' ? 'Light Mode' : 'Dark Mode'}</span>
          <Toggle
            checked={theme === 'light'}
            onChange={(checked) => setTheme(checked ? 'light' : 'dark')}
            size="sm"
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          />
        </div>

        <DropdownSeparator />

        <DropdownItem
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          }
          onSelect={async () => {
            await logout();
            navigate('/');
          }}
        >
          Logout
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}

/**
 * Get Discord's default avatar based on user ID
 */
function getDefaultAvatar(discordId: string): string {
  // Discord uses (user_id >> 22) % 6 for default avatar index
  const index = (BigInt(discordId) >> BigInt(22)) % BigInt(6);
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}
