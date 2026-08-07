/**
 * PNG plumbing: decode/encode, mask compositing, SHA-256, pixelmatch diff and the
 * LOCAL mirror of the backend's classification ladder (visual design §4).
 *
 * The backend classifies authoritatively at ingest; classifyLocal exists for the
 * offline self-test and for the CLI's own pre-upload logging. Masks are composited as
 * BLACK rectangles over the capture BEFORE the diff (and before upload), so the stored
 * current image and any baseline approved from it carry identical masking.
 */
'use strict';

const crypto = require('crypto');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');

/** §4: diff ratio above this ceiling classifies Broken (backend default). */
const BROKEN_CEILING = 0.35;

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function decodePng(buffer) {
  return PNG.sync.read(buffer);
}

function encodePng(png) {
  return PNG.sync.write(png);
}

/**
 * Composites opaque black rectangles over the image. Rects are
 * {x, y, width, height} in image pixels; anything outside the bounds is clamped.
 */
function applyMasks(png, rects) {
  for (const rect of rects) {
    const x0 = Math.max(0, Math.floor(rect.x));
    const y0 = Math.max(0, Math.floor(rect.y));
    const x1 = Math.min(png.width, Math.ceil(rect.x + rect.width));
    const y1 = Math.min(png.height, Math.ceil(rect.y + rect.height));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const idx = (png.width * y + x) << 2;
        png.data[idx] = 0;
        png.data[idx + 1] = 0;
        png.data[idx + 2] = 0;
        png.data[idx + 3] = 255;
      }
    }
  }
  return png;
}

/**
 * Pixelmatch diff of two PNG buffers. The scenario's AntiAliasing threshold feeds
 * pixelmatch's per-pixel `threshold` (anti-aliased pixels are skipped by default, §2).
 *
 * Dimension mismatch NEVER throws (§12.10): it reports {dimensionMismatch: true} and
 * the caller classifies ReviewRequired with a named reason.
 */
function diffImages(currentBuffer, baselineBuffer, thresholds) {
  const current = decodePng(currentBuffer);
  const baseline = decodePng(baselineBuffer);

  if (current.width !== baseline.width || current.height !== baseline.height) {
    return {
      dimensionMismatch: true,
      ratio: 0,
      diffPng: null,
      currentSize: { width: current.width, height: current.height },
      baselineSize: { width: baseline.width, height: baseline.height },
    };
  }

  const out = new PNG({ width: current.width, height: current.height });
  const diffPixels = pixelmatch(
    current.data,
    baseline.data,
    out.data,
    current.width,
    current.height,
    { threshold: Number(thresholds.antiAliasing ?? 0.1) }
  );
  const ratio = diffPixels / (current.width * current.height);

  return {
    dimensionMismatch: false,
    ratio,
    diffPng: encodePng(out),
    currentSize: { width: current.width, height: current.height },
    baselineSize: { width: baseline.width, height: baseline.height },
  };
}

/**
 * Local mirror of the backend classification ladder (§4, in order):
 * Broken → ReviewRequired → MinorDifference → Pass, with NewScenario when no baseline
 * exists and functional-only scenarios never pixel-classified.
 */
function classifyLocal({
  renderFailed = false,
  missingCriticalSelectors = [],
  functionalFailed = false,
  isCritical = false,
  jsErrors = [],
  failOnJsError = true,
  pixelCompare = true,
  hasBaseline = false,
  dimensionMismatch = false,
  ratio = 0,
  thresholds = { pixelRatioPass: 0.001, pixelRatioMinor: 0.01 },
}) {
  if (renderFailed) return { status: 'Broken', reason: 'VISUAL_RENDER_FAILED' };
  if (missingCriticalSelectors.length > 0)
    return { status: 'Broken', reason: 'VISUAL_CRITICAL_SELECTOR_MISSING' };
  if (functionalFailed && isCritical)
    return { status: 'Broken', reason: 'VISUAL_CRITICAL_FUNCTIONAL_FAILED' };
  if (jsErrors.length > 0 && failOnJsError)
    return { status: 'Broken', reason: 'VISUAL_JS_ERROR' };

  if (!pixelCompare) return { status: 'Pass', reason: null };
  if (!hasBaseline) return { status: 'NewScenario', reason: 'VISUAL_NO_BASELINE' };
  if (dimensionMismatch)
    return { status: 'ReviewRequired', reason: 'VISUAL_DIMENSION_MISMATCH' };
  if (ratio > BROKEN_CEILING) return { status: 'Broken', reason: 'VISUAL_DIFF_ABOVE_CEILING' };
  if (ratio > Number(thresholds.pixelRatioMinor))
    return { status: 'ReviewRequired', reason: 'VISUAL_DIFF_REVIEW' };
  if (ratio > Number(thresholds.pixelRatioPass))
    return { status: 'MinorDifference', reason: 'VISUAL_DIFF_MINOR' };
  return { status: 'Pass', reason: null };
}

module.exports = {
  BROKEN_CEILING,
  sha256,
  decodePng,
  encodePng,
  applyMasks,
  diffImages,
  classifyLocal,
};
