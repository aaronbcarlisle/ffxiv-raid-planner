import { useState } from 'react';

// External image hosts allowed for portrait/avatar display.
// Only HTTPS URLs from these domains are rendered; all others fall back to the fallback slot.
const ALLOWED_HOSTS = new Set([
  'i.imgur.com',
  'imgur.com',
  'i.gyazo.com',
  'gyazo.com',
  'cdn.discordapp.com',
  'images.xivapi.com',
  'img2.finalfantasyxiv.com',
]);

function isSafeAvatarUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  // Internal/relative paths and data URIs are always safe
  if (url.startsWith('/') || url.startsWith('./') || url.startsWith('data:')) return true;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return ALLOWED_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

interface SafeAvatarProps {
  /** Source URL. External URLs must be from the ALLOWED_HOSTS list. */
  src?: string | null;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Rendered when src is absent, blocked, or fails to load. */
  fallback?: React.ReactNode;
}

/**
 * SafeAvatar renders an <img> only when the URL is internal or from an
 * explicit allowlist of trusted hosts. Blocked or erroring sources render
 * the fallback slot instead.
 */
export function SafeAvatar({ src, alt = '', className, style, fallback }: SafeAvatarProps) {
  const [errored, setErrored] = useState(false);
  const safe = isSafeAvatarUrl(src);
  const showImage = safe && !errored && !!src;

  if (showImage) {
    return (
      <img
        src={src!}
        alt={alt}
        className={className}
        style={style}
        onError={() => setErrored(true)}
      />
    );
  }

  if (fallback) return <>{fallback}</>;
  return <div className={className} style={style} aria-hidden="true" />;
}
