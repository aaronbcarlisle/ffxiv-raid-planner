/**
 * User Menu - Shows user avatar with dropdown for logout
 */

import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

interface UserMenuProps {
  className?: string;
}

export function UserMenu({ className = '' }: UserMenuProps) {
  const { user, logout } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const displayName = user.displayName || user.discordUsername;
  const avatarUrl = user.avatarUrl || getDefaultAvatar(user.discordId);

  return (
    <div ref={menuRef} className={`relative ${className}`}>
      {/* Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 rounded-full hover:bg-white/10 transition-colors"
        aria-label="User menu"
      >
        <img
          src={avatarUrl}
          alt={displayName}
          className="w-8 h-8 rounded-full border-2 border-accent/50"
        />
        {/* Dropdown indicator */}
        <svg
          className={`w-4 h-4 text-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 py-1 bg-bg-card border border-white/10 rounded-lg shadow-lg z-50">
          {/* User Info */}
          <div className="px-4 py-2 border-b border-white/10">
            <p className="text-sm font-medium text-text-primary truncate">{displayName}</p>
            <p className="text-xs text-text-muted truncate">@{user.discordUsername}</p>
          </div>

          {/* Menu Items */}
          <Link
            to="/dashboard"
            onClick={() => setIsOpen(false)}
            className="block w-full px-4 py-2 text-left text-sm text-text-secondary hover:bg-white/5 hover:text-text-primary transition-colors"
          >
            My Statics
          </Link>

          <button
            onClick={() => {
              setIsOpen(false);
              logout();
            }}
            className="w-full px-4 py-2 text-left text-sm text-text-secondary hover:bg-white/5 hover:text-text-primary transition-colors"
          >
            Logout
          </button>
        </div>
      )}
    </div>
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
