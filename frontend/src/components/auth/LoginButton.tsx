/* eslint-disable design-system/no-raw-button */
/**
 * Login Button - Initiates Discord OAuth flow
 */

import { useAuthStore } from '../../stores/authStore';
import { DiscordIcon } from '../ui/DiscordIcon';

interface LoginButtonProps {
  className?: string;
  /**
   * In-app path to return to after login (see authStore.login). Omitted, the
   * click is V1's bare login(): callers such as ProtectedRoute set
   * auth_redirect themselves and rely on bare login() leaving it alone.
   */
  redirectTo?: string;
}

export function LoginButton({ className = '', redirectTo }: LoginButtonProps) {
  const { login, isLoading } = useAuthStore();

  return (
    <button
      onClick={() => (redirectTo ? login(redirectTo) : login())}
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
