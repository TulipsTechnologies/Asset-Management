'use client';

import { useCallback, useEffect, useState } from 'react';
import CustomTable from '@/components/CustomTable/CustomTable';
import {
  ITableFilters,
  TTableColumn,
} from '@/components/CustomTable/CustomTableInterface';
import Modal from '@/components/UI/Modal';
import Pagination from '@/components/UI/Pagination';
import Select from '@/components/UI/Select';
import FilterPanel from '@/components/UI/FilterPanel';
import { DetailField } from '@/components/UI/FormLayout';
import RunExportButtons from '@/components/SystemTest/RunExportButtons';
import RunItemsTable from '@/components/SystemTest/RunItemsTable';
import SystemTestGate from '@/components/SystemTest/SystemTestGate';
import { useToast } from '@/components/Providers/ToastProvider';
import {
  RUN_KIND_LABELS,
  RUN_STATUS_BADGE,
  RUN_STATUS_LABELS,
  SystemTestRunKindEnum,
  SystemTestRunStatusEnum,
} from '@/enum/systemTestEnums';
import { ISystemTestRun, ISystemTestRunFilter } from '@/interface/ISystemTest';
import {
  fetchSystemTestRun,
  fetchSystemTestRuns,
} from '@/services/systemTest.service';
import { mergeTableFilters, unwrapPaged } from '@/utils/serviceUtils';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';

const stamp = (value?: string | null) =>
  value ? value.replace('T', ' ').slice(0, 16) : '—';

const durationText = (ms?: number | null) =>
  ms == null ? '—' : ms >= 10_000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;

const ReportsContent = () => {
  const { addToast } = useToast();

  const [runs, setRuns] = useState<ISystemTestRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // StartedOn is the server's default order; stating it here keeps the header seeded.
  const [filters, setFilters] = useState<ISystemTestRunFilter>({
    pageNumber: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    sortBy: 'StartedOn',
    sortDesc: true,
  });

  const [detail, setDetail] = useState<ISystemTestRun | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // sortField names a SystemTestRun ENTITY property the service whitelists (Status, Kind,
  // DurationMs, ModuleKey, StartedOn). The counters are not sortable server-side.
  const columns: TTableColumn[] = [
    { key: 'kind', label: 'Kind', width: 110, name: 'kind', sortField: 'Kind' },
    { key: 'moduleKey', label: 'Module', width: 140, name: 'moduleKey', sortField: 'ModuleKey' },
    { key: 'status', label: 'Status', width: 140, name: 'status', sortField: 'Status' },
    { key: 'startedOn', label: 'Started', width: 130, name: 'startedOn', sortField: 'StartedOn' },
    { key: 'duration', label: 'Duration', width: 90, name: 'duration', sortField: 'DurationMs' },
    { key: 'passed', label: 'Passed', width: 70, name: 'passed' },
    { key: 'warnings', label: 'Warnings', width: 80, name: 'warnings' },
    { key: 'failed', label: 'Failed', width: 70, name: 'failed' },
  ];

  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchSystemTestRuns(filters);
      if (res?.success) {
        const paged = unwrapPaged(res);
        setRuns(paged.items);
        setRowCount(paged.rowCount);
        setPageCount(paged.pageCount);
      } else {
        addToast.error(res?.message || 'Failed to fetch runs');
      }
    } catch {
      addToast.error('An error occurred while fetching runs');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const updateFilters = (updates: Partial<ITableFilters>) => {
    setFilters((prev) => mergeTableFilters(prev, updates));
  };

  const openDetail = async (runId: string) => {
    setDetailLoading(true);
    try {
      const res = await fetchSystemTestRun(runId);
      if (res?.success && res.data) setDetail(res.data);
      else addToast.error(res?.message || 'Could not load the run');
    } catch {
      addToast.error('Could not load the run');
    } finally {
      setDetailLoading(false);
    }
  };

  const rowData = runs.map((run) => ({
    id: run.id,
    kind: (
      <span className="font-medium text-secondaryColor">
        {RUN_KIND_LABELS[run.kind] ?? run.kind}
      </span>
    ),
    moduleKey: run.moduleKey || 'All modules',
    status: (
      <span
        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${RUN_STATUS_BADGE[run.status]}`}
      >
        {RUN_STATUS_LABELS[run.status] ?? run.status}
      </span>
    ),
    startedOn: stamp(run.startedOn),
    duration: durationText(run.durationMs),
    passed: run.passedCount > 0 ? (
      <span className="text-green-700">{run.passedCount}</span>
    ) : (
      '—'
    ),
    warnings: run.warningCount > 0 ? (
      <span className="text-amber-700">{run.warningCount}</span>
    ) : (
      '—'
    ),
    failed: run.failedCount > 0 ? (
      <span className="font-medium text-red-700">{run.failedCount}</span>
    ) : (
      '—'
    ),
  }));

  const activeFilterCount = [filters.kind, filters.status].filter(
    (value) => value != null
  ).length;

  return (
    <div className="px-4 mt-2">
      <CustomTable
        columns={columns}
        rows={rowData}
        tableName="System Test Runs"
        serialOffset={
          ((filters.pageNumber ?? 1) - 1) * (filters.pageSize ?? DEFAULT_PAGE_SIZE)
        }
        isLoading={loading || detailLoading}
        selectable={false}
        sortBy={filters.sortBy}
        sortDesc={filters.sortDesc}
        onRowClick={(row) => openDetail(String(row.id))}
        tableHeaderRight={
          <FilterPanel
            open={showFilters}
            onOpenChange={setShowFilters}
            activeCount={activeFilterCount}
            onClearAll={() =>
              setFilters((prev) => ({
                ...prev,
                kind: undefined,
                status: undefined,
                pageNumber: 1,
              }))
            }
          >
            <Select
              label="Kind"
              placeholder="All"
              options={Object.entries(RUN_KIND_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
              value={filters.kind != null ? String(filters.kind) : ''}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  kind: e.target.value
                    ? (Number(e.target.value) as SystemTestRunKindEnum)
                    : undefined,
                  pageNumber: 1,
                }))
              }
            />
            <Select
              label="Status"
              placeholder="All"
              options={Object.entries(RUN_STATUS_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
              value={filters.status != null ? String(filters.status) : ''}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  status: e.target.value
                    ? (Number(e.target.value) as SystemTestRunStatusEnum)
                    : undefined,
                  pageNumber: 1,
                }))
              }
            />
          </FilterPanel>
        }
        updateFilters={updateFilters}
      />

      <div className="mt-3">
        <Pagination
          pageNumber={filters.pageNumber ?? 1}
          totalPages={pageCount}
          pageSize={filters.pageSize ?? DEFAULT_PAGE_SIZE}
          totalCount={rowCount}
          updateFilters={updateFilters}
        />
      </div>

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} size="6xl">
        {detail && (
          <div className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold text-secondaryColor">
                  {RUN_KIND_LABELS[detail.kind]} run
                </h2>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${RUN_STATUS_BADGE[detail.status]}`}
                >
                  {RUN_STATUS_LABELS[detail.status]}
                </span>
              </div>
              <RunExportButtons run={detail} />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg bg-gray-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <DetailField label="Module" value={detail.moduleKey || 'All modules'} />
              <DetailField label="Started" value={stamp(detail.startedOn)} />
              <DetailField label="Completed" value={stamp(detail.completedOn)} />
              <DetailField label="Duration" value={durationText(detail.durationMs)} />
              <DetailField label="Passed" value={detail.passedCount} />
              <DetailField label="Warnings" value={detail.warningCount} />
              <DetailField label="Failed" value={detail.failedCount} />
              <DetailField
                label="Fixed clock"
                value={
                  detail.clockInstant ? stamp(detail.clockInstant) : 'Real clock'
                }
              />
            </div>

            <div className="mt-4 max-h-[55vh] overflow-y-auto">
              <RunItemsTable items={detail.items} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const SystemTestReportsPage = () => (
  <SystemTestGate>
    <ReportsContent />
  </SystemTestGate>
);

export default SystemTestReportsPage;
