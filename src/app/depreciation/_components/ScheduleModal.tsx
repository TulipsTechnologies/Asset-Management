'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Button from '@/components/UI/Button';
import Modal from '@/components/UI/Modal';
import { IAssetBook, IDepreciationSchedule, IFiscalPeriod } from '@/interface/IDepreciation';
import { CONVENTION_LABELS, isDayBasedConvention } from '@/enum/depreciationEnums';
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
}: {
  label: string;
  value?: string | number | null;
}) => (
  <div>
    <p className="text-xs text-gray-500">{label}</p>
    <p className="text-sm font-medium text-gray-800">{value ?? '—'}</p>
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
};

/**
 * The depreciation schedule, grouped the way finance reads it: one row per FISCAL YEAR
 * (the grouping the backend already provides via fiscalYearCode — never re-bucketed into
 * asset-anniversary years), expandable to the monthly rows beneath it.
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
  // Period calendar dates come from the fiscal calendar, loaded once per open — the
  // schedule rows themselves carry only (year, ordinal).
  const [periodDates, setPeriodDates] = useState<Map<string, IFiscalPeriod>>(new Map());

  useEffect(() => {
    if (!book) return;
    setView('yearly');
    setExpanded(new Set());
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

  const years = useMemo<TYearGroup[]>(() => {
    const groups = new Map<string, IDepreciationSchedule[]>();
    for (const row of schedule) {
      const list = groups.get(row.fiscalYearCode) ?? [];
      list.push(row);
      groups.set(row.fiscalYearCode, list);
    }
    return [...groups.entries()].map(([fiscalYearCode, rows]) => {
      const first = rows[0];
      const last = rows[rows.length - 1];
      return {
        fiscalYearCode,
        rows,
        openingNbv: cost - (first.cumulativeAmount - first.amount),
        charge: rows.reduce((sum, r) => sum + r.amount, 0),
        accumulatedAtEnd: last.cumulativeAmount,
        closingNbv: cost - last.cumulativeAmount,
        postedCount: rows.filter((r) => r.isPosted).length,
      };
    });
  }, [schedule, cost]);

  const scheduleCoverage = useMemo(() => {
    if (!book || schedule.length === 0) return null;
    const last = schedule[schedule.length - 1];
    const undepreciated = (book.depreciableBase ?? 0) - last.cumulativeAmount;
    return {
      periods: schedule.length,
      through: `${last.fiscalYearCode} · ${last.periodOrdinal}`,
      truncated: undepreciated > 0.005,
      undepreciated,
    };
  }, [book, schedule]);

  const lastPostedPeriod = useMemo(() => {
    const posted = schedule.filter((r) => r.isPosted);
    if (posted.length === 0) return null;
    const last = posted[posted.length - 1];
    return `${last.fiscalYearCode} · ${last.periodOrdinal}`;
  }, [schedule]);

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
    year.postedCount === year.rows.length
      ? { label: 'Posted', classes: 'bg-green-100 text-green-700' }
      : year.postedCount > 0
        ? { label: 'In progress', classes: 'bg-blue-100 text-blue-700' }
        : { label: 'Forecast', classes: 'bg-gray-100 text-gray-500' };

  const toggle = (code: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const monthRow = (row: IDepreciationSchedule, nested: boolean) => {
    const period = periodDates.get(`${row.fiscalYearCode}·${row.periodOrdinal}`);
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
          ) : (
            <span className="text-[10px] text-gray-400">Forecast</span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <Modal isOpen={!!book} onClose={onClose} size="3xl">
      <div className="p-5">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">
          {book.assetCode} — Depreciation Schedule
        </h2>

        <div className="mb-4 grid grid-cols-4 gap-4 rounded bg-gray-50 p-3">
          <DetailField label="Cost" value={money(book.cost, book.currencyId)} />
          <DetailField label="Residual" value={money(book.residualValue, book.currencyId)} />
          <DetailField label="Method" value={book.depreciationMethodName} />
          {isRateBased ? (
            <DetailField label="Annual Rate" value={rateLabel} />
          ) : (
            <DetailField
              label="Useful Life"
              value={book.usefulLifeMonths ? `${book.usefulLifeMonths} months` : '—'}
            />
          )}
          <DetailField
            label="Convention"
            value={CONVENTION_LABELS[book.depreciationConvention] ?? '—'}
          />
          <DetailField
            label="Available for Use"
            value={formatDate(book.availableForUseDate)}
          />
          <DetailField
            label="Depreciated to Date"
            value={money(book.accumulatedDepreciation, book.currencyId)}
          />
          <DetailField
            label="Value Left Today"
            value={money(book.netBookValue, book.currencyId)}
          />
          <DetailField
            label="Charged Through"
            value={formatDate(book.lastDepreciationThroughDate)}
          />
          <DetailField label="Last Posted Period" value={lastPostedPeriod ?? 'None posted'} />
          {isRateBased && book.usefulLifeMonths != null && (
            <DetailField label="Life Cap" value={`${book.usefulLifeMonths} months`} />
          )}
          {isRateBased && (
            <DetailField
              label="Straight-line Crossover"
              value={book.useStraightLineCrossover ? 'On (legacy policy)' : 'Off'}
            />
          )}
        </div>

        {scheduleCoverage && (
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-xs">
            <span className="text-gray-500">
              {scheduleCoverage.periods} period(s), through{' '}
              <strong className="text-gray-700">{scheduleCoverage.through}</strong>
              <span className="ml-2 text-gray-400">
                Grouped by Nepal fiscal year, as the schedule is stored.
              </span>
            </span>
            {scheduleCoverage.truncated && (
              <span className="text-gray-400">
                {money(scheduleCoverage.undepreciated, book.currencyId)} not yet scheduled
              </span>
            )}
          </div>
        )}

        {scheduleCoverage?.truncated && !isRateBased && (
          <p className="mb-3 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
            This schedule stops where the seeded fiscal calendar ends, not where the
            asset&apos;s life does. Add the next fiscal year under{' '}
            <strong>Configuration</strong> and every active book&apos;s schedule extends
            automatically.
          </p>
        )}
        {scheduleCoverage?.truncated && isRateBased && !book.useStraightLineCrossover && (
          <p className="mb-3 rounded bg-gray-50 px-3 py-2 text-xs text-gray-500">
            A reducing balance never reaches zero by design — the value shown as not yet
            scheduled is what the rate has not consumed within the seeded calendar.
          </p>
        )}

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
          {view === 'yearly' && (
            <div className="flex gap-3 text-xs">
              <button
                type="button"
                className="text-gray-500 hover:text-primarycolor"
                onClick={() => setExpanded(new Set(years.map((y) => y.fiscalYearCode)))}
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
            </div>
          )}
        </div>

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
              {schedule.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                    No schedule rows. A method of None never generates one, and a schedule
                    stops where the seeded fiscal calendar ends.
                  </td>
                </tr>
              )}

              {view === 'monthly' && schedule.map((row) => monthRow(row, false))}

              {view === 'yearly' &&
                years.map((year) => {
                  const status = yearStatus(year);
                  const open = expanded.has(year.fiscalYearCode);
                  const yearSpan = (() => {
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
                        role="button"
                        tabIndex={0}
                        aria-expanded={open}
                        aria-label={`Fiscal year ${year.fiscalYearCode} — ${
                          open ? 'collapse' : 'expand'
                        } monthly detail`}
                        className="cursor-pointer border-b border-gray-100 font-medium hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primarycolor"
                        onClick={() => toggle(year.fiscalYearCode)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggle(year.fiscalYearCode);
                          }
                        }}
                      >
                        <td className="px-3 py-2">
                          <i
                            className={`icon icon-arrow-down mr-1.5 text-[10px] text-gray-400 transition-transform ${
                              open ? 'rotate-180' : ''
                            }`}
                          />
                          {year.fiscalYearCode}
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
                      {open && (
                        <tr>
                          <td colSpan={6} className="p-0">
                            <table className="w-full">
                              <tbody>{year.rows.map((row) => monthRow(row, true))}</tbody>
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
