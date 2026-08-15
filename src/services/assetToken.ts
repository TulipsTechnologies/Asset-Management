import Cookies from 'js-cookie';
import { IValidUser } from '@/interface/IAuth';
import { IResponse } from '@/interface/IGeneric';
import { buildApiUrl } from '@/utils/constants';

const ASSET_AUTH_TOKEN_COOKIE = 'AssetAuthToken';
const ACTIVE_COMPANY_ID_COOKIE = 'ActiveCompanyId';
const AUTH_TOKEN_COOKIE = 'AuthToken';
const LOGIN_ENDPOINT = '/AppUsers/TulipsHrm/Login';

export type EnsureAssetTokenResult = {
  token: string | null;
  error: string | null;
  /** Tenant carried by the login envelope. Null for internal users. */
  companyId: string | null;
};

let inFlight: Promise<EnsureAssetTokenResult> | null = null;

export const getAssetToken = (): string | null =>
  Cookies.get(ASSET_AUTH_TOKEN_COOKIE) ?? null;

export const setAssetToken = (token: string): void => {
  Cookies.set(ASSET_AUTH_TOKEN_COOKIE, token, {
    path: '/',
    sameSite: 'lax',
  });
};

export const clearAssetToken = (): void => {
  Cookies.remove(ASSET_AUTH_TOKEN_COOKIE, { path: '/' });
};

/** The tenant the UI is scoped to — namespaces per-company client-side preferences. */
export const getActiveCompanyId = (): string | null =>
  Cookies.get(ACTIVE_COMPANY_ID_COOKIE) ?? null;

export const clearActiveCompanyId = (): void => {
  Cookies.remove(ACTIVE_COMPANY_ID_COOKIE, { path: '/' });
};

/**
 * Persist the active tenant from the login response only when the cookie is
 * absent, so a value set by the hub is never clobbered.
 */
export const persistActiveCompanyIdIfAbsent = (
  companyId?: string | null
): void => {
  if (!companyId) return;
  if (Cookies.get(ACTIVE_COMPANY_ID_COOKIE)) return;
  Cookies.set(ACTIVE_COMPANY_ID_COOKIE, companyId, {
    path: '/',
    sameSite: 'lax',
  });
};

/**
 * Exchange the HRM `AuthToken` for an AssetAuthToken via a raw fetch (avoids
 * an import cycle with httpService). Single-flight so concurrent callers share
 * one in-progress exchange.
 *
 * The endpoint authenticates from the request body, so no Authorization header
 * is sent — the hub token travels in `body.token` only.
 */
export async function ensureAssetToken(
  force = false
): Promise<EnsureAssetTokenResult> {
  if (!force) {
    const existing = getAssetToken();
    if (existing) {
      return { token: existing, error: null, companyId: null };
    }
  }

  if (inFlight) return inFlight;

  inFlight = (async (): Promise<EnsureAssetTokenResult> => {
    const authToken = Cookies.get(AUTH_TOKEN_COOKIE);
    if (!authToken) {
      return {
        token: null,
        error: 'No AuthToken cookie found. Sign in again.',
        companyId: null,
      };
    }

    if (force) {
      clearAssetToken();
    }

    const url = buildApiUrl(LOGIN_ENDPOINT);

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': 'en',
        },
        body: JSON.stringify({ token: authToken }),
      });
    } catch {
      return {
        token: null,
        error: `Unable to reach the asset API at ${url}. Check that the API is running and reachable.`,
        companyId: null,
      };
    }

    if (res.status === 401) {
      clearAssetToken();
      return {
        token: null,
        error: 'Unauthorized while exchanging the asset token.',
        companyId: null,
      };
    }

    let envelope: IResponse<IValidUser> | null = null;
    try {
      const contentType = res.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        envelope = (await res.json()) as IResponse<IValidUser>;
      }
    } catch {
      return {
        token: null,
        error: `Unexpected response from asset login (HTTP ${res.status}).`,
        companyId: null,
      };
    }

    if (!res.ok) {
      return {
        token: null,
        error:
          envelope?.message ||
          `Asset token exchange failed (HTTP ${res.status}).`,
        companyId: null,
      };
    }

    const assetToken = envelope?.data?.token;
    if (envelope?.data?.isLoginValid && assetToken) {
      setAssetToken(assetToken);
      persistActiveCompanyIdIfAbsent(envelope.data.companyId);
      return {
        token: assetToken,
        error: null,
        companyId: envelope.data.companyId ?? null,
      };
    }

    return {
      token: null,
      error:
        envelope?.data?.remarks ||
        envelope?.message ||
        'Asset login was rejected or returned no token.',
      companyId: null,
    };
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

export const ASSET_LOGIN_ENDPOINT = LOGIN_ENDPOINT;
