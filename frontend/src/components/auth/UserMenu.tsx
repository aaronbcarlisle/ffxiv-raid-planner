/**
 * User Menu - Shows user avatar with dropdown for logout
 *
 * Migrated to Radix DropdownMenu for accessibility and consistent styling.
 */

import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { useSyntheticUnreadCount } from '../../lib/syntheticNotifications';
import { NotificationCenter } from './NotificationCenter';
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
  Key,
  Swords,
  EyeOff,
  Bell,
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { Modal } from '../ui/Modal';
import { useModal } from '../../hooks/useModal';
import { Toggle } from '../ui';
import { ApiKeyManager } from '../settings/ApiKeyManager';

interface UserMenuProps {
  className?: string;
  /** 'header' = compact avatar trigger (default); 'rail' = full-width footer trigger that opens upward */
  variant?: 'header' | 'rail';
  /** When rail variant is collapsed, only the avatar shows (no name/chevron) */
  collapsed?: boolean;
}

export function UserMenu({ className = '', variant = 'header', collapsed = false }: UserMenuProps) {
  const { user, logout, updatePreferences } = useAuthStore();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const apiKeysModal = useModal();
  const notificationsModal = useModal();
  const { unreadCount, fetchNotifications } = useNotificationStore();
  // useSyntheticUnreadCount re-renders this badge when a release note is marked
  // read — getSyntheticUnreadCount() alone wouldn't, since marking the only
  // unread item read doesn't change the server-backed unreadCount.
  const syntheticUnread = useSyntheticUnreadCount();
  const totalBadge = unreadCount + syntheticUnread;

  useEffect(() => {
    if (user) fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!user) return null;

  const displayName = user.displayName || user.discordUsername;
  const avatarUrl = user.avatarUrl || getDefaultAvatar(user.discordId);
  const isRail = variant === 'rail';

  return (
    <>
    <Dropdown>
      <DropdownTrigger>
        {/* design-system-ignore - Radix DropdownTrigger requires native button with asChild */}
        {/* a11y-exception: Focus ring intentionally removed per user request - avatar border provides sufficient visual indicator */}
        <button
          className={isRail
            ? `flex items-center gap-2.5 w-full py-2.5 ${collapsed ? 'justify-center px-0' : 'px-3'} hover:bg-white/[0.035] transition-colors ${className}`
            : `flex items-center gap-2 p-1 rounded-full hover:bg-surface-interactive transition-colors focus:outline-none ${className}`}
          aria-label={`User menu for ${displayName}`}
        >
          <span className="relative">
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-8 h-8 rounded-full border-2 border-accent/50"
            />
            {totalBadge > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-status-error text-[9px] font-bold text-white flex items-center justify-center leading-none">
                {totalBadge > 9 ? '9+' : totalBadge}
              </span>
            )}
          </span>
          {isRail && !collapsed && (
            <span className="flex-1 min-w-0 text-left">
              <span className="block text-sm font-medium text-text-primary truncate">{displayName}</span>
            </span>
          )}
          {(!isRail || !collapsed) && (
            <svg
              className="w-4 h-4 text-text-secondary flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isRail ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
            </svg>
          )}
        </button>
      </DropdownTrigger>

      <DropdownContent align={isRail ? 'start' : 'end'} side={isRail ? 'top' : 'bottom'} className="w-48">
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

        <DropdownItem
          icon={<Swords className="w-4 h-4" />}
          onSelect={() => navigate('/profile')}
        >
          Player Hub
        </DropdownItem>

        {/* Admin Dashboard - only for admins */}
        {user.isAdmin && (
          <DropdownItem
            icon={<Shield className="w-4 h-4 text-status-warning" />}
            onSelect={() => navigate('/admin')}
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
          icon={<Key className="w-4 h-4" />}
          onSelect={() => apiKeysModal.open()}
        >
          API Keys
        </DropdownItem>

        <DropdownItem
          icon={
            <span className="relative">
              <Bell className="w-4 h-4" />
              {totalBadge > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[10px] h-[10px] px-0.5 rounded-full bg-status-error text-[7px] font-bold text-white flex items-center justify-center leading-none">
                  {totalBadge > 9 ? '9+' : totalBadge}
                </span>
              )}
            </span>
          }
          onSelect={() => notificationsModal.open()}
        >
          {totalBadge > 0 ? `${totalBadge} unread notifications` : 'Notifications'}
        </DropdownItem>

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
            Off-state orb CSS vars are overridden so the handle is visible against the
            dark menu. These reference Toggle.tsx internals: --color-toggle-orb-off-start
            and --color-toggle-orb-off-end (see Toggle.tsx line 117). */}
        <div
          role="none"
          className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary cursor-pointer hover:bg-surface-interactive transition-colors"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          style={{
            '--color-toggle-orb-off-start': 'var(--color-accent)',
            '--color-toggle-orb-off-end': 'var(--color-accent-muted)',
          } as React.CSSProperties}
        >
          <span className="w-4 h-4 flex items-center justify-center">
            {theme === 'light' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </span>
          <span className="flex-1">
            {theme === 'light' ? 'Light Mode' : 'Dark Mode'}
          </span>
          {/* Stop propagation so the row click and Toggle click don't double-fire */}
          <span onClick={(e) => e.stopPropagation()}>
            <Toggle
              checked={theme === 'light'}
              onChange={(checked) => setTheme(checked ? 'light' : 'dark')}
              size="sm"
              aria-label="Toggle theme"
            />
          </span>
        </div>

        {/* Activity privacy toggle — same non-item pattern as theme toggle */}
        <div
          role="none"
          className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary cursor-pointer hover:bg-surface-interactive transition-colors"
          onClick={() =>
            updatePreferences({
              activityDisplayMode:
                user.activityDisplayMode === 'anonymous' ? 'named' : 'anonymous',
            })
          }
          title="When on, your name is hidden in the static activity feed"
        >
          <span className="w-4 h-4 flex items-center justify-center">
            <EyeOff className="w-4 h-4" />
          </span>
          <span className="flex-1">Anonymous activity</span>
          <span onClick={(e) => e.stopPropagation()}>
            <Toggle
              checked={user.activityDisplayMode === 'anonymous'}
              onChange={(checked) =>
                updatePreferences({ activityDisplayMode: checked ? 'anonymous' : 'named' })
              }
              size="sm"
              aria-label="Toggle activity anonymity"
            />
          </span>
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

    {/* API Keys Modal */}
    <Modal isOpen={apiKeysModal.isOpen} onClose={apiKeysModal.close} title={<span className="flex items-center gap-2"><Key className="w-5 h-5" />API Keys</span>} size="lg">
      <ApiKeyManager />
    </Modal>

    {/* Notification Center */}
    <NotificationCenter isOpen={notificationsModal.isOpen} onClose={notificationsModal.close} />
    </>
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
