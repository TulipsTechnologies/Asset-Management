'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Modal from '@/components/UI/Modal';
import { IAssetBook, IDepreciationSchedule, IFiscalPeriod } from '@/interface/IDepreciation';
import { CONVENTION_LABELS } from '@/enum/depreciationEnums';
import { DEPRECIATION_METHOD_CODES } from '@/enum/depreciationEnums';
import { fetchFiscalPeriods } from '@/services/depreciation.service';
import { unwrapPaged } from '@/utils/serviceUtils';

const formatDate = (value?: string | null) =>
  value ? value.slice(0, 10) : '—';

const money = (amount?: number | null, currency?: string | null) =>
  amount == null
    ? '—'
    : `${amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}${currency ? ` ${currency.trim()}` : ''}`;

const DetailField = ({
  label,
  value,
  strong,
}: {
  label: string;
  value?: string | number | null;
  strong?: boolean;
}) => (
  <div>
    <p className="text-xs text-gray-500">{label}</p>
    <p
      className={`text-sm font-medium ${
        strong ? 'text-primarycolor' : 'text-gray-800'
      }`}
    >
      {value ?? '—'}
    </p>
  </div>
);

type TYearGroup = {
  fiscalYearCode: string;
  rows: IDepreciationSchedule[];
  openingNbv: number;
  charge: number;
  accumulatedAtEnd: number;
  closingNbv: number;
  postedCount: number;
  /** 'history' ended by the as-of date; 'current' contains it; 'future' starts after it. */
  era: 'history' | 'current' | 'future';
};

/**
 * The depreciation schedule, grouped the way finance reads it: one row per FISCAL YEAR
 * (the grouping the backend already provides via fiscalYearCode — never re-bucketed into
 * asset-anniversary years), expandable to the monthly rows beneath it.
 *
 * The DEFAULT view is a statement of record: history through the last closed fiscal year,
 * then the current fiscal year charged only through the as-of date. The stored rows for
 * later periods exist (posting reads them), but they are projections of the configured
 * rate — they appear only behind "Forecast Future Value", labelled as estimates.
 *
 * Every figure is the server's. Yearly rows are sums and endpoint-cumulatives of the
 * monthly rows in one response — no depreciation arithmetic happens here, and expanding a
 * year fetches nothing.
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
  const [view, setView] = useState<'yearly' | 'monthly'>('yearly');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showForecast, setShowForecast] = useState(false);
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  // Period calendar dates come from the fiscal calendar, loaded once per open — the
  // schedule rows themselves carry only (year, ordinal).
  const [periodDates, setPeriodDates] = useState<Map<string, IFiscalPeriod>>(new Map());

  useEffect(() => {
    if (!book) return;
    setView('yearly');
    setExpanded(new Set());
    setShowForecast(false);
    setAsOfDate(new Date().toISOString().slice(0, 10));
    fetchFiscalPeriods({ pageNumber: 1, pageSize: 500 })
      .then((response) => {
        const map = new Map<string, IFiscalPeriod>();
        for (const period of unwrapPaged<IFiscalPeriod>(response).items)
          map.set(`${period.fiscalYearCode}·${period.periodOrdinal}`, period);
        setPeriodDates(map);
      })
      .catch(() => setPeriodDates(new Map()));
  }, [book]);

  const cost = book?.cost ?? 0;

  const periodOf = (row: IDepreciationSchedule) =>
    periodDates.get(`${row.fiscalYearCode}·${row.periodOrdinal}`);

  /**
   * A row belongs to the record when its period has ENDED by the as-of date — or when it
   * is posted, because a posted figure is the authority regardless of any date filter.
   * Everything else is the forecast tail.
   */
  const isRecordRow = (row: IDepreciationSchedule) => {
    if (row.isPosted) return true;
    const period = periodOf(row);
    if (!period) return false; // no calendar dates loaded (yet) — keep it out of the record
    return formatDate(period.endDate) <= asOfDate;
  };

  /** Fiscal-year boundaries derived from the loaded calendar (max period end per year). */
  const yearEnds = useMemo(() => {
    const ends = new Map<string, string>();
    for (const period of periodDates.values()) {
      const end = formatDate(period.endDate);
      const current = ends.get(period.fiscalYearCode);
      if (!current || end > current) ends.set(period.fiscalYearCode, end);
    }
    return ends;
  }, [periodDates]);

  const yearStarts = useMemo(() => {
    const starts = new Map<string, string>();
    for (const period of periodDates.values()) {
      const start = formatDate(period.startDate);
      const current = starts.get(period.fiscalYearCode);
      if (!current || start < current) starts.set(period.fiscalYearCode, start);
    }
    return starts;
  }, [periodDates]);

  const years = useMemo<TYearGroup[]>(() => {
    const groups = new Map<string, IDepreciationSchedule[]>();
    for (const row of schedule) {
      const list = groups.get(row.fiscalYearCode) ?? [];
      list.push(row);
      groups.set(row.fiscalYearCode, list);
    }
    return [...groups.entries()].map(([fiscalYearCode, rows]) => {
      // The record's cut of the year: only periods ended by the as-of date (or posted).
      // For a current year that is exactly "depreciation through the selected date"; for
      // a history year it is every row; for a future year it is empty.
      const yearEnd = yearEnds.get(fiscalYearCode);
      const yearStart = yearStarts.get(fiscalYearCode);
      const era: TYearGroup['era'] =
        yearEnd && yearEnd <= asOfDate
          ? 'history'
          : yearStart && yearStart > asOfDate
            ? 'future'
            : 'current';

      const recordRows = era === 'future' ? [] : rows.filter(isRecordRow);
      const visible = showForecast || era === 'future' ? rows : recordRows;

      // The year opens where its FIRST stored row opens, whether or not that row is
      // inside the record — that is the accumulated position carried into the year.
      const openingAccumulated = rows[0].cumulativeAmount - rows[0].amount;
      // It closes at the last VISIBLE row; with nothing charged yet it closes where it
      // opened (a current year still inside its first period charges nothing).
      const closingAccumulated =
        visible.length > 0 ? visible[visible.length - 1].cumulativeAmount : openingAccumulated;

      return {
        fiscalYearCode,
        rows: visible,
        openingNbv: cost - openingAccumulated,
        charge: visible.reduce((sum, r) => sum + r.amount, 0),
        accumulatedAtEnd: closingAccumulated,
        closingNbv: cost - closingAccumulated,
        postedCount: visible.filter((r) => r.isPosted).length,
        era,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule, cost, yearEnds, yearStarts, asOfDate, showForecast, periodDates]);

  /**
   * The default statement: history + the current fiscal year, which stays on screen even
   * with nothing charged yet — "0.00 so far this year" is the answer, an absent row is not.
   */
  const futureYears = years.filter((y) => y.era === 'future');
  const visibleYears = showForecast
    ? years
    : years.filter((y) => y.era !== 'future' && (y.rows.length > 0 || y.era === 'current'));

  /**
   * A book that arrived with an opening balance carries its pre-register history there,
   * not in schedule rows. Show it as the statement's first line so "history through the
   * last closed fiscal year" is visible rather than merely implied. Server figures only.
   */
  const openingLine =
    book && book.openingAccumulatedDepreciation > 0
      ? {
          accumulated: book.openingAccumulatedDepreciation,
          nbv: book.cost - book.openingAccumulatedDepreciation,
          through: formatDate(book.lastDepreciationThroughDate),
        }
      : null;

  /** The summary the requirement names, every figure a server number. */
  const summary = useMemo(() => {
    const recordRows = schedule.filter(isRecordRow);
    const lastRecord = recordRows[recordRows.length - 1];
    // A cutover book may have NO rows in the record yet — its history is the opening
    // balance itself (the first stored row's cumulative minus its own charge).
    const accumulatedThrough =
      lastRecord?.cumulativeAmount ??
      (schedule.length > 0
        ? schedule[0].cumulativeAmount - schedule[0].amount
        : (book?.accumulatedDepreciation ?? 0));

    const lastClosedYear = [...yearEnds.entries()]
      .filter(([, end]) => end <= asOfDate)
      .sort((a, b) => (a[1] < b[1] ? -1 : 1))
      .pop();
    const currentYear = [...yearEnds.entries()].find(
      ([code, end]) => end > asOfDate && (yearStarts.get(code) ?? '9999') <= asOfDate
    );

    const currentYearCharge = currentYear
      ? schedule
          .filter((r) => r.fiscalYearCode === currentYear[0] && isRecordRow(r))
          .reduce((sum, r) => sum + r.amount, 0)
      : 0;

    // Charged through: the book's own anchor, else the last posted period's end, else
    // the opening cutover — the date nothing on or before is ever charged again.
    const posted = schedule.filter((r) => r.isPosted);
    const lastPosted = posted[posted.length - 1];
    const chargedThrough =
      (lastPosted ? formatDate(periodOf(lastPosted)?.endDate) : null) ??
      formatDate(book?.lastDepreciationThroughDate) ??
      '—';

    return {
      accumulatedThrough,
      nbv: cost - accumulatedThrough,
      lastClosedYearCode: lastClosedYear?.[0] ?? '—',
      currentYearCode: currentYear?.[0] ?? null,
      currentYearCharge,
      chargedThrough,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule, yearEnds, yearStarts, asOfDate, cost, book, periodDates]);

  if (!book) return null;

  const isRateBased =
    book.depreciationMethodCode === DEPRECIATION_METHOD_CODES.DecliningBalance ||
    book.depreciationMethodCode === DEPRECIATION_METHOD_CODES.WrittenDownValue;

  /** The rate line, in the operator's terms — never a bare factor. */
  const rateLabel = (() => {
    if (!isRateBased) return null;
    if (book.annualRatePercent != null) return `${book.annualRatePercent}% a year`;
    if (book.usefulLifeMonths)
      return `${(
        (book.decliningBalanceFactor / (book.usefulLifeMonths / 12)) * 100
      ).toFixed(1)}% a year (derived from factor ${book.decliningBalanceFactor} over ${(
        book.usefulLifeMonths / 12
      ).toFixed(1)} years — legacy setup)`;
    return null;
  })();

  const yearStatus = (year: TYearGroup) =>
    year.era === 'future'
      ? { label: 'Estimate', classes: 'border border-amber-300 bg-amber-50 text-amber-700' }
      : year.postedCount === year.rows.length && year.rows.length > 0
        ? { label: 'Posted', classes: 'bg-green-100 text-green-700' }
        : year.postedCount > 0
          ? { label: 'In progress', classes: 'bg-blue-100 text-blue-700' }
          : { label: 'Unposted', classes: 'bg-gray-100 text-gray-500' };

  const toggle = (code: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const monthRow = (row: IDepreciationSchedule, nested: boolean, estimate: boolean) => {
    const period = periodOf(row);
    return (
      <tr
        key={`${row.fiscalYearCode}-${row.periodOrdinal}`}
        className={`border-b border-gray-50 text-xs ${nested ? 'bg-gray-50/60' : ''} ${
          row.isPosted ? '' : 'text-gray-500'
        }`}
      >
        <td className={`px-3 py-1.5 ${nested ? 'pl-8' : ''}`}>
          {row.fiscalYearCode} · {row.periodOrdinal}
          {period?.monthName ? (
            <span className="ml-1 text-gray-400">{period.monthName}</span>
          ) : null}
        </td>
        <td className="px-3 py-1.5 text-gray-400">
          {period ? `${formatDate(period.startDate)} → ${formatDate(period.endDate)}` : '—'}
        </td>
        <td className="px-3 py-1.5 text-right">
          {row.chargedDays ?? <span className="text-gray-400">Full period</span>}
        </td>
        <td className="px-3 py-1.5 text-right tabular-nums">
          {money(cost - (row.cumulativeAmount - row.amount), book.currencyId)}
        </td>
        <td className="px-3 py-1.5 text-right font-medium tabular-nums">
          {money(row.amount, book.currencyId)}
        </td>
        <td className="px-3 py-1.5 text-right tabular-nums">
          {money(row.cumulativeAmount, book.currencyId)}
        </td>
        <td className="px-3 py-1.5 text-right tabular-nums">
          {money(cost - row.cumulativeAmount, book.currencyId)}
        </td>
        <td className="px-3 py-1.5 text-center">
          {row.isPosted ? (
            <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
              Posted
            </span>
          ) : estimate ? (
            <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
              Estimate
            </span>
          ) : (
            <span className="text-[10px] text-gray-400">Unposted</span>
          )}
        </td>
      </tr>
    );
  };

  const monthlyRows = schedule.filter((row) => {
    if (isRecordRow(row)) return true;
    return showForecast;
  });

  return (
    <Modal isOpen={!!book} onClose={onClose} size="3xl">
      <div className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-800">
            {book.assetCode} — Depreciation Schedule
          </h2>
          <label className="flex items-center gap-2 text-xs text-gray-500">
            As of
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => e.target.value && setAsOfDate(e.target.value)}
              className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-700"
            />
          </label>
        </div>

        {/* The statement summary the schedule answers for the as-of date. */}
        <div className="mb-2 grid grid-cols-3 gap-4 rounded bg-gray-50 p-3">
          <DetailField label="Cost" value={money(book.cost, book.currencyId)} />
          <DetailField
            label={`Accumulated through ${asOfDate}`}
            value={money(summary.accumulatedThrough, book.currencyId)}
          />
          <DetailField
            label={`Value as of ${asOfDate}`}
            value={money(summary.nbv, book.currencyId)}
            strong
          />
          <DetailField label="Last closed fiscal year" value={summary.lastClosedYearCode} />
          <DetailField
            label={
              summary.currentYearCode
                ? `${summary.currentYearCode} depreciation to date`
                : 'Current-year depreciation'
            }
            value={money(summary.currentYearCharge, book.currencyId)}
          />
          <DetailField label="Charged through" value={summary.chargedThrough} />
        </div>

        {/* The book's terms, secondary. */}
        <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1 px-1 text-[11px] text-gray-500">
          <span>{book.depreciationMethodName}{rateLabel ? ` · ${rateLabel}` : ''}</span>
          {!isRateBased && book.usefulLifeMonths ? (
            <span>{book.usefulLifeMonths} months life</span>
          ) : null}
          <span>{CONVENTION_LABELS[book.depreciationConvention] ?? ''}</span>
          <span>Residual {money(book.residualValue, book.currencyId)}</span>
          <span>In service {formatDate(book.availableForUseDate)}</span>
          <span>Grouped by the configured Nepal fiscal calendar.</span>
        </div>

        {/* view controls */}
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex rounded border border-gray-200 p-0.5 text-xs">
            {(['yearly', 'monthly'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={view === mode}
                onClick={() => setView(mode)}
                className={`rounded px-2.5 py-1 capitalize ${
                  view === mode ? 'bg-primarycolor/10 font-medium text-primarycolor' : 'text-gray-500'
                }`}
              >
                {mode} view
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-xs">
            {view === 'yearly' && (
              <>
                <button
                  type="button"
                  className="text-gray-500 hover:text-primarycolor"
                  onClick={() => setExpanded(new Set(visibleYears.map((y) => y.fiscalYearCode)))}
                >
                  Expand all
                </button>
                <button
                  type="button"
                  className="text-gray-500 hover:text-primarycolor"
                  onClick={() => setExpanded(new Set())}
                >
                  Collapse all
                </button>
              </>
            )}
            {futureYears.length > 0 && (
              <button
                type="button"
                aria-pressed={showForecast}
                onClick={() => setShowForecast((on) => !on)}
                className={`rounded border px-2.5 py-1 font-medium ${
                  showForecast
                    ? 'border-amber-300 bg-amber-50 text-amber-700'
                    : 'border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-700'
                }`}
              >
                {showForecast ? 'Hide forecast' : 'Forecast Future Value'}
              </button>
            )}
          </div>
        </div>

        {showForecast && (
          <p className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Future periods are <strong>estimates</strong> — the configured{' '}
            {isRateBased ? 'rate' : 'method'} projected over the seeded fiscal calendar
            {isRateBased && !book.useStraightLineCrossover
              ? ' (a reducing balance never reaches zero, so value remains at the end)'
              : ''}
            . Nothing here is posted, and none of it affects the opening balance or the
            value as of {asOfDate}.
          </p>
        )}

        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-gray-100 text-left text-xs text-gray-600">
              {view === 'yearly' ? (
                <tr>
                  <th scope="col" className="px-3 py-2">Fiscal Year</th>
                  <th scope="col" className="px-3 py-2 text-right">Opening NBV</th>
                  <th scope="col" className="px-3 py-2 text-right">Depreciation</th>
                  <th scope="col" className="px-3 py-2 text-right">Accumulated</th>
                  <th scope="col" className="px-3 py-2 text-right">Closing NBV</th>
                  <th scope="col" className="px-3 py-2 text-center">Status</th>
                </tr>
              ) : (
                <tr>
                  <th scope="col" className="px-3 py-2">Period</th>
                  <th scope="col" className="px-3 py-2">Dates</th>
                  <th scope="col" className="px-3 py-2 text-right">Days</th>
                  <th scope="col" className="px-3 py-2 text-right">Opening NBV</th>
                  <th scope="col" className="px-3 py-2 text-right">Charge</th>
                  <th scope="col" className="px-3 py-2 text-right">Accumulated</th>
                  <th scope="col" className="px-3 py-2 text-right">NBV After</th>
                  <th scope="col" className="px-3 py-2 text-center">Status</th>
                </tr>
              )}
            </thead>
            <tbody>
              {view === 'yearly' && openingLine && (
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  <td className="px-3 py-2">
                    <span className="font-medium text-gray-700">Opening balance</span>
                    <span className="ml-2 text-xs font-normal text-gray-400">
                      history charged through {openingLine.through}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-400">
                    {money(book.cost, book.currencyId)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {money(openingLine.accumulated, book.currencyId)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                    {money(openingLine.accumulated, book.currencyId)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {money(openingLine.nbv, book.currencyId)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                      Adopted
                    </span>
                  </td>
                </tr>
              )}

              {(view === 'yearly'
                ? visibleYears.length === 0 && !openingLine
                : monthlyRows.length === 0) && (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                    {schedule.length === 0
                      ? 'No schedule rows — a method of None never generates any.'
                      : 'Nothing charged by this date yet. The current fiscal year is still inside its first period.'}
                  </td>
                </tr>
              )}

              {view === 'monthly' &&
                monthlyRows.map((row) => monthRow(row, false, !isRecordRow(row)))}

              {view === 'yearly' &&
                visibleYears.map((year) => {
                  const status = yearStatus(year);
                  const open = expanded.has(year.fiscalYearCode);
                  const yearSpan = (() => {
                    // A current year with nothing charged yet has no visible rows — fall
                    // back to the configured year's own boundaries.
                    if (year.rows.length === 0) {
                      const start = yearStarts.get(year.fiscalYearCode);
                      const end = yearEnds.get(year.fiscalYearCode);
                      return start && end ? `${start} → ${end}` : 'no periods charged yet';
                    }
                    const first = periodDates.get(`${year.fiscalYearCode}·${year.rows[0].periodOrdinal}`);
                    const last = periodDates.get(
                      `${year.fiscalYearCode}·${year.rows[year.rows.length - 1].periodOrdinal}`
                    );
                    return first && last
                      ? `${formatDate(first.startDate)} → ${formatDate(last.endDate)}`
                      : `${year.rows.length} period(s)`;
                  })();
                  return (
                    <Fragment key={year.fiscalYearCode}>
                      <tr
                        role={year.rows.length > 0 ? 'button' : undefined}
                        tabIndex={year.rows.length > 0 ? 0 : undefined}
                        aria-expanded={year.rows.length > 0 ? open : undefined}
                        aria-label={
                          year.rows.length > 0
                            ? `Fiscal year ${year.fiscalYearCode} — ${
                                open ? 'collapse' : 'expand'
                              } monthly detail`
                            : undefined
                        }
                        className={`border-b border-gray-100 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primarycolor ${
                          year.rows.length > 0 ? 'cursor-pointer hover:bg-gray-50' : ''
                        } ${year.era === 'future' ? 'text-gray-500' : ''}`}
                        onClick={() => year.rows.length > 0 && toggle(year.fiscalYearCode)}
                        onKeyDown={(e) => {
                          if (year.rows.length > 0 && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            toggle(year.fiscalYearCode);
                          }
                        }}
                      >
                        <td className="px-3 py-2">
                          {year.rows.length > 0 && (
                            <i
                              className={`icon icon-arrow-down mr-1.5 text-[10px] text-gray-400 transition-transform ${
                                open ? 'rotate-180' : ''
                              }`}
                            />
                          )}
                          {year.fiscalYearCode}
                          {year.era === 'current' && (
                            <span
                              className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                showForecast
                                  ? 'border border-amber-300 bg-amber-50 text-amber-700'
                                  : 'bg-primarycolor/10 text-primarycolor'
                              }`}
                            >
                              {showForecast
                                ? 'current · full year estimated'
                                : `current · through ${asOfDate}`}
                            </span>
                          )}
                          <span className="ml-2 text-xs font-normal text-gray-400">
                            {yearSpan}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {money(year.openingNbv, book.currencyId)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {money(year.charge, book.currencyId)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                          {money(year.accumulatedAtEnd, book.currencyId)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {money(year.closingNbv, book.currencyId)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${status.classes}`}
                          >
                            {status.label}
                            {status.label === 'In progress'
                              ? ` ${year.postedCount}/${year.rows.length}`
                              : ''}
                          </span>
                        </td>
                      </tr>
                      {open && year.rows.length > 0 && (
                        <tr>
                          <td colSpan={6} className="p-0">
                            <table className="w-full">
                              <tbody>
                                {year.rows.map((row) =>
                                  monthRow(row, true, year.era === 'future' || !isRecordRow(row))
                                )}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
