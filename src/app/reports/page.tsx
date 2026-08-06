'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/Providers/ToastProvider';
import Button from '@/components/UI/Button';
import CustomTable from '@/components/CustomTable/CustomTable';
import { TTableColumn } from '@/components/CustomTable/CustomTableInterface';
import Input from '@/components/UI/Input';
import Select from '@/components/UI/Select';
import Pagination from '@/components/UI/Pagination';
import { IReportDescriptor, IReportFilter } from '@/interface/IReports';
import { IFiscalYear } from '@/interface/IDepreciation';
import {
  downloadReportXlsx,
  fetchReportCatalogue,
  runReport,
} from '@/services/reports.service';
import { fetchFiscalYears } from '@/services/depreciation.service';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';

/**
 * Column labels per report code. Columns render whatever the backend row carries —
 * the backend's numbers are the numbers; this page never aggregates client-side.
 */
const humanize = (key: string) =>
  key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();

/** One glyph per report so the grid is scannable by shape, not just by reading. */
const REPORT_ICONS: Record<string, string> = {
  'asset-register': 'briefcase',
  'asset-movement': 'move',
  'missing-assets': 'alert',
  'audit-discrepancies': 'checked',
  'maintenance-cost': 'setting',
  'depreciation-detail': 'trend',
  'nbv-register': 'cash',
  'disposal-register': 'trash',
  'fixed-asset-subledger': 'book',
  'asset-distribution': 'modules',
  'asset-roll-forward': 'redo',
  'subledger-reconciliation': 'calculator',
};

const formatCell = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : '—';
  if (typeof value === 'number')
    return Number.isInteger(value)
      ? value.toLocaleString()
      : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value))
    return new Date(value).toLocaleDateString();
  return String(value);
};

export default function ReportsPage() {
  const { addToast } = useToast();

  const [catalogue, setCatalogue] = useState<IReportDescriptor[]>([]);
  const [selected, setSelected] = useState<IReportDescriptor | null>(null);
  const [years, setYears] = useState<IFiscalYear[]>([]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [moneyTotals, setMoneyTotals] = useState<{ currencyId: string; total: number }[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  /** Where Run Report sends the result. */
  const [output, setOutput] = useState<'screen' | 'excel'>('screen');

  const [filter, setFilter] = useState<IReportFilter>({ pageNumber: 1, pageSize: DEFAULT_PAGE_SIZE });

  useEffect(() => {
    (async () => {
      try {
        const [catalogueResponse, yearResponse] = await Promise.all([
          fetchReportCatalogue(),
          fetchFiscalYears(),
        ]);
        const descriptors = catalogueResponse?.data ?? [];
        setCatalogue(descriptors);
        setYears(yearResponse?.data ?? []);
        // Land on the first report the catalogue offers — Asset Register, unless the
        // caller's permissions hide it — so the page opens with a report on screen
        // instead of a grid of buttons and nothing under it. Taking [0] rather than
        // the literal code keeps that true for whatever the catalogue allows.
        if (descriptors.length > 0) setSelected((prev) => prev ?? descriptors[0]);
      } catch {
        addToast.error('Could not load the report catalogue.');
      }
    })();
  }, [addToast]);

  const load = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const response = await runReport(selected.code, filter);
      if (!response?.success && response?.message) {
        addToast.error(response.message);
        setRows([]);
        setRowCount(0);
        setPageCount(0);
        return;
      }
      if (selected.isPaginated) {
        // Paginated reports nest the paged envelope inside the Result's data.
        const envelope = response?.data ?? {};
        setRows(envelope.data ?? envelope.results ?? []);
        setRowCount(envelope.rowCount ?? 0);
        setPageCount(envelope.pageCount ?? 0);
        // Money reports carry per-currency totals over the FULL filtered set — the
        // backend computes them because summing the visible page is the exact
        // wrong-number failure the design forbids.
        setMoneyTotals(envelope.moneyTotals ?? []);
      } else {
        const list = response?.data ?? [];
        setRows(list);
        setRowCount(list.length);
        setPageCount(1);
        setMoneyTotals([]);
      }
    } catch {
      addToast.error('Could not run the report.');
    } finally {
      setLoading(false);
    }
  }, [selected, filter, addToast]);

  useEffect(() => {
    load();
  }, [load]);

  const pick = (descriptor: IReportDescriptor) => {
    setSelected(descriptor);
    setRows([]);
    setRowCount(0);
    setFilter({ pageNumber: 1, pageSize: DEFAULT_PAGE_SIZE });
  };

  const exportXlsx = async () => {
    if (!selected) return;
    setExporting(true);
    try {
      const response = await downloadReportXlsx(selected.code, filter);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      const disposition = response.headers.get('content-disposition') ?? '';
      const match = /filename="?([^";]+)"?/.exec(disposition);
      anchor.download = match?.[1] ?? `${selected.code}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      addToast.error('Could not export the report.');
    } finally {
      setExporting(false);
    }
  };

  /**
   * Run Report honours the output toggle. On-screen results also refresh on their own
   * when the filters or the page change, so the button is for re-running deliberately
   * and for exporting — never the only way to see anything.
   */
  const run = () => (output === 'excel' ? exportXlsx() : load());

  /** What a raw value should be compared as, so a column sorts by value not by label. */
  const cellType = (value: unknown): 'number' | 'date' | 'string' => {
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return 'date';
    return 'string';
  };

  // Columns derive from the first row — the backend shape is the contract.
  const columns: TTableColumn[] = useMemo(() => {
    if (rows.length === 0) return [];
    return Object.keys(rows[0])
      .filter((key) => key !== 'id')
      .map((key) => ({
        key,
        label: humanize(key),
        width: 140,
        name: key,
        type: 'custom' as const,
      }));
  }, [rows]);

  // Every cell keeps its RAW value beside the text it prints. A report column used to
  // hold only the formatted string, so sorting money compared "1,234.50" with "999.00"
  // as words and put the larger first, and dates ordered by their printed month.
  const displayRows = rows.map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formatted: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      formatted[key] =
        key === 'id'
          ? value
          : {
              value: value === '' ? null : value,
              content: formatCell(value),
              type: cellType(value),
            };
    }
    return formatted;
  });

  return (
    <div className="px-4 mt-2">
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-secondaryColor">Reports &amp; Analytics</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Run a report on screen or export it as an Excel workbook.
        </p>
      </div>

      {/* Every report the caller's permissions allow, three across. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {catalogue.map((descriptor) => {
          const active = selected?.code === descriptor.code;
          return (
            <button
              key={descriptor.code}
              type="button"
              onClick={() => pick(descriptor)}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                active
                  ? 'border-primarycolor bg-primarycolor/10'
                  : 'border-gray-200 bg-white hover:border-primarycolor/40 hover:bg-hoverColor'
              }`}
            >
              <i
                className={`icon icon-${REPORT_ICONS[descriptor.code] ?? 'bar-chart'} text-[17px] shrink-0 text-primarycolor`}
              />
              <span className="min-w-0 grow truncate text-sm font-medium text-secondaryColor">
                {descriptor.name}
              </span>
              {/* The description lives here rather than under the grid, so picking a
                  report does not shift the layout to make room for it. */}
              <i
                className="icon icon-info shrink-0 text-[15px] text-gray-300"
                title={descriptor.description}
              />
            </button>
          );
        })}
      </div>

      {selected && (
        <>
          <div className="mt-5 mb-4 flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4">
            {selected.supportsDateRange && (
              <>
                <Input
                  label="From"
                  type="date"
                  value={filter.from ?? ''}
                  onChange={(e) =>
                    setFilter((prev) => ({ ...prev, from: e.target.value || undefined, pageNumber: 1 }))
                  }
                />
                <Input
                  label="To"
                  type="date"
                  value={filter.to ?? ''}
                  onChange={(e) =>
                    setFilter((prev) => ({ ...prev, to: e.target.value || undefined, pageNumber: 1 }))
                  }
                />
              </>
            )}
            {selected.supportsFiscalYear && (
              <Select
                label="Fiscal Year"
                value={filter.fiscalYearCode ?? ''}
                onChange={(e) =>
                  setFilter((prev) => ({ ...prev, fiscalYearCode: e.target.value || undefined, pageNumber: 1 }))
                }
                options={[
                  { label: 'All years', value: '' },
                  ...years.map((y) => ({ label: y.code, value: y.code })),
                ]}
              />
            )}
            {selected.supportsDimension && (
              <Select
                label="Dimension"
                value={filter.dimension ?? 'category'}
                onChange={(e) =>
                  setFilter((prev) => ({ ...prev, dimension: e.target.value }))
                }
                options={[
                  { label: 'Category', value: 'category' },
                  { label: 'Location', value: 'location' },
                  { label: 'Custodian', value: 'custodian' },
                  { label: 'Custodian Department', value: 'department' },
                ]}
              />
            )}

            {/* Where the result goes, chosen before running rather than as a second
                action afterwards. */}
            <div className="flex overflow-hidden rounded-full border border-gray-200">
              {(['screen', 'excel'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setOutput(mode)}
                  className={`px-4 py-1.5 text-xs font-medium uppercase tracking-wide transition-colors ${
                    output === mode
                      ? 'bg-primarycolor text-white'
                      : 'bg-white text-gray-600 hover:bg-hoverColor'
                  }`}
                >
                  {mode === 'screen' ? 'On screen' : 'Excel'}
                </button>
              ))}
            </div>

            <Button onClick={run} disabled={loading || exporting}>
              <i className="icon icon-bar-chart text-xs"></i>
              <span>
                {loading || exporting
                  ? output === 'excel'
                    ? 'Exporting…'
                    : 'Running…'
                  : 'Run Report'}
              </span>
            </Button>
          </div>

          <p className="mb-3 text-xs text-gray-500">{selected.description}</p>

          {/* Distinct key AND tableName per report code: CustomTable caches its column
              state by tableName, so a shared name bleeds columns between reports. The key
              also carries the column count because CustomTable seeds column state ONCE —
              when data (and therefore columns) arrive after the empty first render, the
              table must remount to pick them up. */}
          <CustomTable
            key={`report-${selected.code}-${columns.length}`}
            columns={columns}
            rows={displayRows}
            tableName={`report-${selected.code}`}
            serialOffset={
              selected.isPaginated
                ? ((filter.pageNumber ?? 1) - 1) * (filter.pageSize ?? DEFAULT_PAGE_SIZE)
                : 0
            }
            isLoading={loading}
            entityLabel="row"
            // A report that came back whole can be ordered here. A paged one cannot:
            // its endpoint ignores a sort request, and reordering the page on screen
            // would present one slice of the rows as if it were the report.
            clientSort={!selected.isPaginated}
          />

          {moneyTotals.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-4 rounded bg-gray-50 px-3 py-2 text-sm">
              <span className="font-medium text-gray-700">Totals (full result set):</span>
              {moneyTotals.map((t) => (
                <span key={t.currencyId} className="text-gray-800">
                  {t.total.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  {t.currencyId.trim()}
                </span>
              ))}
            </div>
          )}

          {selected.isPaginated && (
            <Pagination
              pageNumber={filter.pageNumber ?? 1}
              totalPages={pageCount}
              pageSize={filter.pageSize ?? DEFAULT_PAGE_SIZE}
              totalCount={rowCount}
              updateFilters={(updates) => setFilter((prev) => ({ ...prev, ...updates }))}
            />
          )}
        </>
      )}

      {!selected && catalogue.length > 0 && (
        <p className="text-sm text-gray-500">Pick a report to run it.</p>
      )}
    </div>
  );
}
