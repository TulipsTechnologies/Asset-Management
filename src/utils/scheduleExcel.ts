import * as XLSX from 'xlsx-js-style';
import {
  IDepreciationReport,
  IReportYear,
  OPENING_SOURCE_LABEL,
  TEra,
} from '@/utils/depreciationReport';

/**
 * The Depreciation Schedule as a workbook.
 *
 * Renders `IDepreciationReport` and nothing else — no depreciation arithmetic happens here,
 * only totalling of the figures the report already produced, so the workbook can never
 * disagree with the dialog or the print sheet.
 *
 * Every amount lands as a real number carrying a display format, never as pre-formatted
 * text: an auditor selects a column and Excel foots it. A workbook of strings looks the
 * same on screen and is useless the moment anyone tries to check it.
 */

export interface IScheduleExportContext {
  companyName: string;
  assetCode: string;
  assetName: string;
  assetCategory?: string | null;
  generatedBy: string;
  generatedOn: Date;
  includeForecast: boolean;
}

/** Number formats — the value stays a number, only its presentation is decorated. */
const MONEY = '#,##0.00';
const COUNT = '0';

const COLORS = {
  titleBg: '1F4E78',
  titleText: 'FFFFFF',
  sectionBg: '2E75B6',
  sectionText: 'FFFFFF',
  tableHeadBg: 'DEEBF7',
  tableHeadText: '0B3559',
  labelBg: 'F2F4F7',
  labelText: '1F2937',
  valueText: '1F2937',
  mutedText: '6B7280',
  totalBg: 'FFE699',
  totalText: '7F5F00',
  highlightBg: 'C6EFCE',
  highlightText: '0E5F1F',
  openingBg: 'F5EFE0',
  border: 'BFBFBF',
  titleBorder: '0F3450',
  totalBorder: 'C99A2E',
  highlightBorder: '4F8A4D',
};

type TStyle = Record<string, unknown>;

const edge = (style: string, rgb: string) => ({
  top: { style, color: { rgb } },
  bottom: { style, color: { rgb } },
  left: { style, color: { rgb } },
  right: { style, color: { rgb } },
});

const thinBorder = edge('thin', COLORS.border);
const titleBorder = edge('thin', COLORS.titleBorder);
const totalBorder = edge('medium', COLORS.totalBorder);
const highlightBorder = edge('medium', COLORS.highlightBorder);

const titleStyle: TStyle = {
  font: { name: 'Calibri', sz: 16, bold: true, color: { rgb: COLORS.titleText } },
  fill: { patternType: 'solid', fgColor: { rgb: COLORS.titleBg } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: titleBorder,
};

const subtitleStyle: TStyle = {
  font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: COLORS.tableHeadText } },
  fill: { patternType: 'solid', fgColor: { rgb: COLORS.tableHeadBg } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: thinBorder,
};

const sectionStyle: TStyle = {
  font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: COLORS.sectionText } },
  fill: { patternType: 'solid', fgColor: { rgb: COLORS.sectionBg } },
  alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
  border: thinBorder,
};

const noteStyle: TStyle = {
  font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: COLORS.mutedText } },
  alignment: { horizontal: 'left', vertical: 'center', wrapText: true, indent: 1 },
};

const labelStyle: TStyle = {
  font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: COLORS.labelText } },
  fill: { patternType: 'solid', fgColor: { rgb: COLORS.labelBg } },
  alignment: { horizontal: 'left', vertical: 'center', wrapText: true, indent: 1 },
  border: thinBorder,
};

const valueStyle: TStyle = {
  font: { name: 'Calibri', sz: 11, color: { rgb: COLORS.valueText } },
  alignment: { horizontal: 'left', vertical: 'center', wrapText: true, indent: 1 },
  border: thinBorder,
};

const headTextStyle: TStyle = {
  font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: COLORS.tableHeadText } },
  fill: { patternType: 'solid', fgColor: { rgb: COLORS.tableHeadBg } },
  alignment: { horizontal: 'left', vertical: 'center', wrapText: true, indent: 1 },
  border: thinBorder,
};

const headNumberStyle: TStyle = {
  ...headTextStyle,
  alignment: { horizontal: 'right', vertical: 'center', wrapText: true, indent: 1 },
};

const cellStyle: TStyle = {
  font: { name: 'Calibri', sz: 11, color: { rgb: COLORS.valueText } },
  alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
  border: thinBorder,
};

const dateStyle: TStyle = {
  ...cellStyle,
  alignment: { horizontal: 'center', vertical: 'center' },
};

const moneyStyle: TStyle = {
  ...cellStyle,
  alignment: { horizontal: 'right', vertical: 'center', indent: 1 },
  numFmt: MONEY,
};

const countStyle: TStyle = {
  ...cellStyle,
  alignment: { horizontal: 'right', vertical: 'center', indent: 1 },
  numFmt: COUNT,
};

const openingTint = (style: TStyle): TStyle => ({
  ...style,
  fill: { patternType: 'solid', fgColor: { rgb: COLORS.openingBg } },
  font: { name: 'Calibri', sz: 11, italic: true, color: { rgb: COLORS.valueText } },
});

const totalTextStyle: TStyle = {
  font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: COLORS.totalText } },
  fill: { patternType: 'solid', fgColor: { rgb: COLORS.totalBg } },
  alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
  border: totalBorder,
};

const totalMoneyStyle: TStyle = {
  ...totalTextStyle,
  alignment: { horizontal: 'right', vertical: 'center', indent: 1 },
  numFmt: MONEY,
};

const totalCountStyle: TStyle = {
  ...totalTextStyle,
  alignment: { horizontal: 'right', vertical: 'center', indent: 1 },
  numFmt: COUNT,
};

const highlightLabelStyle: TStyle = {
  font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: COLORS.highlightText } },
  fill: { patternType: 'solid', fgColor: { rgb: COLORS.highlightBg } },
  alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
  border: highlightBorder,
};

const highlightMoneyStyle: TStyle = {
  ...highlightLabelStyle,
  alignment: { horizontal: 'right', vertical: 'center', indent: 1 },
  numFmt: MONEY,
};

const str = (value: string | null | undefined, style: TStyle): XLSX.CellObject => ({
  v: value == null ? '' : String(value),
  t: 's',
  s: style,
});

/**
 * The load-bearing helper. `t: 'n'` is what makes SUM(), subtotals and pivot tables work
 * downstream; the thousands separator and the two decimals come from the style's numFmt,
 * so nothing about the value is lost to presentation. A non-finite figure would poison the
 * column, so it falls back to zero rather than writing `NaN` into the sheet.
 */
const num = (value: number | null | undefined, style: TStyle): XLSX.CellObject => {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return { v: n, t: 'n', s: style };
};

/** A cell with no figure at all — distinct from a zero, which would be a claim. */
const blank = (style: TStyle): XLSX.CellObject => str('', style);

const dash = (value: string | null | undefined) => (value && value.length > 0 ? value : '—');

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Local calendar parts, not toISOString — a UTC shift would misdate an evening export. */
const isoDate = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const isoDateTime = (date: Date) =>
  `${isoDate(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

const SECTION_LABEL: Record<TEra, string> = {
  history: 'History',
  current: 'Current',
  forecast: 'Forecast',
};

/** Accumulates rows, merges and heights for one sheet, padding every row to full width. */
const sheetBuilder = (columns: number) => {
  const rows: XLSX.CellObject[][] = [];
  const merges: XLSX.Range[] = [];
  const heights: XLSX.RowInfo[] = [];

  const push = (row: XLSX.CellObject[], height = 20, filler: TStyle = {}) => {
    const padded = [...row];
    while (padded.length < columns) padded.push(blank(filler));
    rows.push(padded);
    heights.push({ hpt: height });
  };

  /** One value stretched across the sheet — banners and section bars. */
  const pushMerged = (value: string, style: TStyle, height = 22) => {
    push([str(value, style)], height, style);
    merges.push({
      s: { r: rows.length - 1, c: 0 },
      e: { r: rows.length - 1, c: columns - 1 },
    });
  };

  const spacer = (height = 6) => push([], height);

  const build = (widths: number[]): XLSX.WorkSheet => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = widths.map((wch) => ({ wch }));
    ws['!rows'] = heights;
    ws['!merges'] = merges;
    ws['!sheetView'] = [{ showGridLines: false }];
    return ws;
  };

  return { push, pushMerged, spacer, build };
};

const buildSummarySheet = (
  report: IDepreciationReport,
  context: IScheduleExportContext
): XLSX.WorkSheet => {
  const { summary, openingLine } = report;
  const sheet = sheetBuilder(2);

  const textRow = (label: string, value: string | null | undefined) =>
    sheet.push([str(label, labelStyle), str(dash(value), valueStyle)], 22);
  const moneyRow = (label: string, value: number) =>
    sheet.push([str(label, labelStyle), num(value, moneyStyle)], 22);
  const countRow = (label: string, value: number | null | undefined) =>
    value == null
      ? textRow(label, null)
      : sheet.push([str(label, labelStyle), num(value, countStyle)], 22);

  sheet.pushMerged('Depreciation Schedule', titleStyle, 30);
  sheet.pushMerged(context.companyName, subtitleStyle);
  sheet.pushMerged(`${context.assetCode} — ${context.assetName}`, subtitleStyle);
  sheet.spacer();

  sheet.pushMerged('Asset & Book', sectionStyle, 24);
  textRow('Asset Code', context.assetCode);
  textRow('Asset Name', context.assetName);
  textRow('Category', context.assetCategory);
  textRow('Depreciation Method', summary.methodName);
  textRow('Annual Rate', summary.annualRate);
  textRow('Convention', summary.convention);
  moneyRow('Cost', summary.cost);
  moneyRow('Residual Value', summary.residualValue);
  countRow('Useful Life (Months)', summary.usefulLifeMonths);
  textRow('Available for Use', summary.availableForUseDate);
  textRow(
    'Opening Balance Source',
    openingLine
      ? `${OPENING_SOURCE_LABEL[openingLine.source]}${
          openingLine.throughDate ? ` through ${openingLine.throughDate}` : ''
        }`
      : OPENING_SOURCE_LABEL.system
  );
  sheet.spacer();

  sheet.pushMerged('Report', sectionStyle, 24);
  textRow('As Of', summary.asOfDate);
  textRow('Scope', context.includeForecast ? 'Forecast included' : 'Forecast excluded');
  textRow('Generated On', isoDateTime(context.generatedOn));
  textRow('Generated By', context.generatedBy);
  sheet.spacer();

  sheet.pushMerged('Key Figures', sectionStyle, 24);
  moneyRow('Cost', summary.cost);
  moneyRow(`Accumulated Depreciation (through ${summary.asOfDate})`, summary.accumulated);
  sheet.push(
    [str('Current Book Value', highlightLabelStyle), num(summary.currentBookValue, highlightMoneyStyle)],
    26
  );
  textRow('Last Closed Fiscal Year', summary.lastClosedFiscalYear);
  textRow('Current Fiscal Year', summary.currentFiscalYear);
  moneyRow('Current Fiscal Year Depreciation', summary.currentFiscalYearCharge);
  textRow('Charged Through', summary.chargedThrough);

  if (!context.includeForecast) {
    sheet.spacer();
    sheet.pushMerged(
      'Forecast excluded — this export covers the record only (history and the current fiscal year).',
      noteStyle,
      18
    );
  }

  return sheet.build([38, 30]);
};

/** One rendered line of the fiscal-year schedule, opening balance included. */
interface ILedgerRow {
  code: string;
  from: string | null;
  to: string | null;
  section: string;
  months: number;
  /** Null on the opening line: a brought-forward position has no opening NBV of its own. */
  opening: number | null;
  charge: number;
  accumulated: number;
  closing: number;
  status: string;
  isOpening: boolean;
}

const yearStatus = (year: IReportYear) => {
  if (year.era === 'forecast') return 'Forecast — estimate, not in the record';
  const posted = `${year.postedCount} of ${year.monthsInYear} months posted`;
  return year.partial ? `${posted} · partial year` : posted;
};

const buildLedgerRows = (
  report: IDepreciationReport,
  years: IReportYear[],
  context: IScheduleExportContext
): ILedgerRow[] => {
  const rows: ILedgerRow[] = [];

  if (report.openingLine) {
    const line = report.openingLine;
    rows.push({
      code: 'Opening Balance',
      from: null,
      to: line.throughDate,
      section: 'Opening',
      months: 0,
      opening: null,
      // Zero, not the brought-forward accumulated: this line is a carried position, and
      // charging it here would double-count it against the years that follow.
      charge: 0,
      accumulated: line.accumulated,
      closing: line.netBookValue,
      status: `${OPENING_SOURCE_LABEL[line.source]}${
        line.throughDate ? ` through ${line.throughDate}` : ''
      }`,
      isOpening: true,
    });
  }

  for (const year of years) {
    rows.push({
      code: year.fiscalYearCode,
      from: year.startDate ?? null,
      to: year.endDate ?? null,
      section: SECTION_LABEL[year.era],
      // The months this row's CHARGE covers — `monthsInYear` counts stored periods, so a
      // part-elapsed current year printed 12 beside a charge covering only the elapsed ones.
      months:
        year.era === 'forecast' || context.includeForecast
          ? year.monthsInYear
          : year.months.filter((month) => month.inRecord).length,
      opening: year.openingNbv,
      charge: year.charge,
      accumulated: year.accumulated,
      closing: year.closingNbv,
      status: yearStatus(year),
      isOpening: false,
    });
  }

  return rows;
};

const YEAR_HEADERS = [
  'Fiscal Year',
  'Period From',
  'Period To',
  'Section',
  'Months',
  'Opening NBV',
  'Depreciation',
  'Accumulated',
  'Closing NBV',
  'Status',
];

const buildYearSheet = (
  report: IDepreciationReport,
  context: IScheduleExportContext,
  years: IReportYear[]
): XLSX.WorkSheet => {
  const sheet = sheetBuilder(YEAR_HEADERS.length);
  const rows = buildLedgerRows(report, years, context);

  sheet.pushMerged(
    `Fiscal Year Schedule — ${context.assetCode} ${context.assetName} (as of ${report.summary.asOfDate})`,
    titleStyle,
    28
  );
  sheet.push(
    YEAR_HEADERS.map((head, index) =>
      str(head, index >= 4 && index <= 8 ? headNumberStyle : headTextStyle)
    ),
    26
  );

  for (const row of rows) {
    const tint = (style: TStyle) => (row.isOpening ? openingTint(style) : style);
    sheet.push([
      str(row.code, tint(cellStyle)),
      str(dash(row.from), tint(dateStyle)),
      str(dash(row.to), tint(dateStyle)),
      str(row.section, tint(cellStyle)),
      num(row.months, tint(countStyle)),
      row.opening == null ? blank(tint(moneyStyle)) : num(row.opening, tint(moneyStyle)),
      num(row.charge, tint(moneyStyle)),
      num(row.accumulated, tint(moneyStyle)),
      num(row.closing, tint(moneyStyle)),
      str(row.status, tint(cellStyle)),
    ]);
  }

  // Foots exactly the column above it, so the auditor's own SUM over the range matches the
  // printed total to the cent. Opening and closing come from the endpoints, never re-derived.
  if (rows.length > 0) {
    const last = rows[rows.length - 1];
    const firstWithOpening = rows.find((row) => row.opening != null);
    sheet.push(
      [
        str('TOTAL', totalTextStyle),
        blank(totalTextStyle),
        blank(totalTextStyle),
        blank(totalTextStyle),
        num(
          rows.reduce((sum, row) => sum + row.months, 0),
          totalCountStyle
        ),
        firstWithOpening
          ? num(firstWithOpening.opening, totalMoneyStyle)
          : blank(totalMoneyStyle),
        num(
          rows.reduce((sum, row) => sum + row.charge, 0),
          totalMoneyStyle
        ),
        num(last.accumulated, totalMoneyStyle),
        num(last.closing, totalMoneyStyle),
        str(
          context.includeForecast ? 'History + current + forecast' : 'Record only',
          totalTextStyle
        ),
      ],
      24
    );
  }

  return sheet.build([16, 13, 13, 12, 9, 16, 16, 16, 16, 34]);
};

const MONTH_HEADERS = [
  'Fiscal Year',
  'Period',
  'Month',
  'From',
  'To',
  'Days',
  'Opening NBV',
  'Depreciation',
  'Accumulated',
  'Closing NBV',
  'Posted',
];

const buildMonthSheet = (
  report: IDepreciationReport,
  context: IScheduleExportContext,
  years: IReportYear[]
): XLSX.WorkSheet => {
  const sheet = sheetBuilder(MONTH_HEADERS.length);
  // Only the months this export actually counts. Without the inRecord filter the current
  // year's post-as-of periods were exported unmarked, and this sheet's TOTAL then
  // disagreed with the year sheet and the summary in the same workbook.
  const months = years.flatMap((year) =>
    year.era === 'forecast' || context.includeForecast
      ? year.months
      : year.months.filter((month) => month.inRecord)
  );

  sheet.pushMerged(
    `Monthly Detail — ${context.assetCode} ${context.assetName} (as of ${report.summary.asOfDate})`,
    titleStyle,
    28
  );
  sheet.push(
    MONTH_HEADERS.map((head, index) =>
      str(head, index === 1 || (index >= 5 && index <= 9) ? headNumberStyle : headTextStyle)
    ),
    26
  );

  for (const month of months) {
    sheet.push([
      str(month.fiscalYearCode, cellStyle),
      num(month.periodOrdinal, countStyle),
      str(dash(month.monthName), cellStyle),
      str(dash(month.startDate), dateStyle),
      str(dash(month.endDate), dateStyle),
      // Charged days are absent on a full period; a zero there would read as "nothing charged".
      month.chargedDays == null ? blank(countStyle) : num(month.chargedDays, countStyle),
      num(month.openingNbv, moneyStyle),
      num(month.charge, moneyStyle),
      num(month.accumulated, moneyStyle),
      num(month.closingNbv, moneyStyle),
      str(month.isPosted ? 'Posted' : 'Not posted', cellStyle),
    ]);
  }

  if (months.length > 0) {
    const last = months[months.length - 1];
    sheet.push(
      [
        str('TOTAL', totalTextStyle),
        blank(totalTextStyle),
        blank(totalTextStyle),
        blank(totalTextStyle),
        // 'Days' foots charged DAYS, never a month count — a count here read as a day
        // total under that heading.
        blank(totalCountStyle),
        num(months[0].openingNbv, totalMoneyStyle),
        num(
          months.reduce((sum, month) => sum + month.charge, 0),
          totalMoneyStyle
        ),
        num(last.accumulated, totalMoneyStyle),
        num(last.closingNbv, totalMoneyStyle),
        str(
          `${months.filter((month) => month.isPosted).length} posted`,
          totalTextStyle
        ),
      ],
      24
    );
  }

  return sheet.build([14, 9, 14, 13, 13, 8, 16, 16, 16, 16, 13]);
};

const buildTotalsSheet = (
  report: IDepreciationReport,
  context: IScheduleExportContext
): XLSX.WorkSheet => {
  const { summary, totals } = report;
  const sheet = sheetBuilder(2);

  const textRow = (label: string, value: string | null | undefined) =>
    sheet.push([str(label, labelStyle), str(dash(value), valueStyle)], 22);
  const moneyRow = (label: string, value: number) =>
    sheet.push([str(label, labelStyle), num(value, moneyStyle)], 22);
  const countRow = (label: string, value: number) =>
    sheet.push([str(label, labelStyle), num(value, countStyle)], 22);

  sheet.pushMerged('Reconciliation', titleStyle, 28);
  sheet.pushMerged(`${context.assetCode} — ${context.assetName}`, subtitleStyle);
  sheet.spacer();

  sheet.pushMerged('Charged', sectionStyle, 24);
  moneyRow('Total charged in the record', totals.recordCharge);
  countRow('Months in the record', totals.recordMonths);
  moneyRow('Total in the stored schedule', totals.scheduleCharge);
  countRow('Months in the stored schedule', totals.scheduleMonths);
  sheet.spacer();

  sheet.pushMerged('Closing Position', sectionStyle, 24);
  moneyRow('Cost', summary.cost);
  moneyRow(`Accumulated depreciation (through ${summary.asOfDate})`, summary.accumulated);
  sheet.push(
    [str('Current book value', highlightLabelStyle), num(summary.currentBookValue, highlightMoneyStyle)],
    26
  );
  moneyRow('Residual value', summary.residualValue);
  textRow('Charged through', summary.chargedThrough);
  textRow('As of', summary.asOfDate);
  sheet.spacer();

  // The stored-schedule figures always span the whole schedule, forecast tail included —
  // worth saying, because the other sheets may have dropped those years.
  sheet.pushMerged(
    'Record figures cover history and the current fiscal year through the as-of date. Stored-schedule figures cover every row held, including forecast years.',
    noteStyle,
    30
  );
  if (!context.includeForecast) {
    sheet.pushMerged(
      'Forecast excluded — forecast years do not appear on the schedule sheets.',
      noteStyle,
      18
    );
  }

  return sheet.build([46, 24]);
};

/** Safe for a filename on every platform, and still recognisable as the asset code. */
const sanitise = (value: string) =>
  value.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'Asset';

export const exportScheduleToExcel = (
  report: IDepreciationReport,
  context: IScheduleExportContext
): void => {
  const generatedOn = Number.isNaN(context.generatedOn.getTime())
    ? new Date()
    : context.generatedOn;
  const stamped = { ...context, generatedOn };

  // The record first, then the forecast tail only when it was asked for.
  const years: IReportYear[] = [
    ...report.history,
    ...(report.current ? [report.current] : []),
    ...(context.includeForecast ? report.forecast : []),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSummarySheet(report, stamped), 'Summary');
  XLSX.utils.book_append_sheet(
    wb,
    buildYearSheet(report, stamped, years),
    'Fiscal Year Schedule'
  );
  XLSX.utils.book_append_sheet(wb, buildMonthSheet(report, stamped, years), 'Monthly Detail');
  XLSX.utils.book_append_sheet(wb, buildTotalsSheet(report, stamped), 'Totals');

  XLSX.writeFile(
    wb,
    `Depreciation-Schedule_${sanitise(context.assetCode)}_${isoDate(generatedOn)}.xlsx`,
    { bookType: 'xlsx', compression: true }
  );
};
