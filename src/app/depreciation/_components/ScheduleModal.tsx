'use client';

import { Fragment, ReactNode, useEffect, useMemo, useState } from 'react';
import Modal from '@/components/UI/Modal';
import { IAssetBook, IDepreciationSchedule, IFiscalPeriod } from '@/interface/IDepreciation';
import { CONVENTION_LABELS } from '@/enum/depreciationEnums';
import { fetchFiscalPeriods } from '@/services/depreciation.service';
import { fetchCurrentUser } from '@/services/auth.service';
import { useAuth } from '@/contexts/AuthContext';
import { unwrapPaged } from '@/utils/serviceUtils';
import {
  IDepreciationReport,
  IReportMonth,
  IReportYear,
  OPENING_SOURCE_LABEL,
  buildDepreciationReport,
} from '@/utils/depreciationReport';
import { exportScheduleToExcel } from '@/utils/scheduleExcel';
import { exportScheduleToPdf } from '@/utils/schedulePdf';
import SchedulePrintSheet from './SchedulePrintSheet';

const money = (amount?: number | null, currency?: string | null) =>
  amount == null
    ? '—'
    : `${amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}${currency ? ` ${currency.trim()}` : ''}`;

/** Money without the currency suffix — for dense table cells where the header carries it. */
const num = (amount?: number | null) =>
  amount == null
    ? '—'
    : amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

const StatTile = ({
  label,
  value,
  foot,
  hero,
}: {
  label: string;
  value: ReactNode;
  foot?: string | null;
  hero?: boolean;
}) => (
  <div
    className={`rounded-xl border px-4 py-3 ${
      hero ? 'border-primarycolor/30 bg-primarycolor/5' : 'border-gray-100 bg-white shadow-sm'
    }`}
  >
    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
    <p
      className={`mt-1 tabular-nums leading-tight ${
        hero ? 'text-2xl font-bold text-primarycolor' : 'text-lg font-semibold text-gray-800'
      }`}
    >
      {value}
    </p>
    {foot ? <p className="mt-1 truncate text-[11px] text-gray-400">{foot}</p> : null}
  </div>
);

const ToolbarButton = ({
  onClick,
  children,
  active,
  title,
}: {
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
  title?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-pressed={active}
    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primarycolor ${
      active
        ? 'border-amber-300 bg-amber-50 text-amber-700'
        : 'border-gray-200 bg-white text-gray-600 hover:border-primarycolor/40 hover:text-primarycolor'
    }`}
  >
    {children}
  </button>
);

/** One consistent badge palette for the whole dialog. */
const BADGE: Record<string, string> = {
  posted: 'bg-green-100 text-green-700',
  progress: 'bg-blue-100 text-blue-700',
  unposted: 'bg-gray-100 text-gray-600',
  estimate: 'border border-amber-300 bg-amber-50 text-amber-700',
  adopted: 'bg-slate-200 text-slate-700',
  current: 'bg-primarycolor/10 text-primarycolor',
};

const Badge = ({ tone, children }: { tone: keyof typeof BADGE | string; children: ReactNode }) => (
  <span
    className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
      BADGE[tone] ?? BADGE.unposted
    }`}
  >
    {children}
  </span>
);

/**
 * The Depreciation Schedule — a statement of record for finance users.
 *
 * WHAT IS SHOWN BY DEFAULT is the point of this screen: the current fiscal year first
 * (charged only through the as-of date), then history, and nothing beyond. Forecast years
 * are stored rows too, but they are projections of the configured rate rather than the
 * book's position, so they appear only when explicitly asked for and are labelled as
 * estimates everywhere they surface — screen, print, Excel and PDF.
 *
 * HISTORY HAS TWO SHAPES, decided by how the book's opening position arrived:
 *  • system-calculated (no opening balance) — the register computed every past period, so
 *    every historical fiscal year is real and is listed individually, each expandable;
 *  • manual or imported — the prior system's figure was adopted wholesale and the years
 *    behind it are UNKNOWN, so one Opening Balance row states what was adopted, its source
 *    and its through-date. Inventing year rows there would be fabrication.
 *
 * Every figure comes from the server via buildDepreciationReport — this component performs
 * no depreciation arithmetic, and the same report object feeds the exports so the workbook,
 * the PDF and the screen can never disagree.
 */
export default function ScheduleModal({
  book,
  schedule,
  onClose,
}: {
  book: IAssetBook | null;
  schedule: IDepreciationSchedule[];
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [view, setView] = useState<'yearly' | 'monthly'>('yearly');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showForecast, setShowForecast] = useState(false);
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [periodDates, setPeriodDates] = useState<Map<string, IFiscalPeriod>>(new Map());
  /** A failed calendar fetch must be SAID, not silently degraded into a wrong grouping. */
  const [calendarError, setCalendarError] = useState(false);
  const [identity, setIdentity] = useState<{ company: string; user: string }>({
    company: '',
    user: '',
  });

  useEffect(() => {
    if (!book) return;
    setView('yearly');
    setExpanded(new Set());
    setShowForecast(false);
    setCalendarError(false);
    setAsOfDate(new Date().toISOString().slice(0, 10));
    // Period dates and month names live on the fiscal calendar, not on the schedule rows
    // (rows are keyed by year+ordinal so far-future periods need no materialized row).
    fetchFiscalPeriods({ pageNumber: 1, pageSize: 500 })
      .then((response) => {
        const map = new Map<string, IFiscalPeriod>();
        for (const period of unwrapPaged<IFiscalPeriod>(response).items)
          map.set(`${period.fiscalYearCode}·${period.periodOrdinal}`, period);
        setPeriodDates(map);
        setCalendarError(map.size === 0);
      })
      .catch(() => {
        setPeriodDates(new Map());
        setCalendarError(true);
      });
  }, [book]);

  // Printed and exported documents must name the company and the person who produced them.
  // The JWT carries neither reliably — it holds a company ID, and this deployment's tokens
  // can omit the name claims entirely — so both come from /me.
  useEffect(() => {
    if (!book || identity.company) return;
    fetchCurrentUser()
      .then((response) =>
        setIdentity({
          company: response?.data?.companyName?.trim() || '',
          user: response?.data?.fullName?.trim() || response?.data?.username?.trim() || '',
        })
      )
      .catch(() => undefined);
  }, [book, identity.company]);

  /**
   * The print stylesheet hides every other body child, which must only ever be true while
   * this dialog is open — otherwise printing any other page in the app comes out blank.
   */
  useEffect(() => {
    if (!book) return;
    document.body.classList.add('schedule-print-active');
    return () => document.body.classList.remove('schedule-print-active');
  }, [book]);

  const report: IDepreciationReport | null = useMemo(() => {
    if (!book) return null;
    return buildDepreciationReport({
      book,
      schedule,
      periods: periodDates,
      asOfDate,
      conventionLabel: CONVENTION_LABELS[book.depreciationConvention] ?? '—',
      includeForecast: showForecast,
    });
  }, [book, schedule, periodDates, asOfDate, showForecast]);

  if (!book || !report) return null;

  const { summary, openingLine, history, current, forecast } = report;
  const currency = book.currencyId;

  // Current fiscal year first, then history, then the forecast tail when asked for.
  const sections: { key: string; title: string; hint?: string; years: IReportYear[] }[] = [
    ...(current
      ? [{ key: 'current', title: 'Current fiscal year', hint: `charged through ${asOfDate}`, years: [current] }]
      : []),
    ...(history.length > 0
      ? [{ key: 'history', title: 'History', hint: 'closed fiscal years', years: history }]
      : []),
    ...(showForecast && forecast.length > 0
      ? [{ key: 'forecast', title: 'Forecast', hint: 'estimates — not posted', years: forecast }]
      : []),
  ];

  const visibleYears = sections.flatMap((s) => s.years);

  /** Monthly view rows, chronological and cut to what the active mode counts. */
  const monthlyRows = [
    ...history,
    ...(current ? [current] : []),
    ...(showForecast ? forecast : []),
  ].flatMap((y) =>
    y.era === 'forecast' || showForecast ? y.months : y.months.filter((m) => m.inRecord)
  );
  const allExpanded =
    visibleYears.length > 0 && visibleYears.every((y) => expanded.has(y.fiscalYearCode));

  const toggle = (code: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const exportContext = {
    // No invented letterhead: an unknown company is stated as unknown rather than
    // stamping the vendor's name on a document that will be filed as this company's.
    companyName: identity.company || '(Company not set)',
    assetCode: book.assetCode,
    assetName: book.assetName,
    assetCategory: book.assetCategoryName,
    generatedBy: identity.user || user?.fullName?.trim() || user?.userName?.trim() || '—',
    generatedOn: new Date(),
    includeForecast: showForecast,
  };

  /**
   * Print uses the browser's own pipeline over a dedicated sheet (SchedulePrintSheet),
   * which is mounted continuously and hidden off-print by CSS — so there is no race
   * between mounting it and the browser snapshotting the document.
   */
  const handlePrint = () => window.print();

  const monthRow = (month: IReportMonth, nested: boolean, estimate: boolean) => (
    <tr
      key={`${month.fiscalYearCode}-${month.periodOrdinal}`}
      className={`border-b border-gray-50 text-xs transition-colors hover:bg-gray-50 ${
        nested ? 'bg-gray-50/50' : ''
      } ${month.isPosted ? 'text-gray-700' : 'text-gray-500'}`}
    >
      <td className={`py-2 pr-3 ${nested ? 'pl-10' : 'pl-4'}`}>
        <span className="font-medium">{month.monthName ?? `Period ${month.periodOrdinal}`}</span>
        <span className="ml-1.5 text-gray-400">
          {month.fiscalYearCode} · {month.periodOrdinal}
        </span>
      </td>
      <td className="px-3 py-2 text-gray-400">
        {month.startDate && month.endDate ? `${month.startDate} → ${month.endDate}` : '—'}
      </td>
      <td className="px-3 py-2 text-right text-gray-400">
        {month.chargedDays ?? <span className="text-gray-300">full</span>}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{num(month.openingNbv)}</td>
      <td className="px-3 py-2 text-right font-medium tabular-nums text-gray-800">
        {num(month.charge)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{num(month.accumulated)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{num(month.closingNbv)}</td>
      <td className="px-4 py-2 text-center">
        {month.isPosted ? (
          <Badge tone="posted">Posted</Badge>
        ) : estimate ? (
          <Badge tone="estimate">Estimate</Badge>
        ) : (
          <Badge tone="unposted">Unposted</Badge>
        )}
      </td>
    </tr>
  );

  const yearStatus = (year: IReportYear) => {
    if (year.era === 'forecast') return { tone: 'estimate', label: 'Estimate' };
    if (year.months.length > 0 && year.postedCount === year.months.length)
      return { tone: 'posted', label: 'Posted' };
    if (year.postedCount > 0)
      return { tone: 'progress', label: `Posted ${year.postedCount}/${year.months.length}` };
    return { tone: 'unposted', label: 'Unposted' };
  };

  return (
    <>
      <Modal isOpen={!!book} onClose={onClose} size="6xl">
        {/* The dialog is one flex column: header, summary and toolbar hold still while
            only the table scrolls, so the columns never lose their headings. */}
        <div className="flex max-h-[86vh] flex-col print:hidden">
          <div className="shrink-0 border-b border-gray-100 px-6 pb-4 pr-14 pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-secondaryColor">Depreciation Schedule</h2>
                <p className="mt-0.5 truncate text-xs text-gray-500">
                  {book.assetCode} · {book.assetName}
                  {book.assetCategoryName ? (
                    <span className="text-gray-400"> · {book.assetCategoryName}</span>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={openingLine ? 'adopted' : 'current'}>
                  {openingLine
                    ? `Opening balance · ${OPENING_SOURCE_LABEL[openingLine.source]}`
                    : 'History computed by the register'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Summary — the six figures a finance user opens this screen for. */}
          <div className="shrink-0 px-6 pt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                hero
                label={`Book value as of ${asOfDate}`}
                value={money(summary.currentBookValue, currency)}
                foot={`Cost ${money(summary.cost, currency)}`}
              />
              <StatTile
                label="Accumulated depreciation"
                value={money(summary.accumulated, currency)}
                foot={`through ${asOfDate}`}
              />
              <StatTile
                label={
                  summary.currentFiscalYear
                    ? `${summary.currentFiscalYear} depreciation`
                    : 'Current-year depreciation'
                }
                value={money(summary.currentFiscalYearCharge, currency)}
                foot={
                  summary.lastClosedFiscalYear
                    ? `Last closed FY ${summary.lastClosedFiscalYear}`
                    : 'No fiscal year closed yet'
                }
              />
              <StatTile
                label="Charged through"
                value={summary.chargedThrough ?? 'Nothing posted'}
                foot={`${summary.methodName}${summary.annualRate ? ` · ${summary.annualRate}` : ''} · ${summary.convention}`}
              />
            </div>
          </div>

          {/* Toolbar */}
          <div className="mt-4 flex shrink-0 flex-wrap items-center justify-between gap-3 border-y border-gray-100 bg-gray-50/60 px-6 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex overflow-hidden rounded-lg border border-gray-200">
                {(['yearly', 'monthly'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={view === mode}
                    onClick={() => setView(mode)}
                    className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                      view === mode
                        ? 'bg-primarycolor text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-1.5 text-xs text-gray-500">
                As of
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => e.target.value && setAsOfDate(e.target.value)}
                  className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700"
                />
              </label>
              {view === 'yearly' && visibleYears.length > 0 && (
                <ToolbarButton
                  onClick={() =>
                    setExpanded(
                      allExpanded ? new Set() : new Set(visibleYears.map((y) => y.fiscalYearCode))
                    )
                  }
                >
                  {allExpanded ? 'Collapse all' : 'Expand all'}
                </ToolbarButton>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {forecast.length > 0 && (
                <ToolbarButton active={showForecast} onClick={() => setShowForecast((on) => !on)}>
                  {showForecast ? 'Hide forecast' : 'Forecast Future Value'}
                </ToolbarButton>
              )}
              <ToolbarButton onClick={handlePrint} title="Print this schedule">
                Print
              </ToolbarButton>
              <ToolbarButton
                onClick={() =>
                  exportScheduleToPdf(report, {
                    ...exportContext,
                    includeMonthlyDetail: expanded.size > 0 || view === 'monthly',
                  })
                }
                title="Download a PDF report"
              >
                PDF
              </ToolbarButton>
              <ToolbarButton
                onClick={() => exportScheduleToExcel(report, exportContext)}
                title="Download an Excel workbook"
              >
                Excel
              </ToolbarButton>
            </div>
          </div>

          {(report.calendarIncomplete || calendarError) && (
            <p className="shrink-0 border-b border-red-100 bg-red-50 px-6 py-2 text-xs text-red-800">
              {calendarError
                ? 'The fiscal calendar could not be loaded, so periods cannot be dated and years cannot be placed against the as-of date. Reopen the schedule once the connection is back — do not rely on the grouping below.'
                : 'Some fiscal years referenced by this schedule have no periods in the configured calendar. Those years are listed under History because they cannot be dated; seed the missing years to place them correctly.'}
            </p>
          )}

          {showForecast && (
            <p className="shrink-0 border-b border-amber-100 bg-amber-50 px-6 py-2 text-xs text-amber-800">
              Forecast years are <strong>estimates</strong> — the configured rate projected over
              the seeded fiscal calendar. Nothing there is posted, and none of it affects the
              opening balance or the book value as of {asOfDate}.
            </p>
          )}

          {/* Table */}
          <div className="min-h-0 flex-1 overflow-auto px-6 pb-5">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10">
                {view === 'yearly' ? (
                  <tr className="bg-gray-100 text-left text-[11px] uppercase tracking-wide text-gray-600">
                    <th scope="col" className="rounded-l-lg py-2.5 pl-4 pr-3 font-semibold">
                      Fiscal year
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Period</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-semibold">Opening NBV</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-semibold">Depreciation</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-semibold">Accumulated</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-semibold">Closing NBV</th>
                    <th scope="col" className="rounded-r-lg px-4 py-2.5 text-center font-semibold">
                      Status
                    </th>
                  </tr>
                ) : (
                  <tr className="bg-gray-100 text-left text-[11px] uppercase tracking-wide text-gray-600">
                    <th scope="col" className="rounded-l-lg py-2.5 pl-4 pr-3 font-semibold">Period</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Dates</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-semibold">Days</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-semibold">Opening NBV</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-semibold">Charge</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-semibold">Accumulated</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-semibold">Closing NBV</th>
                    <th scope="col" className="rounded-r-lg px-4 py-2.5 text-center font-semibold">
                      Status
                    </th>
                  </tr>
                )}
              </thead>

              <tbody>
                {/* An adopted opening balance stands in for history that cannot be shown. */}
                {view === 'yearly' && openingLine && (
                  <tr className="border-b border-gray-100 bg-slate-50">
                    <td className="py-2.5 pl-4 pr-3">
                      <span className="font-semibold text-gray-700">Opening balance</span>
                      <span className="ml-2">
                        <Badge tone="adopted">{OPENING_SOURCE_LABEL[openingLine.source]}</Badge>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">
                      through {openingLine.throughDate ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-400">
                      {num(summary.cost)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums text-gray-800">
                      {num(openingLine.accumulated)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">
                      {num(openingLine.accumulated)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {num(openingLine.netBookValue)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge tone="adopted">Adopted</Badge>
                    </td>
                  </tr>
                )}

                {view === 'monthly' &&
                  monthlyRows.map((m) => monthRow(m, false, !m.inRecord))}

                {view === 'yearly' &&
                  sections.map((section) => (
                    <Fragment key={section.key}>
                      <tr>
                        <td colSpan={7} className="pb-1 pt-4">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            {section.title}
                          </span>
                          {section.hint && (
                            <span className="ml-2 text-[11px] font-normal normal-case text-gray-400">
                              {section.hint}
                            </span>
                          )}
                        </td>
                      </tr>

                      {section.years.map((year) => {
                        const status = yearStatus(year);
                        const open = expanded.has(year.fiscalYearCode);
                        const expandable = year.months.length > 0;
                        const shownMonths =
                          year.era === 'forecast' || showForecast
                            ? year.months
                            : year.months.filter((m) => m.inRecord);
                        return (
                          <Fragment key={year.fiscalYearCode}>
                            <tr
                              role={expandable ? 'button' : undefined}
                              tabIndex={expandable ? 0 : undefined}
                              aria-expanded={expandable ? open : undefined}
                              onClick={() => expandable && toggle(year.fiscalYearCode)}
                              onKeyDown={(e) => {
                                if (expandable && (e.key === 'Enter' || e.key === ' ')) {
                                  e.preventDefault();
                                  toggle(year.fiscalYearCode);
                                }
                              }}
                              className={`border-b border-gray-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primarycolor ${
                                expandable ? 'cursor-pointer hover:bg-gray-50' : ''
                              } ${year.era === 'forecast' ? 'text-gray-500' : 'text-gray-800'} ${
                                year.era === 'current' ? 'bg-primarycolor/[0.04]' : ''
                              }`}
                            >
                              <td className="py-2.5 pl-4 pr-3 font-medium">
                                <span className="inline-flex items-center gap-1.5">
                                  {expandable && (
                                    <span
                                      aria-hidden
                                      className={`text-[9px] text-gray-400 transition-transform ${
                                        open ? 'rotate-90' : ''
                                      }`}
                                    >
                                      ▶
                                    </span>
                                  )}
                                  {year.fiscalYearCode}
                                </span>
                                {year.partial && (
                                  <span className="ml-2">
                                    <Badge tone="current">to date</Badge>
                                  </span>
                                )}
                                {/* With the forecast on, this year's figure is the whole
                                    projected year rather than the charge to date — say so
                                    rather than letting the number change meaning silently. */}
                                {year.era === 'current' && showForecast && (
                                  <span className="ml-2">
                                    <Badge tone="estimate">full year projected</Badge>
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-xs text-gray-400">
                                {year.startDate && year.endDate
                                  ? `${year.startDate} → ${year.endDate}`
                                  : `${year.monthsInYear} period(s)`}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums">
                                {num(year.openingNbv)}
                              </td>
                              <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                                {num(year.charge)}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">
                                {num(year.accumulated)}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums">
                                {num(year.closingNbv)}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <Badge tone={status.tone}>{status.label}</Badge>
                              </td>
                            </tr>

                            {open &&
                              shownMonths.map((m) =>
                                monthRow(m, true, year.era === 'forecast' || !m.inRecord)
                              )}
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  ))}

                {(view === 'yearly'
                  ? visibleYears.length === 0 && !openingLine
                  : monthlyRows.length === 0) && (
                  <tr>
                    <td
                      colSpan={view === 'yearly' ? 7 : 8}
                      className="px-4 py-8 text-center text-sm text-gray-500"
                    >
                      {schedule.length === 0
                        ? 'No schedule rows — a method of None never generates any.'
                        : openingLine
                          ? `Nothing charged since the opening balance through ${openingLine.throughDate ?? 'the cutover'} — the yearly view shows the adopted position.`
                          : 'Nothing charged by this date yet.'}
                    </td>
                  </tr>
                )}
              </tbody>

              {view === 'yearly' && visibleYears.length > 0 && (
                <tfoot className="sticky bottom-0">
                  <tr className="bg-gray-100 text-sm font-semibold text-gray-800">
                    <td className="rounded-l-lg py-2.5 pl-4 pr-3">
                      Total{showForecast ? ' incl. forecast' : ' through ' + asOfDate}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-normal text-gray-500">
                      {report.totals.countedMonths} month(s)
                    </td>
                    <td className="px-3 py-2.5" />
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {num((openingLine?.accumulated ?? 0) + report.totals.countedCharge)}
                    </td>
                    {/* Endpoints come from the report, never from "the last row" — the
                        current year is listed FIRST here, so the last row is a closed year. */}
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {num(report.totals.closingAccumulated)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {num(report.totals.closingNetBookValue)}
                    </td>
                    <td className="rounded-r-lg px-4 py-2.5" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </Modal>

      {/* Always mounted, always hidden on screen — the print stylesheet reveals it and
          hides everything else, so Print needs no timing dance. */}
      <SchedulePrintSheet
          report={report}
          companyName={exportContext.companyName}
          assetCode={book.assetCode}
          assetName={book.assetName}
          assetCategory={book.assetCategoryName}
          generatedBy={exportContext.generatedBy}
          generatedOn={exportContext.generatedOn}
          includeForecast={showForecast}
          includeMonthlyDetail={expanded.size > 0 || view === 'monthly'}
        />
    </>
  );
}
