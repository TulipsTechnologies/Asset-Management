#!/usr/bin/env node
/**
 * Visual Regression runner CLI (visual design §9 as amended by §12.7–§12.16).
 *
 *   npm run visual -- --level smoke|regression|full [--module <key>]
 *     [--scenario <key>] [--base-url <frontend>] [--api-url <backend>]
 *
 * Flow: login (API, never the sign-in form, §12.8) → verify production build (§12.9)
 * → resolve the registered framework company from /environment → dataset check (§6)
 * → fetch the capture plan → create the run → per scenario×viewport (workers=1,
 * §12.15): capture → download active baseline (+hash echo, §12.4) → pixelmatch diff →
 * POST multipart result → heartbeat every 2 minutes from a timer (§12.5) → complete →
 * summary table → exit code (§12.6; VISUAL_REVIEW_POLICY=warn downgrades
 * ReviewRequired).
 *
 * The backend classifies authoritatively at ingest — this CLI reports, uploads, and
 * renders the SERVER's verdicts. Baselines are never created here (§4).
 */
'use strict';

const os = require('os');
const { chromium } = require('playwright');

const log = require('./lib/log');
const { parseArgs } = require('./lib/args');
const { ApiClient, ApiError } = require('./lib/api');
const { verifyProductionBuild, BuildVerificationError } = require('./lib/build');
const { captureScenario } = require('./lib/scenario');
const { sha256, diffImages } = require('./lib/image');
const { printSummary } = require('./lib/summary');

const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000;

/** Framework purposes (SystemTestCompanyPurposeEnum): Test=1, Demo=2. */
const PURPOSE_TEST = 1;
const PURPOSE_DEMO = 2;

function platformFamily() {
  switch (os.platform()) {
    case 'darwin':
      return 'macos';
    case 'win32':
      return 'windows';
    default:
      return 'linux';
  }
}

/** Cookie values the app writes with encodeURIComponent (AuthContext.setCookie). */
function appCookies(baseUrl, token, user, companyId) {
  return [
    { name: 'AuthToken', value: encodeURIComponent(token), url: baseUrl },
    { name: 'user', value: encodeURIComponent(JSON.stringify(user)), url: baseUrl },
    { name: 'ActiveCompanyId', value: encodeURIComponent(companyId), url: baseUrl },
  ];
}

/**
 * §12.8: the registered framework company the run pins. Preference order: explicit
 * VISUAL_COMPANY_ID → the registered DEMO company (the demo dataset lives there) →
 * the registered TEST company.
 */
function companyCandidates(environment, override) {
  if (override) {
    const match = (environment.provisionedCompanies || []).find(
      (c) => c.companyId?.toLowerCase() === override.toLowerCase()
    );
    return match ? [match] : [{ companyId: override, companyName: '(override)', purpose: null }];
  }
  const provisioned = environment.provisionedCompanies || [];
  return [
    ...provisioned.filter((c) => c.purpose === PURPOSE_DEMO),
    ...provisioned.filter((c) => c.purpose === PURPOSE_TEST),
  ];
}

/** Flattens the scenario-set DTO into ordered capture units, applying --scenario. */
function buildCaptureUnits(scenarioSet, scenarioFilter) {
  const units = [];
  for (const module of scenarioSet.modules || []) {
    for (const planned of module.scenarios || []) {
      const definition = planned.definition;
      if (scenarioFilter && definition.key !== scenarioFilter) continue;
      for (const viewport of planned.viewports || []) {
        units.push({
          moduleKey: module.moduleKey,
          sharedMaskSelectors: module.sharedMaskSelectors || [],
          definition,
          viewport,
        });
      }
    }
  }
  return units;
}

async function resolveCompanyAndPlan(api, options) {
  // /environment is discovery, and it lives on the SystemTest controller behind
  // ManageSystemTest — a permission the visual operator deliberately does not hold
  // (§12.7 grants it exactly View + Run). When the company is already named there is
  // nothing to discover, so the call is skipped rather than the account widened. The
  // registration gate is unaffected: /visual/scenarios and the results ingest
  // re-verify it server-side, which is where the boundary actually is.
  const environment = options.companyIdOverride
    ? { provisionedCompanies: [] }
    : await api.environment();
  const candidates = companyCandidates(environment, options.companyIdOverride);
  if (candidates.length === 0) {
    throw new ApiError(
      'No registered framework company found in /SystemTest/environment. Provision the test/demo companies first (System Test hub).',
      { reasonCode: 'VISUAL_NO_REGISTERED_COMPANY' }
    );
  }

  let lastError = null;
  for (const candidate of candidates) {
    api.companyId = candidate.companyId;
    let scenarioSet;
    try {
      scenarioSet = await api.scenarios(options.levelValue, options.module);
    } catch (err) {
      lastError = err;
      log.warn(
        `company ${candidate.companyName} (${candidate.companyId}) refused the scenario plan: ${err.message}${err.reasonCode ? ` [${err.reasonCode}]` : ''}`
      );
      continue;
    }

    const units = buildCaptureUnits(scenarioSet, options.scenario);
    if (units.length === 0) {
      throw new ApiError(
        options.scenario
          ? `No scenario "${options.scenario}" exists at level ${options.level}.`
          : `No scenarios are registered at level ${options.level}.`,
        { reasonCode: 'VISUAL_NO_SCENARIOS' }
      );
    }

    const needsDemo = units.some((u) => u.definition.requiredDataState === 'demo');
    if (needsDemo) {
      const dataset = await api.datasetState();
      if (!dataset.datasetPresent) {
        lastError = new ApiError(
          `Company ${candidate.companyName} holds no demo dataset (assets: ${dataset.assetCount}, categories: ${dataset.categoryCount}). Load demo data from the System Test hub (seeding is a human act — §12.7).`,
          { reasonCode: 'VISUAL_DATASET_ABSENT' }
        );
        log.warn(lastError.message);
        continue;
      }
    }

    return { company: candidate, scenarioSet, units };
  }

  throw lastError ?? new ApiError('No candidate company was usable.', {
    reasonCode: 'VISUAL_NO_REGISTERED_COMPANY',
  });
}

/** §12.11: neutralize table-layout preferences — code-default layouts on every machine. */
async function interceptTablePreferences(context) {
  await context.route(/\/api\/TablePreferences/i, async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          statusCode: 200,
          message: 'Successful.',
          data: { personalColumnsJson: null, companyColumnsJson: null, canManageCompany: false },
        }),
      });
      return;
    }
    // PUT (and anything else) is BLOCKED — fulfilled locally so nothing persists and
    // the app does not surface an error toast mid-capture.
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        statusCode: 200,
        message: 'Blocked by the visual runner.',
        data: null,
      }),
    });
  });
}

/** §12.8: assert the ActiveCompanyId cookie survived the first load unchanged. */
async function assertCompanyCookie(context, baseUrl, expectedCompanyId) {
  const cookies = await context.cookies(baseUrl);
  const auth = cookies.find((c) => c.name === 'AuthToken');
  if (!auth || !auth.value) {
    throw new ApiError(
      'The AuthToken cookie disappeared after the first load — the app rejected the session (VISUAL_AUTH_FAILED).',
      { reasonCode: 'VISUAL_AUTH_FAILED' }
    );
  }
  const active = cookies.find((c) => c.name === 'ActiveCompanyId');
  const actual = active ? decodeURIComponent(active.value) : null;
  if (!actual || actual.toLowerCase() !== expectedCompanyId.toLowerCase()) {
    // AuthContext's missing-cookie fallback picks the FIRST company — wrong-tenant
    // captures, not just flaky ones (§12.8). Named refusal, no captures.
    throw new ApiError(
      `ActiveCompanyId cookie is "${actual}" after the first load but the run pins "${expectedCompanyId}" (VISUAL_COMPANY_COOKIE_MISMATCH).`,
      { reasonCode: 'VISUAL_COMPANY_COOKIE_MISMATCH' }
    );
  }
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (err) {
    log.error(err.message);
    log.info(
      'Usage: npm run visual -- --level smoke|regression|full [--module <key>] [--scenario <key>] [--base-url <frontend>] [--api-url <backend>]'
    );
    return 2;
  }

  // §12.7: credentials are masked in EVERY line this process prints.
  log.registerSecret(options.password);
  log.registerSecret(options.user);

  const api = new ApiClient(options.apiUrl);
  const platform = platformFamily();

  log.info(`visual runner — level ${options.level}, policy ${options.reviewPolicy}, platform ${platform}`);

  // 1. Login through the API (§12.8) — never the sign-in form.
  const login = await api.login(options.user, options.password, options.companyIdOverride);
  log.info('authenticated against the API');

  // 2. §12.9: refuse dev servers; record BUILD_ID.
  const buildId = await verifyProductionBuild(options.baseUrl);
  log.info(`target verified as production build ${buildId}`);

  // 3-5. Registered company + dataset + capture plan (§6).
  const { company, units } = await resolveCompanyAndPlan(api, options);
  log.info(
    `company: ${company.companyName} (${company.companyId}) — ${units.length} capture(s) planned`
  );
  if (options.scenario) {
    log.warn(
      `--scenario ${options.scenario}: the run's TotalSteps still reflects the full level plan; unsubmitted captures simply stay absent from this run.`
    );
  }

  // 6. Browser — §12.16 pinned capture conditions; §12.11 fresh context per run;
  // tracing/video never enabled (§12.7).
  const browser = await chromium.launch({
    args: ['--force-color-profile=srgb', '--hide-scrollbars'],
  });
  const browserVersion = `chromium ${browser.version()}`;

  let runId = null;
  let heartbeatTimer = null;
  let exitCode = 1;

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    await interceptTablePreferences(context);

    // §12.8: cookies BEFORE any navigation.
    const user = {
      userId: login.userId ?? 0,
      fullName: login.fullName ?? options.user,
      email: login.email ?? options.user,
      userName: login.userName ?? options.user,
      companyId: null,
    };
    await context.addCookies(appCookies(options.baseUrl, api.token, user, company.companyId));

    // First load + cookie assertion (§12.8).
    const probe = await context.newPage();
    try {
      await probe.goto(`${options.baseUrl}/dashboard`, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
      await probe.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
      await assertCompanyCookie(context, options.baseUrl, company.companyId);
    } finally {
      await probe.close().catch(() => {});
    }
    log.info('session cookies verified on first load');

    // 7. Create the run — claims the company's single run slot (§12.5).
    const created = await api.createRun(options.module, options.levelValue);
    runId = created.runId;
    log.info(`run ${runId} created (server plans ${created.totalCaptures} captures)`);

    // §12.5: heartbeat every 2 minutes from a timer.
    heartbeatTimer = setInterval(() => {
      api.heartbeat(runId).catch((err) => log.warn(`heartbeat failed: ${err.message}`));
    }, HEARTBEAT_INTERVAL_MS);
    heartbeatTimer.unref();

    // 8. Sequential captures — workers=1 (§12.15).
    const rows = [];
    let runNotRunning = false;
    for (const unit of units) {
      const label = `${unit.definition.key}/${unit.viewport.name}`;
      log.info(`capturing ${label} ...`);

      const outcome = await captureScenario({
        context,
        baseUrl: options.baseUrl,
        apiUrl: options.apiUrl,
        definition: unit.definition,
        sharedMaskSelectors: unit.sharedMaskSelectors,
        viewport: unit.viewport,
      });

      for (const warning of outcome.stabilizationWarnings) log.warn(`${label}: ${warning}`);

      // Baseline download + diff (§12.4): echo the id AND the hash of the bytes we
      // actually diffed against, so the server can detect a stale baseline.
      let baselineId = null;
      let baselineSha = null;
      let diffPng = null;
      let ratio = 0;
      let dimensionMismatch = false;

      if (unit.definition.pixelCompare && outcome.currentPng) {
        // A refused baseline listing is FATAL, not a warning: swallowing it would diff
        // every scenario against nothing and drown the run in all-stale noise. The
        // throw aborts the run with a named reason (outer catch).
        const baselines = await api
          .baselines(unit.definition.key, unit.viewport.name)
          .catch((err) => {
            throw new ApiError(
              `${label}: the baseline listing was refused (${err.message}) — aborting instead of reporting every scenario as stale.`,
              {
                reasonCode: err.reasonCode || 'VISUAL_BASELINES_UNAVAILABLE',
                statusCode: err.statusCode || 0,
              }
            );
          });
        const active = (baselines || []).find(
          (b) => b.isActive && b.platform === platform && b.moduleKey === unit.moduleKey
        );
        if (active) {
          try {
            const baselineBytes = await api.downloadFile(active.fileId);
            baselineId = active.id;
            baselineSha = sha256(baselineBytes);
            if (baselineSha !== active.fileSha256) {
              log.warn(
                `${label}: downloaded baseline bytes hash differently than the server records — the ingest guard will flag it stale.`
              );
            }
            const diff = diffImages(outcome.currentPng, baselineBytes, unit.definition.diffThresholds);
            dimensionMismatch = diff.dimensionMismatch;
            ratio = diff.ratio;
            diffPng = diff.diffPng;
            if (dimensionMismatch) {
              log.warn(
                `${label}: dimensions ${diff.currentSize.width}x${diff.currentSize.height} vs baseline ${diff.baselineSize.width}x${diff.baselineSize.height} — reported for review, never a crash (§12.10).`
              );
            }
          } catch (err) {
            log.warn(`${label}: baseline download/diff failed: ${err.message}`);
          }
        }
      }

      const payload = {
        scenarioKey: unit.definition.key,
        viewport: unit.viewport.name,
        platform,
        browserVersion,
        baselineId,
        baselineFileSha256: baselineSha,
        diffPixelRatio: ratio,
        functionalStatus: outcome.functionalFailed ? 2 : 1,
        renderFailed: outcome.renderFailed,
        dimensionMismatch,
        jsErrorsJson: outcome.jsErrors.length ? JSON.stringify(outcome.jsErrors) : null,
        failedAssertionsJson: outcome.failedAssertions.length
          ? JSON.stringify(outcome.failedAssertions)
          : null,
        missingCriticalSelectorsJson: outcome.missingCriticalSelectors.length
          ? JSON.stringify(outcome.missingCriticalSelectors)
          : null,
        durationMs: outcome.durationMs,
        currentPng: outcome.currentPng,
        diffPng,
      };

      try {
        const dto = await api.ingestResult(runId, payload);
        rows.push({
          moduleKey: unit.moduleKey,
          scenarioKey: unit.definition.key,
          viewport: unit.viewport.name,
          visualStatus: dto.visualStatus,
          functionalStatus: dto.functionalStatus,
          diffPixelRatio: dto.diffPixelRatio,
          reasonCode: dto.reasonCode,
          error: null,
        });
      } catch (err) {
        rows.push({
          moduleKey: unit.moduleKey,
          scenarioKey: unit.definition.key,
          viewport: unit.viewport.name,
          visualStatus: null,
          functionalStatus: payload.functionalStatus,
          diffPixelRatio: ratio,
          reasonCode: err.reasonCode,
          error: `${err.message}${err.reasonCode ? ` [${err.reasonCode}]` : ''}`,
        });
        if (err.reasonCode === 'SYSTEM_TEST_RUN_NOT_RUNNING') {
          // §12.5: the run slot was reclaimed/aborted — surface it and stop.
          log.error(`run ${runId} is no longer running — stopping (${err.message})`);
          runNotRunning = true;
          break;
        }
        log.error(`${label}: result ingest failed: ${err.message}`);
      }
    }

    clearInterval(heartbeatTimer);
    heartbeatTimer = null;

    // 9. Complete — the verdict derives from persisted items server-side (§12.5).
    let runStatus = null;
    if (!runNotRunning) {
      try {
        const completed = await api.completeRun(runId);
        runStatus = completed?.status ?? null;
      } catch (err) {
        log.error(`complete failed: ${err.message}${err.reasonCode ? ` [${err.reasonCode}]` : ''}`);
      }
    }

    exitCode = printSummary(rows, {
      reviewPolicy: options.reviewPolicy,
      buildId,
      runId,
      runStatus,
    });
    if (runNotRunning) exitCode = 1;
  } catch (err) {
    if (err instanceof ApiError || err instanceof BuildVerificationError) {
      log.error(`${err.message}${err.reasonCode ? ` [${err.reasonCode}]` : ''}`);
    } else {
      log.error(err);
    }
    if (runId) {
      await api.abortRun(runId).catch((abortErr) => log.warn(`abort failed: ${abortErr.message}`));
      log.warn(`run ${runId} aborted`);
    }
    exitCode = 1;
  } finally {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    await browser.close().catch(() => {});
  }

  return exitCode;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    log.error(err);
    process.exit(1);
  }
);
