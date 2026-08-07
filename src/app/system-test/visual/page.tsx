'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import BackButton from '@/components/UI/BackButton';
import Button from '@/components/UI/Button';
import CustomTable from '@/components/CustomTable/CustomTable';
import {
  ITableFilters,
  TTableColumn,
} from '@/components/CustomTable/CustomTableInterface';
import FilterPanel from '@/components/UI/FilterPanel';
import { DetailField } from '@/components/UI/FormLayout';
import Modal from '@/components/UI/Modal';
import Pagination from '@/components/UI/Pagination';
import Select from '@/components/UI/Select';
import SummaryCard from '@/components/Dashboard/SummaryCard';
import RunExportButtons from '@/components/SystemTest/RunExportButtons';
import SystemTestGate from '@/components/SystemTest/SystemTestGate';
import VisualImage from '@/components/SystemTest/VisualImage';
import {
  ApproveBaselineModal,
  KeepBaselineModal,
  TemporaryDifferenceModal,
} from '@/components/SystemTest/VisualDecisionModals';
import { useToast } from '@/components/Providers/ToastProvider';
import { Permission } from '@/enum/permissions';
import {
  RUN_STATUS_BADGE,
  RUN_STATUS_LABELS,
  SystemTestRunKindEnum,
  VISUAL_DECISION_LABELS,
  VISUAL_FUNCTIONAL_BADGE,
  VISUAL_FUNCTIONAL_LABELS,
  VISUAL_STATUS_BADGE,
  VISUAL_STATUS_LABELS,
  VisualLevelEnum,
  VisualReviewDecisionEnum,
  VisualStatusEnum,
} from '@/enum/systemTestEnums';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { ISystemTestRun } from '@/interface/ISystemTest';
import {
  IVisualBaseline,
  IVisualException,
  IVisualResult,
  IVisualResultFilter,
  IVisualScenarioSet,
  IVisualSummary,
} from '@/interface/IVisualRegression';
import {
  fetchSystemTestRun,
  fetchSystemTestRuns,
} from '@/services/systemTest.service';
import {
  approveVisualBaseline,
  createVisualException,
  deactivateVisualException,
  fetchVisualBaselines,
  fetchVisualExceptions,
  fetchVisualResults,
  fetchVisualScenarios,
  fetchVisualSummary,
  keepVisualBaseline,
} from '@/services/visualRegression.service';
import { mergeTableFilters, unwrapPaged } from '@/utils/serviceUtils';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';

const stamp = (value?: string | null) =>
  value ? value.replace('T', ' ').slice(0, 16) : '—';

const durationText = (ms?: number | null) =>
  ms == null ? '—' : ms >= 10_000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;

/** DiffPixelRatio is a 0–1 ratio server-side (Broken ceiling 0.35 = 35%). */
const diffPercent = (result: IVisualResult) =>
  result.baselineId == null ? '—' : `${(result.diffPixelRatio * 100).toFixed(2)}%`;

/**
 * The runner submits JsErrors / FailedAssertions / MissingCriticalSelectors as JSON
 * arrays (§12.4). Entries may be strings or objects; either renders as one line, and
 * malformed JSON renders as nothing rather than crashing the review modal.
 */
const parseJsonList = (json?: string | null): string[] => {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object') {
        const record = entry as Record<string, unknown>;
        const parts = ['kind', 'selector', 'expected', 'actual', 'message']
          .filter((key) => record[key] != null && record[key] !== '')
          .map((key) => `${key}: ${String(record[key])}`);
        if (parts.length > 0) return parts.join(' · ');
      }
      return JSON.stringify(entry);
    });
  } catch {
    return [];
  }
};

/** One titled bullet list inside the detail modal — "None" stated, never blank (§10). */
const FindingList = ({
  title,
  entries,
  tone,
}: {
  title: string;
  entries: string[];
  tone: 'red' | 'amber';
}) => (
  <div>
    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
      {title}
    </h4>
    {entries.length === 0 ? (
      <p className="mt-1 text-sm text-gray-400">None</p>
    ) : (
      <ul className="mt-1 space-y-1">
        {entries.map((entry, index) => (
          <li
            key={index}
            className={`rounded px-2 py-1 font-mono text-xs ${
              tone === 'red'
                ? 'bg-red-50 text-red-700'
                : 'bg-amber-50 text-amber-800'
            }`}
          >
            {entry}
          </li>
        ))}
      </ul>
    )}
  </div>
);

const exceptionState = (exception: IVisualException) =>
  exception.isActive && !exception.isExpired
    ? { label: 'Active', badge: 'bg-green-100 text-green-800' }
    : exception.isExpired
      ? { label: 'Expired', badge: 'bg-amber-100 text-amber-800' }
      : { label: 'Inactive', badge: 'bg-gray-100 text-gray-600' };

const VisualContent = () => {
  const { addToast } = useToast();
  const { can } = useUserPermissions();

  const [summary, setSummary] = useState<IVisualSummary | null>(null);
  const [gateNotice, setGateNotice] = useState<string | null>(null);
  const [scenarioSet, setScenarioSet] = useState<IVisualScenarioSet | null>(null);
  const [visualRuns, setVisualRuns] = useState<ISystemTestRun[]>([]);
  const [exceptions, setExceptions] = useState<IVisualException[]>([]);
  const [includeInactiveExceptions, setIncludeInactiveExceptions] = useState(false);

  const [results, setResults] = useState<IVisualResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [resultsMessage, setResultsMessage] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // CreatedOn is the server's default order; stating it keeps the header seeded.
  const [filters, setFilters] = useState<IVisualResultFilter>({
    pageNumber: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    sortBy: 'CreatedOn',
    sortDesc: true,
  });

  const [detail, setDetail] = useState<IVisualResult | null>(null);
  const [baselines, setBaselines] = useState<IVisualBaseline[]>([]);
  const [baselinesLoading, setBaselinesLoading] = useState(false);

  const [approveOpen, setApproveOpen] = useState(false);
  const [keepOpen, setKeepOpen] = useState(false);
  const [temporaryOpen, setTemporaryOpen] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState(false);

  const [exportRun, setExportRun] = useState<ISystemTestRun | null>(null);

  const canApprove = can(Permission.ApproveVisualBaseline);
  const canManageExceptions = can(Permission.ManageVisualExceptions);
  // SystemTestController is class-gated on ManageSystemTest, so the run list and the
  // run-report exports exist only for holders of it; a pure reviewer (ViewVisual-
  // Regression alone) gets the page without the run filter and export buttons rather
  // than a row of calls the API is guaranteed to refuse.
  const canManageFramework = can(Permission.ManageSystemTest);

  // ---- loads ------------------------------------------------------------------------

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetchVisualSummary();
      if (res?.success && res.data) {
        setSummary(res.data);
        setGateNotice(null);
      } else {
        // The gate refused (unregistered/linked company, §12.3) — one inline notice,
        // not a toast per failing call.
        setGateNotice(
          res?.message ||
            'Visual regression is only available inside a registered test or demo company.'
        );
      }
    } catch {
      setGateNotice('Could not reach the visual regression endpoints.');
    }
  }, []);

  const loadExceptions = useCallback(async () => {
    try {
      const res = await fetchVisualExceptions(includeInactiveExceptions);
      if (res?.success && res.data) setExceptions(res.data);
    } catch {
      // the gate notice already covers the refused-company case
    }
  }, [includeInactiveExceptions]);

  const loadResults = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchVisualResults(filters);
      if (res?.success) {
        const paged = unwrapPaged(res);
        setResults(paged.items);
        setRowCount(paged.rowCount);
        setPageCount(paged.pageCount);
        setResultsMessage(null);
      } else {
        setResults([]);
        setRowCount(0);
        setPageCount(0);
        setResultsMessage(res?.message || 'Failed to fetch visual results');
      }
    } catch {
      setResults([]);
      setResultsMessage('An error occurred while fetching visual results');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadSummary();
    // Full = the complete scenario catalogue, for filter options and display names.
    fetchVisualScenarios(VisualLevelEnum.Full)
      .then((res) => {
        if (res?.success && res.data) setScenarioSet(res.data);
      })
      .catch(() => undefined);
    if (canManageFramework)
      fetchSystemTestRuns({
        pageNumber: 1,
        pageSize: 25,
        kind: SystemTestRunKindEnum.VisualRegression,
        sortBy: 'StartedOn',
        sortDesc: true,
      })
        .then((res) => {
          if (res?.success) setVisualRuns(unwrapPaged(res).items);
        })
        .catch(() => undefined);
  }, [loadSummary, canManageFramework]);

  useEffect(() => {
    loadExceptions();
  }, [loadExceptions]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  // The export target: the filtered run when one is selected, else the latest run.
  const exportRunId = canManageFramework
    ? (filters.runId ?? summary?.latestRunId ?? null)
    : null;
  useEffect(() => {
    if (!exportRunId) {
      setExportRun(null);
      return;
    }
    let cancelled = false;
    fetchSystemTestRun(exportRunId)
      .then((res) => {
        if (!cancelled && res?.success && res.data) setExportRun(res.data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [exportRunId]);

  // ---- lookups ----------------------------------------------------------------------

  const scenarioNames = useMemo(() => {
    const map = new Map<string, string>();
    scenarioSet?.modules.forEach((module) =>
      module.scenarios.forEach((planned) =>
        map.set(planned.definition.key, planned.definition.name)
      )
    );
    return map;
  }, [scenarioSet]);

  const moduleOptions = useMemo(
    () =>
      (scenarioSet?.modules ?? []).map((module) => ({
        value: module.moduleKey,
        label: module.displayName,
      })),
    [scenarioSet]
  );

  const scenarioOptions = useMemo(
    () =>
      (scenarioSet?.modules ?? [])
        .filter(
          (module) => !filters.moduleKey || module.moduleKey === filters.moduleKey
        )
        .flatMap((module) =>
          module.scenarios.map((planned) => ({
            value: planned.definition.key,
            label: planned.definition.name,
          }))
        ),
    [scenarioSet, filters.moduleKey]
  );

  const viewportOptions = useMemo(() => {
    const names = new Set<string>(summary?.viewports ?? []);
    scenarioSet?.modules.forEach((module) =>
      module.scenarios.forEach((planned) =>
        planned.viewports.forEach((viewport) => names.add(viewport.name))
      )
    );
    return [...names].sort().map((name) => ({ value: name, label: name }));
  }, [summary, scenarioSet]);

  const baselineUsed = detail?.baselineId
    ? (baselines.find((baseline) => baseline.id === detail.baselineId) ?? null)
    : null;

  // ---- actions ----------------------------------------------------------------------

  const copyCommand = async (command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      addToast.info(
        'Command copied. Run it from the frontend repo — the web app cannot launch Playwright.'
      );
    } catch {
      addToast.error(`Could not copy to the clipboard. Command: ${command}`);
    }
  };

  const pageRerunCommand = () =>
    `npm run visual -- --level regression${
      filters.moduleKey ? ` --module ${filters.moduleKey}` : ''
    }`;

  /** Tile click: the tile's count describes the latest run, so the filter must too. */
  const filterToLatestRun = (status: VisualStatusEnum | undefined) =>
    setFilters((prev) => ({
      ...prev,
      runId: summary?.latestRunId ?? undefined,
      visualStatus: status,
      pageNumber: 1,
    }));

  const resultRerunCommand = (result: IVisualResult) =>
    `npm run visual -- --level full --module ${result.moduleKey} --scenario ${result.scenarioKey}`;

  const openDetail = (result: IVisualResult) => {
    setDetail(result);
    setBaselines([]);
    setBaselinesLoading(true);
    fetchVisualBaselines(result.scenarioKey, result.viewport)
      .then((res) => {
        if (res?.success && res.data) setBaselines(res.data);
      })
      .catch(() => undefined)
      .finally(() => setBaselinesLoading(false));
  };

  const refreshAfterDecision = () => {
    loadResults();
    loadSummary();
  };

  const approve = async (reason: string) => {
    if (!detail) return;
    setDecisionBusy(true);
    try {
      const res = await approveVisualBaseline(detail.id, { reason });
      if (res?.success && res.data) {
        addToast.success(
          `Baseline v${res.data.version} approved for ${detail.scenarioKey} · ${detail.viewport}`
        );
        setApproveOpen(false);
        setDetail((current) =>
          current
            ? {
                ...current,
                reviewDecision: VisualReviewDecisionEnum.ApprovedNewBaseline,
                reviewComment: reason,
              }
            : current
        );
        setBaselines((current) => [
          res.data,
          ...current.map((baseline) =>
            baseline.scenarioKey === res.data.scenarioKey &&
            baseline.viewport === res.data.viewport &&
            baseline.platform === res.data.platform
              ? { ...baseline, isActive: false }
              : baseline
          ),
        ]);
        refreshAfterDecision();
      } else {
        addToast.error(res?.message || 'The approval was refused');
      }
    } catch {
      addToast.error('An error occurred while approving the baseline');
    } finally {
      setDecisionBusy(false);
    }
  };

  const keep = async (reason: string) => {
    if (!detail) return;
    setDecisionBusy(true);
    try {
      const res = await keepVisualBaseline(detail.id, { reason });
      if (res?.success && res.data) {
        addToast.success('Recorded: the existing baseline stays authoritative');
        setKeepOpen(false);
        setDetail(res.data);
        refreshAfterDecision();
      } else {
        addToast.error(res?.message || 'The decision was refused');
      }
    } catch {
      addToast.error('An error occurred while recording the decision');
    } finally {
      setDecisionBusy(false);
    }
  };

  const createTemporaryDifference = async (payload: {
    reason: string;
    expiresOn: string;
    ticketReference: string | null;
  }) => {
    if (!detail) return;
    setDecisionBusy(true);
    try {
      const res = await createVisualException({
        moduleKey: detail.moduleKey,
        scenarioKey: detail.scenarioKey,
        viewport: detail.viewport,
        reason: payload.reason,
        expiresOn: payload.expiresOn,
        ticketReference: payload.ticketReference,
        // The server stamps this result's ReviewDecision=TemporaryDifference in the
        // same SaveChanges as the exception — the row never shows "not reviewed".
        resultId: detail.id,
      });
      if (res?.success && res.data) {
        addToast.success(
          `Temporary difference recorded until ${stamp(res.data.expiresOn).slice(0, 10)}`
        );
        setTemporaryOpen(false);
        setDetail((current) =>
          current
            ? {
                ...current,
                reviewDecision: VisualReviewDecisionEnum.TemporaryDifference,
                reviewComment: payload.reason,
              }
            : current
        );
        loadExceptions();
        refreshAfterDecision();
      } else {
        addToast.error(res?.message || 'The exception was refused');
      }
    } catch {
      addToast.error('An error occurred while creating the exception');
    } finally {
      setDecisionBusy(false);
    }
  };

  const deactivate = async (exception: IVisualException) => {
    try {
      const res = await deactivateVisualException(exception.id);
      if (res?.success) {
        addToast.success('Exception deactivated');
        loadExceptions();
        loadSummary();
      } else {
        addToast.error(res?.message || 'The deactivation was refused');
      }
    } catch {
      addToast.error('An error occurred while deactivating the exception');
    }
  };

  // ---- table ------------------------------------------------------------------------

  // sortField names VisualResult ENTITY properties the dynamic sorter binds
  // (ScenarioKey, Viewport, VisualStatus, FunctionalStatus, DiffPixelRatio,
  // ReviewDecision, CreatedOn, DurationMs). Diff % IS entity-backed: the runner-reported
  // ratio is persisted verbatim (§12.4) — the column label carries that caveat.
  const columns: TTableColumn[] = [
    { key: 'scenario', label: 'Scenario', width: 230, name: 'scenario', sortField: 'ScenarioKey' },
    { key: 'viewport', label: 'Viewport', width: 100, name: 'viewport', sortField: 'Viewport' },
    { key: 'status', label: 'Status', width: 150, name: 'status', sortField: 'VisualStatus' },
    { key: 'functional', label: 'Functional', width: 100, name: 'functional', sortField: 'FunctionalStatus' },
    {
      key: 'diff',
      label: <span title="Pixel-diff ratio as the runner reported it">Diff %</span>,
      width: 90,
      name: 'diff',
      sortField: 'DiffPixelRatio',
      contentAlign: 'right',
    },
    { key: 'decision', label: 'Decision', width: 170, name: 'decision', sortField: 'ReviewDecision' },
    { key: 'captured', label: 'Captured', width: 130, name: 'captured', sortField: 'CreatedOn' },
    {
      key: 'duration',
      label: 'Duration',
      width: 90,
      name: 'duration',
      sortField: 'DurationMs',
      contentAlign: 'right',
    },
  ];

  const rowData = results.map((result) => ({
    id: result.id,
    scenario: (
      <div>
        <p className="font-mono text-xs font-medium text-secondaryColor">
          {result.scenarioKey}
        </p>
        {scenarioNames.get(result.scenarioKey) && (
          <p className="mt-0.5 text-xs text-gray-500">
            {scenarioNames.get(result.scenarioKey)}
          </p>
        )}
      </div>
    ),
    viewport: result.viewport,
    status: (
      <div>
        <span
          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${VISUAL_STATUS_BADGE[result.visualStatus]}`}
        >
          {VISUAL_STATUS_LABELS[result.visualStatus] ?? result.visualStatus}
        </span>
        {result.reasonCode && (
          <code className="mt-1 block w-fit rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
            {result.reasonCode}
          </code>
        )}
      </div>
    ),
    functional: (
      <span
        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${VISUAL_FUNCTIONAL_BADGE[result.functionalStatus]}`}
      >
        {VISUAL_FUNCTIONAL_LABELS[result.functionalStatus] ?? result.functionalStatus}
      </span>
    ),
    diff: <span className="tabular-nums">{diffPercent(result)}</span>,
    decision:
      result.reviewDecision === VisualReviewDecisionEnum.None ? (
        <span className="text-gray-400">
          {VISUAL_DECISION_LABELS[VisualReviewDecisionEnum.None]}
        </span>
      ) : (
        VISUAL_DECISION_LABELS[result.reviewDecision]
      ),
    captured: stamp(result.createdOn),
    duration: <span className="tabular-nums">{durationText(result.durationMs)}</span>,
  }));

  const updateFilters = (updates: Partial<ITableFilters>) => {
    setFilters((prev) => mergeTableFilters(prev, updates));
  };

  const activeFilterCount = [
    filters.moduleKey,
    filters.scenarioKey,
    filters.viewport,
    filters.visualStatus,
    filters.runId,
  ].filter((value) => value != null && value !== '').length;

  const jsErrors = parseJsonList(detail?.jsErrors);
  const failedAssertions = parseJsonList(detail?.failedAssertions);
  const missingSelectors = parseJsonList(detail?.missingCriticalSelectors);

  return (
    <div className="px-4 sm:px-6 py-6">
      <BackButton className="mb-3" />
      <h1 className="text-lg font-semibold text-secondaryColor">Visual Regression</h1>
      <p className="text-xs text-gray-500 mt-0.5 max-w-3xl">
        Playwright captures of the registered test company, diffed against approved
        baselines. Diff ratios are runner-reported; the images and the classification
        are the server&apos;s. Runs execute from the frontend repo CLI — the web app
        cannot launch Playwright.
      </p>

      {gateNotice && (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {gateNotice} Open the registered test company from the{' '}
          <a href="/system-test/demo" className="font-medium underline">
            Demo &amp; Environment page
          </a>{' '}
          first.
        </p>
      )}

      {summary && (
        <>
          {/* Status tiles: reserved status colours with icon + label — never colour
              alone. The counts cover the LATEST run (that is what the summary endpoint
              returns), so a tile click filters the table to that run + status —
              otherwise the tile and the table would disagree. */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <SummaryCard
              title="Results (latest run)"
              value={summary.totalResults}
              tint="indigo"
              iconName="clipboard"
              onClick={() => filterToLatestRun(undefined)}
            />
            <SummaryCard
              title="Pass"
              value={summary.passCount}
              tint="mint"
              iconName="check-circle"
              onClick={() => filterToLatestRun(VisualStatusEnum.Pass)}
            />
            <SummaryCard
              title="Minor difference"
              value={summary.minorDifferenceCount}
              tint="amber"
              iconName="info"
              onClick={() => filterToLatestRun(VisualStatusEnum.MinorDifference)}
            />
            <SummaryCard
              title="Review required"
              value={summary.reviewRequiredCount}
              tint="peach"
              iconName="alert"
              onClick={() => filterToLatestRun(VisualStatusEnum.ReviewRequired)}
            />
            <SummaryCard
              title="Broken"
              value={summary.brokenCount}
              tint="pink"
              iconName="zap"
              onClick={() => filterToLatestRun(VisualStatusEnum.Broken)}
            />
            <SummaryCard
              title="New scenarios"
              value={summary.newScenarioCount}
              tint="sky"
              iconName="eye"
              onClick={() => filterToLatestRun(VisualStatusEnum.NewScenario)}
            />
          </div>

          <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
                <div>
                  <p className="text-xs text-gray-500">Latest run</p>
                  {summary.latestRunStatus != null ? (
                    <span
                      className={`mt-0.5 inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${RUN_STATUS_BADGE[summary.latestRunStatus]}`}
                    >
                      {RUN_STATUS_LABELS[summary.latestRunStatus]}
                    </span>
                  ) : (
                    <p className="text-sm font-medium text-gray-800">—</p>
                  )}
                </div>
                <DetailField label="Started" value={stamp(summary.latestRunStartedOn)} />
                <DetailField
                  label="Viewports"
                  value={summary.viewports.length > 0 ? summary.viewports.join(', ') : '—'}
                />
                <DetailField
                  label="Latest baseline approval"
                  value={stamp(summary.latestBaselineApprovedOn)}
                />
                <DetailField label="Active baselines" value={summary.activeBaselineCount} />
                <DetailField
                  label="Active exceptions"
                  value={summary.activeExceptionCount}
                />
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="toolbar"
                    onClick={() => copyCommand(pageRerunCommand())}
                    title={pageRerunCommand()}
                  >
                    <i className="icon icon-redo text-xs" />
                    <span>Copy run command</span>
                  </Button>
                  {exportRun && <RunExportButtons run={exportRun} />}
                </div>
                <p className="text-[11px] text-gray-400">
                  {exportRun
                    ? `Exports cover ${filters.runId ? 'the filtered run' : 'the latest run'}; the command runs Playwright from the frontend repo.`
                    : 'The command runs Playwright from the frontend repo.'}
                </p>
              </div>
            </div>
          </section>
        </>
      )}

      <div className="mt-4">
        {resultsMessage && !gateNotice && (
          <p className="mb-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {resultsMessage}
          </p>
        )}
        <CustomTable
          columns={columns}
          rows={rowData}
          tableName="Visual Results"
          showBack={false}
          serialOffset={
            ((filters.pageNumber ?? 1) - 1) * (filters.pageSize ?? DEFAULT_PAGE_SIZE)
          }
          isLoading={loading}
          selectable={false}
          sortBy={filters.sortBy}
          sortDesc={filters.sortDesc}
          onRowClick={(row) => {
            const result = results.find((r) => r.id === row.id);
            if (result) openDetail(result);
          }}
          tableHeaderRight={
            <FilterPanel
              open={showFilters}
              onOpenChange={setShowFilters}
              activeCount={activeFilterCount}
              onClearAll={() =>
                setFilters((prev) => ({
                  ...prev,
                  moduleKey: undefined,
                  scenarioKey: undefined,
                  viewport: undefined,
                  visualStatus: undefined,
                  runId: undefined,
                  pageNumber: 1,
                }))
              }
            >
              <Select
                label="Module"
                placeholder="All"
                options={moduleOptions}
                value={filters.moduleKey ?? ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    moduleKey: e.target.value || undefined,
                    // A scenario belongs to a module — changing module resets it.
                    scenarioKey: undefined,
                    pageNumber: 1,
                  }))
                }
              />
              <Select
                label="Scenario"
                placeholder="All"
                options={scenarioOptions}
                value={filters.scenarioKey ?? ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    scenarioKey: e.target.value || undefined,
                    pageNumber: 1,
                  }))
                }
              />
              <Select
                label="Viewport"
                placeholder="All"
                options={viewportOptions}
                value={filters.viewport ?? ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    viewport: e.target.value || undefined,
                    pageNumber: 1,
                  }))
                }
              />
              <Select
                label="Status"
                placeholder="All"
                options={Object.entries(VISUAL_STATUS_LABELS).map(([value, label]) => ({
                  value,
                  label,
                }))}
                value={filters.visualStatus != null ? String(filters.visualStatus) : ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    visualStatus: e.target.value
                      ? (Number(e.target.value) as VisualStatusEnum)
                      : undefined,
                    pageNumber: 1,
                  }))
                }
              />
              {canManageFramework && (
                <Select
                  label="Run"
                  placeholder="All runs"
                  options={visualRuns.map((run) => ({
                    value: run.id,
                    label: `${stamp(run.startedOn)} — ${RUN_STATUS_LABELS[run.status]}`,
                  }))}
                  value={filters.runId ?? ''}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      runId: e.target.value || undefined,
                      pageNumber: 1,
                    }))
                  }
                />
              )}
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
      </div>

      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-secondaryColor">
              Temporary exceptions
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Time-boxed waivers: until expiry the scenario×viewport classifies as a
              minor difference instead of review-required. Broken is never excepted, and
              expiry reverts on its own.
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={includeInactiveExceptions}
              onChange={(e) => setIncludeInactiveExceptions(e.target.checked)}
            />
            Include inactive
          </label>
        </div>
        {exceptions.length === 0 ? (
          <p className="mt-3 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
            No {includeInactiveExceptions ? '' : 'active '}exceptions.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium text-gray-600">Scenario</th>
                  <th className="px-3 py-2 w-24 font-medium text-gray-600">Viewport</th>
                  <th className="px-3 py-2 font-medium text-gray-600">Reason</th>
                  <th className="px-3 py-2 w-28 font-medium text-gray-600">Expires</th>
                  <th className="px-3 py-2 w-28 font-medium text-gray-600">Ticket</th>
                  <th className="px-3 py-2 w-24 font-medium text-gray-600">State</th>
                  {canManageExceptions && <th className="px-3 py-2 w-28" />}
                </tr>
              </thead>
              <tbody>
                {exceptions.map((exception) => {
                  const state = exceptionState(exception);
                  return (
                    <tr key={exception.id} className="border-t border-gray-50 align-top">
                      <td className="px-3 py-2 font-mono text-xs font-medium text-secondaryColor">
                        {exception.scenarioKey}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{exception.viewport}</td>
                      <td className="px-3 py-2 text-gray-700">{exception.reason}</td>
                      <td className="px-3 py-2 text-gray-700">
                        {stamp(exception.expiresOn).slice(0, 10)}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {exception.ticketReference || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${state.badge}`}
                        >
                          {state.label}
                        </span>
                      </td>
                      {canManageExceptions && (
                        <td className="px-3 py-2 text-right">
                          {exception.isActive && (
                            <Button
                              variant="toolbarDanger"
                              onClick={() => deactivate(exception)}
                            >
                              Deactivate
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---- detail modal ------------------------------------------------------------ */}
      <Modal isOpen={!!detail} onClose={() => setDetail(null)} size="7xl">
        {detail && (
          <div className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-semibold text-secondaryColor">
                    {scenarioNames.get(detail.scenarioKey) ?? detail.scenarioKey}
                  </h2>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${VISUAL_STATUS_BADGE[detail.visualStatus]}`}
                  >
                    {VISUAL_STATUS_LABELS[detail.visualStatus]}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${VISUAL_FUNCTIONAL_BADGE[detail.functionalStatus]}`}
                  >
                    Functional: {VISUAL_FUNCTIONAL_LABELS[detail.functionalStatus]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  <span className="font-mono font-medium text-secondaryColor">
                    {detail.scenarioKey}
                  </span>
                  {' · '}
                  {detail.viewport}
                  {' · '}
                  {detail.platform}
                  {detail.browserVersion ? ` · Chromium ${detail.browserVersion}` : ''}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="toolbar"
                    onClick={() => copyCommand(resultRerunCommand(detail))}
                    title={resultRerunCommand(detail)}
                  >
                    <i className="icon icon-redo text-xs" />
                    <span>Re-run</span>
                  </Button>
                  {canApprove && detail.currentFileId && (
                    <Button variant="toolbar" onClick={() => setApproveOpen(true)}>
                      <i className="icon icon-check-circle text-xs" />
                      <span>Approve new baseline</span>
                    </Button>
                  )}
                  {canApprove && detail.baselineId && (
                    <Button variant="toolbar" onClick={() => setKeepOpen(true)}>
                      <i className="icon icon-lock text-xs" />
                      <span>Keep existing</span>
                    </Button>
                  )}
                  {canManageExceptions &&
                    (detail.visualStatus === VisualStatusEnum.MinorDifference ||
                      detail.visualStatus === VisualStatusEnum.ReviewRequired) && (
                      <Button variant="toolbar" onClick={() => setTemporaryOpen(true)}>
                        <i className="icon icon-hourglass text-xs" />
                        <span>Temporary difference</span>
                      </Button>
                    )}
                </div>
                <p className="text-[11px] text-gray-400">
                  Re-run copies the CLI command — the web app cannot launch Playwright.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4 sm:grid-cols-4">
              <DetailField label="Module" value={detail.moduleKey} />
              <DetailField
                label="Difference (runner-reported)"
                value={diffPercent(detail)}
              />
              <DetailField label="Captured" value={stamp(detail.createdOn)} />
              <DetailField label="Duration" value={durationText(detail.durationMs)} />
              <DetailField
                label="Baseline used"
                value={
                  detail.baselineId
                    ? baselineUsed
                      ? `v${baselineUsed.version}`
                      : '…'
                    : 'None (first run)'
                }
              />
              <DetailField label="Reason code" value={detail.reasonCode} />
              <DetailField
                label="Decision"
                value={VISUAL_DECISION_LABELS[detail.reviewDecision]}
              />
              <DetailField label="Reviewed" value={stamp(detail.reviewedOn)} />
            </div>

            {detail.reviewComment && (
              <p className="mt-3 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
                <span className="font-medium">Review comment:</span> {detail.reviewComment}
              </p>
            )}

            {/* §12.4: baseline and current come from SERVER files; the diff is the
                runner's advisory overlay. */}
            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Baseline{baselineUsed ? ` · v${baselineUsed.version}` : ''}
                </h3>
                {detail.baselineId && baselinesLoading ? (
                  <div className="mt-2 flex min-h-[120px] w-full animate-pulse items-center justify-center rounded border border-gray-200 bg-gray-100 text-xs text-gray-400">
                    Loading…
                  </div>
                ) : (
                  <VisualImage
                    fileId={baselineUsed?.fileId}
                    alt={`Baseline for ${detail.scenarioKey} at ${detail.viewport}`}
                    className="mt-2 w-full min-h-[120px] bg-gray-50 object-contain"
                  />
                )}
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Current
                </h3>
                <VisualImage
                  fileId={detail.currentFileId}
                  alt={`Current capture of ${detail.scenarioKey} at ${detail.viewport}`}
                  className="mt-2 w-full min-h-[120px] bg-gray-50 object-contain"
                />
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Diff (advisory, runner-generated)
                </h3>
                <VisualImage
                  fileId={detail.diffFileId}
                  alt={`Pixel diff of ${detail.scenarioKey} at ${detail.viewport}`}
                  className="mt-2 w-full min-h-[120px] bg-gray-50 object-contain"
                />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <FindingList
                title="Failed assertions"
                entries={failedAssertions}
                tone="red"
              />
              <FindingList title="JS errors" entries={jsErrors} tone="red" />
              <FindingList
                title="Missing critical selectors"
                entries={missingSelectors}
                tone="amber"
              />
            </div>

            <div className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Baseline history · {detail.scenarioKey} · {detail.viewport}
              </h3>
              {baselinesLoading ? (
                <p className="mt-2 text-sm text-gray-400">Loading…</p>
              ) : baselines.length === 0 ? (
                <p className="mt-2 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
                  No baseline has been approved yet — approving this result creates v1.
                </p>
              ) : (
                <div className="mt-2 overflow-x-auto rounded-lg border border-gray-100">
                  <table className="w-full min-w-[680px] text-sm">
                    <thead className="bg-gray-50 text-left">
                      <tr>
                        <th className="px-3 py-2 w-16 font-medium text-gray-600">Version</th>
                        <th className="px-3 py-2 w-24 font-medium text-gray-600">Platform</th>
                        <th className="px-3 py-2 w-32 font-medium text-gray-600">Approved</th>
                        <th className="px-3 py-2 font-medium text-gray-600">Reason</th>
                        <th className="px-3 py-2 w-28 font-medium text-gray-600">
                          App version
                        </th>
                        <th className="px-3 py-2 w-20 font-medium text-gray-600">State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {baselines.map((baseline) => (
                        <tr key={baseline.id} className="border-t border-gray-50 align-top">
                          <td className="px-3 py-2 font-medium text-secondaryColor">
                            v{baseline.version}
                          </td>
                          <td className="px-3 py-2 text-gray-700">{baseline.platform}</td>
                          <td className="px-3 py-2 text-gray-700">
                            {stamp(baseline.approvedOn)}
                          </td>
                          <td className="px-3 py-2 text-gray-700">{baseline.reason}</td>
                          <td className="px-3 py-2 text-gray-700">
                            {baseline.appVersion || '—'}
                          </td>
                          <td className="px-3 py-2">
                            {baseline.isActive ? (
                              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                                Superseded
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {detail && (
        <>
          <ApproveBaselineModal
            isOpen={approveOpen}
            onClose={() => setApproveOpen(false)}
            result={detail}
            busy={decisionBusy}
            onConfirm={approve}
          />
          <KeepBaselineModal
            isOpen={keepOpen}
            onClose={() => setKeepOpen(false)}
            result={detail}
            busy={decisionBusy}
            onConfirm={keep}
          />
          <TemporaryDifferenceModal
            isOpen={temporaryOpen}
            onClose={() => setTemporaryOpen(false)}
            result={detail}
            busy={decisionBusy}
            onConfirm={createTemporaryDifference}
          />
        </>
      )}
    </div>
  );
};

/**
 * ViewVisualRegression, NOT ManageSystemTest: VisualRegressionController carries
 * method-level permissions precisely so reviewers do not need the destructive framework
 * permission (visual design §12.2) — the page's fence matches the controller's.
 */
const VisualRegressionPage = () => (
  <SystemTestGate permissions={[Permission.ViewVisualRegression]}>
    <VisualContent />
  </SystemTestGate>
);

export default VisualRegressionPage;
