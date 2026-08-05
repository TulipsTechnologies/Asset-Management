'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/Providers/ToastProvider';
import Button from '@/components/UI/Button';
import CustomTable from '@/components/CustomTable/CustomTable';
import ImportExportOptions from '@/components/ImportExport/ImportExportOptions';
import {
  ITableFilters,
  TTableColumn,
} from '@/components/CustomTable/CustomTableInterface';
import ConfirmationModal from '@/components/UI/ConfirmationModel';
import Modal from '@/components/UI/Modal';
import Select from '@/components/UI/Select';
import FilterPanel from '@/components/UI/FilterPanel';
import SearchBox from '@/components/SearchBox';
import Pagination from '@/components/UI/Pagination';
import ViewSwitcher, { IViewOption, readStoredView } from '@/components/UI/ViewSwitcher';
import AssetCardView from '@/components/Assets/AssetCardView';
import AssetCalendarView from '@/components/Assets/AssetCalendarView';
import AssetAnalyticsView from '@/components/Assets/AssetAnalyticsView';
import SingleAssignModal, { IAssignTarget } from '@/components/Assignments/SingleAssignModal';
import {
  AssetActionsMenu,
  IAssetAction,
  StatusBadge,
  VAT_RATE,
  money,
  shortDate,
} from '@/components/Assets/AssetViewShared';
import { IAssetFilter, IAssetListItem } from '@/interface/IAsset';
import { IAssetCategory } from '@/interface/IAssetCategory';
import { IEmployee } from '@/interface/IEmployee';
import {
  activateAsset,
  bulkActivateAssets,
  BulkActivateOutcomeEnum,
  deleteAsset,
  fetchAssets,
  IBulkActivateResult,
} from '@/services/asset.service';
import { fetchAssetCategories } from '@/services/assetCategory.service';
import { fetchEmployees } from '@/services/employee.service';
import { unwrapPaged } from '@/utils/serviceUtils';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';
import {
  CUSTODY_BADGE_CLASSES,
  CUSTODY_LABELS,
  CustodyStatusEnum,
  enumOptions,
  LIFECYCLE_BADGE_CLASSES,
  LIFECYCLE_LABELS,
  LifecycleStatusEnum,
  OPERATIONAL_LABELS,
  OperationalStatusEnum,
} from '@/enum/assetEnums';
import useDebounce from '@/hooks/useDebounce';

/* --------------------------------------------------------------------- */
/* View modes                                                             */
/* --------------------------------------------------------------------- */

type TAssetView = 'table' | 'card' | 'calendar' | 'analytics';

const VIEW_VALUES = ['table', 'card', 'calendar', 'analytics'] as const;
const VIEW_STORAGE_KEY = 'assets.viewMode';

const VIEW_OPTIONS: IViewOption<TAssetView>[] = [
  // Rows, not columns: Manage Columns sits inches away in the same toolbar and owns the
  // three-cols glyph, so sharing it made the two controls look like the same control.
  { value: 'table', label: 'Table', iconName: 'menu', title: 'Compare assets column by column' },
  { value: 'card', label: 'Cards', iconName: 'modules', title: 'Browse assets one tile at a time' },
  { value: 'calendar', label: 'Calendar', iconName: 'calendar', title: 'What falls due, and when' },
  { value: 'analytics', label: 'Analytics', iconName: 'bar-chart', title: 'What this selection is made of' },
];

/** Table and Cards page through the same result set; the other two describe it whole. */
const PAGED_VIEWS: TAssetView[] = ['table', 'card'];

const AssetsPage = () => {
  const { addToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialLifecycle = searchParams.get('lifecycleStatus');

  const [view, setView] = useState<TAssetView>('table');
  const [assets, setAssets] = useState<IAssetListItem[]>([]);
  const [deleting, setDeleting] = useState<IAssetListItem | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [categories, setCategories] = useState<IAssetCategory[]>([]);
  const [employees, setEmployees] = useState<IEmployee[]>([]);
  const [assigning, setAssigning] = useState<IAssignTarget | null>(null);
  const [bulkActivateResult, setBulkActivateResult] = useState<IBulkActivateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  const [filters, setFilters] = useState<IAssetFilter>({
    pageNumber: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    lifecycleStatus: initialLifecycle
      ? (Number(initialLifecycle) as LifecycleStatusEnum)
      : undefined,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 400);
  const [showFilters, setShowFilters] = useState(false);
  const loadTokenRef = useRef(0);
  // Ids with an activation in flight — the row menu stays open after a click, so without
  // this a second click would re-send the same, now-spent RowVersion and read as a 409.
  const activatingRef = useRef<Set<string>>(new Set());

  // Restored after mount, never during render: the server has no localStorage, and
  // painting the remembered view on the first client pass would hydrate mismatched.
  useEffect(() => {
    const stored = readStoredView<TAssetView>(VIEW_STORAGE_KEY, VIEW_VALUES);
    if (stored) setView(stored);
  }, []);

  const columns: TTableColumn[] = [
    { key: 'purchaseDate', label: 'Purchase Date', width: 120, type: 'date', name: 'purchaseDate' },
    { key: 'assetCode', label: 'Code', width: 140, type: 'string', name: 'assetCode' },
    { key: 'assetName', label: 'Asset Name', width: 190, type: 'string', name: 'assetName' },
    { key: 'currentCustodianEmployeeName', label: 'Custodian', width: 150, type: 'string', name: 'currentCustodianEmployeeName' },
    { key: 'units', label: 'Units', width: 60, name: 'units' },
    { key: 'netPrice', label: 'Net Price', width: 120, name: 'netPrice' },
    { key: 'totalPrice', label: `Total (incl. ${VAT_RATE * 100}% VAT)`, width: 155, name: 'totalPrice' },
    { key: 'accumulatedDepreciation', label: 'Depreciation', width: 120, name: 'accumulatedDepreciation' },
    { key: 'netBookValue', label: 'Net Value', width: 120, name: 'netBookValue' },
    { key: 'assetLocationName', label: 'Location', width: 150, type: 'string', name: 'assetLocationName' },
    { key: 'lifecycleStatus', label: 'Lifecycle', width: 110, name: 'lifecycleStatus' },
    // Off by default — Manage Columns brings them back per user or company-wide.
    { key: 'assetCategoryName', label: 'Category', width: 150, type: 'string', name: 'assetCategoryName', visible: false },
    { key: 'serialNumber', label: 'Serial No.', width: 140, type: 'string', name: 'serialNumber', visible: false },
    { key: 'custodyStatus', label: 'Custody', width: 120, name: 'custodyStatus', visible: false },
    { key: 'conditionName', label: 'Condition', width: 110, type: 'string', name: 'conditionName', visible: false },
    {
      key: 'actions',
      label: <i className="icon icon-actions text-[10px]" />,
      width: 45,
      canToggle: false,
      name: 'actions',
    },
  ];

  const loadAssets = useCallback(async () => {
    // Generation token: an action can fire a refresh while a page or filter change is
    // still in flight, and the register must end up showing the LATEST request's rows,
    // never whichever response happened to land last.
    const token = ++loadTokenRef.current;
    setLoading(true);
    try {
      const res = await fetchAssets(filters);
      if (token !== loadTokenRef.current) return;
      if (res?.success) {
        const paged = unwrapPaged(res);
        setAssets(paged.items);
        setRowCount(paged.rowCount);
        setPageCount(paged.pageCount);
      } else {
        addToast.error(res?.message || 'Failed to fetch assets');
      }
    } catch (error) {
      if (token !== loadTokenRef.current) return;
      console.error('Error fetching assets:', error);
      addToast.error('An error occurred while fetching assets');
    } finally {
      if (token === loadTokenRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Only the paged views need the list. Calendar and Analytics fetch their own shape from
  // the same filters, so leaving this running would be a wasted request per keystroke.
  useEffect(() => {
    if (PAGED_VIEWS.includes(view)) loadAssets();
  }, [loadAssets, view]);

  useEffect(() => {
    // Categories for the filter dropdown (first 500 covers real-world category counts).
    fetchAssetCategories({ pageNumber: 1, pageSize: 500 })
      .then((res) => {
        if (res?.success) setCategories(unwrapPaged(res).items);
      })
      .catch(() => undefined);

    // Custodians for the assign modal — only active employees can receive an asset.
    fetchEmployees({ pageNumber: 1, pageSize: 500, isActive: true })
      .then((res) => {
        if (res?.success) setEmployees(unwrapPaged(res).items);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      search: debouncedSearch || undefined,
      pageNumber: 1,
    }));
  }, [debouncedSearch]);

  const updateFilters = (updates: Partial<ITableFilters>) => {
    setFilters((prev) => ({
      ...prev,
      ...(updates.pageNumber !== undefined && {
        pageNumber: Number(updates.pageNumber),
      }),
      ...(updates.pageSize !== undefined && {
        pageSize: Number(updates.pageSize),
        pageNumber: 1,
      }),
    }));
  };

  /**
   * The filter identity Calendar and Analytics depend on — deliberately without the page
   * number, so turning a page in the table does not refetch a calendar that would come
   * back byte-identical. Memoized on the primitives, because a fresh object every render
   * would defeat the effect that consumes it.
   */
  const viewFilters = useMemo<IAssetFilter>(
    () => ({
      search: filters.search,
      assetCategoryId: filters.assetCategoryId,
      lifecycleStatus: filters.lifecycleStatus,
      custodyStatus: filters.custodyStatus,
      operationalStatus: filters.operationalStatus,
    }),
    [
      filters.search,
      filters.assetCategoryId,
      filters.lifecycleStatus,
      filters.custodyStatus,
      filters.operationalStatus,
    ]
  );

  const activeFilterCount = [
    filters.assetCategoryId,
    filters.lifecycleStatus,
    filters.custodyStatus,
    filters.operationalStatus,
  ].filter((value) => value != null).length;

  /** Plain-language echo of the active narrowing, so Analytics can say what it describes. */
  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (filters.assetCategoryId) {
      const category = categories.find((c) => c.id === filters.assetCategoryId);
      if (category) parts.push(category.name);
    }
    if (filters.lifecycleStatus != null) parts.push(LIFECYCLE_LABELS[filters.lifecycleStatus]);
    if (filters.custodyStatus != null) parts.push(CUSTODY_LABELS[filters.custodyStatus]);
    if (filters.operationalStatus != null) parts.push(OPERATIONAL_LABELS[filters.operationalStatus]);
    if (filters.search) parts.push(`matching “${filters.search}”`);
    return parts.length ? parts.join(' · ') : 'every asset in the register';
  }, [filters, categories]);

  const handleActivate = useCallback(
    async (asset: IAssetListItem) => {
      // The menu does not close on click, so a second click would otherwise re-send a
      // token the first call has already spent and report the success as a conflict.
      if (activatingRef.current.has(asset.id)) return;
      activatingRef.current.add(asset.id);
      try {
        const res = await activateAsset(asset.id, asset.rowVersion ?? '');
        if (res?.success) addToast.success(res.message || `Asset '${asset.assetCode}' is now Active.`);
        else addToast.error(res?.message || 'The asset could not be activated.');
      } catch {
        addToast.error('The asset could not be activated.');
      } finally {
        activatingRef.current.delete(asset.id);
        loadAssets();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadAssets]
  );

  /**
   * Declared once, rendered by the table cell and by every card. The lifecycle rule lives
   * here rather than in each view's markup, so a Delete hidden in one place cannot
   * reappear in another.
   *
   * Kept referentially stable across unrelated re-renders: the rows are built from it, and
   * a new rows array resets the table's selection — which would empty a bulk selection the
   * moment the operator opened the filter panel.
   */
  const assetActions = useMemo<IAssetAction[]>(
    () => [
      {
        // First in the menu, ahead of View. On a row that can be issued, issuing it is the
        // reason the menu was opened — View and Edit are what you do when it cannot be.
        //
        // Only what the list knows is gated here; the assign endpoint still has the last
        // word on operational holds, active transfers, pending returns and approved
        // disposals.
        label: 'Assign',
        iconName: 'user-check',
        onClick: (asset) =>
          setAssigning({
            id: asset.id,
            assetCode: asset.assetCode,
            assetName: asset.assetName,
          }),
        isAvailable: (asset) =>
          asset.lifecycleStatus === LifecycleStatusEnum.Active &&
          (asset.custodyStatus === CustodyStatusEnum.Unassigned ||
            asset.custodyStatus === CustodyStatusEnum.Reserved),
      },
      {
        // Lifecycle is a workflow, not an edit: this calls the activate endpoint with the
        // row's own token, so a stale row fails alone with the standard 409.
        label: 'Activate',
        iconName: 'zap',
        onClick: (asset) => handleActivate(asset),
        isAvailable: (asset) =>
          asset.lifecycleStatus === LifecycleStatusEnum.Draft ||
          asset.lifecycleStatus === LifecycleStatusEnum.Retired,
      },
      {
        label: 'View',
        iconName: 'eye',
        onClick: (asset) => router.push(`/assets/${asset.id}`),
      },
      {
        label: 'Edit',
        iconName: 'edit',
        onClick: (asset) => router.push(`/assets/${asset.id}/edit`),
      },
      {
        // A Draft was never in service — deletion is its honest exit. Anything past Draft
        // leaves through retirement and disposal, never deletion.
        label: 'Delete',
        iconName: 'trash',
        onClick: (asset) => setDeleting(asset),
        isAvailable: (asset) => asset.lifecycleStatus === LifecycleStatusEnum.Draft,
      },
    ],
    [router, handleActivate]
  );

  const rowData = useMemo(() => assets.map((asset) => ({
    id: asset.id,
    purchaseDate: shortDate(asset.purchaseDate),
    assetCode: (
      <span className="font-medium text-primarycolor">{asset.assetCode}</span>
    ),
    assetName: asset.assetName,
    // Named only while someone actually holds it: an unassigned asset has no custodian,
    // and printing the last one would read as current custody.
    currentCustodianEmployeeName: asset.currentCustodianEmployeeName || '—',
    // Item-level register: every row IS one unit. Registering with Quantity > 1
    // creates that many rows, each independently assignable.
    units: 1,
    netPrice: money(asset.purchaseCost, asset.currencyId),
    totalPrice:
      asset.purchaseCost != null
        ? money(
            Math.round(asset.purchaseCost * (1 + VAT_RATE) * 100) / 100,
            asset.currencyId
          )
        : '—',
    accumulatedDepreciation: money(asset.accumulatedDepreciation, asset.currencyId),
    netBookValue: money(asset.netBookValue, asset.currencyId),
    assetLocationName: asset.assetLocationName || '—',
    assetCategoryName: asset.assetCategoryName,
    serialNumber: asset.serialNumber || '—',
    lifecycleStatus: (
      <StatusBadge
        value={asset.lifecycleStatus}
        labels={LIFECYCLE_LABELS}
        classes={LIFECYCLE_BADGE_CLASSES}
      />
    ),
    custodyStatus: (
      <StatusBadge
        value={asset.custodyStatus}
        labels={CUSTODY_LABELS}
        classes={CUSTODY_BADGE_CLASSES}
      />
    ),
    conditionName: asset.conditionName,
    actions: (
      <AssetActionsMenu asset={asset} actions={assetActions} className="bg-white px-4 py-2 -m-2" />
    ),
  })), [assets, assetActions]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      const res = await deleteAsset(deleting.id, deleting.rowVersion ?? '');
      if (res?.success) addToast.success(res.message || 'Draft asset deleted');
      else addToast.error(res?.message || 'Could not delete the asset');
    } catch {
      addToast.error('Could not delete the asset');
    } finally {
      setDeletingBusy(false);
      setDeleting(null);
      loadAssets();
    }
  };

  /**
   * Selected ids come from the table's selection bar; the rowVersions come from the rows
   * already loaded — activation is an edit of a row the operator is looking at, so each
   * item carries its own token and a stale one fails only its own asset.
   */
  const handleBulkActivate = async (selectedIds: (string | number)[]) => {
    const items = selectedIds
      .map((id) => assets.find((a) => a.id === id))
      .filter((a): a is IAssetListItem => !!a)
      .map((a) => ({ assetId: a.id, rowVersion: a.rowVersion ?? null }));
    if (items.length === 0) return;

    try {
      const res = await bulkActivateAssets(items);
      if (res?.data) {
        setBulkActivateResult(res.data);
        if (res.data.activated > 0) addToast.success(res.message || 'Activation complete.');
        else if (res.data.failed > 0) addToast.error(res.message || 'Nothing was activated.');
        else addToast.success(res.message || 'Already active.');
      } else {
        addToast.error(res?.message || 'The activation failed.');
      }
    } catch {
      addToast.error('The activation failed.');
    } finally {
      loadAssets();
    }
  };

  const filterControls = (
    <>
      <FilterPanel
        open={showFilters}
        onOpenChange={setShowFilters}
        activeCount={activeFilterCount}
        onClearAll={() =>
          setFilters((prev) => ({
            ...prev,
            assetCategoryId: undefined,
            lifecycleStatus: undefined,
            custodyStatus: undefined,
            operationalStatus: undefined,
            pageNumber: 1,
          }))
        }
      >
        <Select
          label="Category"
          placeholder="All categories"
          options={categories.map((c) => ({
            value: c.id,
            label: `${c.categoryCode} — ${c.name}`,
          }))}
          value={filters.assetCategoryId ?? ''}
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              assetCategoryId: e.target.value || undefined,
              pageNumber: 1,
            }))
          }
        />
        <Select
          label="Lifecycle"
          placeholder="All"
          options={enumOptions(LIFECYCLE_LABELS).map((o) => ({
            value: String(o.value),
            label: o.label,
          }))}
          value={filters.lifecycleStatus != null ? String(filters.lifecycleStatus) : ''}
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              lifecycleStatus: e.target.value
                ? (Number(e.target.value) as LifecycleStatusEnum)
                : undefined,
              pageNumber: 1,
            }))
          }
        />
        <Select
          label="Custody"
          placeholder="All"
          options={enumOptions(CUSTODY_LABELS).map((o) => ({
            value: String(o.value),
            label: o.label,
          }))}
          value={filters.custodyStatus != null ? String(filters.custodyStatus) : ''}
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              custodyStatus: e.target.value
                ? (Number(e.target.value) as CustodyStatusEnum)
                : undefined,
              pageNumber: 1,
            }))
          }
        />
        <Select
          label="Operational"
          placeholder="All"
          options={enumOptions(OPERATIONAL_LABELS).map((o) => ({
            value: String(o.value),
            label: o.label,
          }))}
          value={filters.operationalStatus != null ? String(filters.operationalStatus) : ''}
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              operationalStatus: e.target.value
                ? (Number(e.target.value) as OperationalStatusEnum)
                : undefined,
              pageNumber: 1,
            }))
          }
        />
      </FilterPanel>
      <ImportExportOptions entity="assets" entityLabel="Assets" onImported={loadAssets} />
      <SearchBox onSearch={setSearchQuery} searchVal={searchQuery} />
    </>
  );

  const toolbarLeft = (
    <>
      <Button onClick={() => router.push('/assets/create')}>
        <i className="icon icon-plus text-xs"></i>
        <span>Register Asset</span>
      </Button>
      <ViewSwitcher
        options={VIEW_OPTIONS}
        value={view}
        onChange={setView}
        storageKey={VIEW_STORAGE_KEY}
      />
    </>
  );

  return (
    <div className="px-4 mt-2">
      {/*
       * The same toolbar, placed twice. In Table view it is handed to CustomTable's own
       * header so Manage Columns — which only means anything to a table — sits on the same
       * row as everything else instead of on a line of its own underneath. Every other view
       * renders it standalone, since there are no columns to manage there.
       */}
      {view === 'table' ? (
        <CustomTable
          columns={columns}
          rows={rowData}
          tableName="Assets"
          // v1: Purchase Date leads the row and Units precedes Net Price.
          // v2: Custodian sits next to Asset Name. Layouts saved before this keep their
          // widths but adopt the new order.
          layoutVersion={2}
          serialOffset={
            ((filters.pageNumber ?? 1) - 1) * (filters.pageSize ?? DEFAULT_PAGE_SIZE)
          }
          isLoading={loading}
          entityLabel="asset"
          tableHeaderLeft={toolbarLeft}
          tableHeaderRight={filterControls}
          updateFilters={updateFilters}
          bulkActions={[
            {
              label: 'Activate',
              onClick: handleBulkActivate,
            },
          ]}
        />
      ) : (
        <>
          <div className="flex flex-wrap justify-between items-center gap-x-4 gap-y-2 w-full mb-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">{toolbarLeft}</div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:gap-x-8">
              {filterControls}
            </div>
          </div>

          {view === 'card' && (
            <AssetCardView
              assets={assets}
              loading={loading}
              actions={assetActions}
              onOpen={(asset) => router.push(`/assets/${asset.id}`)}
            />
          )}

          {view === 'calendar' && (
            <AssetCalendarView
              filters={viewFilters}
              onOpenAsset={(assetId) => router.push(`/assets/${assetId}`)}
            />
          )}

          {view === 'analytics' && (
            <AssetAnalyticsView filters={viewFilters} filterSummary={filterSummary} />
          )}
        </>
      )}

      {/* Paging belongs to the views that page. The calendar is bounded by its window and
          the analytics describe the whole selection, so a pager there would be a lie. */}
      {PAGED_VIEWS.includes(view) && (
        <div className="mt-3">
          <Pagination
            pageNumber={filters.pageNumber ?? 1}
            totalPages={pageCount}
            pageSize={filters.pageSize ?? DEFAULT_PAGE_SIZE}
            totalCount={rowCount}
            updateFilters={updateFilters}
          />
        </div>
      )}

      <SingleAssignModal
        isOpen={!!assigning}
        onClose={() => setAssigning(null)}
        asset={assigning}
        employees={employees}
        onAssigned={loadAssets}
      />

      {/* Bulk activation report — same honesty rules as bulk assign: failures first,
          a re-submit reads as already-active, and the counts are the headline. */}
      <Modal
        isOpen={!!bulkActivateResult}
        onClose={() => setBulkActivateResult(null)}
        size="lg"
      >
        {bulkActivateResult && (
          <div className="p-5">
            <h2 className="text-lg font-semibold text-secondaryColor mb-4">
              Activation Report
            </h2>
            <div className="text-left">
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="rounded-xl bg-green-50 px-3 py-2.5 text-center">
                  <p className="text-2xl font-bold leading-none text-green-700 tabular-nums">
                    {bulkActivateResult.activated}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">Activated</p>
                </div>
                <div className="rounded-xl bg-sky-50 px-3 py-2.5 text-center">
                  <p className="text-2xl font-bold leading-none text-sky-700 tabular-nums">
                    {bulkActivateResult.alreadyActive}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">Already active</p>
                </div>
                <div
                  className={`rounded-xl px-3 py-2.5 text-center ${
                    bulkActivateResult.failed > 0 ? 'bg-amber-50' : 'bg-gray-50'
                  }`}
                >
                  <p
                    className={`text-2xl font-bold leading-none tabular-nums ${
                      bulkActivateResult.failed > 0 ? 'text-amber-700' : 'text-gray-300'
                    }`}
                  >
                    {bulkActivateResult.failed}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">Not activated</p>
                </div>
              </div>
              {bulkActivateResult.failed > 0 && (
                <ul className="max-h-48 overflow-y-auto space-y-1.5">
                  {bulkActivateResult.outcomes
                    .filter(
                      (o) =>
                        o.outcome !== BulkActivateOutcomeEnum.Activated &&
                        o.outcome !== BulkActivateOutcomeEnum.AlreadyActive
                    )
                    .map((o) => (
                      <li
                        key={o.assetId}
                        className="rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2 text-xs text-gray-700"
                      >
                        <span className="font-semibold">{o.assetCode || '—'}</span>: {o.message}
                      </li>
                    ))}
                </ul>
              )}
            </div>
            <div className="flex justify-end mt-5">
              <Button onClick={() => setBulkActivateResult(null)}>Done</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmationModal
        isOpen={!!deleting}
        message={`Delete draft asset '${deleting?.assetCode}'? Its code will not be reused — asset codes are burned once issued.`}
        loading={deletingBusy}
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
};

export default AssetsPage;
