'use client';

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Providers/ToastProvider';
import Button from '@/components/UI/Button';
import CustomTable from '@/components/CustomTable/CustomTable';
import {
  ITableFilters,
  TTableColumn,
} from '@/components/CustomTable/CustomTableInterface';
import CustomCheckbox from '@/components/UI/CustomCheckBox';
import CustomMenuItem from '@/components/UI/CustomMenuItem';
import Dropdown from '@/components/UI/Dropdown';
import Modal from '@/components/UI/Modal';
import Input from '@/components/UI/Input';
import Select from '@/components/UI/Select';
import TextArea from '@/components/UI/TextArea';
import FilterPanel from '@/components/UI/FilterPanel';
import SearchBox from '@/components/SearchBox';
import Pagination from '@/components/UI/Pagination';
import { IAssetReturn, IAssetReturnFilter } from '@/interface/IAssetReturn';
import { IAssetAssignment } from '@/interface/IAssetAssignment';
import {
  cancelAssetReturn,
  completeAssetReturn,
  fetchAssetReturns,
  initiateAssetReturn,
} from '@/services/assetReturn.service';
import { fetchAssetAssignments } from '@/services/assetAssignment.service';
import { unwrapPaged } from '@/utils/serviceUtils';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';
import { ASSET_CONDITIONS } from '@/enum/assetEnums';
import { AssignmentStatusEnum } from '@/enum/assignmentEnums';
import {
  RECOVERY_CASE_STATUS_BADGE_CLASSES,
  RECOVERY_CASE_STATUS_LABELS,
  RETURN_OUTCOME_BADGE_CLASSES,
  RETURN_OUTCOME_EFFECTS,
  RETURN_OUTCOME_LABELS,
  RETURN_STATUS_BADGE_CLASSES,
  RETURN_STATUS_LABELS,
  ReturnOutcomeEnum,
  ReturnStatusEnum,
} from '@/enum/returnEnums';
import useDebounce from '@/hooks/useDebounce';
import RecoveryCasesTab from './RecoveryCasesTab';

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString() : '—';

const localToday = () => new Date().toLocaleDateString('en-CA');

type TInspectForm = {
  conditionAtReturnId: string;
  outcome: string;
  missingAccessories: string;
  damageNotes: string;
  inspectionNotes: string;
  openRecovery: boolean;
  recoveryDescription: string;
  recoveryAmount: string;
  recoveryCurrency: string;
  recoveryNotes: string;
};

const emptyInspectForm: TInspectForm = {
  conditionAtReturnId: '',
  outcome: '',
  missingAccessories: '',
  damageNotes: '',
  inspectionNotes: '',
  openRecovery: false,
  recoveryDescription: '',
  recoveryAmount: '',
  recoveryCurrency: '',
  recoveryNotes: '',
};

const STATUS_PILLS: { label: string; value?: ReturnStatusEnum }[] = [
  { label: 'All' },
  { label: 'Pending Inspection', value: ReturnStatusEnum.Initiated },
  { label: 'Completed', value: ReturnStatusEnum.Completed },
  { label: 'Cancelled', value: ReturnStatusEnum.Cancelled },
];

const statusBadge = (status: ReturnStatusEnum) => (
  <span
    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
      RETURN_STATUS_BADGE_CLASSES[status] ?? 'bg-gray-100 text-gray-700'
    }`}
  >
    {RETURN_STATUS_LABELS[status] ?? status}
  </span>
);

const outcomeBadge = (outcome?: ReturnOutcomeEnum | null) =>
  outcome != null ? (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
        RETURN_OUTCOME_BADGE_CLASSES[outcome] ?? 'bg-gray-100 text-gray-700'
      }`}
    >
      {RETURN_OUTCOME_LABELS[outcome] ?? outcome}
    </span>
  ) : (
    '—'
  );

const DetailField = ({
  label,
  value,
  wide,
}: {
  label: string;
  value: ReactNode;
  wide?: boolean;
}) => (
  <div className={wide ? 'md:col-span-2' : undefined}>
    <div className="text-xs font-medium text-gray-400">{label}</div>
    <div className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">
      {value ?? '—'}
    </div>
  </div>
);

const ReturnsPage = () => {
  const { addToast } = useToast();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'returns' | 'recovery'>('returns');

  const [returns, setReturns] = useState<IAssetReturn[]>([]);
  const [loading, setLoading] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  const [filters, setFilters] = useState<IAssetReturnFilter>({
    pageNumber: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 400);
  const [showFilters, setShowFilters] = useState(false);

  // Initiate modal
  const [initiateOpen, setInitiateOpen] = useState(false);
  const [openAssignments, setOpenAssignments] = useState<IAssetAssignment[]>([]);
  const [initiateForm, setInitiateForm] = useState({
    assetAssignmentId: '',
    returnDate: '',
    notes: '',
  });
  const [initiateError, setInitiateError] = useState('');
  const [initiateSaving, setInitiateSaving] = useState(false);

  // Inspect (complete) modal
  const [inspecting, setInspecting] = useState<IAssetReturn | null>(null);
  const [inspectForm, setInspectForm] = useState<TInspectForm>(emptyInspectForm);
  const [inspectError, setInspectError] = useState('');
  const [inspectSaving, setInspectSaving] = useState(false);

  // Cancel modal
  const [cancelling, setCancelling] = useState<IAssetReturn | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSaving, setCancelSaving] = useState(false);

  // Detail modal (view-only)
  const [viewing, setViewing] = useState<IAssetReturn | null>(null);

  const columns: TTableColumn[] = [
    { key: 'assetCode', label: 'Asset', width: 110, type: 'string', name: 'assetCode' },
    { key: 'assetName', label: 'Name', width: 160, type: 'string', name: 'assetName' },
    { key: 'returnedBy', label: 'Returned By', width: 165, name: 'returnedBy' },
    { key: 'returnDate', label: 'Return Date', width: 105, name: 'returnDate' },
    { key: 'status', label: 'Status', width: 130, name: 'status' },
    { key: 'outcome', label: 'Outcome', width: 120, name: 'outcome' },
    { key: 'recovery', label: 'Recovery', width: 110, name: 'recovery' },
    {
      key: 'actions',
      label: <i className="icon icon-actions text-[10px]" />,
      width: 45,
      canToggle: false,
      name: 'actions',
    },
  ];

  const loadReturns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAssetReturns(filters);
      if (res?.success) {
        const paged = unwrapPaged(res);
        setReturns(paged.items);
        setRowCount(paged.rowCount);
        setPageCount(paged.pageCount);
      } else {
        addToast.error(res?.message || 'Failed to fetch returns');
      }
    } catch (error) {
      console.error('Error fetching returns:', error);
      addToast.error('An error occurred while fetching returns');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    if (activeTab === 'returns') loadReturns();
  }, [loadReturns, activeTab]);

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

  // House pattern: after ANY failed workflow action, close the modal and
  // refresh the list so retries never reuse a stale rowVersion.
  const openInitiate = async () => {
    setInitiateForm({
      assetAssignmentId: '',
      returnDate: localToday(),
      notes: '',
    });
    setInitiateError('');
    setInitiateOpen(true);
    try {
      const res = await fetchAssetAssignments({
        pageNumber: 1,
        pageSize: 500,
        status: AssignmentStatusEnum.Open,
      });
      if (res?.success) setOpenAssignments(unwrapPaged(res).items);
    } catch {
      addToast.error('Failed to load open assignments');
    }
  };

  const handleInitiate = async () => {
    if (!initiateForm.assetAssignmentId) {
      setInitiateError('Pick the open assignment being returned');
      return;
    }
    const assignment = openAssignments.find(
      (a) => a.id === initiateForm.assetAssignmentId
    );
    setInitiateSaving(true);
    try {
      const res = await initiateAssetReturn({
        assetAssignmentId: initiateForm.assetAssignmentId,
        returnDate: initiateForm.returnDate || undefined,
        notes: initiateForm.notes.trim() || undefined,
        rowVersion: assignment?.rowVersion ?? '',
      });
      if (res?.success) {
        addToast.success(res.message || 'Return initiated');
        setInitiateOpen(false);
        loadReturns();
      } else {
        // 409s (active transfer / stale assignment / pending return): show the
        // server message verbatim, close, refresh.
        addToast.error(res?.message || 'Failed to initiate the return');
        setInitiateOpen(false);
        loadReturns();
      }
    } catch (error) {
      console.error('Error initiating return:', error);
      addToast.error('An error occurred while initiating the return');
      setInitiateOpen(false);
      loadReturns();
    } finally {
      setInitiateSaving(false);
    }
  };

  const openInspect = (assetReturn: IAssetReturn) => {
    setInspecting(assetReturn);
    setInspectForm(emptyInspectForm);
    setInspectError('');
  };

  const handleInspect = async () => {
    if (!inspecting) return;
    if (!inspectForm.conditionAtReturnId || !inspectForm.outcome) {
      setInspectError('Condition and outcome are required');
      return;
    }
    if (inspectForm.openRecovery) {
      const description = inspectForm.recoveryDescription.trim();
      if (!description) {
        setInspectError('A description is required to open a recovery case');
        return;
      }
      if (description.length > 1000) {
        setInspectError('Recovery case description must be 1000 characters or fewer');
        return;
      }
      if (
        inspectForm.recoveryCurrency &&
        !/^[A-Za-z]{3}$/.test(inspectForm.recoveryCurrency.trim())
      ) {
        setInspectError('Currency must be a 3-letter code (e.g. USD)');
        return;
      }
      if (
        inspectForm.recoveryAmount &&
        (Number.isNaN(Number(inspectForm.recoveryAmount)) ||
          Number(inspectForm.recoveryAmount) < 0)
      ) {
        setInspectError('Estimated amount must be a positive number');
        return;
      }
    }
    setInspectSaving(true);
    try {
      const res = await completeAssetReturn(inspecting.id, {
        conditionAtReturnId: inspectForm.conditionAtReturnId,
        outcome: Number(inspectForm.outcome) as ReturnOutcomeEnum,
        missingAccessories: inspectForm.missingAccessories.trim() || undefined,
        damageNotes: inspectForm.damageNotes.trim() || undefined,
        inspectionNotes: inspectForm.inspectionNotes.trim() || undefined,
        recoveryCase: inspectForm.openRecovery
          ? {
              description: inspectForm.recoveryDescription.trim(),
              estimatedAmount: inspectForm.recoveryAmount
                ? Number(inspectForm.recoveryAmount)
                : undefined,
              currencyId: inspectForm.recoveryCurrency
                ? inspectForm.recoveryCurrency.trim().toUpperCase()
                : undefined,
              notes: inspectForm.recoveryNotes.trim() || undefined,
            }
          : undefined,
        rowVersion: inspecting.rowVersion ?? '',
      });
      if (res?.success) {
        addToast.success(res.message || 'Return completed');
        setInspecting(null);
        loadReturns();
      } else {
        addToast.error(res?.message || 'Failed to complete the return');
        setInspecting(null);
        loadReturns();
      }
    } catch (error) {
      console.error('Error completing return:', error);
      addToast.error('An error occurred while completing the return');
      setInspecting(null);
      loadReturns();
    } finally {
      setInspectSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelling || !cancelReason.trim() || cancelSaving) return;
    if (cancelReason.trim().length > 1000) {
      addToast.error('Reason must be 1000 characters or fewer');
      return;
    }
    setCancelSaving(true);
    try {
      const res = await cancelAssetReturn(cancelling.id, {
        reason: cancelReason.trim(),
        rowVersion: cancelling.rowVersion ?? '',
      });
      if (res?.success) {
        addToast.success(res.message || 'Return cancelled');
      } else {
        addToast.error(res?.message || 'Failed to cancel the return');
      }
    } catch (error) {
      console.error('Error cancelling return:', error);
      addToast.error('An error occurred while cancelling the return');
    } finally {
      setCancelSaving(false);
      setCancelling(null);
      setCancelReason('');
      loadReturns();
    }
  };

  const recoveryIndicator = (assetReturn: IAssetReturn) => {
    if (!assetReturn.recoveryCases || assetReturn.recoveryCases.length === 0)
      return '—';
    const total = assetReturn.recoveryCases.reduce(
      (sum, c) => sum + (c.estimatedAmount ?? 0),
      0
    );
    const currencyId = assetReturn.recoveryCases.find(
      (c) => c.currencyId
    )?.currencyId;
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 whitespace-nowrap">
        {assetReturn.recoveryCases.length}
        {total > 0 &&
          ` · ${total.toLocaleString()}${currencyId ? ` ${currencyId}` : ''}`}
      </span>
    );
  };

  const rowData = returns.map((assetReturn) => ({
    id: assetReturn.id,
    assetCode: (
      <button
        type="button"
        className="font-medium text-primarycolor hover:underline"
        onClick={() => router.push(`/assets/${assetReturn.assetId}`)}
      >
        {assetReturn.assetCode}
      </button>
    ),
    assetName: assetReturn.assetName,
    returnedBy: (
      <span>
        {assetReturn.returnedByEmployeeName}
        {assetReturn.returnedByEmployeeCode && (
          <span className="text-xs text-gray-400 ml-1">
            ({assetReturn.returnedByEmployeeCode})
          </span>
        )}
      </span>
    ),
    returnDate: formatDate(assetReturn.returnDate),
    status: statusBadge(assetReturn.status),
    outcome: outcomeBadge(assetReturn.outcome),
    recovery: recoveryIndicator(assetReturn),
    actions: (
      <div className="flex gap-x-2 relative bg-white px-4 py-2 -m-2">
        <Dropdown
          buttonChildren={
            <div className="bg-white/80 px-1.5 py-2 rounded-sm hover:bg-primarycolor hover:text-white">
              <i className="icon icon-elipsis-v text-sm"></i>
            </div>
          }
        >
          {[
            {
              label: 'View Details',
              icon: <i className="icon icon-eye text-sm" />,
              action: () => setViewing(assetReturn),
            },
            ...(assetReturn.status === ReturnStatusEnum.Initiated
              ? [
                  {
                    label: 'Inspect',
                    icon: <i className="icon icon-clipboard text-sm" />,
                    action: () => openInspect(assetReturn),
                  },
                  {
                    label: 'Cancel',
                    icon: <i className="icon icon-close text-sm" />,
                    action: () => {
                      setCancelling(assetReturn);
                      setCancelReason('');
                    },
                  },
                ]
              : []),
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

  const selectedOutcomeEffect = inspectForm.outcome
    ? RETURN_OUTCOME_EFFECTS[Number(inspectForm.outcome)]
    : '';

  return (
    <div className="px-4 mt-2">
      {/* Tab switcher: returns workflow vs recovery cases */}
      <div className="flex border-b gap-x-10 mb-4">
        {(
          [
            { id: 'returns', label: 'Returns' },
            { id: 'recovery', label: 'Recovery Cases' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`pb-3 border-b-2 text-sm font-medium ${
              activeTab === tab.id
                ? 'border-primarycolor text-secondaryColor'
                : 'border-transparent text-gray-500'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'recovery' ? (
        <RecoveryCasesTab />
      ) : (
        <>
          {/* Status filter pills */}
          <div className="flex flex-wrap gap-2 mb-3">
            {STATUS_PILLS.map((pill) => (
              <button
                key={pill.label}
                type="button"
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filters.status === pill.value
                    ? 'bg-primarycolor text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    status: pill.value,
                    pageNumber: 1,
                  }))
                }
              >
                {pill.label}
              </button>
            ))}
          </div>

          <CustomTable
            columns={columns}
            rows={rowData}
            tableName="Returns"
            serialOffset={
              ((filters.pageNumber ?? 1) - 1) *
              (filters.pageSize ?? DEFAULT_PAGE_SIZE)
            }
            isLoading={loading}
            entityLabel="return"
            tableHeaderLeft={
              <Button onClick={openInitiate}>
                <i className="icon icon-plus text-xs"></i>
                <span>Initiate Return</span>
              </Button>
            }
            tableHeaderRight={
              <>
                <FilterPanel
                  open={showFilters}
                  onOpenChange={setShowFilters}
                  activeCount={[filters.outcome].filter((v) => v != null).length}
                  onClearAll={() =>
                    setFilters((prev) => ({
                      ...prev,
                      outcome: undefined,
                      pageNumber: 1,
                    }))
                  }
                >
                  <Select
                    label="Outcome"
                    placeholder="All"
                    options={Object.entries(RETURN_OUTCOME_LABELS).map(
                      ([v, l]) => ({ value: v, label: l })
                    )}
                    value={filters.outcome != null ? String(filters.outcome) : ''}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        outcome: e.target.value
                          ? (Number(e.target.value) as ReturnOutcomeEnum)
                          : undefined,
                        pageNumber: 1,
                      }))
                    }
                  />
                </FilterPanel>
                <SearchBox onSearch={setSearchQuery} searchVal={searchQuery} />
              </>
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
        </>
      )}

      {/* Initiate Return modal */}
      <Modal
        isOpen={initiateOpen}
        onClose={() => setInitiateOpen(false)}
        size="lg"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            Initiate Return
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Takes the asset back from its custodian; the asset stays out of
            circulation until the return is inspected and completed.
          </p>
          <div className="grid grid-cols-1 gap-y-5">
            <Select
              label="Assignment"
              required
              placeholder="Select an open assignment"
              options={openAssignments.map((a) => ({
                value: a.id,
                label: `${a.assetCode} — ${a.assetName} — ${a.employeeName}`,
              }))}
              value={initiateForm.assetAssignmentId}
              onChange={(e) => {
                setInitiateForm((prev) => ({
                  ...prev,
                  assetAssignmentId: e.target.value,
                }));
                setInitiateError('');
              }}
            />
            <Input
              label="Return Date"
              type="date"
              value={initiateForm.returnDate}
              onChange={(e) =>
                setInitiateForm((prev) => ({
                  ...prev,
                  returnDate: e.target.value,
                }))
              }
            />
            <TextArea
              label="Notes"
              value={initiateForm.notes}
              onChange={(e) =>
                setInitiateForm((prev) => ({ ...prev, notes: e.target.value }))
              }
              rows={2}
              placeholder="Exit clearance, upgrade swap…"
            />
          </div>
          {initiateError && (
            <p className="text-sm text-red-600 mt-3">{initiateError}</p>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setInitiateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInitiate} disabled={initiateSaving}>
              {initiateSaving ? 'Initiating…' : 'Initiate'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Inspect / complete modal */}
      <Modal
        isOpen={inspecting !== null}
        onClose={() => setInspecting(null)}
        size="2xl"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            Inspect Return
          </h2>
          {inspecting && (
            <p className="text-sm text-gray-500 mb-4">
              {inspecting.assetCode} — {inspecting.assetName} from{' '}
              {inspecting.returnedByEmployeeName}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <Select
              label="Condition at Return"
              required
              placeholder="Select condition"
              options={ASSET_CONDITIONS.map((c) => ({
                value: c.id,
                label: c.name,
              }))}
              value={inspectForm.conditionAtReturnId}
              onChange={(e) => {
                setInspectForm((prev) => ({
                  ...prev,
                  conditionAtReturnId: e.target.value,
                }));
                setInspectError('');
              }}
            />
            <div>
              <Select
                label="Outcome"
                required
                placeholder="Select outcome"
                options={Object.entries(RETURN_OUTCOME_LABELS).map(
                  ([v, l]) => ({ value: v, label: l })
                )}
                value={inspectForm.outcome}
                onChange={(e) => {
                  setInspectForm((prev) => ({
                    ...prev,
                    outcome: e.target.value,
                  }));
                  setInspectError('');
                }}
              />
              {selectedOutcomeEffect && (
                <p className="text-gray-400 text-xs mt-1 italic">
                  {selectedOutcomeEffect}
                </p>
              )}
            </div>
            <Input
              label="Missing Accessories"
              value={inspectForm.missingAccessories}
              onChange={(e) =>
                setInspectForm((prev) => ({
                  ...prev,
                  missingAccessories: e.target.value,
                }))
              }
              placeholder="Charger, bag, dock…"
            />
            <Input
              label="Damage Notes"
              value={inspectForm.damageNotes}
              onChange={(e) =>
                setInspectForm((prev) => ({
                  ...prev,
                  damageNotes: e.target.value,
                }))
              }
              placeholder="Cracked screen, dents…"
            />
            <div className="md:col-span-2">
              <TextArea
                label="Inspection Notes"
                value={inspectForm.inspectionNotes}
                onChange={(e) =>
                  setInspectForm((prev) => ({
                    ...prev,
                    inspectionNotes: e.target.value,
                  }))
                }
                rows={2}
              />
            </div>
          </div>

          {/* Recovery case section */}
          <div className="mt-6 border-t pt-4">
            <CustomCheckbox
              title="Open recovery case"
              checked={inspectForm.openRecovery}
              onChange={() => {
                setInspectForm((prev) => ({
                  ...prev,
                  openRecovery: !prev.openRecovery,
                }));
                setInspectError('');
              }}
            />
            {inspectForm.openRecovery && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 mt-4">
                <div className="md:col-span-2">
                  <TextArea
                    label="Description"
                    required
                    value={inspectForm.recoveryDescription}
                    onChange={(e) => {
                      setInspectForm((prev) => ({
                        ...prev,
                        recoveryDescription: e.target.value,
                      }));
                      setInspectError('');
                    }}
                    rows={2}
                    placeholder="What is being recovered from the custodian and why"
                  />
                </div>
                <Input
                  label="Estimated Amount"
                  type="number"
                  value={inspectForm.recoveryAmount}
                  onChange={(e) =>
                    setInspectForm((prev) => ({
                      ...prev,
                      recoveryAmount: e.target.value,
                    }))
                  }
                  placeholder="0.00"
                />
                <Input
                  label="Currency"
                  value={inspectForm.recoveryCurrency}
                  onChange={(e) =>
                    setInspectForm((prev) => ({
                      ...prev,
                      recoveryCurrency: e.target.value.toUpperCase(),
                    }))
                  }
                  maxLength={3}
                  placeholder="USD"
                  helperText="3-letter currency code"
                />
                <div className="md:col-span-2">
                  <TextArea
                    label="Recovery Notes"
                    value={inspectForm.recoveryNotes}
                    onChange={(e) =>
                      setInspectForm((prev) => ({
                        ...prev,
                        recoveryNotes: e.target.value,
                      }))
                    }
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>

          {inspectError && (
            <p className="text-sm text-red-600 mt-3">{inspectError}</p>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setInspecting(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleInspect}
              disabled={
                inspectSaving ||
                !inspectForm.conditionAtReturnId ||
                !inspectForm.outcome
              }
            >
              {inspectSaving ? 'Completing…' : 'Complete Return'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancel modal */}
      <Modal
        isOpen={cancelling !== null}
        onClose={() => setCancelling(null)}
        size="md"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            Cancel Return
          </h2>
          {cancelling && (
            <p className="text-sm text-gray-500 mb-2">
              {cancelling.assetCode} — {cancelling.assetName}
            </p>
          )}
          <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2 mb-4">
            Cancelling restores custody to{' '}
            {cancelling?.returnedByEmployeeName ?? 'the original custodian'} via
            a fresh open assignment.
          </p>
          <TextArea
            label="Reason"
            required
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={2}
            placeholder="Why is this return being cancelled?"
          />
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setCancelling(null)}>
              Back
            </Button>
            <Button
              onClick={handleCancel}
              disabled={!cancelReason.trim() || cancelSaving}
            >
              {cancelSaving ? 'Cancelling…' : 'Cancel Return'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Detail modal (view-only) */}
      <Modal isOpen={viewing !== null} onClose={() => setViewing(null)} size="2xl">
        {viewing && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-secondaryColor mb-1">
              Return Details
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {viewing.assetCode} — {viewing.assetName}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <DetailField
                label="Returned By"
                value={
                  viewing.returnedByEmployeeCode
                    ? `${viewing.returnedByEmployeeName} (${viewing.returnedByEmployeeCode})`
                    : viewing.returnedByEmployeeName
                }
              />
              <DetailField label="Status" value={statusBadge(viewing.status)} />
              <DetailField
                label="Return Date"
                value={formatDate(viewing.returnDate)}
              />
              <DetailField
                label="Initiated On"
                value={formatDate(viewing.createdOn)}
              />
              {viewing.notes && (
                <DetailField label="Notes" value={viewing.notes} wide />
              )}
              {viewing.status === ReturnStatusEnum.Completed && (
                <>
                  <DetailField
                    label="Inspected On"
                    value={formatDate(viewing.inspectedOn)}
                  />
                  <DetailField
                    label="Condition at Return"
                    value={viewing.conditionAtReturnName}
                  />
                  <DetailField
                    label="Outcome"
                    value={outcomeBadge(viewing.outcome)}
                  />
                  <DetailField
                    label="Missing Accessories"
                    value={viewing.missingAccessories}
                  />
                  <DetailField
                    label="Damage Notes"
                    value={viewing.damageNotes}
                    wide
                  />
                  <DetailField
                    label="Inspection Notes"
                    value={viewing.inspectionNotes}
                    wide
                  />
                </>
              )}
              {viewing.status === ReturnStatusEnum.Cancelled && (
                <>
                  <DetailField
                    label="Cancelled On"
                    value={formatDate(viewing.cancelledOn)}
                  />
                  <DetailField
                    label="Cancel Reason"
                    value={viewing.cancelReason}
                  />
                </>
              )}
              {viewing.recoveryCases && viewing.recoveryCases.length > 0 && (
                <div className="md:col-span-2">
                  <div className="text-xs font-medium text-gray-400 mb-1">
                    Recovery Cases
                  </div>
                  <div className="flex flex-col gap-1">
                    {viewing.recoveryCases.map((recoveryCase) => (
                      <div
                        key={recoveryCase.id}
                        className="flex items-center gap-2 text-sm text-gray-700"
                      >
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            RECOVERY_CASE_STATUS_BADGE_CLASSES[
                              recoveryCase.status
                            ] ?? 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {RECOVERY_CASE_STATUS_LABELS[recoveryCase.status] ??
                            recoveryCase.status}
                        </span>
                        <span>
                          {recoveryCase.estimatedAmount != null
                            ? `${recoveryCase.estimatedAmount.toLocaleString()}${
                                recoveryCase.currencyId
                                  ? ` ${recoveryCase.currencyId}`
                                  : ''
                              }`
                            : 'No estimate'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1 italic">
                    Manage these on the Recovery Cases tab.
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-6">
              <Button variant="secondary" onClick={() => setViewing(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ReturnsPage;
