const DEFAULT_PUBLIC_APP_URL = 'https://www.xivraidplanner.app';

interface PublicUrlOptions {
  configuredUrl?: string | null;
  origin?: string | null;
  isProduction?: boolean;
}

function normalizeBaseUrl(url?: string | null): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, '');
}

export function resolvePublicAppUrl({
  configuredUrl,
  origin,
  isProduction = false,
}: PublicUrlOptions = {}): string {
  const configured = normalizeBaseUrl(configuredUrl);
  if (configured) return configured;

  if (isProduction) {
    return DEFAULT_PUBLIC_APP_URL;
  }

  return normalizeBaseUrl(origin) ?? DEFAULT_PUBLIC_APP_URL;
}

export function getPublicAppUrl(): string {
  return resolvePublicAppUrl({
    configuredUrl: import.meta.env.VITE_PUBLIC_APP_URL,
    origin: typeof window !== 'undefined' ? window.location.origin : null,
    isProduction: Boolean(import.meta.env.PROD),
  });
}

export function buildPublicProfileUrl(
  shareCode: string,
  options?: PublicUrlOptions,
): string {
  return `${resolvePublicAppUrl(options)}/profile/${encodeURIComponent(shareCode)}`;
}
