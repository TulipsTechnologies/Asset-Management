/**
 * Summary table + CI exit code (visual design §4/§12.6). The per-row item mapping is
 * PINNED (§12.6): Pass→Pass, MinorDifference→Warning, ReviewRequired→Failed,
 * Broken→Failed, NewScenario→Info; FunctionalStatus=Failed forces Failed. The exit
 * code derives from that one table; VISUAL_REVIEW_POLICY=warn downgrades rows whose
 * ONLY failure is ReviewRequired (never Broken, never functional failures).
 */
'use strict';

const log = require('./log');

const VISUAL_STATUS_NAMES = {
  1: 'Pass',
  2: 'MinorDifference',
  3: 'ReviewRequired',
  4: 'Broken',
  5: 'NewScenario',
};

const FUNCTIONAL_STATUS_NAMES = { 1: 'Pass', 2: 'Failed' };

const RUN_STATUS_NAMES = {
  1: 'Running',
  2: 'Passed',
  3: 'PassedWithWarnings',
  4: 'Failed',
  5: 'Cancelled',
  6: 'Abandoned',
};

/** §12.6 pinned mapping, one place. */
function itemStatus(row) {
  if (row.error) return 'Failed';
  if (row.functionalStatus === 2) return 'Failed';
  switch (row.visualStatus) {
    case 1:
      return 'Pass';
    case 2:
      return 'Warning';
    case 3:
    case 4:
      return 'Failed';
    case 5:
      return 'Info';
    default:
      return 'Failed';
  }
}

/** True when the row fails ONLY because of ReviewRequired — the warn-policy downgrade. */
function isReviewOnlyFailure(row) {
  return !row.error && row.visualStatus === 3 && row.functionalStatus !== 2;
}

function pad(value, width) {
  const s = String(value ?? '');
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

/**
 * @param rows [{moduleKey, scenarioKey, viewport, visualStatus, functionalStatus,
 *              diffPixelRatio, reasonCode, durationMs, error}]
 * @returns {number} process exit code per §12.6/§4.
 */
function printSummary(rows, { reviewPolicy, buildId, runId, runStatus }) {
  const widths = {
    scenario: Math.max(8, ...rows.map((r) => `${r.moduleKey}/${r.scenarioKey}`.length)),
    viewport: Math.max(8, ...rows.map((r) => String(r.viewport).length)),
    visual: 16,
    functional: 10,
    ratio: 9,
    item: 7,
  };

  log.info('');
  log.info(
    `${pad('Scenario', widths.scenario)}  ${pad('Viewport', widths.viewport)}  ` +
      `${pad('Visual', widths.visual)}  ${pad('Functional', widths.functional)}  ` +
      `${pad('Diff', widths.ratio)}  ${pad('Item', widths.item)}  Reason`
  );
  log.info('-'.repeat(widths.scenario + widths.viewport + widths.visual + widths.functional + widths.ratio + widths.item + 20));

  for (const row of rows) {
    const visual = row.error
      ? 'IngestFailed'
      : VISUAL_STATUS_NAMES[row.visualStatus] || String(row.visualStatus ?? '-');
    const functional = FUNCTIONAL_STATUS_NAMES[row.functionalStatus] || '-';
    const ratio =
      row.diffPixelRatio != null ? `${(Number(row.diffPixelRatio) * 100).toFixed(3)}%` : '-';
    const reason = row.error || row.reasonCode || '';
    log.info(
      `${pad(`${row.moduleKey}/${row.scenarioKey}`, widths.scenario)}  ` +
        `${pad(row.viewport, widths.viewport)}  ${pad(visual, widths.visual)}  ` +
        `${pad(functional, widths.functional)}  ${pad(ratio, widths.ratio)}  ` +
        `${pad(itemStatus(row), widths.item)}  ${reason}`
    );
  }

  const counts = { Pass: 0, Warning: 0, Failed: 0, Info: 0 };
  for (const row of rows) counts[itemStatus(row)]++;

  const failedRows = rows.filter((r) => itemStatus(r) === 'Failed');
  const downgraded =
    reviewPolicy === 'warn' ? failedRows.filter((r) => isReviewOnlyFailure(r)) : [];
  const hardFailures = failedRows.filter((r) => !downgraded.includes(r));

  log.info('');
  log.info(
    `Totals: ${rows.length} captures — pass ${counts.Pass}, warning ${counts.Warning}, ` +
      `failed ${counts.Failed}, new/info ${counts.Info}`
  );
  if (downgraded.length > 0) {
    log.warn(
      `VISUAL_REVIEW_POLICY=warn: ${downgraded.length} ReviewRequired result(s) downgraded to warnings — review them in /system-test/visual.`
    );
  }
  if (buildId) log.info(`Frontend BUILD_ID: ${buildId}`);
  if (runId) log.info(`Run: ${runId} (${RUN_STATUS_NAMES[runStatus] || runStatus || 'unknown'}) — review at /system-test/visual`);

  return hardFailures.length > 0 ? 1 : 0;
}

module.exports = { printSummary, itemStatus, VISUAL_STATUS_NAMES, RUN_STATUS_NAMES };
