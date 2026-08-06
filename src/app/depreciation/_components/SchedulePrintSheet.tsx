'use client';

import { Fragment } from 'react';
import { createPortal } from 'react-dom';
import {
  IDepreciationReport,
  IReportYear,
  OPENING_SOURCE_LABEL,
} from '@/utils/depreciationReport';

const Field = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="print-field">
    <span className="print-field-label">{label}</span>
    <span className="print-field-value">{value || '—'}</span>
  </div>
);

const num = (amount?: number | null) =>
  amount == null
    ? ''
    : amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

/**
 * The printable Depreciation Schedule.
 *
 * Mounted into <body> only while a print is in flight, and the print stylesheet hides
 * everything else on the page — so what reaches the paper is this document alone, not a
 * screenshot of a dialog. The browser paginates it and stamps its own page numbers and
 * date in the margins.
 *
 * It renders the SAME report object the dialog and the exports use, so a printed sheet can
 * never carry different figures from the screen it was printed from.
 */
export default function SchedulePrintSheet({
  report,
  companyName,
  assetCode,
  assetName,
  assetCategory,
  generatedBy,
  generatedOn,
  includeForecast,
  includeMonthlyDetail,
}: {
  report: IDepreciationReport;
  companyName: string;
  assetCode: string;
  assetName: string;
  assetCategory?: string | null;
  generatedBy: string;
  generatedOn: Date;
  includeForecast: boolean;
  includeMonthlyDetail: boolean;
}) {
  if (typeof document === 'undefined') return null;

  const { summary, openingLine, history, current, forecast } = report;
  const currency = summary.currencyId ? ` (${summary.currencyId.trim()})` : '';

  const sections: { title: string; years: IReportYear[] }[] = [
    ...(current ? [{ title: 'Current fiscal year', years: [current] }] : []),
    ...(history.length > 0 ? [{ title: 'History', years: history }] : []),
    ...(includeForecast && forecast.length > 0
      ? [{ title: 'Forecast (estimates — not posted)', years: forecast }]
      : []),
  ];
  const allYears = sections.flatMap((s) => s.years);

  return createPortal(
    <div id="schedule-print-root" className="print-sheet">
      <header className="print-header">
        <div>
          <h1 className="print-company">{companyName}</h1>
          <p className="print-title">Depreciation Schedule</p>
        </div>
        <div className="print-meta">
          <div>As of {summary.asOfDate}</div>
          <div>Generated {generatedOn.toLocaleString()}</div>
          <div>By {generatedBy}</div>
        </div>
      </header>

      <section className="print-block">
        <h2 className="print-section-title">Asset</h2>
        <div className="print-grid">
          <Field label="Asset code" value={assetCode} />
          <Field label="Asset name" value={assetName} />
          <Field label="Category" value={assetCategory} />
          <Field label="In service" value={summary.availableForUseDate} />
        </div>
      </section>

      <section className="print-block">
        <h2 className="print-section-title">Book</h2>
        <div className="print-grid">
          <Field label="Method" value={summary.methodName} />
          <Field label="Annual rate" value={summary.annualRate ?? 'n/a'} />
          <Field label="Convention" value={summary.convention} />
          <Field
            label="Useful life"
            value={summary.usefulLifeMonths ? `${summary.usefulLifeMonths} months` : 'n/a'}
          />
          <Field label={`Cost${currency}`} value={num(summary.cost)} />
          <Field label={`Residual${currency}`} value={num(summary.residualValue)} />
          <Field
            label="Opening balance"
            value={
              openingLine
                ? `${OPENING_SOURCE_LABEL[openingLine.source]} · through ${openingLine.throughDate ?? '—'}`
                : 'System-calculated history'
            }
          />
          <Field label="Charged through" value={summary.chargedThrough ?? 'Nothing posted'} />
        </div>
      </section>

      <section className="print-block">
        <h2 className="print-section-title">Position as of {summary.asOfDate}</h2>
        <div className="print-grid print-grid-figures">
          <Field label={`Cost${currency}`} value={num(summary.cost)} />
          <Field label={`Accumulated depreciation${currency}`} value={num(summary.accumulated)} />
          <Field label={`Current book value${currency}`} value={num(summary.currentBookValue)} />
          <Field label="Last closed fiscal year" value={summary.lastClosedFiscalYear} />
          <Field
            label={`${summary.currentFiscalYear ?? 'Current'} depreciation${currency}`}
            value={num(summary.currentFiscalYearCharge)}
          />
          <Field label="Charged through" value={summary.chargedThrough} />
        </div>
      </section>

      <section className="print-block">
        <h2 className="print-section-title">Fiscal-year depreciation{currency}</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>Fiscal year</th>
              <th>Period</th>
              <th className="right">Opening NBV</th>
              <th className="right">Depreciation</th>
              <th className="right">Accumulated</th>
              <th className="right">Closing NBV</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {openingLine && (
              <tr className="print-opening">
                <td>Opening balance</td>
                <td>through {openingLine.throughDate ?? '—'}</td>
                <td className="right">{num(summary.cost)}</td>
                {/* The Depreciation column is what the YEARS charged; the adopted balance
                    belongs in Accumulated only. Booking it here too would double it against
                    the footed total (Excel and the PDF both keep it out for the same reason). */}
                <td className="right">—</td>
                <td className="right">{num(openingLine.accumulated)}</td>
                <td className="right">{num(openingLine.netBookValue)}</td>
                <td>{OPENING_SOURCE_LABEL[openingLine.source]}</td>
              </tr>
            )}

            {sections.map((section) => (
              <Fragment key={section.title}>
                <tr className="print-subhead">
                  <td colSpan={7}>{section.title}</td>
                </tr>
                {section.years.map((year) => (
                  <Fragment key={year.fiscalYearCode}>
                    <tr>
                      <td>{year.fiscalYearCode}</td>
                      <td>
                        {year.startDate && year.endDate
                          ? `${year.startDate} → ${year.endDate}`
                          : `${year.monthsInYear} period(s)`}
                      </td>
                      <td className="right">{num(year.openingNbv)}</td>
                      <td className="right">{num(year.charge)}</td>
                      <td className="right">{num(year.accumulated)}</td>
                      <td className="right">{num(year.closingNbv)}</td>
                      <td>
                        {year.era === 'forecast'
                          ? 'Estimate'
                          : year.months.length > 0 && year.postedCount === year.months.length
                            ? 'Posted'
                            : year.postedCount > 0
                              ? `Posted ${year.postedCount}/${year.months.length}`
                              : 'Unposted'}
                      </td>
                    </tr>

                    {includeMonthlyDetail &&
                      (year.era === 'forecast' || includeForecast
                        ? year.months
                        : year.months.filter((m) => m.inRecord)
                      ).map((month) => (
                        <tr
                          key={`${year.fiscalYearCode}-${month.periodOrdinal}`}
                          className="print-month"
                        >
                          <td className="indent">
                            {month.monthName ?? `Period ${month.periodOrdinal}`}
                          </td>
                          <td>
                            {month.startDate} → {month.endDate}
                          </td>
                          <td className="right">{num(month.openingNbv)}</td>
                          <td className="right">{num(month.charge)}</td>
                          <td className="right">{num(month.accumulated)}</td>
                          <td className="right">{num(month.closingNbv)}</td>
                          <td>{month.isPosted ? 'Posted' : 'Unposted'}</td>
                        </tr>
                      ))}
                  </Fragment>
                ))}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total{includeForecast ? ' incl. forecast' : ` through ${summary.asOfDate}`}</td>
              <td />
              <td />
              <td className="right">{num(report.totals.countedCharge)}</td>
              {/* Endpoints from the report, never from "the last row" — the current year
                  prints FIRST here, so the last row is a closed year. */}
              <td className="right">{num(report.totals.closingAccumulated)}</td>
              <td className="right">{num(report.totals.closingNetBookValue)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </section>

      {includeForecast && forecast.length > 0 && (
        <p className="print-note">
          Forecast rows are estimates produced by projecting the configured rate over the
          seeded fiscal calendar. They are not posted and do not affect the opening balance or
          the book value shown above.
        </p>
      )}

      <footer className="print-footer">
        {companyName} · {assetCode} · Depreciation Schedule as of {summary.asOfDate} ·
        generated {generatedOn.toLocaleString()} by {generatedBy}
      </footer>
    </div>,
    document.body
  );
}
