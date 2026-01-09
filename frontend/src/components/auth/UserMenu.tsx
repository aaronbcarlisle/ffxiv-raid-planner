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
  BookOpen,
  Users,
  UserPlus,
  ListChecks,
  Calculator,
  Code,
  Palette,
  ExternalLink,
  Sparkles,
  Wrench,
  Shield,
} from 'lucide-react';

interface UserMenuProps {
  className?: string;
}

export function UserMenu({ className = '' }: UserMenuProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  if (!user) return null;

  const displayName = user.displayName || user.discordUsername;
  const avatarUrl = user.avatarUrl || getDefaultAvatar(user.discordId);

  return (
    <Dropdown>
      <DropdownTrigger>
        <button
          className={`flex items-center gap-2 p-1 rounded-full hover:bg-surface-interactive transition-colors ${className}`}
          aria-label="User menu"
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
        >
          My Statics
        </DropdownItem>

        {/* Admin Dashboard - only for admins */}
        {user.isAdmin && (
          <DropdownItem
            icon={<Shield className="w-4 h-4 text-amber-400" />}
            onSelect={() => navigate('/admin/statics')}
          >
            <span className="text-amber-400">Admin Dashboard</span>
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
            <DropdownItem
              icon={<BookOpen className="w-4 h-4" />}
              onSelect={() => window.open('/docs', '_blank')}
            >
              <span className="flex items-center gap-1">
                All Docs
                <ExternalLink className="w-3 h-3 text-text-muted" />
              </span>
            </DropdownItem>
            <DropdownItem
              icon={<Sparkles className="w-4 h-4" />}
              onSelect={() => window.open('/docs/release-notes', '_blank')}
            >
              <span className="flex items-center gap-1">
                Release Notes
                <ExternalLink className="w-3 h-3 text-text-muted" />
              </span>
            </DropdownItem>
            <DropdownItem
              icon={<Wrench className="w-4 h-4" />}
              onSelect={() => window.open('/docs/roadmap', '_blank')}
            >
              <span className="flex items-center gap-1">
                Roadmap
                <ExternalLink className="w-3 h-3 text-text-muted" />
              </span>
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem
              icon={<Users className="w-4 h-4" />}
              onSelect={() => window.open('/docs/guides/leads', '_blank')}
            >
              <span className="flex items-center gap-1">
                Guide for Leads
                <ExternalLink className="w-3 h-3 text-text-muted" />
              </span>
            </DropdownItem>
            <DropdownItem
              icon={<UserPlus className="w-4 h-4" />}
              onSelect={() => window.open('/docs/guides/members', '_blank')}
            >
              <span className="flex items-center gap-1">
                Guide for Members
                <ExternalLink className="w-3 h-3 text-text-muted" />
              </span>
            </DropdownItem>
            <DropdownItem
              icon={<ListChecks className="w-4 h-4" />}
              onSelect={() => window.open('/docs/guides/common-tasks', '_blank')}
            >
              <span className="flex items-center gap-1">
                Common Tasks
                <ExternalLink className="w-3 h-3 text-text-muted" />
              </span>
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem
              icon={<Calculator className="w-4 h-4" />}
              onSelect={() => window.open('/docs/loot-math', '_blank')}
            >
              <span className="flex items-center gap-1">
                Loot & Priority Math
                <ExternalLink className="w-3 h-3 text-text-muted" />
              </span>
            </DropdownItem>
            <DropdownItem
              icon={<Code className="w-4 h-4" />}
              onSelect={() => window.open('/docs/api', '_blank')}
            >
              <span className="flex items-center gap-1">
                API Reference
                <ExternalLink className="w-3 h-3 text-text-muted" />
              </span>
            </DropdownItem>
            <DropdownItem
              icon={<Palette className="w-4 h-4" />}
              onSelect={() => window.open('/docs/design-system', '_blank')}
            >
              <span className="flex items-center gap-1">
                Design System
                <ExternalLink className="w-3 h-3 text-text-muted" />
              </span>
            </DropdownItem>
          </DropdownSubContent>
        </DropdownSub>

        <DropdownSeparator />

        <DropdownItem
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          }
          onSelect={logout}
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
