/**
 * Group Header
 *
 * Displays static group info: name, role badge, and share code.
 * Single-row layout with clickable share code to copy.
 */

import { useState } from 'react';
import type { MemberRole } from '../../types';

// Role badge colors
const ROLE_COLORS: Record<MemberRole, string> = {
  owner: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  lead: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  member: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  viewer: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

interface GroupHeaderProps {
  name: string;
  shareCode: string;
  userRole?: MemberRole;
}

export function GroupHeader({
  name,
  shareCode,
  userRole,
}: GroupHeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(shareCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <h1 className="text-2xl font-display text-accent">{name}</h1>
      {userRole && (
        <span className={`text-xs px-2 py-0.5 rounded border ${ROLE_COLORS[userRole]}`}>
          {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
        </span>
      )}
      {/* Share code - clickable to copy */}
      <button
        onClick={handleCopyCode}
        className="flex items-center gap-1.5 px-2 py-1 rounded bg-bg-hover hover:bg-bg-elevated transition-colors group"
        title="Click to copy share code"
      >
        <span className="font-mono text-sm text-accent">{shareCode}</span>
        {copied ? (
          <svg className="w-4 h-4 text-status-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>
    </div>
  );
}
