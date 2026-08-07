/**
 * Executes ONE scenario×viewport (visual design §1/§9 as amended by
 * §12.10/§12.12/§12.14/§12.15): navigate → stabilize → declarative steps → declarative
 * assertions → critical selectors → mask boxes → capture → composite masks.
 *
 * Everything here is generic — scenario steps and assertions arrive as DATA from the
 * backend provider; nothing in this file knows Asset Management.
 */
'use strict';

const log = require('./log');
const { decodePng, encodePng, applyMasks } = require('./image');

// ---- enum values as served by the backend (VisualContracts.cs, numbers) -------------
const StepKind = {
  Click: 1,
  Fill: 2,
  Press: 3,
  Hover: 4,
  WaitForSelector: 5,
  WaitForHidden: 6,
  WaitForNetworkIdle: 7,
};

const AssertionKind = {
  SelectorExists: 1,
  SelectorVisible: 2,
  SelectorEnabled: 3,
  SelectorDisabled: 4,
  SelectorHidden: 5,
  SelectorCount: 6,
  NoHorizontalOverflow: 7,
};

const CaptureMode = { FullPage: 1, Element: 2 };
const CaptureMedia = { Screen: 1, Print: 2 };

const STEP_TIMEOUT_MS = 15000;
const NAV_TIMEOUT_MS = 45000;
const STABILIZE_TIMEOUT_MS = 20000;

/**
 * §12.14 determinism CSS: kill animations, transitions, caret blink and smooth
 * scrolling for the whole document.
 */
const STABILIZATION_CSS = `
*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  caret-color: transparent !important;
}
html { scroll-behavior: auto !important; }
`;

/** Loading skeletons the §12.14 contract waits out (Tailwind pulse + skeleton classes). */
const SKELETON_SELECTOR = '.animate-pulse, [class*="skeleton" i]';

/** The app's toast portal (ToastProvider.tsx): fixed container, aria-live=polite. */
const TOAST_CONTAINER_SELECTOR = '[aria-live="polite"][aria-relevant="additions"]';

function isAppApiRequest(url, apiUrl) {
  if (apiUrl && url.startsWith(apiUrl)) return url.includes('/api/');
  return url.includes('/api/');
}

async function stabilize(page, warnings) {
  await page.addStyleTag({ content: STABILIZATION_CSS });

  // Fonts first — layout depends on them.
  try {
    await page.evaluate(() => document.fonts.ready.then(() => true));
  } catch (err) {
    warnings.push(`fonts.ready failed: ${err.message}`);
  }

  try {
    await page.waitForLoadState('networkidle', { timeout: STABILIZE_TIMEOUT_MS });
  } catch {
    warnings.push('network never went idle within the stabilization window');
  }

  // No visible skeletons (§12.14) — never a timed sleep.
  try {
    await page.waitForFunction(
      (selector) => {
        const nodes = document.querySelectorAll(selector);
        for (const node of nodes) {
          const rect = node.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) return false;
        }
        return true;
      },
      SKELETON_SELECTOR,
      { timeout: STABILIZE_TIMEOUT_MS }
    );
  } catch {
    warnings.push('loading skeletons still visible after the stabilization window');
  }

  // Toast container empty/hidden (§12.14) — toasts are dismissed by waiting them out.
  try {
    await page.waitForFunction(
      (selector) => {
        const container = document.querySelector(selector);
        return !container || container.childElementCount === 0;
      },
      TOAST_CONTAINER_SELECTOR,
      { timeout: STABILIZE_TIMEOUT_MS }
    );
  } catch {
    warnings.push('toast container still showing toasts after the stabilization window');
  }
}

async function runStep(page, step, warnings) {
  const locator = step.selector ? page.locator(step.selector).first() : null;
  switch (step.kind) {
    case StepKind.Click:
      await locator.click({ timeout: STEP_TIMEOUT_MS });
      break;
    case StepKind.Fill: {
      // Native date/time inputs: locator.fill() engages headless Chromium's internal
      // picker, whose invisible overlay then claims a whole band of the page for
      // hit-testing (headed Chromium is unaffected) — every LATER Click in that band
      // times out with "<input> intercepts pointer events". Set the value through the
      // native setter + input/change events instead: React's onChange still fires and
      // the picker is never engaged.
      await locator.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS });
      const inputType = await locator.evaluate((el) =>
        el instanceof HTMLInputElement ? el.type : null
      );
      if (['date', 'datetime-local', 'month', 'week', 'time'].includes(inputType)) {
        await locator.evaluate((el, value) => {
          const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value'
          ).set;
          setter.call(el, value);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }, step.value ?? '');
      } else {
        await locator.fill(step.value ?? '', { timeout: STEP_TIMEOUT_MS });
      }
      break;
    }
    case StepKind.Press:
      if (locator) await locator.press(step.value ?? 'Enter', { timeout: STEP_TIMEOUT_MS });
      else await page.keyboard.press(step.value ?? 'Enter');
      break;
    case StepKind.Hover:
      await locator.hover({ timeout: STEP_TIMEOUT_MS });
      break;
    case StepKind.WaitForSelector:
      await page.waitForSelector(step.selector, { state: 'attached', timeout: STEP_TIMEOUT_MS });
      break;
    case StepKind.WaitForHidden:
      await page.waitForSelector(step.selector, { state: 'hidden', timeout: STEP_TIMEOUT_MS });
      break;
    case StepKind.WaitForNetworkIdle:
      // Best-effort like the stabilize() pass: a page that keeps a request in flight
      // (polling, straggling fetch) is a determinism WARNING, not a functional failure
      // — the pixel classification catches any real instability it causes.
      try {
        await page.waitForLoadState('networkidle', { timeout: STEP_TIMEOUT_MS });
      } catch {
        warnings.push('step: network never went idle within the step window');
      }
      break;
    default:
      throw new Error(`Unknown step kind ${step.kind}`);
  }
}

/** Evaluates one declarative assertion; returns null on pass, a failure record on fail. */
async function runAssertion(page, assertion) {
  const fail = (actual) => ({
    kind: assertion.kind,
    selector: assertion.selector ?? null,
    expected: assertion.expected ?? null,
    actual: String(actual),
  });

  const locator = assertion.selector ? page.locator(assertion.selector) : null;
  switch (assertion.kind) {
    case AssertionKind.SelectorExists: {
      // §12.12: exists means ATTACHED, not visible — print-media assertions rely on it.
      const count = await locator.count();
      return count > 0 ? null : fail('not attached');
    }
    case AssertionKind.SelectorVisible: {
      const count = await locator.count();
      if (count === 0) return fail('not attached');
      return (await locator.first().isVisible()) ? null : fail('hidden');
    }
    case AssertionKind.SelectorEnabled: {
      const count = await locator.count();
      if (count === 0) return fail('not attached');
      return (await locator.first().isEnabled()) ? null : fail('disabled');
    }
    case AssertionKind.SelectorDisabled: {
      const count = await locator.count();
      if (count === 0) return fail('not attached');
      return (await locator.first().isDisabled()) ? null : fail('enabled');
    }
    case AssertionKind.SelectorHidden: {
      const count = await locator.count();
      if (count === 0) return null;
      return (await locator.first().isHidden()) ? null : fail('visible');
    }
    case AssertionKind.SelectorCount: {
      const expected = parseInt(assertion.expected ?? '0', 10);
      const count = await locator.count();
      return count === expected ? null : fail(count);
    }
    case AssertionKind.NoHorizontalOverflow: {
      const overflow = await page.evaluate((selector) => {
        const el = selector ? document.querySelector(selector) : document.documentElement;
        if (!el) return 'missing';
        return el.scrollWidth > el.clientWidth + 1 ? 'overflows' : null;
      }, assertion.selector ?? null);
      return overflow === null ? null : fail(overflow);
    }
    default:
      return fail(`unknown assertion kind ${assertion.kind}`);
  }
}

/** Bounding boxes of every element matching each mask selector, in page pixels. */
async function collectMaskRects(page, selectors) {
  const rects = [];
  for (const selector of selectors) {
    let boxes;
    try {
      boxes = await page.evaluate((sel) => {
        return Array.from(document.querySelectorAll(sel)).map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        });
      }, selector);
    } catch (err) {
      log.warn(`mask selector "${selector}" failed to evaluate: ${err.message}`);
      continue;
    }
    for (const box of boxes) {
      if (box.width > 0 && box.height > 0) rects.push(box);
    }
  }
  return rects;
}

/**
 * Runs one scenario at one viewport. Never throws for scenario-level problems — the
 * outcome object carries them; only infrastructure faults (context dead) propagate.
 *
 * @returns {Promise<{
 *   renderFailed: boolean, functionalFailed: boolean,
 *   jsErrors: string[], failedAssertions: object[], missingCriticalSelectors: string[],
 *   mutationViolations: string[], stabilizationWarnings: string[],
 *   currentPng: Buffer|null, durationMs: number
 * }>}
 */
async function captureScenario({ context, baseUrl, apiUrl, definition, sharedMaskSelectors, viewport }) {
  const startedAt = Date.now();
  const outcome = {
    renderFailed: false,
    functionalFailed: false,
    jsErrors: [],
    failedAssertions: [],
    missingCriticalSelectors: [],
    mutationViolations: [],
    stabilizationWarnings: [],
    currentPng: null,
    durationMs: 0,
  };

  const size = definition.viewportOverride ?? viewport;
  const page = await context.newPage();
  try {
    await page.setViewportSize({ width: size.width, height: size.height });

    page.on('pageerror', (err) => {
      outcome.jsErrors.push(err.message || String(err));
    });

    // §12.15 non-mutation rule: any non-GET app API call during the scenario fails it.
    // TablePreferences traffic is neutralized by the context route (§12.11) and only
    // logged — it can never persist.
    page.on('request', (request) => {
      const method = request.method();
      if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
      const url = request.url();
      if (!isAppApiRequest(url, apiUrl)) return;
      if (/\/api\/TablePreferences/i.test(url)) {
        log.warn(`blocked TablePreferences ${method} during ${definition.key}/${viewport.name}`);
        return;
      }
      outcome.mutationViolations.push(`${method} ${url}`);
    });

    try {
      await page.goto(`${baseUrl}${definition.route}`, {
        waitUntil: 'domcontentloaded',
        timeout: NAV_TIMEOUT_MS,
      });
    } catch (err) {
      outcome.renderFailed = true;
      outcome.failedAssertions.push({
        kind: 'Navigation',
        selector: definition.route,
        expected: 'page renders',
        actual: err.message,
      });
      outcome.durationMs = Date.now() - startedAt;
      return outcome;
    }

    await stabilize(page, outcome.stabilizationWarnings);

    // Declarative pre-capture steps; the first failure stops the sequence (the page is
    // no longer in the state later steps assume) but the capture still happens as
    // evidence.
    for (const step of definition.preCaptureSteps ?? []) {
      try {
        await runStep(page, step, outcome.stabilizationWarnings);
      } catch (err) {
        outcome.functionalFailed = true;
        outcome.failedAssertions.push({
          kind: `Step:${step.kind}`,
          selector: step.selector ?? null,
          expected: step.value ?? null,
          actual: err.message,
        });
        break;
      }
    }

    // Let whatever the steps triggered settle before asserting/capturing.
    try {
      await page.waitForLoadState('networkidle', { timeout: STABILIZE_TIMEOUT_MS });
    } catch {
      outcome.stabilizationWarnings.push('network not idle after steps');
    }

    // §12.12: print scenarios INTERACT under screen media (the dialog toolbar is
    // display:none in print, so steps would time out on invisible controls), then flip
    // to print for assertions, masks and capture — the print scenarios' SelectorExists
    // assertions mean attached-not-visible precisely so they hold on both sides of
    // this switch.
    if (definition.captureMedia === CaptureMedia.Print) {
      await page.emulateMedia({ media: 'print' });
    }

    for (const assertion of definition.assertions ?? []) {
      try {
        const failure = await runAssertion(page, assertion);
        if (failure) {
          outcome.functionalFailed = true;
          outcome.failedAssertions.push(failure);
        }
      } catch (err) {
        outcome.functionalFailed = true;
        outcome.failedAssertions.push({
          kind: assertion.kind,
          selector: assertion.selector ?? null,
          expected: assertion.expected ?? null,
          actual: err.message,
        });
      }
    }

    for (const selector of definition.criticalSelectors ?? []) {
      const count = await page.locator(selector).count();
      if (count === 0) outcome.missingCriticalSelectors.push(selector);
    }

    // Masks: provider-level chrome masks + scenario masks, boxes measured BEFORE the
    // screenshot (animations are frozen, so nothing moves in between).
    const maskSelectors = [...(sharedMaskSelectors ?? []), ...(definition.maskSelectors ?? [])];
    let maskRects = await collectMaskRects(page, maskSelectors);

    let screenshot;
    if (definition.captureMode === CaptureMode.Element && definition.captureSelector) {
      // The capture element may be missing when a pre-step already failed. A null
      // capture would be unclassifiable at ingest (PNG guard) — so the failure is
      // recorded and the FULL VIEWPORT is captured as evidence instead.
      const element = page.locator(definition.captureSelector).first();
      let elementBox = null;
      try {
        await element.waitFor({ state: 'visible', timeout: 5000 });
        elementBox = await element.boundingBox();
      } catch {
        /* recorded below */
      }
      if (elementBox) {
        screenshot = await element.screenshot({ animations: 'disabled', caret: 'hide' });
        maskRects = maskRects.map((r) => ({
          x: r.x - elementBox.x,
          y: r.y - elementBox.y,
          width: r.width,
          height: r.height,
        }));
      } else {
        outcome.functionalFailed = true;
        outcome.failedAssertions.push({
          kind: 'Capture',
          selector: definition.captureSelector,
          expected: 'capture element visible',
          actual: 'capture element not visible — captured the full viewport as evidence',
        });
        screenshot = await page.screenshot({ animations: 'disabled', caret: 'hide' });
      }
    } else {
      // §12.10: FullPage ≡ viewport in this shell; taller needs come from
      // ViewportOverride, applied above.
      screenshot = await page.screenshot({ animations: 'disabled', caret: 'hide' });
    }

    if (maskRects.length > 0) {
      const png = decodePng(screenshot);
      applyMasks(png, maskRects);
      screenshot = encodePng(png);
    }
    outcome.currentPng = screenshot;
  } catch (err) {
    outcome.renderFailed = true;
    outcome.failedAssertions.push({
      kind: 'Capture',
      selector: null,
      expected: 'capture succeeds',
      actual: err.message,
    });
  } finally {
    await page.close().catch(() => {});
  }

  // §12.15: a mutation attempt is a functional failure with a named reason.
  if (outcome.mutationViolations.length > 0) {
    outcome.functionalFailed = true;
    outcome.failedAssertions.push({
      kind: 'NonMutationRule',
      selector: null,
      expected: 'no non-GET app API calls during a visual scenario',
      actual: outcome.mutationViolations.join('; '),
    });
  }

  outcome.durationMs = Date.now() - startedAt;
  return outcome;
}

module.exports = {
  captureScenario,
  StepKind,
  AssertionKind,
  CaptureMode,
  CaptureMedia,
  STABILIZATION_CSS,
};
