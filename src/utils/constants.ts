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

/** True for a fully-qualified URL (`https://…`, `http://…`, any scheme). */
export const isAbsoluteUrl = (value: string): boolean =>
  /^[a-z][a-z0-9+.-]*:\/\//i.test(value);

/* -------------------------------------------------------------------------- */
/* API endpoint configuration — the single source                              */
/* -------------------------------------------------------------------------- */

/**
 * Where the AssetManagement API lives, as ONE configured value.
 *
 * This follows the platform's existing convention rather than inventing a
 * module-local one: the employee app configures every sibling API the same way
 * — `NEXT_PUBLIC_API_URL=/api`, `/payroll/api`, `/attendance/api`, `/crm/api` —
 * a RELATIVE path that is byte-identical in development and production, with an
 * absolute URL used only for a genuinely different origin
 * (`NEXT_PUBLIC_AI_API_URL=https://fastapi.tulipshrm.com/api`).
 *
 * A relative base is what makes one build work everywhere: the browser resolves
 * it against whatever origin served the page, and the server in front (the
 * `next dev` rewrite locally, `server.js` under IIS, the gateway in front of
 * either) forwards it to the API. Nothing here needs to know which host it is
 * running on, so there is nothing to detect and nothing to get wrong.
 *
 * Absolute is still supported for a cross-origin deployment — and when the
 * value IS absolute it is used verbatim, never appended to an origin.
 */
const CONFIGURED_API_BASE = (
  process.env.NEXT_PUBLIC_ASSET_API_URL ?? `${BASE_PATH}/api`
).trim();

/**
 * The configured base, sanitised.
 *
 * A path-shaped value is normalised to a leading slash and no trailing slash.
 * An absolute value keeps its origin untouched. Anything else — the misconfigured
 * middle ground, e.g. `localhost:5199` with no scheme — cannot be resolved
 * safely, so it is refused in favour of the same-origin default rather than
 * silently producing a corrupt URL.
 */
const resolveApiBase = (configured: string): string => {
  if (!configured) return `${BASE_PATH}/api`;
  if (isAbsoluteUrl(configured)) return configured.replace(/\/+$/, '');
  if (configured.startsWith('/')) return configured.replace(/\/+$/, '');

  if (typeof console !== 'undefined') {
    console.error(
      `[config] NEXT_PUBLIC_ASSET_API_URL must be an absolute URL or a path ` +
        `beginning with "/" — received "${configured}". Falling back to ` +
        `"${BASE_PATH}/api". Fix the environment file; do not rely on this fallback.`
    );
  }
  return `${BASE_PATH}/api`;
};

/** The one value every AssetManagement request is built from. */
export const API_BASE = resolveApiBase(CONFIGURED_API_BASE);

/**
 * Build an AssetManagement API URL.
 *
 * There is deliberately no origin parameter and no origin lookup. `API_BASE` is
 * already either same-origin-relative or a complete absolute base, so an origin
 * can never be prepended to something that already has one — which is the whole
 * class of bug behind `https://webdev.tulipshrm.com:4433http://localhost:5199/api/…`:
 * a resolved origin concatenated with a variable that had itself been set to an
 * origin. Passing an absolute endpoint returns it unchanged, so a fully-qualified
 * URL handed back by the API (a signed file link, say) survives a round trip.
 */
export const buildApiUrl = (endpoint: string): string => {
  if (isAbsoluteUrl(endpoint)) return endpoint;
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE}${path}`;
};

/**
 * Base for paths the API hands back already rooted at the module (`/api/Files/
 * content?path=…&exp=…&sig=…`). That is `API_BASE` minus its trailing `/api`,
 * because the returned path supplies its own.
 */
export const getApiRoot = (): string => API_BASE.replace(/\/api$/, '');

/* -------------------------------------------------------------------------- */
/* Shared HRM hub — sign-in and sign-out only, never API calls                 */
/* -------------------------------------------------------------------------- */

/**
 * Client-side base URL of the shared HRM hub, where sign-in and sign-out live.
 *
 * This is the platform's existing approach for the hub, unchanged: the employee
 * and CRM apps resolve it exactly this way, because on localhost there is no hub
 * on the same origin to redirect to. It is kept deliberately separate from the
 * API configuration above and is never a component of an API URL — mixing the
 * two is what produced the malformed-URL bug.
 */
export const getHubBaseUrl = (): string => {
  if (typeof window === 'undefined') return '';
  const configured = process.env.NEXT_PUBLIC_HUB_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
    ? 'https://webdev.tulipshrm.com:4433'
    : window.location.origin;
};

/** Back-compat alias: the hub base, for callers that predate the rename. */
export const getBaseUrl = getHubBaseUrl;

/**
 * Base for the HRM hub menu API behind the shared sidebar
 * (`useSidebarMenus` -> `GET {base}/users/menus/{userMode}`).
 *
 * The hub, not this module's API — same distinction the two blocks above keep.
 * It resolves through `getHubBaseUrl()` so the configured hub wins and there is
 * exactly one place that decides where the hub lives; the literal fallback
 * covers the server pass, where `window` does not exist yet and the shared
 * chrome would otherwise be handed an empty base.
 */
export const getMenusApiBaseUrl = (): string =>
  getHubBaseUrl() || 'https://webdev.tulipshrm.com:4433';

/**
 * Dev-only escape hatch: with no hub cookie to inherit, bounce to the local
 * /dev-auth screen instead of the remote sign-in. Driven by an explicit flag,
 * not by sniffing the host, so a deployment can never fall into it by accident.
 */
export const isDevAuthEnabled = (): boolean =>
  process.env.NEXT_PUBLIC_DEV_AUTH === 'true';

/**
 * What dev-auth writes into `AuthToken`. The middleware gates on that cookie EXISTING, never
 * on its contents — the real credential is the module token in `AssetAuthToken` — so a
 * placeholder is enough to get past it. It is not a hub credential and the hub will reject
 * it, which is why callers check for this value before making a hub request rather than
 * discovering it as a 401 with an unparseable empty body.
 *
 * Named here so the writer (dev-auth) and the readers agree; two copies of a sentinel
 * string is one rename away from silently never matching.
 */
export const DEV_AUTH_PLACEHOLDER_TOKEN = 'dev-auth-module-token';

export const DEFAULT_PAGE_SIZE = Number(
  process.env.NEXT_DEFAULT_ITEM_COUNT ?? 25
);
