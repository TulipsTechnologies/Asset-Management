import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { RowInput, Styles } from 'jspdf-autotable';
import {
  RUN_ITEM_STATUS_LABELS,
  RUN_KIND_LABELS,
  RUN_STATUS_LABELS,
  SystemTestRunItemStatusEnum,
} from '@/enum/systemTestEnums';
import { ISystemTestRun } from '@/interface/ISystemTest';
import { systemTestRunFileStem } from '@/utils/systemTestReportExcel';

/**
 * A System Test run as a working paper — rendered client-side from the run JSON (§12.9),
 * following the schedule PDF pattern: jspdf + autotable, a title block, the items table
 * with Expected vs Actual side by side, and stamped page footers in a second pass.
 * This file formats; it does not calculate.
 */

export interface ISystemTestPdfContext {
  companyName: string;
  generatedBy: string;
  generatedOn: Date;
}

type RGB = [number, number, number];

const INK: RGB = [33, 37, 41];
const MUTED: RGB = [108, 117, 125];
const HEAD_FILL: RGB = [45, 55, 72];
const HEAD_INK: RGB = [255, 255, 255];
const RULE: RGB = [206, 212, 218];
const PANEL: RGB = [244, 246, 248];
const STRIPE: RGB = [250, 251, 252];
const PASS: RGB = [14, 95, 31];
const WARN: RGB = [127, 95, 0];
const FAIL: RGB = [156, 0, 6];
const INFO: RGB = [31, 78, 120];

const MARGIN_X = 12;
const MARGIN_TOP = 14;
const FOOTER_RESERVE = 18;

const pad = (value: number) => String(value).padStart(2, '0');

const dayOf = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const timestamp = (date: Date) =>
  `${dayOf(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;

const serverStamp = (value?: string | null) =>
  value ? value.replace('T', ' ').slice(0, 16) : '—';

const dash = (value?: string | null) => (value && value.length > 0 ? value : '—');

const durationText = (ms?: number | null) =>
  ms == null ? '—' : ms >= 10_000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;

const STATUS_INK: Record<SystemTestRunItemStatusEnum, RGB> = {
  [SystemTestRunItemStatusEnum.Pass]: PASS,
  [SystemTestRunItemStatusEnum.Warning]: WARN,
  [SystemTestRunItemStatusEnum.Failed]: FAIL,
  [SystemTestRunItemStatusEnum.Info]: INFO,
};

interface IColumn {
  header: string;
  weight: number;
  halign?: 'left' | 'center' | 'right';
}

const ITEM_COLUMNS: IColumn[] = [
  { header: '#', weight: 6, halign: 'center' },
  { header: 'Module', weight: 16 },
  { header: 'Item', weight: 30 },
  { header: 'Status', weight: 12, halign: 'center' },
  { header: 'Expected', weight: 30 },
  { header: 'Actual', weight: 30 },
  { header: 'Message', weight: 40 },
  { header: 'Duration', weight: 12, halign: 'right' },
];

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

const afterTable = (doc: jsPDF, fallback: number) => {
  const stamped = (doc as jsPDF & { lastAutoTable?: { finalY?: number } | false })
    .lastAutoTable;
  return stamped && typeof stamped.finalY === 'number' ? stamped.finalY : fallback;
};

export const exportSystemTestRunToPdf = (
  run: ISystemTestRun,
  context: ISystemTestPdfContext
): void => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = MARGIN_X;
  const right = pageWidth - MARGIN_X;
  const width = pageWidth - MARGIN_X * 2;

  const kindLabel = RUN_KIND_LABELS[run.kind];
  const statusLabel = RUN_STATUS_LABELS[run.status];

  doc.setProperties({
    title: `System Test Report — ${kindLabel}`,
    subject: `${kindLabel} run started ${serverStamp(run.startedOn)}`,
    author: context.generatedBy,
    creator: context.companyName,
  });

  // ------------------------------------------------------------------ title block
  let y = MARGIN_TOP + 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...INK);
  doc.text(context.companyName, left, y);
  y += 6.5;

  doc.setFontSize(11);
  doc.text(`System Test Report — ${kindLabel}`, left, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(`Started ${serverStamp(run.startedOn)}`, right, y, { align: 'right' });
  y += 2.4;

  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.5);
  doc.line(left, y, right, y);
  y += 5;

  // ------------------------------------------------------------------ summary panel
  const cells: Array<[string, string]> = [
    ['Status', statusLabel],
    ['Module', run.moduleKey || 'All modules'],
    ['Duration', durationText(run.durationMs)],
    ['Passed', String(run.passedCount)],
    ['Warnings', String(run.warningCount)],
    ['Failed', String(run.failedCount)],
    ['Completed', serverStamp(run.completedOn)],
    ['Fixed clock', run.clockInstant ? serverStamp(run.clockInstant) : 'Real clock'],
    ['Items', String(run.items.length)],
  ];

  const rows: RowInput[] = [];
  for (let i = 0; i < cells.length; i += 3) {
    rows.push(cells.slice(i, i + 3).flatMap(([label, value]) => [label, value]));
  }

  const labelWidth = width * 0.12;
  const valueWidth = width / 3 - labelWidth;

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    margin: { left, right: MARGIN_X, top: MARGIN_TOP, bottom: FOOTER_RESERVE },
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
      1: { cellWidth: valueWidth, fontStyle: 'bold', textColor: INK },
      2: { cellWidth: labelWidth, fillColor: PANEL, textColor: MUTED, fontSize: 7.5 },
      3: { cellWidth: valueWidth, fontStyle: 'bold', textColor: INK },
      4: { cellWidth: labelWidth, fillColor: PANEL, textColor: MUTED, fontSize: 7.5 },
      5: { cellWidth: valueWidth, fontStyle: 'bold', textColor: INK },
    },
  });

  y = afterTable(doc, y) + 7;

  // ------------------------------------------------------------------ items table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text('Run Items', left, y);
  y += 2;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.line(left, y, right, y);
  y += 4;

  if (run.items.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text('This run recorded no items.', left, y + 2);
  } else {
    const statusColumn = 3;
    const body: RowInput[] = run.items.map((item) => [
      String(item.sequence),
      item.moduleKey,
      // Reason code and record travel under the name so a finding stays one row.
      [item.name, item.reasonCode, item.recordReference].filter(Boolean).join('\n'),
      RUN_ITEM_STATUS_LABELS[item.status] ?? String(item.status),
      dash(item.expected),
      dash(item.actual),
      [item.message, item.recommendation].filter(Boolean).join('\n') || '—',
      durationText(item.durationMs),
    ]);

    autoTable(doc, {
      startY: y,
      theme: 'grid',
      margin: { left, right: MARGIN_X, top: MARGIN_TOP, bottom: FOOTER_RESERVE },
      head: [ITEM_COLUMNS.map((column) => column.header)],
      body,
      styles: {
        fontSize: 7,
        cellPadding: { top: 1.4, bottom: 1.4, left: 1.2, right: 1.2 },
        lineColor: RULE,
        lineWidth: 0.1,
        textColor: INK,
        overflow: 'linebreak',
        valign: 'top',
      },
      headStyles: { fillColor: HEAD_FILL, textColor: HEAD_INK, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: STRIPE },
      columnStyles: columnStylesOf(ITEM_COLUMNS, width),
      didParseCell: (data) => {
        if (data.section !== 'body' || data.column.index !== statusColumn) return;
        const item = run.items[data.row.index];
        if (!item) return;
        data.cell.styles.textColor = STATUS_INK[item.status] ?? INK;
        data.cell.styles.fontStyle = 'bold';
      },
    });
  }

  // ------------------------------------------------------------------ footers
  const pageCount = doc.getNumberOfPages();
  const baseline = pageHeight - 11;
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.3);
    doc.line(left, baseline - 4, right, baseline - 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(
      `${context.companyName} · ${kindLabel} · ${statusLabel}`,
      left,
      baseline
    );
    doc.text(
      `Generated ${timestamp(context.generatedOn)} by ${context.generatedBy}`,
      left,
      baseline + 3.4
    );
    doc.text(`Page ${page} of ${pageCount}`, right, baseline, { align: 'right' });
  }

  doc.save(`${systemTestRunFileStem(run)}.pdf`);
};
