import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The AssetAuthToken exchange, exercised against the URL the configuration
 * actually produces. The regression this guards is not "the exchange fails" but
 * "the exchange is aimed at a corrupt URL": the reported error was
 * `Unable to reach the asset API at https://webdev.tulipshrm.com:4433http://localhost:5199/api/AppUsers/TulipsHrm/Login`.
 */

const cookieJar = new Map<string, string>();

vi.mock('js-cookie', () => ({
  default: {
    get: (key?: string) =>
      key === undefined
        ? Object.fromEntries(cookieJar)
        : cookieJar.get(key),
    set: (key: string, value: string) => {
      cookieJar.set(key, value);
    },
    remove: (key: string) => {
      cookieJar.delete(key);
    },
  },
}));

const ORIGINAL = { ...process.env };

const loadToken = async (env: Record<string, string | undefined> = {}) => {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return import('../assetToken');
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

beforeEach(() => {
  cookieJar.clear();
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('AssetAuthToken exchange', () => {
  it('posts to the module-relative login URL, with no origin prefixed', async () => {
    cookieJar.set('AuthToken', 'hub-token');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({
          data: { isLoginValid: true, token: 'asset-token', companyId: 'c1' },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const { ensureAssetToken } = await loadToken({
      NEXT_PUBLIC_ASSET_API_URL: '/asset-management/api',
    });
    const result = await ensureAssetToken();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/asset-management/api/AppUsers/TulipsHrm/Login'
    );
    expect(result.token).toBe('asset-token');
    expect(cookieJar.get('AssetAuthToken')).toBe('asset-token');
  });

  it('never produces a double-scheme URL, even with an absolute API base', async () => {
    cookieJar.set('AuthToken', 'hub-token');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ data: { isLoginValid: true, token: 'asset-token' } })
      );
    vi.stubGlobal('fetch', fetchMock);

    const { ensureAssetToken } = await loadToken({
      NEXT_PUBLIC_ASSET_API_URL: 'http://localhost:5199/api',
    });
    await ensureAssetToken();

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe('http://localhost:5199/api/AppUsers/TulipsHrm/Login');
    expect(url).not.toMatch(/:\/\/[^/]*[a-z]+:\/\//i);
  });

  it('sends the hub token in the body and no Authorization header', async () => {
    cookieJar.set('AuthToken', 'hub-token');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ data: { isLoginValid: true, token: 'asset-token' } })
      );
    vi.stubGlobal('fetch', fetchMock);

    const { ensureAssetToken } = await loadToken();
    await ensureAssetToken();

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({ token: 'hub-token' });
    expect(
      (init.headers as Record<string, string>).Authorization
    ).toBeUndefined();
  });

  it('refuses without a hub AuthToken instead of calling the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { ensureAssetToken } = await loadToken();
    const result = await ensureAssetToken();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.token).toBeNull();
    expect(result.error).toMatch(/AuthToken/i);
  });

  it('reuses an existing asset token without a round trip', async () => {
    cookieJar.set('AuthToken', 'hub-token');
    cookieJar.set('AssetAuthToken', 'existing');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { ensureAssetToken } = await loadToken();
    const result = await ensureAssetToken();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.token).toBe('existing');
  });

  it('force re-exchanges even when a token is present', async () => {
    cookieJar.set('AuthToken', 'hub-token');
    cookieJar.set('AssetAuthToken', 'stale');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ data: { isLoginValid: true, token: 'fresh' } })
      );
    vi.stubGlobal('fetch', fetchMock);

    const { ensureAssetToken } = await loadToken();
    const result = await ensureAssetToken(true);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.token).toBe('fresh');
    expect(cookieJar.get('AssetAuthToken')).toBe('fresh');
  });

  it('clears the asset token on a 401 rather than leaving a dead one', async () => {
    cookieJar.set('AuthToken', 'hub-token');
    cookieJar.set('AssetAuthToken', 'dead');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));

    const { ensureAssetToken } = await loadToken();
    const result = await ensureAssetToken(true);

    expect(result.token).toBeNull();
    expect(cookieJar.get('AssetAuthToken')).toBeUndefined();
  });

  it('names the URL it could not reach, so a misconfiguration is visible', async () => {
    cookieJar.set('AuthToken', 'hub-token');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const { ensureAssetToken } = await loadToken({
      NEXT_PUBLIC_ASSET_API_URL: '/asset-management/api',
    });
    const result = await ensureAssetToken();

    expect(result.token).toBeNull();
    expect(result.error).toContain('/asset-management/api/AppUsers/TulipsHrm/Login');
  });

  it('shares one in-flight exchange between concurrent callers', async () => {
    cookieJar.set('AuthToken', 'hub-token');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ data: { isLoginValid: true, token: 'asset-token' } })
      );
    vi.stubGlobal('fetch', fetchMock);

    const { ensureAssetToken } = await loadToken();
    const [a, b] = await Promise.all([ensureAssetToken(), ensureAssetToken()]);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(a.token).toBe('asset-token');
    expect(b.token).toBe('asset-token');
  });

  it('adopts the tenant from the envelope only when the cookie is absent', async () => {
    cookieJar.set('AuthToken', 'hub-token');
    cookieJar.set('ActiveCompanyId', 'chosen-by-hub');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: { isLoginValid: true, token: 't', companyId: 'from-login' },
        })
      )
    );

    const { ensureAssetToken } = await loadToken();
    await ensureAssetToken();

    expect(cookieJar.get('ActiveCompanyId')).toBe('chosen-by-hub');
  });
});
