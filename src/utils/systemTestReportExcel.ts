import * as XLSX from 'xlsx-js-style';
import {
  RUN_ITEM_STATUS_LABELS,
  RUN_KIND_LABELS,
  RUN_STATUS_LABELS,
} from '@/enum/systemTestEnums';
import { ISystemTestRun, ISystemTestRunItem } from '@/interface/ISystemTest';

/**
 * A System Test run as a workbook, produced client-side from the run JSON (§12.9 — the
 * backend exports json only; Excel has ONE owner and it is this file). Follows the
 * schedule export pattern: counts and durations land as real numbers (`t: 'n'`) so an
 * auditor can foot a column, never as pre-formatted text.
 */

export interface ISystemTestExportContext {
  companyName: string;
  generatedBy: string;
  generatedOn: Date;
}

const COUNT = '0';
const MS = '#,##0';

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
  passText: '0E5F1F',
  passBg: 'C6EFCE',
  warnText: '7F5F00',
  warnBg: 'FFE699',
  failText: '9C0006',
  failBg: 'FFC7CE',
  infoText: '1F4E78',
  infoBg: 'DDEBF7',
  border: 'BFBFBF',
  titleBorder: '0F3450',
};

type TStyle = Record<string, unknown>;

const edge = (style: string, rgb: string) => ({
  top: { style, color: { rgb } },
  bottom: { style, color: { rgb } },
  left: { style, color: { rgb } },
  right: { style, color: { rgb } },
});

const thinBorder = edge('thin', COLORS.border);

const titleStyle: TStyle = {
  font: { name: 'Calibri', sz: 16, bold: true, color: { rgb: COLORS.titleText } },
  fill: { patternType: 'solid', fgColor: { rgb: COLORS.titleBg } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: edge('thin', COLORS.titleBorder),
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
  font: { name: 'Calibri', sz: 10, color: { rgb: COLORS.valueText } },
  alignment: { horizontal: 'left', vertical: 'top', wrapText: true, indent: 1 },
  border: thinBorder,
};

const countStyle: TStyle = {
  ...cellStyle,
  alignment: { horizontal: 'right', vertical: 'top', indent: 1 },
  numFmt: COUNT,
};

const msStyle: TStyle = {
  ...countStyle,
  numFmt: MS,
};

/** Item-status cell tinted the way the pages tint their badges. */
const statusStyle = (item: ISystemTestRunItem): TStyle => {
  const tone =
    item.status === 1
      ? { text: COLORS.passText, bg: COLORS.passBg }
      : item.status === 2
        ? { text: COLORS.warnText, bg: COLORS.warnBg }
        : item.status === 3
          ? { text: COLORS.failText, bg: COLORS.failBg }
          : { text: COLORS.infoText, bg: COLORS.infoBg };
  return {
    ...cellStyle,
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: tone.text } },
    fill: { patternType: 'solid', fgColor: { rgb: tone.bg } },
    alignment: { horizontal: 'center', vertical: 'top' },
  };
};

const str = (value: string | null | undefined, style: TStyle): XLSX.CellObject => ({
  v: value == null ? '' : String(value),
  t: 's',
  s: style,
});

const num = (value: number | null | undefined, style: TStyle): XLSX.CellObject => {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return { v: n, t: 'n', s: style };
};

/** A cell with no figure at all — distinct from a zero, which would be a claim. */
const blank = (style: TStyle): XLSX.CellObject => str('', style);

const dash = (value: string | null | undefined) =>
  value && value.length > 0 ? value : '—';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Local calendar parts, not toISOString — a UTC shift would misdate an evening export. */
const isoDate = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const isoDateTime = (date: Date) =>
  `${isoDate(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

/** Server timestamps arrive ISO; show them as they came, trimmed to the minute. */
const serverStamp = (value: string | null | undefined) =>
  value ? value.replace('T', ' ').slice(0, 16) : '—';

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
  run: ISystemTestRun,
  context: ISystemTestExportContext
): XLSX.WorkSheet => {
  const sheet = sheetBuilder(2);

  const textRow = (label: string, value: string | null | undefined) =>
    sheet.push([str(label, labelStyle), str(dash(value), valueStyle)], 22);
  const countRow = (label: string, value: number | null | undefined, fmt = countStyle) =>
    value == null
      ? textRow(label, null)
      : sheet.push([str(label, labelStyle), num(value, fmt)], 22);

  sheet.pushMerged(`System Test Report — ${RUN_KIND_LABELS[run.kind]}`, titleStyle, 30);
  sheet.pushMerged(context.companyName, subtitleStyle);
  sheet.spacer();

  sheet.pushMerged('Run', sectionStyle, 24);
  textRow('Kind', RUN_KIND_LABELS[run.kind]);
  textRow('Module', run.moduleKey || 'All modules');
  textRow('Status', RUN_STATUS_LABELS[run.status]);
  textRow('Started', serverStamp(run.startedOn));
  textRow('Completed', serverStamp(run.completedOn));
  countRow('Duration (ms)', run.durationMs, msStyle);
  textRow(
    'Fixed clock instant',
    run.clockInstant ? serverStamp(run.clockInstant) : 'None — real clock'
  );
  textRow('Run Id', run.id);
  sheet.spacer();

  sheet.pushMerged('Results', sectionStyle, 24);
  countRow('Passed', run.passedCount);
  countRow('Warnings', run.warningCount);
  countRow('Failed', run.failedCount);
  countRow('Items', run.items.length);
  sheet.spacer();

  sheet.pushMerged('Report', sectionStyle, 24);
  textRow('Generated On', isoDateTime(context.generatedOn));
  textRow('Generated By', context.generatedBy);

  return sheet.build([30, 44]);
};

const ITEM_HEADERS = [
  'Seq',
  'Module',
  'Group',
  'Item Key',
  'Name',
  'Status',
  'Severity',
  'Reason Code',
  'Record',
  'Expected',
  'Actual',
  'Message',
  'Recommendation',
  'Duration (ms)',
];

const buildItemsSheet = (run: ISystemTestRun): XLSX.WorkSheet => {
  const sheet = sheetBuilder(ITEM_HEADERS.length);

  sheet.pushMerged(
    `Run Items — ${RUN_KIND_LABELS[run.kind]} (${RUN_STATUS_LABELS[run.status]})`,
    titleStyle,
    28
  );
  sheet.push(
    ITEM_HEADERS.map((head, index) =>
      str(head, index === 0 || index === ITEM_HEADERS.length - 1 ? headNumberStyle : headTextStyle)
    ),
    26
  );

  for (const item of run.items) {
    sheet.push([
      num(item.sequence, countStyle),
      str(item.moduleKey, cellStyle),
      str(dash(item.groupKey), cellStyle),
      str(item.itemKey, cellStyle),
      str(item.name, cellStyle),
      str(RUN_ITEM_STATUS_LABELS[item.status] ?? String(item.status), statusStyle(item)),
      str(dash(item.severity), cellStyle),
      str(dash(item.reasonCode), cellStyle),
      str(dash(item.recordReference), cellStyle),
      str(dash(item.expected), cellStyle),
      str(dash(item.actual), cellStyle),
      str(dash(item.message), cellStyle),
      str(dash(item.recommendation), cellStyle),
      // Health findings measure no per-item duration — blank, not a zero claim.
      item.durationMs == null ? blank(msStyle) : num(item.durationMs, msStyle),
    ]);
  }

  return sheet.build([6, 16, 18, 24, 30, 10, 10, 26, 24, 26, 26, 40, 30, 12]);
};

/** Safe for a filename on every platform, never empty. */
const sanitise = (value: string) =>
  value.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'Run';

export const systemTestRunFileStem = (run: ISystemTestRun): string =>
  `System-Test_${sanitise(RUN_KIND_LABELS[run.kind])}_${(run.startedOn ?? '').slice(0, 10) || isoDate(new Date())}`;

export const exportSystemTestRunToExcel = (
  run: ISystemTestRun,
  context: ISystemTestExportContext
): void => {
  const generatedOn = Number.isNaN(context.generatedOn.getTime())
    ? new Date()
    : context.generatedOn;
  const stamped = { ...context, generatedOn };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSummarySheet(run, stamped), 'Summary');
  XLSX.utils.book_append_sheet(wb, buildItemsSheet(run), 'Items');

  XLSX.writeFile(wb, `${systemTestRunFileStem(run)}.xlsx`, {
    bookType: 'xlsx',
    compression: true,
  });
};
