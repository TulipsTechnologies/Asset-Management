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

  const [filter, setFilter] = useState<IReportFilter>({ pageNumber: 1, pageSize: DEFAULT_PAGE_SIZE });

  useEffect(() => {
    (async () => {
      try {
        const [catalogueResponse, yearResponse] = await Promise.all([
          fetchReportCatalogue(),
          fetchFiscalYears(),
        ]);
        setCatalogue(catalogueResponse?.data ?? []);
        setYears(yearResponse?.data ?? []);
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
        type: 'string' as const,
      }));
  }, [rows]);

  const displayRows = rows.map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formatted: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) formatted[key] = formatCell(value);
    return formatted;
  });

  return (
    <div className="p-4">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-800">Reports</h1>
        <p className="text-sm text-gray-500">
          Server-computed, per-currency, export-ready. The list shows only the reports your
          permissions can run.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {catalogue.map((descriptor) => (
          <button
            key={descriptor.code}
            type="button"
            title={descriptor.description}
            onClick={() => pick(descriptor)}
            className={`rounded border px-3 py-1.5 text-sm ${
              selected?.code === descriptor.code
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-gray-200 text-gray-700 hover:border-gray-300'
            }`}
          >
            {descriptor.name}
          </button>
        ))}
      </div>

      {selected && (
        <>
          <p className="mb-3 text-xs text-gray-500">{selected.description}</p>

          <div className="mb-4 flex flex-wrap items-end gap-3">
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
            <Button onClick={exportXlsx} disabled={exporting || loading}>
              <i className="icon icon-download text-xs"></i>
              <span>{exporting ? 'Exporting…' : 'Export to Excel'}</span>
            </Button>
          </div>

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
