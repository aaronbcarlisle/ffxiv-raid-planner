const CHUNK_RELOAD_ATTEMPTED_KEY = 'xrp_chunk_reload_attempted';

const CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Loading chunk .+ failed/i,
  /ChunkLoadError/i,
  /\/assets\/.+\.(js|css)/i,
];

interface BrowserLike {
  location: {
    href: string;
    assign: (url: string) => void;
  };
  sessionStorage: StorageLike;
}

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

function getErrorText(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) {
    return [error.name, error.message, error.stack].filter(Boolean).join('\n');
  }
  if (typeof error === 'object') {
    const maybeError = error as { message?: unknown; reason?: unknown; error?: unknown; filename?: unknown };
    return [
      getErrorText(maybeError.error),
      getErrorText(maybeError.reason),
      typeof maybeError.message === 'string' ? maybeError.message : '',
      typeof maybeError.filename === 'string' ? maybeError.filename : '',
    ].filter(Boolean).join('\n');
  }
  return String(error);
}

export function isChunkLoadError(error: unknown): boolean {
  const text = getErrorText(error);
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(text));
}

export function buildChunkRecoveryUrl(currentHref: string, now = Date.now()): string {
  const url = new URL(currentHref);
  url.searchParams.set('refresh', String(now));
  return url.toString();
}

export function hasAttemptedChunkReload(storage: StorageLike = window.sessionStorage): boolean {
  return storage.getItem(CHUNK_RELOAD_ATTEMPTED_KEY) === '1';
}

export function clearChunkReloadGuard(storage: StorageLike = window.sessionStorage): void {
  storage.removeItem(CHUNK_RELOAD_ATTEMPTED_KEY);
}

export function attemptChunkReload(win: BrowserLike = window): boolean {
  if (hasAttemptedChunkReload(win.sessionStorage)) {
    return false;
  }
  win.sessionStorage.setItem(CHUNK_RELOAD_ATTEMPTED_KEY, '1');
  win.location.assign(buildChunkRecoveryUrl(win.location.href));
  return true;
}
