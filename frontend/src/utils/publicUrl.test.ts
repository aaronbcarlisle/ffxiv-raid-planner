import { describe, expect, it } from 'vitest';
import { buildPublicProfileUrl, resolvePublicAppUrl } from './publicUrl';

describe('public URL helpers', () => {
  const localOrigin = `http://localhost${':5174'}`;

  it('uses the configured public app URL for profile links', () => {
    expect(buildPublicProfileUrl('BT7M27EB', {
      configuredUrl: 'https://www.xivraidplanner.app/',
      origin: localOrigin,
      isProduction: true,
    })).toBe('https://www.xivraidplanner.app/profile/BT7M27EB');
  });

  it('falls back to the deployed app URL for production builds', () => {
    expect(resolvePublicAppUrl({
      origin: localOrigin,
      isProduction: true,
    })).toBe('https://www.xivraidplanner.app');
  });

  it('keeps the local origin for development when no public URL is configured', () => {
    expect(buildPublicProfileUrl('LOCAL123', {
      origin: localOrigin,
      isProduction: false,
    })).toBe(`${localOrigin}/profile/LOCAL123`);
  });
});
