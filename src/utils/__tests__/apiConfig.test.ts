import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The API base is read at module load, so every case re-imports the module with
 * a fresh environment. `vi.resetModules()` is what makes each scenario a real
 * build rather than a mutation of one already-resolved config.
 */
const loadConfig = async (env: Record<string, string | undefined>) => {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return import('../constants');
};

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('API base resolution', () => {
  it('defaults to the module-relative path when nothing is configured', async () => {
    const { API_BASE, buildApiUrl } = await loadConfig({
      NEXT_PUBLIC_ASSET_API_URL: undefined,
    });
    expect(API_BASE).toBe('/asset-management/api');
    expect(buildApiUrl('/Assets')).toBe('/asset-management/api/Assets');
  });

  it('local development resolves to the same relative path as every other environment', async () => {
    const { buildApiUrl } = await loadConfig({
      NEXT_PUBLIC_ASSET_API_URL: '/asset-management/api',
      NEXT_PUBLIC_ENV: 'development',
    });
    expect(buildApiUrl('/AssetDashboard')).toBe(
      '/asset-management/api/AssetDashboard'
    );
  });

  it('webdev resolves identically — the build carries no host knowledge', async () => {
    const { buildApiUrl } = await loadConfig({
      NEXT_PUBLIC_ASSET_API_URL: '/asset-management/api',
      NEXT_PUBLIC_ENV: 'production',
    });
    expect(buildApiUrl('/AssetDashboard')).toBe(
      '/asset-management/api/AssetDashboard'
    );
  });

  it('production resolves identically', async () => {
    const { buildApiUrl } = await loadConfig({
      NEXT_PUBLIC_ASSET_API_URL: '/asset-management/api',
      NEXT_PUBLIC_ENV: 'production',
      NEXT_PUBLIC_NODE_ENV: 'production',
    });
    expect(buildApiUrl('/Assets')).toBe('/asset-management/api/Assets');
  });

  it('accepts an absolute base for a genuinely cross-origin API', async () => {
    const { buildApiUrl } = await loadConfig({
      NEXT_PUBLIC_ASSET_API_URL: 'https://api.example.com/asset-management/api',
    });
    expect(buildApiUrl('/Assets')).toBe(
      'https://api.example.com/asset-management/api/Assets'
    );
  });

  it('strips a trailing slash so the endpoint never doubles it', async () => {
    const { buildApiUrl } = await loadConfig({
      NEXT_PUBLIC_ASSET_API_URL: '/asset-management/api/',
    });
    expect(buildApiUrl('/Assets')).toBe('/asset-management/api/Assets');
  });

  it('tolerates an endpoint given without a leading slash', async () => {
    const { buildApiUrl } = await loadConfig({
      NEXT_PUBLIC_ASSET_API_URL: '/asset-management/api',
    });
    expect(buildApiUrl('Assets')).toBe('/asset-management/api/Assets');
  });

  it('refuses a schemeless value instead of building a corrupt URL', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { API_BASE, buildApiUrl } = await loadConfig({
      NEXT_PUBLIC_ASSET_API_URL: 'localhost:5199',
    });
    expect(API_BASE).toBe('/asset-management/api');
    expect(buildApiUrl('/Assets')).toBe('/asset-management/api/Assets');
    expect(error).toHaveBeenCalled();
  });
});

describe('absolute vs relative endpoints', () => {
  it('returns an absolute endpoint untouched', async () => {
    const { buildApiUrl } = await loadConfig({
      NEXT_PUBLIC_ASSET_API_URL: '/asset-management/api',
    });
    const signed =
      'https://files.example.com/api/Files/content?path=x&exp=1&sig=abc';
    expect(buildApiUrl(signed)).toBe(signed);
  });

  it('keeps an absolute endpoint absolute even under an absolute base', async () => {
    const { buildApiUrl } = await loadConfig({
      NEXT_PUBLIC_ASSET_API_URL: 'https://api.example.com/asset-management/api',
    });
    expect(buildApiUrl('http://other.example.com/api/Thing')).toBe(
      'http://other.example.com/api/Thing'
    );
  });

  it('resolves a relative endpoint against the configured base only', async () => {
    const { buildApiUrl } = await loadConfig({
      NEXT_PUBLIC_ASSET_API_URL: '/asset-management/api',
    });
    expect(buildApiUrl('/Assets/019f/edit')).toBe(
      '/asset-management/api/Assets/019f/edit'
    );
  });
});

describe('the regression that caused this work', () => {
  /**
   * The reported failure was literally
   *   https://webdev.tulipshrm.com:4433http://localhost:5199/api/AppUsers/TulipsHrm/Login
   * — a resolved origin concatenated with a variable that had itself been set to
   * an origin. No configuration may produce two schemes in one URL again.
   */
  const twoSchemes = /:\/\/[^/]*[a-z]+:\/\//i;

  it('never concatenates an origin onto an absolute base', async () => {
    const { buildApiUrl } = await loadConfig({
      NEXT_PUBLIC_ASSET_API_URL: 'http://localhost:5199/api',
    });
    const url = buildApiUrl('/AppUsers/TulipsHrm/Login');
    expect(url).toBe('http://localhost:5199/api/AppUsers/TulipsHrm/Login');
    expect(url).not.toMatch(twoSchemes);
  });

  it('produces no double-scheme URL for any supported configuration', async () => {
    const bases = [
      undefined,
      '/asset-management/api',
      '/asset-management/api/',
      'https://api.example.com/asset-management/api',
      'http://localhost:5199/api',
    ];
    for (const base of bases) {
      const { buildApiUrl } = await loadConfig({
        NEXT_PUBLIC_ASSET_API_URL: base,
      });
      for (const endpoint of ['/Assets', 'Assets', '/AppUsers/TulipsHrm/Login']) {
        expect(buildApiUrl(endpoint)).not.toMatch(twoSchemes);
      }
    }
  });

  it('an absolute endpoint is never prefixed, whatever the base', async () => {
    for (const base of [undefined, '/asset-management/api', 'https://a.example.com/api']) {
      const { buildApiUrl } = await loadConfig({
        NEXT_PUBLIC_ASSET_API_URL: base,
      });
      expect(buildApiUrl('https://b.example.com/api/X')).toBe(
        'https://b.example.com/api/X'
      );
    }
  });
});

describe('getApiRoot', () => {
  it('drops the trailing /api so API-supplied rooted paths are not doubled', async () => {
    const { getApiRoot } = await loadConfig({
      NEXT_PUBLIC_ASSET_API_URL: '/asset-management/api',
    });
    expect(getApiRoot()).toBe('/asset-management');
  });

  it('keeps the origin when the base is absolute', async () => {
    const { getApiRoot } = await loadConfig({
      NEXT_PUBLIC_ASSET_API_URL: 'https://api.example.com/asset-management/api',
    });
    expect(getApiRoot()).toBe('https://api.example.com/asset-management');
  });
});

describe('dev auth flag', () => {
  it('is off unless explicitly enabled', async () => {
    const { isDevAuthEnabled } = await loadConfig({
      NEXT_PUBLIC_DEV_AUTH: undefined,
    });
    expect(isDevAuthEnabled()).toBe(false);
  });

  it('is on only for the exact string "true"', async () => {
    const on = await loadConfig({ NEXT_PUBLIC_DEV_AUTH: 'true' });
    expect(on.isDevAuthEnabled()).toBe(true);
    const off = await loadConfig({ NEXT_PUBLIC_DEV_AUTH: 'false' });
    expect(off.isDevAuthEnabled()).toBe(false);
  });

  it('cannot be enabled by a hostname — deployments never fall into it', async () => {
    const { isDevAuthEnabled } = await loadConfig({
      NEXT_PUBLIC_DEV_AUTH: undefined,
    });
    vi.stubGlobal('window', {
      location: { hostname: 'localhost', origin: 'http://localhost:3000' },
    });
    expect(isDevAuthEnabled()).toBe(false);
  });
});

describe('hub base URL (sign-in redirect only)', () => {
  it('prefers the configured hub over any host inference', async () => {
    const { getHubBaseUrl } = await loadConfig({
      NEXT_PUBLIC_HUB_URL: 'https://hub.example.com/',
    });
    vi.stubGlobal('window', {
      location: { hostname: 'localhost', origin: 'http://localhost:3000' },
    });
    expect(getHubBaseUrl()).toBe('https://hub.example.com');
  });

  it('falls back to the current origin on a deployed host', async () => {
    const { getHubBaseUrl } = await loadConfig({
      NEXT_PUBLIC_HUB_URL: undefined,
    });
    vi.stubGlobal('window', {
      location: {
        hostname: 'webdev.tulipshrm.com',
        origin: 'https://webdev.tulipshrm.com:4433',
      },
    });
    expect(getHubBaseUrl()).toBe('https://webdev.tulipshrm.com:4433');
  });

  it('is never part of an API URL', async () => {
    const { getHubBaseUrl, buildApiUrl } = await loadConfig({
      NEXT_PUBLIC_HUB_URL: 'https://hub.example.com',
      NEXT_PUBLIC_ASSET_API_URL: '/asset-management/api',
    });
    vi.stubGlobal('window', {
      location: { hostname: 'localhost', origin: 'http://localhost:3000' },
    });
    expect(getHubBaseUrl()).toBe('https://hub.example.com');
    expect(buildApiUrl('/Assets')).toBe('/asset-management/api/Assets');
    expect(buildApiUrl('/Assets')).not.toContain('hub.example.com');
  });
});
