import {
  IAssetBook,
  IDepreciationSchedule,
  IFiscalPeriod,
} from '@/interface/IDepreciation';

/**
 * The Depreciation Schedule's report model.
 *
 * One place turns the server's rows into what the dialog, the print sheet, the Excel
 * workbook and the PDF all render, so those four can never disagree. It performs NO
 * depreciation arithmetic: every amount here is a figure the server computed (row.amount,
 * row.cumulativeAmount, book.cost). Years are sums and endpoint-cumulatives of the server's
 * own monthly rows, grouped by the fiscal year the server already stamped on each row.
 */

/** Where a book's opening position came from — it decides how history is presented. */
export type TOpeningSource = 'system' | 'manual' | 'import';

export type TEra = 'history' | 'current' | 'forecast';

export interface IReportMonth {
  fiscalYearCode: string;
  periodOrdinal: number;
  monthName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  chargedDays?: number | null;
  openingNbv: number;
  charge: number;
  accumulated: number;
  closingNbv: number;
  isPosted: boolean;
  /** Inside the record (period ended by the as-of date, or already posted). */
  inRecord: boolean;
}

export interface IReportYear {
  fiscalYearCode: string;
  era: TEra;
  startDate?: string | null;
  endDate?: string | null;
  /** Months shown for this year under the active filter. */
  months: IReportMonth[];
  monthsInYear: number;
  openingNbv: number;
  charge: number;
  accumulated: number;
  closingNbv: number;
  postedCount: number;
  /** True when this year is only partly counted because the as-of date falls inside it. */
  partial: boolean;
}

export interface IReportSummary {
  cost: number;
  currencyId?: string | null;
  accumulated: number;
  currentBookValue: number;
  lastClosedFiscalYear: string | null;
  currentFiscalYear: string | null;
  currentFiscalYearCharge: number;
  chargedThrough: string | null;
  methodName: string;
  annualRate: string | null;
  convention: string;
  residualValue: number;
  usefulLifeMonths?: number | null;
  availableForUseDate?: string | null;
  asOfDate: string;
}

export interface IOpeningBalanceLine {
  source: TOpeningSource;
  accumulated: number;
  netBookValue: number;
  throughDate: string | null;
}

export interface IDepreciationReport {
  summary: IReportSummary;
  /** Present only for a manual/imported opening balance — history is unknown there. */
  openingLine: IOpeningBalanceLine | null;
  /** Fiscal years already ended by the as-of date. Empty when an opening line stands in. */
  history: IReportYear[];
  /** The fiscal year containing the as-of date, counted only through that date. */
  current: IReportYear | null;
  /** Years starting after the as-of date. Estimates — never part of the record. */
  forecast: IReportYear[];
  /**
   * True when the fiscal calendar did not cover every year the schedule references, so
   * some rows could not be placed in time. Consumers must say so rather than present a
   * silently shortened schedule.
   */
  calendarIncomplete: boolean;
  totals: {
    /** Charged within the record (history + current), excluding any opening line. */
    recordCharge: number;
    /** Everything the stored schedule holds, including the forecast tail. */
    scheduleCharge: number;
    recordMonths: number;
    scheduleMonths: number;

    /**
     * The footed totals every surface must print — computed here so none of them has to
     * re-derive an endpoint from a display-ordered list. The screen and the print sheet
     * deliberately show the CURRENT year first, so "the last row" is not the last period;
     * taking endpoints from it reported a closed year's position under an as-of caption.
     */
    countedMonths: number;
    countedCharge: number;
    closingAccumulated: number;
    closingNetBookValue: number;
  };
}

const iso = (value?: string | null) => (value ? value.slice(0, 10) : null);

/**
 * How the book's opening position arrived. A book that never carried one computed its own
 * history, so its historical fiscal years are real rows and must be shown individually;
 * a manual or imported balance has no such history to show.
 */
export const resolveOpeningSource = (book: IAssetBook): TOpeningSource => {
  // No adopted balance means the register computed the history itself, whatever the server
  // called it — checked FIRST so a book can never be shown an "opening balance" of zero
  // standing in for fiscal years that actually exist and are worth reading.
  if (!book.openingAccumulatedDepreciation || book.openingAccumulatedDepreciation <= 0)
    return 'system';

  // Otherwise the server distinguishes an import from a typed entry (older responses may
  // omit the field; a typed entry is the safe assumption since the balance is real).
  return book.openingBalanceOrigin === 'Imported' ? 'import' : 'manual';
};

export const OPENING_SOURCE_LABEL: Record<TOpeningSource, string> = {
  system: 'System-calculated',
  manual: 'Manual entry',
  import: 'Imported',
};

/** The rate line in the operator's own terms — never a bare factor. */
export const rateLabel = (book: IAssetBook): string | null => {
  const rateBased =
    book.depreciationMethodCode === 'DecliningBalance' ||
    book.depreciationMethodCode === 'WrittenDownValue';
  if (!rateBased) return null;
  if (book.annualRatePercent != null) return `${book.annualRatePercent}% a year`;
  if (book.usefulLifeMonths)
    return `${((book.decliningBalanceFactor / (book.usefulLifeMonths / 12)) * 100).toFixed(
      1
    )}% a year (derived, legacy setup)`;
  return null;
};

export const buildDepreciationReport = ({
  book,
  schedule,
  periods,
  asOfDate,
  conventionLabel,
  includeForecast = false,
}: {
  book: IAssetBook;
  schedule: IDepreciationSchedule[];
  periods: Map<string, IFiscalPeriod>;
  asOfDate: string;
  conventionLabel: string;
  /**
   * When the forecast is being shown, the CURRENT year is counted in full too — otherwise
   * its rows would stop at the as-of date while later years were counted whole, and the
   * table's depreciation column would not reconcile with its accumulated column. The
   * SUMMARY stays record-based either way: a projection must never move the book value.
   */
  includeForecast?: boolean;
}): IDepreciationReport => {
  const cost = book.cost;
  const periodOf = (row: IDepreciationSchedule) =>
    periods.get(`${row.fiscalYearCode}·${row.periodOrdinal}`);

  // Fiscal-year boundaries come from the configured calendar, never from arithmetic.
  const yearStart = new Map<string, string>();
  const yearEnd = new Map<string, string>();
  for (const period of periods.values()) {
    const start = iso(period.startDate);
    const end = iso(period.endDate);
    if (start) {
      const held = yearStart.get(period.fiscalYearCode);
      if (!held || start < held) yearStart.set(period.fiscalYearCode, start);
    }
    if (end) {
      const held = yearEnd.get(period.fiscalYearCode);
      if (!held || end > held) yearEnd.set(period.fiscalYearCode, end);
    }
  }

  /** A row is in the record once its period has ended — or once it is posted. */
  const inRecord = (row: IDepreciationSchedule) => {
    if (row.isPosted) return true;
    const end = iso(periodOf(row)?.endDate);
    return end != null && end <= asOfDate;
  };

  const grouped = new Map<string, IDepreciationSchedule[]>();
  for (const row of schedule) {
    const list = grouped.get(row.fiscalYearCode) ?? [];
    list.push(row);
    grouped.set(row.fiscalYearCode, list);
  }

  const years: IReportYear[] = [...grouped.entries()]
    .map(([fiscalYearCode, rows]) => {
      const ordered = [...rows].sort((a, b) => a.periodOrdinal - b.periodOrdinal);
      const start = yearStart.get(fiscalYearCode) ?? null;
      const end = yearEnd.get(fiscalYearCode) ?? null;

      // A year with no periods in the calendar cannot be placed in time. It is treated as
      // history so it still APPEARS — dropping it silently is the worst outcome, and only
      // one year may hold the 'current' slot, so falling through to 'current' would have
      // deleted every such year from every view (the calendarIncomplete flag warns).
      const boundariesKnown = start != null && end != null;
      const era: TEra = !boundariesKnown
        ? 'history'
        : end! <= asOfDate
          ? 'history'
          : start! > asOfDate
            ? 'forecast'
            : 'current';

      const months: IReportMonth[] = ordered.map((row) => {
        const period = periodOf(row);
        return {
          fiscalYearCode: row.fiscalYearCode,
          periodOrdinal: row.periodOrdinal,
          monthName: period?.monthName ?? null,
          startDate: iso(period?.startDate),
          endDate: iso(period?.endDate),
          chargedDays: row.chargedDays ?? null,
          openingNbv: cost - (row.cumulativeAmount - row.amount),
          charge: row.amount,
          accumulated: row.cumulativeAmount,
          closingNbv: cost - row.cumulativeAmount,
          isPosted: row.isPosted,
          inRecord: inRecord(row),
        };
      });

      // The year opens where its first stored row opens, whether or not that row is in
      // the record — that is the position carried into the year.
      const openingAccumulated = ordered[0].cumulativeAmount - ordered[0].amount;
      const counted =
        era === 'forecast' || includeForecast ? months : months.filter((m) => m.inRecord);
      const closingAccumulated =
        counted.length > 0 ? counted[counted.length - 1].accumulated : openingAccumulated;

      return {
        fiscalYearCode,
        era,
        startDate: start,
        endDate: end,
        months,
        monthsInYear: months.length,
        openingNbv: cost - openingAccumulated,
        charge: counted.reduce((sum, m) => sum + m.charge, 0),
        accumulated: closingAccumulated,
        closingNbv: cost - closingAccumulated,
        postedCount: months.filter((m) => m.isPosted).length,
        partial: era === 'current' && counted.length < months.length,
      };
    })
    .sort((a, b) => (a.startDate ?? a.fiscalYearCode).localeCompare(b.startDate ?? b.fiscalYearCode));

  const history = years.filter((y) => y.era === 'history');
  const current = years.find((y) => y.era === 'current') ?? null;
  const forecast = years.filter((y) => y.era === 'forecast');

  const source = resolveOpeningSource(book);
  const openingLine: IOpeningBalanceLine | null =
    source === 'system'
      ? null
      : {
          source,
          accumulated: book.openingAccumulatedDepreciation,
          netBookValue: cost - book.openingAccumulatedDepreciation,
          throughDate: iso(book.lastDepreciationThroughDate),
        };

  // Accumulated through the as-of date: the last record row's cumulative, else the
  // position the schedule opens at (a cutover book with nothing charged yet), else the
  // book's own accumulated figure (no schedule at all — method None).
  const recordRows = schedule.filter(inRecord);
  const accumulated =
    recordRows.length > 0
      ? recordRows[recordRows.length - 1].cumulativeAmount
      : schedule.length > 0
        ? schedule[0].cumulativeAmount - schedule[0].amount
        : book.accumulatedDepreciation;

  const lastClosed = [...yearEnd.entries()]
    .filter(([, end]) => end <= asOfDate)
    .sort((a, b) => a[1].localeCompare(b[1]))
    .pop();

  // Charged through: the last posted period's end, else the book's cutover anchor.
  const posted = schedule.filter((r) => r.isPosted);
  const chargedThrough =
    (posted.length > 0 ? iso(periodOf(posted[posted.length - 1])?.endDate) : null) ??
    iso(book.lastDepreciationThroughDate);

  // Chronological, and limited to what the active mode actually counts — the one honest
  // basis for a footed total.
  const countedYears = includeForecast ? years : [...history, ...(current ? [current] : [])];
  const countedMonthsOf = (year: IReportYear) =>
    year.era === 'forecast' || includeForecast
      ? year.months
      : year.months.filter((m) => m.inRecord);

  const countedMonths = countedYears.reduce((n, y) => n + countedMonthsOf(y).length, 0);
  const countedCharge = countedYears.reduce((sum, y) => sum + y.charge, 0);
  // Without the forecast the endpoint IS the as-of position; with it, the last
  // chronological year's close.
  const closingAccumulated = includeForecast
    ? (countedYears[countedYears.length - 1]?.accumulated ?? accumulated)
    : accumulated;

  return {
    calendarIncomplete: years.some((y) => y.startDate == null || y.endDate == null),
    summary: {
      cost,
      currencyId: book.currencyId,
      accumulated,
      currentBookValue: cost - accumulated,
      lastClosedFiscalYear: lastClosed?.[0] ?? null,
      currentFiscalYear: current?.fiscalYearCode ?? null,
      // Always the charge INSIDE the record, even while the forecast is on screen —
      // "this year so far" is a reported figure and a projection must not move it.
      currentFiscalYearCharge:
        current?.months.filter((m) => m.inRecord).reduce((sum, m) => sum + m.charge, 0) ?? 0,
      chargedThrough,
      methodName: book.depreciationMethodName,
      annualRate: rateLabel(book),
      convention: conventionLabel,
      residualValue: book.residualValue,
      usefulLifeMonths: book.usefulLifeMonths,
      availableForUseDate: iso(book.availableForUseDate),
      asOfDate,
    },
    openingLine,
    history,
    current,
    forecast,
    totals: {
      recordCharge: [...history, ...(current ? [current] : [])].reduce(
        (sum, y) => sum + y.charge,
        0
      ),
      scheduleCharge: schedule.reduce((sum, r) => sum + r.amount, 0),
      recordMonths: recordRows.length,
      scheduleMonths: schedule.length,
      countedMonths,
      countedCharge,
      closingAccumulated,
      closingNetBookValue: cost - closingAccumulated,
    },
  };
};
