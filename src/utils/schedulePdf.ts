import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { RowInput, Styles } from 'jspdf-autotable';
import {
  IDepreciationReport,
  IReportMonth,
  IReportYear,
  OPENING_SOURCE_LABEL,
  TEra,
} from '@/utils/depreciationReport';

/**
 * The Depreciation Schedule as a working paper.
 *
 * Every figure printed here comes off IDepreciationReport — this file formats, it does not
 * calculate. The only sums it performs are the TOTAL row and the months behind it, which foot
 * the columns as printed; see `scheduleTotals` for why the model's own totals cannot serve.
 */

export interface ISchedulePdfContext {
  companyName: string;
  assetCode: string;
  assetName: string;
  assetCategory?: string | null;
  generatedBy: string;
  generatedOn: Date;
  includeForecast: boolean;
  includeMonthlyDetail: boolean;
}

type RGB = [number, number, number];

const INK: RGB = [33, 37, 41];
const MUTED: RGB = [108, 117, 125];
/** Forecast and post-as-of rows. Light enough to read as "not yet real" at a glance. */
const ESTIMATE: RGB = [132, 140, 150];
const HEAD_FILL: RGB = [45, 55, 72];
const HEAD_INK: RGB = [255, 255, 255];
const RULE: RGB = [206, 212, 218];
const PANEL: RGB = [244, 246, 248];
const STRIPE: RGB = [250, 251, 252];
const TOTAL_FILL: RGB = [232, 236, 240];

const MARGIN_X = 14;
const MARGIN_TOP = 14;
/** Height kept clear at the foot of every page for the stamped footer block. */
const FOOTER_RESERVE = 18;
/**
 * Heading + header row + two body rows. A year's heading is drawn by hand, so autoTable has no
 * idea it belongs to the table below it and will happily leave it stranded on the last line of
 * a page. Nothing starts unless this much room is left.
 */
const MIN_YEAR_BLOCK = 24;

const AMOUNT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const money = (value: number) => (Number.isFinite(value) ? AMOUNT.format(value) : '—');

const dateText = (value?: string | null) => (value ? value.slice(0, 10) : '—');

const pad = (value: number) => String(value).padStart(2, '0');

const dayOf = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const timestamp = (date: Date) =>
  `${dayOf(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;

/** Safe for a filename on any of the three desktop platforms, never empty. */
const sanitise = (value: string) =>
  value
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '') || 'Asset';

const SECTION_LABEL: Record<TEra, string> = {
  history: 'History',
  current: 'Current',
  forecast: 'Forecast',
};

/**
 * Months standing behind a year's charge. Mirrors the report model's own rule — a forecast year
 * counts everything it holds, anything else counts only what is in the record — so a
 * part-elapsed current year cannot claim twelve months against an eight-month figure.
 */
const countedMonths = (year: IReportYear, includeForecast: boolean) =>
  year.era === 'forecast' || includeForecast
    ? year.monthsInYear
    : year.months.filter((m) => m.inRecord).length;

const yearStatus = (year: IReportYear, includeForecast: boolean): string => {
  if (year.era === 'forecast') return 'Estimated';
  // With the forecast on, the current year's figure is the whole projected year, so the
  // months behind it are all of them — and a year whose unelapsed periods are included is
  // never "Posted", however much of its elapsed part has been.
  if (year.era === 'current' && includeForecast && year.postedCount < year.monthsInYear)
    return year.postedCount === 0
      ? 'Projected'
      : `${year.postedCount} of ${year.monthsInYear} posted, rest projected`;

  const counted = countedMonths(year, includeForecast);
  if (counted === 0) return 'Nothing recorded';
  if (year.postedCount === 0) return 'Not posted';
  if (year.postedCount >= counted) return year.partial ? 'Posted to date' : 'Posted';
  return `${year.postedCount} of ${counted} posted`;
};

interface IColumn {
  header: string;
  /** Relative width. Shares are normalised across the printable width, so margins can move. */
  weight: number;
  halign?: 'left' | 'center' | 'right';
}

const columnStylesOf = (columns: IColumn[], contentWidth: number) => {
  const total = columns.reduce((sum, column) => sum + column.weight, 0);
  const styles: Record<string, Partial<Styles>> = {};
  columns.forEach((column, index) => {
    styles[index] = {
      cellWidth: (column.weight / total) * contentWidth,
      halign: column.halign ?? 'left',
    };
  });
  return styles;
};

const YEAR_COLUMNS: IColumn[] = [
  { header: 'Fiscal Year', weight: 20 },
  { header: 'Period', weight: 34 },
  { header: 'Section', weight: 17 },
  { header: 'Months', weight: 11, halign: 'center' },
  { header: 'Opening NBV', weight: 20, halign: 'right' },
  { header: 'Depreciation', weight: 20, halign: 'right' },
  { header: 'Accumulated', weight: 20, halign: 'right' },
  { header: 'Closing NBV', weight: 20, halign: 'right' },
  { header: 'Status', weight: 20 },
];

const MONTH_COLUMNS: IColumn[] = [
  { header: 'Period', weight: 10, halign: 'center' },
  { header: 'Month', weight: 18 },
  { header: 'From', weight: 18 },
  { header: 'To', weight: 18 },
  { header: 'Days', weight: 10, halign: 'center' },
  { header: 'Opening NBV', weight: 23, halign: 'right' },
  { header: 'Depreciation', weight: 22, halign: 'right' },
  { header: 'Accumulated', weight: 23, halign: 'right' },
  { header: 'Closing NBV', weight: 23, halign: 'right' },
  { header: 'Posted', weight: 17, halign: 'center' },
];

interface ILayout {
  doc: jsPDF;
  left: number;
  right: number;
  width: number;
  top: number;
  /** Last y a block may start at before it must move to a fresh page. */
  bottom: number;
  pageHeight: number;
}

const textColor = (doc: jsPDF, [r, g, b]: RGB) => doc.setTextColor(r, g, b);
const drawColor = (doc: jsPDF, [r, g, b]: RGB) => doc.setDrawColor(r, g, b);

/**
 * Where the last table finished. The plugin stamps the finished table onto the document but
 * ships no jsPDF type augmentation for it, and leaves it `false` until the first table runs.
 */
const afterTable = (doc: jsPDF, fallback: number) => {
  const stamped = (doc as jsPDF & { lastAutoTable?: { finalY?: number } | false }).lastAutoTable;
  return stamped && typeof stamped.finalY === 'number' ? stamped.finalY : fallback;
};

const breakIfShort = (layout: ILayout, y: number, needed: number) => {
  if (y + needed <= layout.bottom) return y;
  layout.doc.addPage();
  return layout.top;
};

const sectionHeading = (layout: ILayout, title: string, y: number, note?: string | null) => {
  const { doc } = layout;
  let cursor = breakIfShort(layout, y, MIN_YEAR_BLOCK);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  textColor(doc, INK);
  doc.text(title, layout.left, cursor);
  cursor += 2;

  drawColor(doc, RULE);
  doc.setLineWidth(0.3);
  doc.line(layout.left, cursor, layout.right, cursor);
  cursor += 4;

  if (note) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    textColor(doc, MUTED);
    doc.text(note, layout.left, cursor);
    cursor += 4;
  }

  return cursor;
};

const drawTitleBlock = (
  layout: ILayout,
  report: IDepreciationReport,
  context: ISchedulePdfContext
) => {
  const { doc } = layout;
  const { summary } = report;
  let y = layout.top + 3;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  textColor(doc, INK);
  doc.text(context.companyName, layout.left, y);
  y += 6.5;

  doc.setFontSize(11);
  doc.text('Depreciation Schedule', layout.left, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  textColor(doc, MUTED);
  doc.text(`As of ${dateText(summary.asOfDate)}`, layout.right, y, { align: 'right' });
  y += 2.4;

  drawColor(doc, RULE);
  doc.setLineWidth(0.5);
  doc.line(layout.left, y, layout.right, y);
  y += 5.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  textColor(doc, INK);
  doc.text(`${context.assetCode} — ${context.assetName}`, layout.left, y);

  if (context.assetCategory) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    textColor(doc, MUTED);
    doc.text(context.assetCategory, layout.right, y, { align: 'right' });
  }
  y += 3;

  const openingSource = report.openingLine
    ? OPENING_SOURCE_LABEL[report.openingLine.source]
    : OPENING_SOURCE_LABEL.system;

  const terms: Array<[string, string]> = [
    ['Method', summary.methodName],
    ['Annual rate', summary.annualRate ?? '—'],
    ['Convention', summary.convention],
    ['Cost', money(summary.cost)],
    ['Residual value', money(summary.residualValue)],
    ['Useful life', summary.usefulLifeMonths ? `${summary.usefulLifeMonths} months` : '—'],
    ['In service', dateText(summary.availableForUseDate)],
    ['Opening balance', openingSource],
  ];

  const termRows: RowInput[] = [];
  for (let i = 0; i < terms.length; i += 2) {
    const [labelA, valueA] = terms[i];
    const [labelB, valueB] = terms[i + 1] ?? ['', ''];
    termRows.push([labelA, valueA, labelB, valueB]);
  }

  autoTable(doc, {
    startY: y,
    theme: 'plain',
    margin: { left: layout.left, right: MARGIN_X, top: layout.top, bottom: FOOTER_RESERVE },
    body: termRows,
    styles: {
      fontSize: 8,
      cellPadding: { top: 0.7, bottom: 0.7, left: 0, right: 2 },
      textColor: INK,
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { cellWidth: layout.width * 0.16, textColor: MUTED },
      1: { cellWidth: layout.width * 0.34 },
      2: { cellWidth: layout.width * 0.16, textColor: MUTED },
      3: { cellWidth: layout.width * 0.34 },
    },
  });

  return afterTable(doc, y) + 6;
};

const drawSummaryPanel = (layout: ILayout, report: IDepreciationReport, y: number) => {
  const { doc } = layout;
  const { summary } = report;

  const cells: Array<[string | string[], string]> = [
    ['Cost', money(summary.cost)],
    [
      ['Accumulated Depreciation', `through ${dateText(summary.asOfDate)}`],
      money(summary.accumulated),
    ],
    ['Current Book Value', money(summary.currentBookValue)],
    ['Last Closed Fiscal Year', summary.lastClosedFiscalYear ?? '—'],
    [
      [
        'Current Fiscal-Year Depreciation',
        summary.currentFiscalYear ? `(${summary.currentFiscalYear})` : '(no open year)',
      ],
      money(summary.currentFiscalYearCharge),
    ],
    ['Charged Through', dateText(summary.chargedThrough)],
  ];

  const rows: RowInput[] = [];
  for (let i = 0; i < cells.length; i += 3) {
    rows.push(cells.slice(i, i + 3).flatMap(([label, value]) => [label, value]));
  }

  const labelWidth = layout.width * 0.185;
  const valueWidth = layout.width / 3 - labelWidth;

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    margin: { left: layout.left, right: MARGIN_X, top: layout.top, bottom: FOOTER_RESERVE },
    body: rows,
    styles: {
      fontSize: 9,
      cellPadding: 2,
      lineColor: RULE,
      lineWidth: 0.1,
      valign: 'middle',
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { cellWidth: labelWidth, fillColor: PANEL, textColor: MUTED, fontSize: 7.5 },
      1: { cellWidth: valueWidth, halign: 'right', fontStyle: 'bold', textColor: INK },
      2: { cellWidth: labelWidth, fillColor: PANEL, textColor: MUTED, fontSize: 7.5 },
      3: { cellWidth: valueWidth, halign: 'right', fontStyle: 'bold', textColor: INK },
      4: { cellWidth: labelWidth, fillColor: PANEL, textColor: MUTED, fontSize: 7.5 },
      5: { cellWidth: valueWidth, halign: 'right', fontStyle: 'bold', textColor: INK },
    },
  });

  return afterTable(doc, y) + 8;
};

interface IScheduleBody {
  rows: RowInput[];
  /** Body-row indices to render as estimates. */
  estimates: Set<number>;
  openingRow: number | null;
  foot: RowInput[];
}

/**
 * The year rows, and a TOTAL that foots the Depreciation column exactly as printed.
 *
 * `totals.scheduleCharge` is deliberately not used: it covers the whole stored schedule,
 * including the current year's months beyond the as-of date, which are not rows in this table.
 * A total that does not add up is worse than no total at all on a working paper.
 */
const buildScheduleBody = (
  report: IDepreciationReport,
  years: IReportYear[],
  includeForecast: boolean
): IScheduleBody => {
  const rows: RowInput[] = [];
  const estimates = new Set<number>();
  let openingRow: number | null = null;

  if (report.openingLine) {
    const { source, accumulated, netBookValue, throughDate } = report.openingLine;
    openingRow = rows.length;
    rows.push([
      'Opening Balance',
      throughDate ? `Through ${dateText(throughDate)}` : '—',
      OPENING_SOURCE_LABEL[source],
      '—',
      money(report.summary.cost),
      // Brought forward, not a charge of any period here — leaving it out of the column keeps
      // the TOTAL honest.
      '—',
      money(accumulated),
      money(netBookValue),
      'Brought forward',
    ]);
  }

  years.forEach((year) => {
    if (year.era === 'forecast') estimates.add(rows.length);
    rows.push([
      year.fiscalYearCode,
      `${dateText(year.startDate)} – ${dateText(year.endDate)}`,
      SECTION_LABEL[year.era],
      String(countedMonths(year, includeForecast)),
      money(year.openingNbv),
      money(year.charge),
      money(year.accumulated),
      money(year.closingNbv),
      yearStatus(year, includeForecast),
    ]);
  });

  const totalCharge = years.reduce((sum, year) => sum + year.charge, 0);
  const totalMonths = years.reduce((sum, year) => sum + countedMonths(year, includeForecast), 0);
  // Endpoints from the report, so every surface foots to the same close.
  const closingAccumulated = report.totals.closingAccumulated;
  const closingNbv = report.totals.closingNetBookValue;

  const foot: RowInput[] = [
    [
      'TOTAL',
      includeForecast
        ? 'Record and forecast'
        : `Record through ${dateText(report.summary.asOfDate)}`,
      '',
      String(totalMonths),
      '',
      money(totalCharge),
      money(closingAccumulated),
      money(closingNbv),
      '',
    ],
  ];

  return { rows, estimates, openingRow, foot };
};

const drawYearTable = (
  layout: ILayout,
  report: IDepreciationReport,
  years: IReportYear[],
  includeForecast: boolean,
  currencyNote: string,
  y: number
) => {
  const { doc } = layout;
  let cursor = sectionHeading(layout, 'Depreciation by Fiscal Year', y, currencyNote);

  const { rows, estimates, openingRow, foot } = buildScheduleBody(report, years, includeForecast);

  if (rows.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    textColor(doc, MUTED);
    doc.text('No depreciation rows fall within this report.', layout.left, cursor + 2);
    return cursor + 8;
  }

  autoTable(doc, {
    startY: cursor,
    theme: 'grid',
    margin: { left: layout.left, right: MARGIN_X, top: layout.top, bottom: FOOTER_RESERVE },
    rowPageBreak: 'avoid',
    showFoot: 'lastPage',
    head: [YEAR_COLUMNS.map((column) => column.header)],
    body: rows,
    foot,
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 1.6, bottom: 1.6, left: 1.4, right: 1.4 },
      lineColor: RULE,
      lineWidth: 0.1,
      textColor: INK,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: { fillColor: HEAD_FILL, textColor: HEAD_INK, fontStyle: 'bold', fontSize: 7.5 },
    footStyles: { fillColor: TOTAL_FILL, textColor: INK, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: STRIPE },
    columnStyles: columnStylesOf(YEAR_COLUMNS, layout.width),
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      if (estimates.has(data.row.index)) {
        data.cell.styles.textColor = ESTIMATE;
        data.cell.styles.fontStyle = 'italic';
      } else if (data.row.index === openingRow) {
        data.cell.styles.fillColor = PANEL;
        data.cell.styles.fontStyle = 'italic';
      }
    },
  });

  return afterTable(doc, cursor) + 5;
};

const drawMonthlySection = (
  layout: ILayout,
  years: IReportYear[],
  includeForecast: boolean,
  currencyNote: string,
  y: number
) => {
  const { doc } = layout;
  let cursor = sectionHeading(layout, 'Monthly Breakdown', y, currencyNote);

  years.forEach((year) => {
    // Without the forecast, a year shows only what is already in the record.
    const months = includeForecast ? year.months : year.months.filter((month) => month.inRecord);
    if (months.length === 0) return;

    cursor = breakIfShort(layout, cursor, MIN_YEAR_BLOCK);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    textColor(doc, INK);
    doc.text(
      `${year.fiscalYearCode} · ${SECTION_LABEL[year.era]} · ${dateText(year.startDate)} – ${dateText(year.endDate)}`,
      layout.left,
      cursor
    );
    cursor += 2.5;

    const estimates = new Set<number>();
    const rows: RowInput[] = months.map((month: IReportMonth, index) => {
      if (!month.inRecord) estimates.add(index);
      return [
        String(month.periodOrdinal),
        month.monthName ?? '—',
        dateText(month.startDate),
        dateText(month.endDate),
        month.chargedDays != null ? String(month.chargedDays) : '—',
        money(month.openingNbv),
        money(month.charge),
        money(month.accumulated),
        money(month.closingNbv),
        month.isPosted ? 'Yes' : month.inRecord ? 'No' : 'Estimate',
      ];
    });

    autoTable(doc, {
      startY: cursor,
      theme: 'grid',
      margin: { left: layout.left, right: MARGIN_X, top: layout.top, bottom: FOOTER_RESERVE },
      rowPageBreak: 'avoid',
      head: [MONTH_COLUMNS.map((column) => column.header)],
      body: rows,
      styles: {
        fontSize: 7,
        cellPadding: { top: 1.2, bottom: 1.2, left: 1.2, right: 1.2 },
        lineColor: RULE,
        lineWidth: 0.1,
        textColor: INK,
        overflow: 'linebreak',
        valign: 'middle',
      },
      headStyles: { fillColor: HEAD_FILL, textColor: HEAD_INK, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: STRIPE },
      columnStyles: columnStylesOf(MONTH_COLUMNS, layout.width),
      didParseCell: (data) => {
        if (data.section !== 'body' || !estimates.has(data.row.index)) return;
        data.cell.styles.textColor = ESTIMATE;
        data.cell.styles.fontStyle = 'italic';
      },
    });

    cursor = afterTable(doc, cursor) + 6;
  });

  return cursor;
};

/**
 * Footers are stamped in a second pass: the page count is only knowable once every table has
 * spilled as far as it is going to, so "of Y" cannot be written while the content is being laid
 * out. Walk the finished document and stamp each page.
 */
const stampFooters = (
  layout: ILayout,
  report: IDepreciationReport,
  context: ISchedulePdfContext
) => {
  const { doc } = layout;
  const pageCount = doc.getNumberOfPages();
  const baseline = layout.pageHeight - 11;

  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);

    drawColor(doc, RULE);
    doc.setLineWidth(0.3);
    doc.line(layout.left, baseline - 4, layout.right, baseline - 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    textColor(doc, MUTED);
    doc.text(
      `${context.companyName} · ${context.assetCode} · As of ${dateText(report.summary.asOfDate)}`,
      layout.left,
      baseline
    );
    doc.text(
      `Generated ${timestamp(context.generatedOn)} by ${context.generatedBy}`,
      layout.left,
      baseline + 3.4
    );
    doc.text(`Page ${page} of ${pageCount}`, layout.right, baseline, { align: 'right' });
  }
};

export const exportScheduleToPdf = (
  report: IDepreciationReport,
  context: ISchedulePdfContext
): void => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const layout: ILayout = {
    doc,
    left: MARGIN_X,
    right: pageWidth - MARGIN_X,
    width: pageWidth - MARGIN_X * 2,
    top: MARGIN_TOP,
    bottom: pageHeight - FOOTER_RESERVE,
    pageHeight,
  };

  doc.setProperties({
    title: `Depreciation Schedule — ${context.assetCode}`,
    subject: `Depreciation schedule as of ${dateText(report.summary.asOfDate)}`,
    author: context.generatedBy,
    creator: context.companyName,
  });

  const years: IReportYear[] = [
    ...report.history,
    ...(report.current ? [report.current] : []),
    ...(context.includeForecast ? report.forecast : []),
  ];

  const currency = report.summary.currencyId?.trim();
  // Stated once per section rather than on every cell — a money column stays readable.
  const currencyNote = currency
    ? `All amounts in ${currency}, to 2 decimal places.`
    : 'All amounts to 2 decimal places.';

  let cursor = drawTitleBlock(layout, report, context);
  cursor = drawSummaryPanel(layout, report, cursor);
  cursor = drawYearTable(
    layout,
    report,
    years,
    context.includeForecast,
    currencyNote,
    cursor
  );

  const showsEstimates =
    context.includeForecast && (report.forecast.length > 0 || report.current?.partial === true);

  if (showsEstimates) {
    cursor = breakIfShort(layout, cursor, 8);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    textColor(doc, ESTIMATE);
    doc.text(
      'Rows in italic grey are estimates projected from the stored schedule — they are not posted figures.',
      layout.left,
      cursor
    );
    cursor += 7;
  }

  if (context.includeMonthlyDetail && years.length > 0) {
    cursor = drawMonthlySection(layout, years, context.includeForecast, currencyNote, cursor + 2);
  }

  stampFooters(layout, report, context);

  doc.save(
    `Depreciation-Schedule_${sanitise(context.assetCode)}_${dayOf(context.generatedOn)}.pdf`
  );
};
