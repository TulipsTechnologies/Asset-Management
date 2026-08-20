'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Providers/ToastProvider';
import Button from '@/components/UI/Button';
import CustomTable from '@/components/CustomTable/CustomTable';
import {
  ITableFilters,
  TTableColumn,
} from '@/components/CustomTable/CustomTableInterface';
import CustomMenuItem from '@/components/UI/CustomMenuItem';
import Dropdown from '@/components/UI/Dropdown';
import RowKebab from '@/components/UI/RowKebab';
import InfoCard, { InfoCardGrid, InfoField } from '@/components/UI/InfoCard';
import Modal from '@/components/UI/Modal';
import Input from '@/components/UI/Input';
import Select from '@/components/UI/Select';
import TextArea from '@/components/UI/TextArea';
import FilterPanel from '@/components/UI/FilterPanel';
import SearchBox from '@/components/SearchBox';
import Pagination from '@/components/UI/Pagination';
import {
  IAssetAssignment,
  IAssetAssignmentFilter,
} from '@/interface/IAssetAssignment';
import { IEmployee } from '@/interface/IEmployee';
import {
  fetchAssetAssignments,
  fetchAssignableAssets,
  returnAsset,
} from '@/services/assetAssignment.service';
import IssueReceiptSheet from '@/components/Print/IssueReceiptSheet';
import usePrintSheet, { usePrintIdentity } from '@/hooks/usePrintSheet';
import { IReceiptLine } from '@/utils/printDocuments';
import { fetchEmployees } from '@/services/employee.service';
import { mergeTableFilters, unwrapPaged } from '@/utils/serviceUtils';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';
import useAssetConditions from '@/hooks/useAssetConditions';
import {
  ASSIGNMENT_STATUS_BADGE_CLASSES,
  ASSIGNMENT_STATUS_LABELS,
  AssignmentStatusEnum,
} from '@/enum/assignmentEnums';
import useDebounce from '@/hooks/useDebounce';
import BulkAssignModal from '@/components/Assignments/BulkAssignModal';
import ViewSwitcher, { IViewOption, readStoredView } from '@/components/UI/ViewSwitcher';
import AssignmentKanbanView from '@/components/Assignments/AssignmentKanbanView';
import AssignmentAnalyticsView from '@/components/Assignments/AssignmentAnalyticsView';
import { shortDate } from '@/components/Assets/AssetViewShared';

// Delegates to the module's one date formatter. This was one of 18 identical local copies
// rendering the locale default ("8/20/2026"), which reads as a different day outside the US
// and disagreed with the dashboard and the printed sheets.
const formatDate = (value?: string | null) => shortDate(value);

/* --------------------------------------------------------------------- */
/* View modes                                                             */
/* --------------------------------------------------------------------- */

type TAssignmentView = 'table' | 'kanban' | 'analytics';

const VIEW_VALUES = ['table', 'kanban', 'analytics'] as const;
const VIEW_STORAGE_KEY = 'assignments.viewMode';

const VIEW_OPTIONS: IViewOption<TAssignmentView>[] = [
  { value: 'table', label: 'Table', iconName: 'menu', title: 'Every assignment, row by row' },
  { value: 'kanban', label: 'Board', iconName: 'rearrange', title: 'Custody as a pipeline' },
  { value: 'analytics', label: 'Analytics', iconName: 'bar-chart', title: 'How custody is behaving' },
];

const AssignmentsPage = () => {
  const { options: conditionOptions, emptyText: conditionEmptyText } = useAssetConditions();
  const { addToast } = useToast();
  const router = useRouter();

  // The handover receipt. Armed only while a row is chosen, so nothing is mounted and no
  // body class is set during ordinary use of the page.
  const [receiptFor, setReceiptFor] = useState<IAssetAssignment | null>(null);
  const [receiptLines, setReceiptLines] = useState<IReceiptLine[]>([]);
  const printIdentity = usePrintIdentity();
  const { print, PrintSheet } = usePrintSheet(!!receiptFor && receiptLines.length > 0);

  const [assignments, setAssignments] = useState<IAssetAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  const [filters, setFilters] = useState<IAssetAssignmentFilter>({
    pageNumber: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 400);
  const [showFilters, setShowFilters] = useState(false);

  const [employees, setEmployees] = useState<IEmployee[]>([]);

  // Assign modal
  const [view, setView] = useState<TAssignmentView>('table');
  /* Bumped after any mutation so the board reloads alongside the list it does not share. */
  const [refreshToken, setRefreshToken] = useState(0);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [viewing, setViewing] = useState<IAssetAssignment | null>(null);

  // Return modal
  const [returning, setReturning] = useState<IAssetAssignment | null>(null);
  const [returnConditionId, setReturnConditionId] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnSaving, setReturnSaving] = useState(false);

  // sortField names an AssetAssignment ENTITY property, so the server orders the whole
  // list and hands back page 1. The custody record itself holds only ids for the asset,
  // the custodian and the condition — those three columns are joined in from their own
  // tables, cannot be ordered by the database, and so offer no sort control.
  const columns: TTableColumn[] = [
    { key: 'assetCode', label: 'Asset', width: 130, type: 'string', name: 'assetCode' },
    { key: 'assetName', label: 'Name', width: 190, type: 'string', name: 'assetName' },
    { key: 'employeeName', label: 'Custodian', width: 170, type: 'string', name: 'employeeName' },
    { key: 'assignmentDate', label: 'Assigned', width: 110, name: 'assignmentDate', sortField: 'AssignmentDate' },
    { key: 'expectedReturnDate', label: 'Expected Return', width: 130, name: 'expectedReturnDate', sortField: 'ExpectedReturnDate' },
    { key: 'conditionAtIssueName', label: 'Condition @ Issue', width: 130, type: 'string', name: 'conditionAtIssueName' },
    // The badge prints a label but orders by the stored enum.
    { key: 'status', label: 'Status', width: 100, name: 'status', sortField: 'Status' },
    {
      key: 'actions',
      label: <i className="icon icon-actions text-[10px]" />,
      width: 45,
      canToggle: false,
      name: 'actions',
    },
  ];

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAssetAssignments(filters);
      if (res?.success) {
        const paged = unwrapPaged(res);
        setAssignments(paged.items);
        setRowCount(paged.rowCount);
        setPageCount(paged.pageCount);
      } else {
        addToast.error(res?.message || 'Failed to fetch assignments');
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
      addToast.error('An error occurred while fetching assignments');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Only the table needs the paged list. The board queries a column at a time and the
  // analytics aggregate server-side, both from the same filters.
  useEffect(() => {
    if (view === 'table') loadAssignments();
  }, [loadAssignments, view]);

  // Restored after mount, never during render: the server has no localStorage, and painting
  // the remembered view on the first client pass would hydrate mismatched.
  useEffect(() => {
    const stored = readStoredView<TAssignmentView>(VIEW_STORAGE_KEY, VIEW_VALUES);
    if (stored) setView(stored);
  }, []);

  /** Reloads whichever view is showing — the list and the board do not share a fetch. */
  const refreshAll = useCallback(() => {
    loadAssignments();
    setRefreshToken((token) => token + 1);
  }, [loadAssignments]);

  useEffect(() => {
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
    setFilters((prev) => mergeTableFilters(prev, updates));
  };

  /**
   * Build and print a handover receipt for one assignment.
   *
   * The assignment DTO carries no serial number or asset tag, and a receipt that identifies
   * the accountable item only by an internal code is weak — the code is a sticker that falls
   * off, the serial is stamped into the metal. One extra call rehydrates it;
   * `includeIneligible` is required because the asset is, by definition, already assigned.
   * A failed lookup still prints, with the serial marked as not recorded rather than blank.
   */
  const openReceipt = async (assignment: IAssetAssignment) => {
    const base: IReceiptLine = {
      assetId: assignment.assetId,
      assetCode: assignment.assetCode,
      assetName: assignment.assetName,
      conditionName: assignment.conditionAtIssueName,
      accessories: assignment.accessories,
    };

    // Resolve FIRST, then arm: the sheet mounts on the next render and prints immediately,
    // so a serial still in flight would simply be absent from a signed document.
    let line = base;
    try {
      const response = await fetchAssignableAssets({
        assetIds: [assignment.assetId],
        includeIneligible: true,
        pageSize: 1,
      });
      const detail = unwrapPaged(response).items[0];
      if (detail)
        line = { ...base, serialNumber: detail.serialNumber, assetTag: detail.assetTag };
    } catch {
      /* The receipt is still correct without it — the sheet says "no serial recorded". */
    }
    setReceiptLines([line]);
    setReceiptFor(assignment);
  };

  // The sheet mounts on the render after the state lands, so the print is queued behind it;
  // calling window.print() in the click handler would race the document snapshot.
  useEffect(() => {
    if (!receiptFor || receiptLines.length === 0) return;
    // setTimeout, NOT requestAnimationFrame: rAF never fires while the document is
    // hidden, so a user who switches tab straight after clicking would get no print
    // at all and no error either. A timer fires regardless of visibility.
    const timer = setTimeout(() => print(), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiptFor]);

  const openReturn = (assignment: IAssetAssignment) => {
    setReturning(assignment);
    setReturnConditionId('');
    // Local "today" — the user can adjust; avoids UTC-offset surprises.
    setReturnDate(new Date().toLocaleDateString('en-CA'));
    setReturnNotes('');
  };

  const handleReturn = async () => {
    if (!returning || !returnConditionId) return;
    setReturnSaving(true);
    try {
      const res = await returnAsset(returning.id, {
        returnedDate: returnDate || undefined,
        conditionAtReturnId: returnConditionId,
        returnNotes: returnNotes.trim() || undefined,
        rowVersion: returning.rowVersion,
      });
      if (res?.success) {
        addToast.success(res.message || 'Asset returned');
        setReturning(null);
        refreshAll();
      } else {
        // Stale row (already returned / modified elsewhere): close the modal and
        // refresh so a retry never loops on the same stale payload.
        addToast.error(res?.message || 'Failed to return the asset');
        setReturning(null);
        refreshAll();
      }
    } catch (error) {
      console.error('Error returning asset:', error);
      addToast.error('An error occurred while returning the asset');
      setReturning(null);
      refreshAll();
    } finally {
      setReturnSaving(false);
    }
  };

  const rowData = assignments.map((assignment) => ({
    id: assignment.id,
    assetCode: (
      <button
        type="button"
        className="font-medium text-primarycolor hover:underline"
        onClick={() => router.push(`/assets/${assignment.assetId}`)}
      >
        {assignment.assetCode}
      </button>
    ),
    assetName: assignment.assetName,
    employeeName: (
      <span>
        {assignment.employeeName}
        {assignment.employeeCode && (
          <span className="text-xs text-gray-400 ml-1">
            ({assignment.employeeCode})
          </span>
        )}
      </span>
    ),
    assignmentDate: formatDate(assignment.assignmentDate),
    expectedReturnDate: formatDate(assignment.expectedReturnDate),
    conditionAtIssueName: assignment.conditionAtIssueName,
    status: (
      <span
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          ASSIGNMENT_STATUS_BADGE_CLASSES[assignment.status] ??
          'bg-gray-100 text-gray-700'
        }`}
      >
        {ASSIGNMENT_STATUS_LABELS[assignment.status] ?? assignment.status}
      </span>
    ),
    actions: (
      <div className="flex gap-x-2 relative bg-white px-4 py-2 -m-2">
        <Dropdown
          buttonChildren={<RowKebab />}
        >
          {[
            {
              label: 'View Details',
              icon: <i className="icon icon-eye text-sm" />,
              action: () => setViewing(assignment),
            },
            ...(assignment.status === AssignmentStatusEnum.Open
              ? [
                  {
                    label: 'Return',
                    icon: <i className="icon icon-redo text-sm" />,
                    action: () => openReturn(assignment),
                  },
                ]
              : []),
            {
              label: 'Print Receipt',
              icon: <i className="icon icon-print text-sm" />,
              action: () => openReceipt(assignment),
            },
          ].map((option, index, arr) => (
            <CustomMenuItem
              key={index}
              label={option.label}
              onClick={option.action}
              border={index !== arr.length - 1}
              icon={option.icon}
              className="!py-2"
            />
          ))}
        </Dropdown>
      </div>
    ),
  }));

  /**
   * The filter identity the board and the analytics depend on — without the page number,
   * so turning a page in the table does not refetch feeds that would come back identical.
   * Memoized on the primitives; a fresh object each render would defeat that.
   */
  const viewFilters = useMemo<IAssetAssignmentFilter>(
    () => ({
      search: filters.search,
      employeeId: filters.employeeId,
      status: filters.status,
    }),
    [filters.search, filters.employeeId, filters.status]
  );

  /** Plain-language echo of the active narrowing, so Analytics can say what it describes. */
  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (filters.status != null) parts.push(ASSIGNMENT_STATUS_LABELS[filters.status]);
    if (filters.employeeId) {
      const employee = employees.find((e) => e.id === filters.employeeId);
      if (employee) parts.push(`held by ${employee.fullName}`);
    }
    if (filters.search) parts.push(`matching \u201C${filters.search}\u201D`);
    return parts.length ? parts.join(' \u00B7 ') : 'every assignment on record';
  }, [filters, employees]);

  const toolbarLeft = (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={() => setBulkOpen(true)}>
        <i className="icon icon-plus text-xs"></i>
        <span>Assign Assets</span>
      </Button>
      <ViewSwitcher
        options={VIEW_OPTIONS}
        value={view}
        onChange={setView}
        storageKey={VIEW_STORAGE_KEY}
      />
    </div>
  );

  const filterControls = (
    <>
            <FilterPanel
              open={showFilters}
              onOpenChange={setShowFilters}
              activeCount={
                [filters.status, filters.employeeId].filter((v) => v != null)
                  .length
              }
              onClearAll={() =>
                setFilters((prev) => ({
                  ...prev,
                  status: undefined,
                  employeeId: undefined,
                  pageNumber: 1,
                }))
              }
            >
              <Select
                label="Status"
                placeholder="All"
                options={[
                  { value: String(AssignmentStatusEnum.Open), label: 'Open' },
                  {
                    value: String(AssignmentStatusEnum.Returned),
                    label: 'Returned',
                  },
                  {
                    value: String(AssignmentStatusEnum.Transferred),
                    label: 'Transferred',
                  },
                ]}
                value={filters.status != null ? String(filters.status) : ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    status: e.target.value
                      ? (Number(e.target.value) as AssignmentStatusEnum)
                      : undefined,
                    pageNumber: 1,
                  }))
                }
              />
              <Select
                label="Custodian"
                placeholder="All employees"
                options={employees.map((e) => ({
                  value: e.id,
                  label: e.fullName,
                }))}
                value={filters.employeeId ?? ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    employeeId: e.target.value || undefined,
                    pageNumber: 1,
                  }))
                }
              />
            </FilterPanel>
            <SearchBox onSearch={setSearchQuery} searchVal={searchQuery} />
    </>
  );

  return (
    <div className="px-4 mt-2">
      {/*
       * The same toolbar, placed twice. Table view hands it to CustomTable so Manage
       * Columns joins the same row; the other views render it standalone, having no
       * columns to manage.
       */}
      {view === 'table' ? (
        <>
          <CustomTable
            columns={columns}
            rows={rowData}
            tableName="Assignments"
            serialOffset={
              ((filters.pageNumber ?? 1) - 1) * (filters.pageSize ?? DEFAULT_PAGE_SIZE)
            }
            isLoading={loading}
            entityLabel="assignment"
            tableHeaderLeft={toolbarLeft}
            tableHeaderRight={filterControls}
            updateFilters={updateFilters}
            sortBy={filters.sortBy}
            sortDesc={filters.sortDesc}
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
        </>
      ) : (
        <>
          <div className="flex flex-wrap justify-between items-center gap-x-4 gap-y-2 w-full mb-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">{toolbarLeft}</div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:gap-x-8">
              {filterControls}
            </div>
          </div>

          {view === 'kanban' && (
            <AssignmentKanbanView
              filters={viewFilters}
              refreshToken={refreshToken}
              onOpenAssignment={setViewing}
              onReturn={openReturn}
              onOpenAsset={(assetId) => router.push(`/assets/${assetId}`)}
              onAssign={() => setBulkOpen(true)}
            />
          )}

          {view === 'analytics' && (
            <AssignmentAnalyticsView filters={viewFilters} filterSummary={filterSummary} />
          )}
        </>
      )}

      {/* Assign modal */}
      <BulkAssignModal
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        employees={employees}
        onAssigned={loadAssignments}
      />

      {/* Return modal */}
      <Modal
        isOpen={returning !== null}
        onClose={() => setReturning(null)}
        size="md"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            Return Asset
          </h2>
          {returning && (
            <p className="text-sm text-gray-500 mb-4">
              {returning.assetCode} — {returning.assetName} from{' '}
              {returning.employeeName}
            </p>
          )}
          <div className="grid grid-cols-1 gap-y-5">
            <Input
              label="Returned Date"
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
            />
            <Select
              label="Condition at Return"
              required
              placeholder="Select condition"
              options={conditionOptions}
              emptyText={conditionEmptyText}
              value={returnConditionId}
              onChange={(e) => setReturnConditionId(e.target.value)}
            />
            <TextArea
              label="Return Notes"
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
              rows={2}
              placeholder="Damage, missing accessories…"
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setReturning(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleReturn}
              disabled={returnSaving || !returnConditionId}
            >
              {returnSaving ? 'Returning…' : 'Confirm Return'}
            </Button>
          </div>
        </div>
      </Modal>
      {/* Assignment details — Vehicle-detail InfoCard language */}
      <Modal isOpen={!!viewing} onClose={() => setViewing(null)} size="3xl">
        <div className="p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex items-center justify-center size-10 rounded-full bg-primarycolor text-white">
              <i className="icon icon-users text-base"></i>
            </span>
            <div>
              <h2 className="text-lg font-semibold text-secondaryColor leading-tight">
                {viewing?.assetCode} → {viewing?.employeeName}
              </h2>
              <p className="text-xs text-gray-500">{viewing?.assetName}</p>
            </div>
            <span
              className={`ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                viewing
                  ? (ASSIGNMENT_STATUS_BADGE_CLASSES[viewing.status] ??
                    'bg-gray-100 text-gray-700')
                  : ''
              }`}
            >
              {viewing ? ASSIGNMENT_STATUS_LABELS[viewing.status] : ''}
            </span>
          </div>

          <InfoCardGrid>
            <InfoCard title="Assignment" icon="user-check">
              <InfoField
                label="Custodian"
                icon="users"
                value={viewing?.employeeName}
              />
              <InfoField
                label="Assigned On"
                icon="calendar"
                value={formatDate(viewing?.assignmentDate)}
              />
              <InfoField
                label="Expected Return"
                icon="clock"
                value={formatDate(viewing?.expectedReturnDate)}
              />
              <InfoField
                label="Condition at Issue"
                icon="check-circle"
                value={viewing?.conditionAtIssueName}
              />
              <InfoField
                label="Accessories"
                icon="clipboard"
                value={viewing?.accessories}
              />
              <InfoField
                label="Handover Notes"
                icon="comment"
                value={viewing?.handoverNotes}
              />
            </InfoCard>

            <InfoCard title="Return" icon="redo">
              <InfoField
                label="Returned On"
                icon="calendar"
                value={formatDate(viewing?.returnedDate)}
                emptyText="Not returned yet"
              />
              <InfoField
                label="Condition at Return"
                icon="check-circle"
                value={viewing?.conditionAtReturnName}
              />
              <InfoField
                label="Return Notes"
                icon="comment"
                value={viewing?.returnNotes}
              />
            </InfoCard>
          </InfoCardGrid>
        </div>
      </Modal>

      {/* Hidden on screen; the print stylesheet reveals it and hides everything else. */}
      {receiptFor && receiptLines.length > 0 && (
        <PrintSheet>
          <IssueReceiptSheet
            companyName={printIdentity.companyName}
            generatedBy={printIdentity.userName}
            generatedOn={new Date()}
            employeeName={receiptFor.employeeName}
            employeeCode={receiptFor.employeeCode}
            assignmentDate={receiptFor.assignmentDate}
            expectedReturnDate={receiptFor.expectedReturnDate}
            accessories={receiptFor.accessories}
            handoverNotes={receiptFor.handoverNotes}
            referenceId={receiptFor.id}
            lines={receiptLines}
          />
        </PrintSheet>
      )}
    </div>
  );
};

export default AssignmentsPage;
