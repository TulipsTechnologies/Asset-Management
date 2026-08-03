# TulipsHRM — Asset Management (Frontend)

Next.js 15 / React 19 / Tailwind v3 frontend for the TulipsHRM **Asset
Management** module, mirroring the `employee` and Vehicle Management module
app shell and conventions.

Backend: [`TulipsHRM-Asset-Management`](https://github.com/TulipsTechnologies/TulipsHRM-Asset-Management)
(standalone .NET 9 module — see its `docs/` for the full Phase 1 design).

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

Environment:

- `NEXT_PUBLIC_API_BASE` — base URL of the Asset Management API. Defaults to
  `http://localhost:5199`. All endpoints live under `/api`. Copy
  `.env.example` to `.env.local` to override locally.

Sign in with an Asset Management API user (POST `/api/AppUsers/Login`,
`{userName, password}` — the module backend seeds a super admin via its
`DbInitializer` when `SeedDatabase` is enabled).

## @tulipstechnologies/common dependency

The common component library is consumed as an npm package, but this repo does
not require registry access to install: the package is vendored as a tarball
(`vendor/tulipstechnologies-common-1.10.25.tgz`) and referenced via a `file:`
dependency in `package.json`. To switch to the GitHub Packages registry,
change the dependency to a semver range and export `NPM_TOKEN` (see `.npmrc`).

`legacy-peer-deps=true` is set because common@1.10.25 declares peer react ^18
while this app runs react 19 — the same combination the employee module runs
in production.

## What's implemented (module Phase 1 scope)

| Area | Status |
|---|---|
| App shell (sidebar, header, auth, 403, coming-soon) | ✅ adapted from the module template |
| Dashboard (asset counts + quick actions) | ✅ |
| Assets — list (search, category/status filters, paging) | ✅ `GET /api/Assets` |
| Assets — register (code generated server-side, immutable) | ✅ `POST /api/Assets` |
| Assets — detail (six status dimensions, purchase/warranty/custody) | ✅ `GET /api/Assets/{id}` |
| Asset Categories — list, create (3-level tree rule), tree view | ✅ `/api/AssetCategories` (+`/tree`) |
| Assignments — assign/return flows, employees registry | ✅ `/api/AssetAssignments` |
| Transfers — request/approve/dispatch/receive/cancel, locations registry | ✅ `/api/AssetTransfers` |
| Returns — initiate/inspect/cancel, recovery cases | ✅ `/api/AssetReturns` (+`/api/AssetRecoveryCases`) |
| Physical Verification — campaigns, scan/record, discrepancy reconciliation, evidence | ✅ `/api/AssetAuditCampaigns` (+results/discrepancies/evidence) |
| Configuration hub | ✅ (cards; management screens arrive with their APIs) |
| Maintenance / Depreciation / Disposal / Reports | sidebar stubs → `/coming-soon` (later phases) |

Conventions:

- `src/services/*.service.ts` — one file per domain over `requestApi`
  (`completeData` envelopes, `buildQuery` for PascalCase query params).
- `src/enum/assetEnums.ts` mirrors the backend status enums (persisted ints —
  never renumber); `src/enum/permissions.ts` mirrors the backend permission
  ids (append-only).
- The six seeded asset conditions are mirrored with their fixed ids until a
  lookup endpoint ships.
- New protected routes must be added to `src/middleware.ts` `config.matcher`.
