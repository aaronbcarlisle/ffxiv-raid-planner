/**
 * Login Button - Initiates Discord OAuth flow
 */

import { useAuthStore } from '../../stores/authStore';
import { DiscordIcon } from '../ui/DiscordIcon';

interface LoginButtonProps {
  className?: string;
}

export function LoginButton({ className = '' }: LoginButtonProps) {
  const { login, isLoading } = useAuthStore();

  return (
    <button
      onClick={() => login()}
      disabled={isLoading}
      className={`
        flex items-center gap-2 px-4 py-2
        bg-discord hover:bg-discord-hover
        text-white font-medium rounded
        transition-colors duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      <DiscordIcon className="w-5 h-5" />
      {isLoading ? 'Connecting...' : 'Login with Discord'}
    </button>
  );
}
