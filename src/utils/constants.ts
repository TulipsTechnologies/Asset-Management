/**
 * The module's route prefix. MUST match `basePath` in next.config.ts.
 *
 * `next/link`, `router.*` and `next/image` apply basePath themselves — this is
 * only for raw `window.location` navigation and hand-written `href`s, which
 * Next does not rewrite.
 */
export const BASE_PATH = '/asset-management';

/** Prefix a basePath-relative app path for raw `window.location` navigation. */
export const appUrl = (path: string): string => `${BASE_PATH}${path}`;

const LOCAL_HOSTS = ['localhost', '127.0.0.1'];

/** True for any localhost/loopback host string (hostname or Host header). */
export const isLocalHost = (host?: string | null): boolean =>
  LOCAL_HOSTS.some((h) => (host ?? '').includes(h));

/**
 * Dev-only escape hatch: on localhost there is no hub cookie to inherit, so
 * bounce to the local /dev-auth screen instead of the remote sign-in.
 */
export const isDevAuthBypass = (host?: string | null): boolean =>
  isLocalHost(host) && process.env.NEXT_PUBLIC_ENV === 'development';

/**
 * Client-side base URL of the shared HRM hub — sign-in and sign-out live there.
 * Mirrors the sibling modules (employee/vehicle): localhost points at the dev
 * HRM host, otherwise the current origin.
 */
export const getBaseUrl = (): string => {
  if (typeof window === 'undefined') return '';
  return isLocalHost(window.location.hostname)
    ? 'https://webdev.tulipshrm.com:4433'
    : window.location.origin;
};

const DEV_API_GATEWAY = 'https://webdev.tulipshrm.com:4433';

/**
 * Base for AssetManagement API calls.
 * - Deployed: same-origin; `server.js` proxies `/asset-management/api/*`.
 * - Localhost with `NEXT_PUBLIC_ASSET_API_URL` set: same-origin so the
 *   `next dev` rewrite can forward to the local API.
 * - Localhost otherwise: talk straight to the shared webdev gateway (no local
 *   API required).
 *
 * Keep this distinct from `getBaseUrl()` — that one is the HRM hub, this one is
 * the module API. Mixing them up is the easiest mistake here.
 */
export const getApiBaseUrl = (): string => {
  if (typeof window === 'undefined') return '';
  if (!isLocalHost(window.location.hostname)) return window.location.origin;
  return process.env.NEXT_PUBLIC_ASSET_API_URL
    ? window.location.origin
    : DEV_API_GATEWAY;
};

/**
 * Origin + module prefix, without `/api`. Used for paths the API already hands
 * back fully qualified below the module root (signed file URLs of the form
 * `/api/Files/content?path=...&exp=...&sig=...`).
 */
export const getApiRoot = (): string =>
  `${getApiBaseUrl()}${process.env.NEXT_PUBLIC_API_BASE}`;

/**
 * Build an AssetManagement API URL:
 * `{base}{NEXT_PUBLIC_API_BASE}/api{endpoint}`.
 */
export const buildApiUrl = (
  endpoint: string,
  baseUrl?: string | null
): string =>
  `${baseUrl ?? getApiBaseUrl()}${
    process.env.NEXT_PUBLIC_API_BASE
  }/api${endpoint}`;

export const DEFAULT_PAGE_SIZE = Number(
  process.env.NEXT_DEFAULT_ITEM_COUNT ?? 25
);
