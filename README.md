# TulipsHRM — Asset Management (Frontend)

Next.js 15 / React 19 / Tailwind v3 frontend for the TulipsHRM **Asset
Management** module, mirroring the `employee` and Vehicle Management module
app shell and conventions.

Backend: [`TulipsHRM-Asset-Management`](https://github.com/TulipsTechnologies/TulipsHRM-Asset-Management)
(standalone .NET 9 module — see its `docs/` for the full Phase 1 design).

The app is served under `basePath: "/asset-management"` — it is one
micro-frontend among several sibling TulipsHRM apps, all behind the same host.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000/asset-management
npx tsc --noEmit   # type check
```

### Environment

`.env.development`, `.env.production`, and `.env.example` are committed; copy
`.env.example` to `.env.local` to override locally.

| Key | Meaning |
|---|---|
| `NEXT_PUBLIC_ASSET_API_URL` | The Asset Management API base — the single source every API URL is built from. A **path** (`/asset-management/api`, the production value) keeps the browser same-origin and lets the server in front route it. An **absolute URL** is used verbatim and the browser calls it cross-origin; `.env.development` uses `https://webdev.tulipshrm.com:4433/asset-management/api` so a developer machine needs no local backend. |
| `ASSET_API_PROXY_TARGET` | **Server-side only** (no `NEXT_PUBLIC_`) — where `/asset-management/api/*` is forwarded, by the `next dev` rewrite and by `server.js` under IIS. Consulted only when the base above is a path; an absolute base bypasses this hop. |
| `NEXT_PUBLIC_HUB_URL` | Optional absolute URL of the HRM hub (sign-in/sign-out). Unset → the current origin, or `https://webdev.tulipshrm.com:4433` on localhost. |
| `NEXT_PUBLIC_DEV_AUTH` | `true` enables the `/dev-auth` token-paste screen. An explicit flag — never inferred from the hostname, so a deployment cannot fall into it by accident. |
| `NEXT_PUBLIC_LOGOUT_URL` | Sign-in/sign-out path on the HRM hub (`/signin`). |
| `NEXT_DEFAULT_ITEM_COUNT` | Default page size (25). |

**There are two distinct base URLs** — see `src/utils/constants.ts`, and don't
mix them up. Conflating them is what produced URLs of the form
`https://webdev.tulipshrm.com:4433http://localhost:5199/api/…`:

- `getHubBaseUrl()` (alias: `getBaseUrl()`) — the **HRM hub**, for sign-in and
  sign-out only. Never a component of an API URL.
- `API_BASE` / `buildApiUrl()` — the **Asset Management API**, resolved once at
  module load from `NEXT_PUBLIC_ASSET_API_URL`. Takes no origin argument, so an
  origin can never be prepended to a value that already has one. Covered by
  `src/utils/__tests__/apiConfig.test.ts`.

### Auth — three cookies, two tokens

The HRM hub owns sign-in; this module has no login form of its own.

- **`AuthToken`** — the HRM hub JWT, set by the hub and read by `src/middleware.ts`.
- **`AssetAuthToken`** — the module-scoped JWT actually used on API calls.
- **`ActiveCompanyId`** — the tenant, sent as the `x-company-id` header.

`src/services/assetToken.ts` owns the exchange. `ensureAssetToken(force)` trades
the hub token for a module token via `POST /api/AppUsers/TulipsHrm/Login` using
a **raw `fetch`** — deliberately, to avoid an import cycle with `httpService` —
and is **single-flight**, so concurrent callers share one in-progress exchange.
`src/contexts/AuthContext.tsx` runs it during bootstrap, before any page mounts
and fires API calls, and decodes UI permissions from the `AssetAuthToken` (the
hub token carries HRM permissions, not this module's). On a 401 `requestApi`
re-exchanges **once** and silently replays the request.

Bootstrap passes `force` whenever `AuthToken` decodes as a JWT, so every real
session re-mints its module token and can never carry stale permissions forward.
The one exception is the `/dev-auth` module-token route below, which writes a
non-JWT placeholder into `AuthToken`: there is no credential to exchange, so
forcing would only discard a working token.

Unauthenticated requests are bounced to the hub sign-in — except when
`NEXT_PUBLIC_DEV_AUTH=true`, where the middleware routes to **`/dev-auth`**. That
screen takes either an `AuthToken` copied from webdev (normal route, exchanged as
above) or an `AssetAuthToken` obtained straight from the module's own
`POST /AppUsers/Login`, for when the hub is unreachable.

## @tulipstechnologies/common dependency

The common component library is consumed as an npm package, but this repo does
not require registry access to install: the package is vendored as a tarball
(`vendor/tulipstechnologies-common-1.10.45.tgz`) and referenced via a `file:`
dependency in `package.json`. To switch to the GitHub Packages registry,
change the dependency to a semver range and export `NPM_TOKEN` (see `.npmrc`).

`legacy-peer-deps=true` is set because common declares peer react ^18
while this app runs react 19 — the same combination the employee module runs
in production. **The "version" in `package.json` is a filename**, so `npm update`
and `npm outdated` will never bump it; upgrading means bumping and building in
`common-module`, then swapping the tarball here and reinstalling.

The app shell comes from this package. `src/components/Layout/DashboardLayout/`
composes `DashboardCtxProvider` + `MaintenanceModeProvider` around the shared
`DashboardSidebar` and `Header`, the same way the vehicle-management and
leave-management modules do. Three things are easy to get wrong when editing it:

- **`basePath`, `urlPrefix`, and the `MODULE_PREFIX` constants must agree** —
  `next.config.ts`, both `urlPrefix` props in `DashboardContents.tsx`, and
  `BASE_PATH` in `src/utils/constants.ts` (used by `sidebarActivePath.ts` and
  `assetFallbackMenus.ts`).
- **Two opposite URL conventions.** Menu URLs in `src/utils/assetFallbackMenus.ts`
  are basePath-**prefixed**; the `IStaticMenu` URLs in `src/utils/staticMenus.ts`
  are basePath-**less**, because `usePathname()` strips it. Getting this backwards
  silently kills active-highlighting or blanks the page title.
- **Two disjoint permission sets.** `useAuth().userPermissions` are this module's
  ids from the `AssetAuthToken` and gate asset screens; `useAuth().hubPermissions`
  are HRM hub ids from the `AuthToken` and are what the shared chrome expects
  (`AdminMode = 67`, see `src/enum/hubPermissions.ts`). They are never
  interchangeable.

The sidebar renders no menu entries until `currentUser` is loaded — that is the
shared component's own behaviour. `AuthContext` populates it via the hub's
`getCurrentUser()`.

## What's implemented (module Phase 1 scope)

| Area | Status |
|---|---|
| App shell (sidebar, header, auth, 403, coming-soon) | ✅ shared `DashboardSidebar`/`Header` from `@tulipstechnologies/common` |
| Dashboard (asset counts + quick actions) | ✅ |
| Assets — list (search, category/status filters, paging) | ✅ `GET /api/Assets` |
| Assets — register (code generated server-side, immutable) | ✅ `POST /api/Assets` |
| Assets — detail (six status dimensions, purchase/warranty/custody) | ✅ `GET /api/Assets/{id}` |
| Asset Categories — list, create (3-level tree rule), tree view | ✅ `/api/AssetCategories` (+`/tree`) |
| Assignments — assign/return flows, employees registry | ✅ `/api/AssetAssignments` |
| Transfers — request/approve/dispatch/receive/cancel, locations registry | ✅ `/api/AssetTransfers` |
| Returns — initiate/inspect/cancel, recovery cases | ✅ `/api/AssetReturns` (+`/api/AssetRecoveryCases`) |
| Physical Verification — campaigns, scan/record, discrepancy reconciliation, evidence | ✅ `/api/AssetAuditCampaigns` (+results/discrepancies/evidence) |
| Maintenance — requests (raise/convert/reject/withdraw), work orders (start/complete/cancel), asset release/recommission | ✅ `/api/MaintenanceRequests`, `/api/WorkOrders` (+`/api/Assets/{id}/release`\|`/recommission`) |
| Disposal — request/approve/reject/cancel, pre-flighted execute, wipe certificates, paperwork | ✅ `/api/DisposalRequests` (+`/wipe-certificates`, `/documents`) |
| Configuration hub | ✅ (cards; management screens arrive with their APIs) |
| Depreciation / Reports | sidebar stubs → `/coming-soon` (later phases) |

Conventions:

- `src/services/*.service.ts` — one file per domain over `requestApi`
  (`completeData` envelopes, `buildQuery` for PascalCase query params).
- `src/enum/assetEnums.ts` mirrors the backend status enums (persisted ints —
  never renumber); `src/enum/permissions.ts` mirrors the backend permission
  ids (append-only).
- The six seeded asset conditions are mirrored with their fixed ids until a
  lookup endpoint ships.
- New protected routes must be added to `src/middleware.ts` `config.matcher`.
- `next/link`, `router.*` and `next/image` apply `basePath` themselves. Raw
  `window.location` navigation and hand-written `href`s do **not** — prefix
  those with `appUrl()` / `BASE_PATH` from `src/utils/constants.ts`.

## Deployment

`server.js` + `web.config` run the app under IIS/iisnode. Beyond the standard
Next custom-server scaffold, `server.js` reverse-proxies `/asset-management/api/*`
to the Asset Management API so the relative `NEXT_PUBLIC_ASSET_API_URL` keeps
resolving same-origin. The target defaults to `localhost:5199` and is overridable
with `ASSET_API_PROXY_TARGET` (legacy `ASSET_API_HOST` / `ASSET_API_PORT` are
still honoured) — **set this to match the API on the server**. The dev-only
`rewrites()` in `next.config.ts` mirrors the proxy for `next dev`, reading the
same `ASSET_API_PROXY_TARGET`.

Note `server.js` parses that variable for host and port only and discards any
path, so a proxy target carrying a path prefix works under `next dev` but not
under IIS.
