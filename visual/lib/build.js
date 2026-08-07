/**
 * §12.9 production-build verification. The runner NEVER builds (next build's
 * cleanDistDir would destroy a live dev server's .next) — it verifies the TARGET is a
 * production `next start` and records its BUILD_ID.
 *
 * Operator sequence when this refuses: stop the dev server → `npm run build` →
 * `npm run start` → re-run the visual CLI.
 *
 * Verification is layered because /_next/BUILD_ID is a build artifact, not a route
 * every deployment serves:
 *   1. GET /_next/BUILD_ID — used verbatim when served ("development" refuses).
 *   2. Dev-server fingerprints in the page HTML (react-refresh, app-pages-internals,
 *      ?v= chunk cache-busting) or a live /_next/webpack-hmr endpoint — refused.
 *   3. A /_next/static/{buildId}/ reference in the HTML — recorded as the BUILD_ID.
 * A target that cannot be verified as a production build is refused with a named
 * reason rather than captured against unstable dev output.
 */
'use strict';

const DEV_MARKERS = [
  '/_next/static/chunks/app-pages-internals.js',
  'react-refresh',
  '__nextjs_original-stack-frame',
  'next-dev.js',
];

class BuildVerificationError extends Error {
  constructor(message, reasonCode) {
    super(message);
    this.name = 'BuildVerificationError';
    this.reasonCode = reasonCode;
  }
}

async function fetchText(url) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    return { status: res.status, text: res.ok ? await res.text() : '' };
  } catch (err) {
    throw new BuildVerificationError(
      `Unable to reach the frontend at ${url} (${err.message}).`,
      'VISUAL_FRONTEND_UNREACHABLE'
    );
  }
}

/** @returns {Promise<string>} the verified BUILD_ID. Throws BuildVerificationError. */
async function verifyProductionBuild(baseUrl) {
  // Layer 1: the artifact itself.
  const direct = await fetchText(`${baseUrl}/_next/BUILD_ID`);
  if (direct.status === 200 && direct.text.trim()) {
    const buildId = direct.text.trim().split('\n')[0];
    if (buildId === 'development') {
      throw new BuildVerificationError(
        'The target is a Next.js DEV server (BUILD_ID=development). Visual baselines are only valid against a production build: stop dev, `npm run build`, `npm run start`.',
        'VISUAL_DEV_SERVER'
      );
    }
    return buildId;
  }

  // Layer 2: dev fingerprints. /signin renders without auth; fall back to the root.
  let html = (await fetchText(`${baseUrl}/signin`)).text;
  if (!html) html = (await fetchText(`${baseUrl}/`)).text;
  if (!html) {
    throw new BuildVerificationError(
      `The frontend at ${baseUrl} returned no HTML to verify.`,
      'VISUAL_FRONTEND_UNREACHABLE'
    );
  }

  const marker = DEV_MARKERS.find((m) => html.includes(m));
  const devChunkVersioning = /\/_next\/static\/chunks\/[^"']+\?v=\d/.test(html);
  if (marker || devChunkVersioning) {
    throw new BuildVerificationError(
      `The target at ${baseUrl} is a Next.js DEV server (marker: ${marker || 'chunk ?v= cache busting'}). Visual baselines are only valid against a production build: stop dev, \`npm run build\`, \`npm run start\`.`,
      'VISUAL_DEV_SERVER'
    );
  }

  // A dev server that didn't match HTML markers still answers the HMR endpoint.
  try {
    const hmr = await fetch(`${baseUrl}/_next/webpack-hmr`, {
      signal: AbortSignal.timeout(2000),
    });
    if (hmr.status === 200) {
      throw new BuildVerificationError(
        `The target at ${baseUrl} serves /_next/webpack-hmr — a DEV server. Stop dev, \`npm run build\`, \`npm run start\`.`,
        'VISUAL_DEV_SERVER'
      );
    }
  } catch (err) {
    if (err instanceof BuildVerificationError) throw err;
    // Timeout/404/refused — expected for production; ignore.
  }

  // Layer 3: extract the build id from static asset references (Pages Router serves
  // /_next/static/{buildId}/_buildManifest.js; the App Router does not).
  const match = html.match(
    /\/_next\/static\/(?!chunks\/|css\/|media\/|development)([A-Za-z0-9_-]{8,})\//
  );
  if (match) return match[1];

  // Layer 3b: the App Router embeds the build id in the RSC flight payload as
  // \"b\":\"<buildId>\" inside __next_f.push — a dev server carries \"b\":\"development\"
  // there, so the field stays a positive production/dev discriminator.
  if (html.includes('__next_f')) {
    if (/\\"b\\":\\"development\\"/.test(html)) {
      throw new BuildVerificationError(
        'The target is a Next.js DEV server (flight payload build id = development). Visual baselines are only valid against a production build: stop dev, `npm run build`, `npm run start`.',
        'VISUAL_DEV_SERVER'
      );
    }
    const flight = html.match(/\\"b\\":\\"([A-Za-z0-9_-]{8,})\\"/);
    if (flight) return flight[1];
  }

  throw new BuildVerificationError(
    `Could not verify that ${baseUrl} is a production Next.js build (no BUILD_ID served, no dev markers, no build-id asset references). Refusing to capture against an unverified target.`,
    'VISUAL_BUILD_UNVERIFIED'
  );
}

module.exports = { verifyProductionBuild, BuildVerificationError };
