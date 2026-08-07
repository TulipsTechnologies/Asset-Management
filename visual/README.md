# Visual Regression runner

Playwright CLI for the Visual Regression framework (design:
`TulipsHRM-Asset-Management/docs/asset-management-visual-regression.md`, §9 as amended
by §12). Scenario definitions are DATA served by the backend
(`GET /api/VisualRegression/scenarios`) — this runner is module-agnostic and stays out
of the app's tsconfig (plain Node, CommonJS).

## Usage

```bash
# offline plumbing check — no backend, no credentials
npm run visual:selftest

# a real run (backend + PRODUCTION frontend must be up)
VISUAL_USER=visual-operator VISUAL_PASSWORD=... \
  npm run visual -- --level smoke|regression|full \
    [--module asset-management] [--scenario asset-list] \
    [--base-url http://localhost:3000] [--api-url http://localhost:5199]
```

Environment:

| Variable | Meaning |
| --- | --- |
| `VISUAL_USER` / `VISUAL_PASSWORD` | The dedicated visual-operator account (§12.7): exactly ViewVisualRegression + RunVisualRegression + membership of the registered framework company. Never superadmin. Masked in ALL output. |
| `VISUAL_REVIEW_POLICY` | `strict` (default) or `warn` — warn downgrades ReviewRequired to a warning exit (§4). |
| `VISUAL_COMPANY_ID` | Optional explicit registered-company override; otherwise the registered DEMO company is preferred (the demo dataset lives there), then the TEST company. |

## Operator sequence (§12.9)

The CLI refuses dev servers and NEVER builds (a `next build` would destroy a live dev
server's `.next`). To run locally:

1. stop `npm run dev`
2. `npm run build`
3. `npm run start`
4. run the CLI

One-time: `npx playwright install chromium`.

## What the runner does (and refuses)

- Auth is the sign-in API + cookie restore — never the sign-in form (§12.8). The
  `ActiveCompanyId` cookie is asserted after the first load; a mismatch is a named
  refusal, not a wrong-tenant capture.
- Verifies the target is a production build via `/_next/BUILD_ID` (with dev-marker
  fallbacks) and records the BUILD_ID in the run output (§12.9).
- Neutralizes TablePreferences by route interception — code-default layouts on every
  machine; PUTs are blocked (§12.11). Fresh browser context per run.
- Stabilizes before capture: animation/transition/caret-kill CSS, fonts, network idle,
  no skeletons, empty toast container — never timed sleeps (§12.14).
- Fails any scenario that fires a non-GET app API call (§12.15); workers=1.
- Masks (provider shared + per-scenario) are composited as black rectangles onto the
  capture BEFORE the diff and the upload.
- Diffs against the ACTIVE baseline for this platform, echoing the baseline id + the
  SHA-256 of the bytes it actually diffed against (§12.4). Dimension mismatches are
  reported for review — never a crash (§12.10).
- The BACKEND classifies at ingest; the summary table and exit code render the
  server's verdicts. Baselines are only ever created by a human approval in
  `/system-test/visual` (§4).

Exit codes: 0 pass/minor/new, 1 any Broken, functional failure or (under `strict`)
ReviewRequired, 2 bad arguments.
