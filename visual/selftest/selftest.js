#!/usr/bin/env node
/**
 * Offline self-test (visual design §11): proves the capture → mask → diff → classify
 * plumbing with two fixture HTML pages served by a tiny local static server. No
 * backend, no credentials — classification here uses the CLI's LOCAL mirror of the §4
 * ladder (the backend stays authoritative in real runs).
 *
 *   npm run visual:selftest
 *
 * Cases:
 *   1. identical      — base vs base, no masks            → Pass (ratio 0)
 *   2. big change     — base vs changed, mask #dynamic    → ReviewRequired (~15%)
 *   3. minor change   — + mask #banner                    → MinorDifference (~0.4%)
 *   4. fully masked   — + mask #small                     → Pass (masks neutralize all)
 *   5. dimensions     — 1024×768 vs 800×600               → ReviewRequired, named reason
 *   6. steps+asserts  — click opens modal, assertions run → functional Pass
 *   7. failed assert  — missing selector, critical        → Broken (functional failure)
 *   8. mutation rule  — page fires POST /api/echo         → functional failure, §12.15
 *   9. js error       — page throws                       → Broken (FailOnJsError)
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const log = require('../lib/log');
const { captureScenario, StepKind, AssertionKind } = require('../lib/scenario');
const { diffImages, classifyLocal } = require('../lib/image');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const THRESHOLDS = { pixelRatioPass: 0.001, pixelRatioMinor: 0.01, antiAliasing: 0.1 };
const VIEWPORT = { name: 'desktop', width: 1024, height: 768 };
const SMALL_VIEWPORT = { name: 'small', width: 800, height: 600 };

/** Serves the fixtures directory; answers POST /api/echo for the mutation case. */
function startServer() {
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname.startsWith('/api/')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
      return;
    }
    const file = path.join(FIXTURES_DIR, path.basename(pathname));
    if (!fs.existsSync(file)) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(file));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

function definition(route, overrides = {}) {
  return {
    key: overrides.key ?? route,
    name: route,
    route,
    requiredDataState: 'none',
    level: 1,
    preCaptureSteps: [],
    assertions: [],
    captureMode: 1,
    captureSelector: null,
    captureMedia: 1,
    viewportOverride: null,
    maskSelectors: [],
    diffThresholds: THRESHOLDS,
    isCritical: false,
    failOnJsError: true,
    criticalSelectors: [],
    pixelCompare: true,
    ...overrides,
  };
}

async function capture(context, baseUrl, def, viewport = VIEWPORT) {
  return captureScenario({
    context,
    baseUrl,
    apiUrl: baseUrl,
    definition: def,
    sharedMaskSelectors: [],
    viewport,
  });
}

/** Diff two captures and classify with the outcome of the CURRENT capture. */
function classify(outcome, diff) {
  return classifyLocal({
    renderFailed: outcome.renderFailed,
    missingCriticalSelectors: outcome.missingCriticalSelectors,
    functionalFailed: outcome.functionalFailed,
    isCritical: false,
    jsErrors: outcome.jsErrors,
    failOnJsError: true,
    pixelCompare: true,
    hasBaseline: true,
    dimensionMismatch: diff.dimensionMismatch,
    ratio: diff.ratio,
    thresholds: THRESHOLDS,
  });
}

async function main() {
  const failures = [];
  const check = (name, actual, expected) => {
    const ok = actual === expected;
    log.info(`${ok ? 'PASS' : 'FAIL'}  ${name}  (expected ${expected}, got ${actual})`);
    if (!ok) failures.push(name);
  };

  const { server, baseUrl } = await startServer();
  const browser = await chromium.launch({
    args: ['--force-color-profile=srgb', '--hide-scrollbars'],
  });
  const context = await browser.newContext({
    viewport: { width: VIEWPORT.width, height: VIEWPORT.height },
    deviceScaleFactor: 1,
  });

  try {
    // Baseline captures ------------------------------------------------------------
    const maskDynamic = ['#dynamic'];
    const maskDynBanner = ['#dynamic', '#banner'];
    const maskAll = ['#dynamic', '#banner', '#small'];

    const base = await capture(context, baseUrl, definition('/fixture-base.html'));
    const baseAgain = await capture(context, baseUrl, definition('/fixture-base.html'));

    // 1. identical → Pass
    let diff = diffImages(base.currentPng, baseAgain.currentPng, THRESHOLDS);
    check('1 identical capture ratio==0', diff.ratio === 0, true);
    check('1 identical → Pass', classify(baseAgain, diff).status, 'Pass');

    // 2. big change, dynamic masked → ReviewRequired
    const baseMaskDyn = await capture(
      context, baseUrl, definition('/fixture-base.html', { maskSelectors: maskDynamic }));
    const changedMaskDyn = await capture(
      context, baseUrl, definition('/fixture-changed.html', { maskSelectors: maskDynamic }));
    diff = diffImages(changedMaskDyn.currentPng, baseMaskDyn.currentPng, THRESHOLDS);
    check('2 big change ratio > minor', diff.ratio > THRESHOLDS.pixelRatioMinor, true);
    check('2 big change → ReviewRequired', classify(changedMaskDyn, diff).status, 'ReviewRequired');

    // 3. banner also masked → MinorDifference (only #small differs, ~0.4%)
    const baseMaskDynBanner = await capture(
      context, baseUrl, definition('/fixture-base.html', { maskSelectors: maskDynBanner }));
    const changedMaskDynBanner = await capture(
      context, baseUrl, definition('/fixture-changed.html', { maskSelectors: maskDynBanner }));
    diff = diffImages(changedMaskDynBanner.currentPng, baseMaskDynBanner.currentPng, THRESHOLDS);
    check('3 minor change → MinorDifference', classify(changedMaskDynBanner, diff).status, 'MinorDifference');

    // 4. everything dynamic masked → Pass
    const baseMaskAll = await capture(
      context, baseUrl, definition('/fixture-base.html', { maskSelectors: maskAll }));
    const changedMaskAll = await capture(
      context, baseUrl, definition('/fixture-changed.html', { maskSelectors: maskAll }));
    diff = diffImages(changedMaskAll.currentPng, baseMaskAll.currentPng, THRESHOLDS);
    check('4 fully masked → Pass', classify(changedMaskAll, diff).status, 'Pass');

    // 5. dimension mismatch → ReviewRequired with named reason, never a crash (§12.10)
    const smaller = await capture(context, baseUrl, definition('/fixture-base.html'), SMALL_VIEWPORT);
    diff = diffImages(smaller.currentPng, base.currentPng, THRESHOLDS);
    check('5 dimension mismatch detected', diff.dimensionMismatch, true);
    const dimClass = classify(smaller, diff);
    check('5 dimension mismatch → ReviewRequired', dimClass.status, 'ReviewRequired');
    check('5 dimension mismatch reason', dimClass.reason, 'VISUAL_DIMENSION_MISMATCH');

    // 6. steps + assertions: click opens the modal, assertions pass
    const withSteps = await capture(context, baseUrl, definition('/fixture-base.html', {
      key: 'steps',
      preCaptureSteps: [{ kind: StepKind.Click, selector: '#open-modal', value: null }],
      assertions: [
        { kind: AssertionKind.SelectorVisible, selector: '#modal', expected: null },
        { kind: AssertionKind.SelectorCount, selector: 'table tr', expected: '3' },
        { kind: AssertionKind.NoHorizontalOverflow, selector: null, expected: null },
      ],
      criticalSelectors: ['#banner'],
    }));
    check('6 steps+assertions functional Pass', withSteps.functionalFailed, false);
    check('6 no missing critical selectors', withSteps.missingCriticalSelectors.length, 0);

    // 7. failed assertion on a critical scenario → Broken
    const failedAssert = await capture(context, baseUrl, definition('/fixture-base.html', {
      key: 'failed-assert',
      assertions: [{ kind: AssertionKind.SelectorVisible, selector: '#does-not-exist', expected: null }],
    }));
    check('7 failed assertion → functional Failed', failedAssert.functionalFailed, true);
    const brokenClass = classifyLocal({
      functionalFailed: failedAssert.functionalFailed,
      isCritical: true,
      hasBaseline: true,
      thresholds: THRESHOLDS,
    });
    check('7 critical functional failure → Broken', brokenClass.status, 'Broken');

    // 8. §12.15 non-mutation rule: the page fires POST /api/echo → named failure
    const mutation = await capture(
      context, baseUrl, definition('/fixture-base.html?mutate=1', { key: 'mutation' }));
    check('8 mutation detected', mutation.mutationViolations.length > 0, true);
    check('8 mutation → functional Failed', mutation.functionalFailed, true);
    check(
      '8 mutation failure is named',
      mutation.failedAssertions.some((a) => a.kind === 'NonMutationRule'),
      true
    );

    // 9. page JS error → Broken under FailOnJsError
    const jsError = await capture(
      context, baseUrl, definition('/fixture-base.html?jserror=1', { key: 'jserror' }));
    check('9 js error captured', jsError.jsErrors.length > 0, true);
    const jsClass = classifyLocal({
      jsErrors: jsError.jsErrors,
      failOnJsError: true,
      hasBaseline: true,
      thresholds: THRESHOLDS,
    });
    check('9 js error → Broken', jsClass.status, 'Broken');
  } finally {
    await browser.close().catch(() => {});
    server.close();
  }

  log.info('');
  if (failures.length > 0) {
    log.error(`self-test FAILED: ${failures.length} check(s): ${failures.join('; ')}`);
    return 1;
  }
  log.info('self-test passed: capture → mask → diff → classify plumbing verified offline.');
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    log.error(err);
    process.exit(1);
  }
);
