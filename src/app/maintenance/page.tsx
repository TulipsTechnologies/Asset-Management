'use client';

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { money, shortDate } from '@/components/Assets/AssetViewShared';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Providers/ToastProvider';
import Button from '@/components/UI/Button';
import ConfirmationModal from '@/components/UI/ConfirmationModel';
import CustomTable from '@/components/CustomTable/CustomTable';
import {
  ITableFilters,
  TTableColumn,
} from '@/components/CustomTable/CustomTableInterface';
import CustomMenuItem from '@/components/UI/CustomMenuItem';
import Dropdown from '@/components/UI/Dropdown';
import RowKebab from '@/components/UI/RowKebab';
import Modal from '@/components/UI/Modal';
import Input from '@/components/UI/Input';
import Select from '@/components/UI/Select';
import TextArea from '@/components/UI/TextArea';
import FilterPanel from '@/components/UI/FilterPanel';
import SearchBox from '@/components/SearchBox';
import Pagination from '@/components/UI/Pagination';
import {
  IMaintenanceRequest,
  IMaintenanceRequestFilter,
  IWorkOrder,
  IWorkOrderFilter,
} from '@/interface/IMaintenance';
import { IAssetListItem } from '@/interface/IAsset';
import { IEmployee } from '@/interface/IEmployee';
import { IVendor } from '@/interface/IVendor';
import {
  cancelMaintenanceRequest,
  updateMaintenanceRequest,
  deleteMaintenanceRequest,
  cancelWorkOrder,
  completeWorkOrder,
  convertMaintenanceRequest,
  createMaintenanceRequest,
  createWorkOrder,
  getMaintenanceRequests,
  getWorkOrders,
  rejectMaintenanceRequest,
  startWorkOrder,
} from '@/services/maintenance.service';
import { fetchAssetById, fetchAssets } from '@/services/asset.service';
import { fetchEmployees } from '@/services/employee.service';
import { fetchVendors } from '@/services/vendor.service';
import { mergeTableFilters, unwrapPaged } from '@/utils/serviceUtils';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';
import {
  LifecycleStatusEnum,
  OPERATIONAL_LABELS,
} from '@/enum/assetEnums';
import {
  BREAKDOWN_REPORT_NOTE,
  MAINTENANCE_PRIORITY_BADGE_CLASSES,
  MAINTENANCE_PRIORITY_LABELS,
  MAINTENANCE_REQUEST_STATUS_BADGE_CLASSES,
  MAINTENANCE_REQUEST_STATUS_LABELS,
  MAINTENANCE_REQUEST_TYPE_BADGE_CLASSES,
  MAINTENANCE_REQUEST_TYPE_LABELS,
  MaintenancePriorityEnum,
  MaintenanceRequestStatusEnum,
  MaintenanceRequestTypeEnum,
  WORK_ORDER_OUTCOME_BADGE_CLASSES,
  WORK_ORDER_OUTCOME_EFFECTS,
  WORK_ORDER_OUTCOME_LABELS,
  WORK_ORDER_STATUS_BADGE_CLASSES,
  WORK_ORDER_STATUS_LABELS,
  WorkOrderOutcomeEnum,
  WorkOrderStatusEnum,
} from '@/enum/maintenanceEnums';
import useDebounce from '@/hooks/useDebounce';
import useAssetConditions from '@/hooks/useAssetConditions';

// Delegates to the module's one date formatter. This was one of 18 identical local copies
// rendering the locale default ("8/20/2026"), which reads as a different day outside the US
// and disagreed with the dashboard and the printed sheets.
const formatDate = (value?: string | null) => shortDate(value);

const truncate = (value?: string | null, max = 70) =>
  !value ? '—' : value.length > max ? `${value.slice(0, max)}…` : value;

/**
 * Money, through the module's one formatter.
 *
 * This was a local copy calling bare toLocaleString(), which uses the locale's DEFAULT
 * fraction digits — so 1234.50 rendered as "1,234.5" and the paise silently disappeared on a
 * financial figure. Delegating to `money` fixes the format and keeps every screen agreeing.
 */
const formatAmount = (amount?: number | null, currencyId?: string | null) =>
  money(amount, currencyId);

type TRequestForm = {
  assetId: string;
  requestType: string;
  priority: string;
  description: string;
};

const emptyRequestForm: TRequestForm = {
  assetId: '',
  requestType: String(MaintenanceRequestTypeEnum.Corrective),
  priority: String(MaintenancePriorityEnum.Medium),
  description: '',
};

type TConvertForm = {
  title: string;
  priority: string;
  description: string;
  assignedToEmployeeId: string;
  vendorId: string;
  scheduledStartDate: string;
  scheduledEndDate: string;
};

const emptyConvertForm: TConvertForm = {
  title: '',
  priority: '',
  description: '',
  assignedToEmployeeId: '',
  vendorId: '',
  scheduledStartDate: '',
  scheduledEndDate: '',
};

type TWorkOrderForm = {
  assetId: string;
  workOrderType: string;
  priority: string;
  title: string;
  description: string;
  assignedToEmployeeId: string;
  vendorId: string;
  scheduledStartDate: string;
  scheduledEndDate: string;
};

const emptyWorkOrderForm: TWorkOrderForm = {
  assetId: '',
  workOrderType: String(MaintenanceRequestTypeEnum.Corrective),
  priority: String(MaintenancePriorityEnum.Medium),
  title: '',
  description: '',
  assignedToEmployeeId: '',
  vendorId: '',
  scheduledStartDate: '',
  scheduledEndDate: '',
};

type TCompleteForm = {
  conditionAfterId: string;
  outcome: string;
  downtimeHours: string;
  laborCost: string;
  partsCost: string;
  externalCost: string;
  currencyId: string;
  completionNotes: string;
};

const emptyCompleteForm: TCompleteForm = {
  conditionAfterId: '',
  outcome: '',
  downtimeHours: '',
  laborCost: '',
  partsCost: '',
  externalCost: '',
  currencyId: '',
  completionNotes: '',
};

const REQUEST_STATUS_PILLS: {
  label: string;
  value?: MaintenanceRequestStatusEnum;
}[] = [
  { label: 'All' },
  { label: 'Open', value: MaintenanceRequestStatusEnum.Open },
  { label: 'Converted', value: MaintenanceRequestStatusEnum.Converted },
  { label: 'Rejected', value: MaintenanceRequestStatusEnum.Rejected },
  { label: 'Withdrawn', value: MaintenanceRequestStatusEnum.Cancelled },
];

const WORK_ORDER_STATUS_PILLS: { label: string; value?: WorkOrderStatusEnum }[] =
  [
    { label: 'All' },
    { label: 'Open', value: WorkOrderStatusEnum.Open },
    { label: 'In Progress', value: WorkOrderStatusEnum.InProgress },
    { label: 'Completed', value: WorkOrderStatusEnum.Completed },
    { label: 'Cancelled', value: WorkOrderStatusEnum.Cancelled },
  ];

const typeBadge = (type: MaintenanceRequestTypeEnum) => (
  <span
    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
      MAINTENANCE_REQUEST_TYPE_BADGE_CLASSES[type] ?? 'bg-gray-100 text-gray-700'
    }`}
  >
    {MAINTENANCE_REQUEST_TYPE_LABELS[type] ?? type}
  </span>
);

const priorityBadge = (priority: MaintenancePriorityEnum) => (
  <span
    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
      MAINTENANCE_PRIORITY_BADGE_CLASSES[priority] ?? 'bg-gray-100 text-gray-700'
    }`}
  >
    {MAINTENANCE_PRIORITY_LABELS[priority] ?? priority}
  </span>
);

const requestStatusBadge = (status: MaintenanceRequestStatusEnum) => (
  <span
    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
      MAINTENANCE_REQUEST_STATUS_BADGE_CLASSES[status] ??
      'bg-gray-100 text-gray-700'
    }`}
  >
    {MAINTENANCE_REQUEST_STATUS_LABELS[status] ?? status}
  </span>
);

const workOrderStatusBadge = (status: WorkOrderStatusEnum) => (
  <span
    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
      WORK_ORDER_STATUS_BADGE_CLASSES[status] ?? 'bg-gray-100 text-gray-700'
    }`}
  >
    {WORK_ORDER_STATUS_LABELS[status] ?? status}
  </span>
);

const outcomeBadge = (outcome?: WorkOrderOutcomeEnum | null) =>
  outcome != null ? (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
        WORK_ORDER_OUTCOME_BADGE_CLASSES[outcome] ?? 'bg-gray-100 text-gray-700'
      }`}
    >
      {WORK_ORDER_OUTCOME_LABELS[outcome] ?? outcome}
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

const MaintenancePage = () => {
  const { options: conditionOptions, emptyText: conditionEmptyText } = useAssetConditions();
  const { addToast } = useToast();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'requests' | 'workOrders'>(
    'requests'
  );

  // ---- Requests list ----
  const [requests, setRequests] = useState<IMaintenanceRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestRowCount, setRequestRowCount] = useState(0);
  const [requestPageCount, setRequestPageCount] = useState(0);
  const [requestFilters, setRequestFilters] =
    useState<IMaintenanceRequestFilter>({
      pageNumber: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  const [requestSearch, setRequestSearch] = useState('');
  const debouncedRequestSearch = useDebounce(requestSearch, 400);
  const [showRequestFilters, setShowRequestFilters] = useState(false);

  // ---- Work orders list ----
  const [workOrders, setWorkOrders] = useState<IWorkOrder[]>([]);
  const [workOrdersLoading, setWorkOrdersLoading] = useState(false);
  const [workOrderRowCount, setWorkOrderRowCount] = useState(0);
  const [workOrderPageCount, setWorkOrderPageCount] = useState(0);
  const [workOrderFilters, setWorkOrderFilters] = useState<IWorkOrderFilter>({
    pageNumber: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [workOrderSearch, setWorkOrderSearch] = useState('');
  const debouncedWorkOrderSearch = useDebounce(workOrderSearch, 400);
  const [showWorkOrderFilters, setShowWorkOrderFilters] = useState(false);

  // Pickers loaded once on the first modal open (500-row cap is a known limit)
  const [assets, setAssets] = useState<IAssetListItem[]>([]);
  const [employees, setEmployees] = useState<IEmployee[]>([]);
  const [vendors, setVendors] = useState<IVendor[]>([]);
  const [pickersLoaded, setPickersLoaded] = useState(false);

  // New Request modal
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm, setRequestForm] = useState<TRequestForm>(emptyRequestForm);
  const [requestError, setRequestError] = useState('');
  const [requestSaving, setRequestSaving] = useState(false);

  // Edit modal. Holds the request being corrected — its rowVersion is the concurrency token.
  const [editing, setEditing] = useState<IMaintenanceRequest | null>(null);
  const [editForm, setEditForm] = useState<TRequestForm>(emptyRequestForm);
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirmation
  const [deleting, setDeleting] = useState<IMaintenanceRequest | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  // Convert modal
  const [converting, setConverting] = useState<IMaintenanceRequest | null>(null);
  const [convertForm, setConvertForm] = useState<TConvertForm>(emptyConvertForm);
  const [convertError, setConvertError] = useState('');
  const [convertSaving, setConvertSaving] = useState(false);

  // Reject modal
  const [rejecting, setRejecting] = useState<IMaintenanceRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSaving, setRejectSaving] = useState(false);

  // Withdraw (cancel request) modal
  const [withdrawing, setWithdrawing] = useState<IMaintenanceRequest | null>(
    null
  );
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawSaving, setWithdrawSaving] = useState(false);

  // New Work Order modal (direct — no request behind it)
  const [workOrderOpen, setWorkOrderOpen] = useState(false);
  const [workOrderForm, setWorkOrderForm] =
    useState<TWorkOrderForm>(emptyWorkOrderForm);
  const [workOrderError, setWorkOrderError] = useState('');
  const [workOrderSaving, setWorkOrderSaving] = useState(false);

  // Start confirm
  const [starting, setStarting] = useState<IWorkOrder | null>(null);

  // Complete modal
  const [completing, setCompleting] = useState<IWorkOrder | null>(null);
  const [completeForm, setCompleteForm] =
    useState<TCompleteForm>(emptyCompleteForm);
  /** The asset's own currency — seeds the cost currency on first entry. */
  const [completeCurrency, setCompleteCurrency] = useState('');
  const [completeError, setCompleteError] = useState('');
  const [completeSaving, setCompleteSaving] = useState(false);

  // Cancel work order modal
  const [cancelling, setCancelling] = useState<IWorkOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSaving, setCancelSaving] = useState(false);

  // Detail modals (view-only)
  const [viewingRequest, setViewingRequest] =
    useState<IMaintenanceRequest | null>(null);
  const [viewingWorkOrder, setViewingWorkOrder] = useState<IWorkOrder | null>(
    null
  );

  // sortField names a MaintenanceRequest ENTITY property, so the server orders the whole
  // queue and hands back page 1. The Asset column has none: the entity holds only AssetId
  // and the code and name are joined in from Asset, which the database cannot order by here.
  // The three badge columns sort by the enum actually stored behind the badge.
  const requestColumns: TTableColumn[] = [
    { key: 'asset', label: 'Asset', width: 190, type: 'string', name: 'asset' },
    { key: 'requestType', label: 'Type', width: 105, name: 'requestType', sortField: 'RequestType' },
    { key: 'priority', label: 'Priority', width: 90, name: 'priority', sortField: 'Priority' },
    { key: 'status', label: 'Status', width: 100, name: 'status', sortField: 'Status' },
    { key: 'description', label: 'Description', width: 240, type: 'string', name: 'description', sortField: 'Description' },
    { key: 'createdOn', label: 'Reported', width: 100, name: 'createdOn', sortField: 'CreatedOn' },
    {
      key: 'actions',
      label: <i className="icon icon-actions text-[10px]" />,
      width: 45,
      canToggle: false,
      name: 'actions',
    },
  ];

  // Same rule against the WorkOrder entity. Two columns carry more than one value and so
  // order by the one their label leads with — Type before Priority, the start of the
  // scheduled window before its end. Assigned To names an employee and a vendor joined in
  // from their own tables (the entity holds only ids), and Cost is the sum of the three
  // cost columns added up in the projection — neither exists to order by.
  const workOrderColumns: TTableColumn[] = [
    { key: 'asset', label: 'Asset', width: 180, type: 'string', name: 'asset' },
    { key: 'title', label: 'Title', width: 200, type: 'string', name: 'title', sortField: 'Title' },
    { key: 'classification', label: 'Type / Priority', width: 150, name: 'classification', sortField: 'WorkOrderType' },
    { key: 'owner', label: 'Assigned To', width: 160, name: 'owner' },
    { key: 'scheduled', label: 'Scheduled', width: 150, name: 'scheduled', sortField: 'ScheduledStartDate' },
    { key: 'status', label: 'Status', width: 105, name: 'status', sortField: 'Status' },
    { key: 'cost', label: 'Cost', width: 110, name: 'cost' },
    {
      key: 'actions',
      label: <i className="icon icon-actions text-[10px]" />,
      width: 45,
      canToggle: false,
      name: 'actions',
    },
  ];

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const res = await getMaintenanceRequests(requestFilters);
      if (res?.success) {
        const paged = unwrapPaged(res);
        setRequests(paged.items);
        setRequestRowCount(paged.rowCount);
        setRequestPageCount(paged.pageCount);
      } else {
        addToast.error(res?.message || 'Failed to fetch maintenance requests');
      }
    } catch (error) {
      console.error('Error fetching maintenance requests:', error);
      addToast.error('An error occurred while fetching maintenance requests');
    } finally {
      setRequestsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestFilters]);

  const loadWorkOrders = useCallback(async () => {
    setWorkOrdersLoading(true);
    try {
      const res = await getWorkOrders(workOrderFilters);
      if (res?.success) {
        const paged = unwrapPaged(res);
        setWorkOrders(paged.items);
        setWorkOrderRowCount(paged.rowCount);
        setWorkOrderPageCount(paged.pageCount);
      } else {
        addToast.error(res?.message || 'Failed to fetch work orders');
      }
    } catch (error) {
      console.error('Error fetching work orders:', error);
      addToast.error('An error occurred while fetching work orders');
    } finally {
      setWorkOrdersLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrderFilters]);

  // Only the active tab fetches (returns precedent).
  useEffect(() => {
    if (activeTab === 'requests') loadRequests();
  }, [loadRequests, activeTab]);

  useEffect(() => {
    if (activeTab === 'workOrders') loadWorkOrders();
  }, [loadWorkOrders, activeTab]);

  useEffect(() => {
    setRequestFilters((prev) => ({
      ...prev,
      search: debouncedRequestSearch || undefined,
      pageNumber: 1,
    }));
  }, [debouncedRequestSearch]);

  useEffect(() => {
    setWorkOrderFilters((prev) => ({
      ...prev,
      search: debouncedWorkOrderSearch || undefined,
      pageNumber: 1,
    }));
  }, [debouncedWorkOrderSearch]);

  const updateRequestFilters = (updates: Partial<ITableFilters>) => {
    setRequestFilters((prev) => mergeTableFilters(prev, updates));
  };

  const updateWorkOrderFilters = (updates: Partial<ITableFilters>) => {
    setWorkOrderFilters((prev) => mergeTableFilters(prev, updates));
  };

  const loadPickers = () => {
    if (pickersLoaded) return;
    setPickersLoaded(true);
    fetchAssets({
      pageNumber: 1,
      pageSize: 500,
      lifecycleStatus: LifecycleStatusEnum.Active,
    })
      .then((res) => {
        if (res?.success) setAssets(unwrapPaged(res).items);
      })
      .catch(() => undefined);
    fetchEmployees({ pageNumber: 1, pageSize: 500, isActive: true })
      .then((res) => {
        if (res?.success) setEmployees(unwrapPaged(res).items);
      })
      .catch(() => undefined);
    fetchVendors({ pageNumber: 1, pageSize: 500, isActive: true })
      .then((res) => {
        if (res?.success) setVendors(unwrapPaged(res).items);
      })
      .catch(() => undefined);
  };

  const assetOptions = assets.map((a) => ({
    value: a.id,
    label: `${a.assetCode} — ${a.assetName} (${
      OPERATIONAL_LABELS[a.operationalStatus] ?? 'Unknown'
    })`,
  }));

  const employeeOptions = employees.map((e) => ({
    value: e.id,
    label: e.employeeCode ? `${e.fullName} (${e.employeeCode})` : e.fullName,
  }));

  const vendorOptions = vendors.map((v) => ({ value: v.id, label: v.name }));

  /**
   * Every rowVersion-carrying verb runs through here. Always refresh:
   * transitions mutate rowversions, stale rows must not linger.
   */
  const runRequestTransition = async (
    fn: () => Promise<{ success?: boolean; message?: string | null }>
  ) => {
    try {
      const res = await fn();
      if (res?.success) {
        addToast.success(res.message || 'Done');
      } else {
        // 409s ("active work order", "release or recommission it first",
        // stale rowVersion) carry the real UX — show them verbatim.
        addToast.error(res?.message || 'The operation failed');
      }
    } catch (error) {
      console.error('Maintenance request transition failed:', error);
      addToast.error('An error occurred');
    } finally {
      loadRequests();
    }
  };

  const runWorkOrderTransition = async (
    fn: () => Promise<{ success?: boolean; message?: string | null }>
  ) => {
    try {
      const res = await fn();
      if (res?.success) {
        addToast.success(res.message || 'Done');
      } else {
        // 409s ("process a return first", "has a return pending inspection",
        // custody guards) explain themselves — show them verbatim.
        addToast.error(res?.message || 'The operation failed');
      }
    } catch (error) {
      console.error('Work order transition failed:', error);
      addToast.error('An error occurred');
    } finally {
      loadWorkOrders();
    }
  };

  const openRequest = () => {
    setRequestForm(emptyRequestForm);
    setRequestError('');
    setRequestOpen(true);
    loadPickers();
  };

  const handleCreateRequest = async () => {
    if (!requestForm.assetId || !requestForm.description.trim()) {
      setRequestError('Pick the asset and describe the problem');
      return;
    }
    if (requestForm.description.trim().length > 2000) {
      setRequestError('Description must be 2000 characters or fewer');
      return;
    }
    setRequestSaving(true);
    try {
      const res = await createMaintenanceRequest({
        assetId: requestForm.assetId,
        requestType: Number(
          requestForm.requestType
        ) as MaintenanceRequestTypeEnum,
        priority: Number(requestForm.priority) as MaintenancePriorityEnum,
        description: requestForm.description.trim(),
      });
      if (res?.success) {
        addToast.success(res.message || 'Maintenance request raised');
        setRequestOpen(false);
        loadRequests();
      } else {
        // No rowVersion rides on a create, so the modal stays open for a
        // different asset (transfers precedent).
        addToast.error(res?.message || 'Failed to raise the request');
      }
    } catch (error) {
      console.error('Error raising maintenance request:', error);
      addToast.error('An error occurred while raising the request');
    } finally {
      setRequestSaving(false);
    }
  };

  const openEdit = (request: IMaintenanceRequest) => {
    setEditing(request);
    setEditForm({
      ...emptyRequestForm,
      assetId: request.assetId,
      requestType: String(request.requestType),
      priority: String(request.priority),
      description: request.description,
    });
    setEditError('');
  };

  const handleEdit = async () => {
    if (!editing || editSaving) return;
    if (!editForm.description.trim()) {
      setEditError('Describe the problem');
      return;
    }
    if (editForm.description.trim().length > 2000) {
      setEditError('Description must be 2000 characters or fewer');
      return;
    }
    setEditSaving(true);
    try {
      const res = await updateMaintenanceRequest(editing.id, {
        requestType: Number(editForm.requestType) as MaintenanceRequestTypeEnum,
        priority: Number(editForm.priority) as MaintenancePriorityEnum,
        description: editForm.description.trim(),
        rowVersion: editing.rowVersion ?? '',
      });
      if (res?.success) {
        addToast.success(res.message || 'Maintenance request updated');
        setEditing(null);
        loadRequests();
      } else {
        // A 409 here means someone else moved it on — the row in hand is stale, so closing
        // and reloading is the only honest next step; keeping the modal open would let them
        // save the same stale rowVersion again.
        addToast.error(res?.message || 'Failed to update the request');
        setEditing(null);
        loadRequests();
      }
    } catch (error) {
      console.error('Error updating maintenance request:', error);
      addToast.error('An error occurred while updating the request');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting || deleteSaving) return;
    setDeleteSaving(true);
    await runRequestTransition(() => deleteMaintenanceRequest(deleting.id));
    setDeleteSaving(false);
    setDeleting(null);
  };

  const openConvert = (request: IMaintenanceRequest) => {
    setConverting(request);
    // Seeded from the request; every field is overridable server-side too.
    setConvertForm({
      ...emptyConvertForm,
      title: `${MAINTENANCE_REQUEST_TYPE_LABELS[request.requestType] ?? 'Maintenance'} — ${request.assetCode}`,
      priority: String(request.priority),
      description: request.description,
    });
    setConvertError('');
    loadPickers();
  };

  const handleConvert = async () => {
    if (!converting || convertSaving) return;
    if (!convertForm.title.trim()) {
      setConvertError('A work order title is required');
      return;
    }
    setConvertSaving(true);
    await runRequestTransition(() =>
      convertMaintenanceRequest(converting.id, {
        title: convertForm.title.trim(),
        priority: convertForm.priority
          ? (Number(convertForm.priority) as MaintenancePriorityEnum)
          : undefined,
        description: convertForm.description.trim() || undefined,
        assignedToEmployeeId: convertForm.assignedToEmployeeId || undefined,
        vendorId: convertForm.vendorId || undefined,
        scheduledStartDate: convertForm.scheduledStartDate || undefined,
        scheduledEndDate: convertForm.scheduledEndDate || undefined,
        rowVersion: converting.rowVersion ?? '',
      })
    );
    setConvertSaving(false);
    setConverting(null);
    setConvertForm(emptyConvertForm);
  };

  const handleReject = async () => {
    if (!rejecting || !rejectReason.trim() || rejectSaving) return;
    setRejectSaving(true);
    await runRequestTransition(() =>
      rejectMaintenanceRequest(rejecting.id, {
        reason: rejectReason.trim(),
        rowVersion: rejecting.rowVersion ?? '',
      })
    );
    setRejectSaving(false);
    setRejecting(null);
    setRejectReason('');
  };

  const handleWithdraw = async () => {
    if (!withdrawing || !withdrawReason.trim() || withdrawSaving) return;
    setWithdrawSaving(true);
    await runRequestTransition(() =>
      cancelMaintenanceRequest(withdrawing.id, {
        reason: withdrawReason.trim(),
        rowVersion: withdrawing.rowVersion ?? '',
      })
    );
    setWithdrawSaving(false);
    setWithdrawing(null);
    setWithdrawReason('');
  };

  const openWorkOrder = () => {
    setWorkOrderForm(emptyWorkOrderForm);
    setWorkOrderError('');
    setWorkOrderOpen(true);
    loadPickers();
  };

  const handleCreateWorkOrder = async () => {
    if (!workOrderForm.assetId || !workOrderForm.title.trim()) {
      setWorkOrderError('Pick the asset and give the work order a title');
      return;
    }
    setWorkOrderSaving(true);
    try {
      const res = await createWorkOrder({
        assetId: workOrderForm.assetId,
        workOrderType: Number(
          workOrderForm.workOrderType
        ) as MaintenanceRequestTypeEnum,
        priority: Number(workOrderForm.priority) as MaintenancePriorityEnum,
        title: workOrderForm.title.trim(),
        description: workOrderForm.description.trim() || undefined,
        assignedToEmployeeId: workOrderForm.assignedToEmployeeId || undefined,
        vendorId: workOrderForm.vendorId || undefined,
        scheduledStartDate: workOrderForm.scheduledStartDate || undefined,
        scheduledEndDate: workOrderForm.scheduledEndDate || undefined,
      });
      if (res?.success) {
        addToast.success(res.message || 'Work order raised');
        setWorkOrderOpen(false);
        loadWorkOrders();
      } else {
        // 409 = one-active-work-order rule or a held asset ("release or
        // recommission it first") — keep the modal so another asset can be
        // picked.
        addToast.error(res?.message || 'Failed to raise the work order');
      }
    } catch (error) {
      console.error('Error raising work order:', error);
      addToast.error('An error occurred while raising the work order');
    } finally {
      setWorkOrderSaving(false);
    }
  };

  const openComplete = (workOrder: IWorkOrder) => {
    setCompleting(workOrder);
    setCompleteForm(emptyCompleteForm);
    setCompleteCurrency('');
    setCompleteError('');
    // Costs need a currency; the asset's own is the sane default.
    fetchAssetById(workOrder.assetId)
      .then((res) => {
        if (res?.success && res.data?.currencyId)
          setCompleteCurrency(res.data.currencyId);
      })
      .catch(() => undefined);
  };

  /** Typing the first cost fills the currency in for you (the API 400s without one). */
  const updateCost = (
    field: 'laborCost' | 'partsCost' | 'externalCost',
    value: string
  ) => {
    setCompleteForm((prev) => ({
      ...prev,
      [field]: value,
      currencyId: prev.currencyId || (value.trim() ? completeCurrency : ''),
    }));
    setCompleteError('');
  };

  const handleComplete = async () => {
    if (!completing || completeSaving) return;
    if (!completeForm.conditionAfterId || !completeForm.outcome) {
      setCompleteError('Condition after the work and an outcome are required');
      return;
    }
    const numbers: [string, string][] = [
      ['Downtime hours', completeForm.downtimeHours],
      ['Labour cost', completeForm.laborCost],
      ['Parts cost', completeForm.partsCost],
      ['External cost', completeForm.externalCost],
    ];
    const invalid = numbers.find(
      ([, v]) => v !== '' && (Number.isNaN(Number(v)) || Number(v) < 0)
    );
    if (invalid) {
      setCompleteError(`${invalid[0]} must be a positive number`);
      return;
    }
    const hasCost = [
      completeForm.laborCost,
      completeForm.partsCost,
      completeForm.externalCost,
    ].some((v) => v !== '');
    if (hasCost && !completeForm.currencyId.trim()) {
      setCompleteError('Costs need a 3-letter currency code');
      return;
    }
    if (
      completeForm.currencyId &&
      !/^[A-Za-z]{3}$/.test(completeForm.currencyId.trim())
    ) {
      setCompleteError('Currency must be a 3-letter code (e.g. NPR)');
      return;
    }
    setCompleteSaving(true);
    await runWorkOrderTransition(() =>
      completeWorkOrder(completing.id, {
        conditionAfterId: completeForm.conditionAfterId,
        outcome: Number(completeForm.outcome) as WorkOrderOutcomeEnum,
        downtimeHours: completeForm.downtimeHours
          ? Number(completeForm.downtimeHours)
          : undefined,
        laborCost: completeForm.laborCost
          ? Number(completeForm.laborCost)
          : undefined,
        partsCost: completeForm.partsCost
          ? Number(completeForm.partsCost)
          : undefined,
        externalCost: completeForm.externalCost
          ? Number(completeForm.externalCost)
          : undefined,
        currencyId: completeForm.currencyId.trim()
          ? completeForm.currencyId.trim().toUpperCase()
          : undefined,
        completionNotes: completeForm.completionNotes.trim() || undefined,
        rowVersion: completing.rowVersion ?? '',
      })
    );
    setCompleteSaving(false);
    setCompleting(null);
    setCompleteForm(emptyCompleteForm);
  };

  const handleCancelWorkOrder = async () => {
    if (!cancelling || !cancelReason.trim() || cancelSaving) return;
    setCancelSaving(true);
    await runWorkOrderTransition(() =>
      cancelWorkOrder(cancelling.id, {
        reason: cancelReason.trim(),
        rowVersion: cancelling.rowVersion ?? '',
      })
    );
    setCancelSaving(false);
    setCancelling(null);
    setCancelReason('');
  };

  const assetCell = (assetCode: string, assetName: string, assetId?: string) => (
    <div>
      {assetId ? (
        <button
          type="button"
          className="font-medium text-primarycolor hover:underline"
          onClick={() => router.push(`/assets/${assetId}`)}
        >
          {assetCode}
        </button>
      ) : (
        // No id to open — so it is not coloured either. Green means clickable.
        <div className="font-medium text-gray-700">{assetCode}</div>
      )}
      <div className="text-xs text-gray-400">{assetName}</div>
    </div>
  );

  const requestRowData = requests.map((request) => ({
    id: request.id,
    asset: assetCell(request.assetCode, request.assetName, request.assetId),
    requestType: typeBadge(request.requestType),
    priority: priorityBadge(request.priority),
    status: requestStatusBadge(request.status),
    description: truncate(request.description),
    createdOn: formatDate(request.createdOn),
    actions: (
      <div className="flex gap-x-2 relative bg-white px-4 py-2 -m-2">
        <Dropdown
          buttonChildren={<RowKebab />}
        >
          {[
            {
              label: 'View Details',
              icon: <i className="icon icon-eye text-sm" />,
              action: () => setViewingRequest(request),
            },
            ...(request.status === MaintenanceRequestStatusEnum.Open
              ? [
                  {
                    label: 'Edit',
                    icon: <i className="icon icon-edit text-sm" />,
                    action: () => openEdit(request),
                  },
                  {
                    label: 'Convert',
                    icon: <i className="icon icon-setting text-sm" />,
                    action: () => openConvert(request),
                  },
                  {
                    label: 'Reject',
                    icon: <i className="icon icon-close text-sm" />,
                    action: () => {
                      setRejecting(request);
                      setRejectReason('');
                    },
                  },
                  {
                    label: 'Withdraw',
                    icon: <i className="icon icon-redo text-sm" />,
                    action: () => {
                      setWithdrawing(request);
                      setWithdrawReason('');
                    },
                  },
                ]
              : []),
            /* Offered for everything except a Converted request, because that is exactly the
               case the API refuses: a work order points back at it. Rejected and Withdrawn
               requests carry no such reference and are the ones most often worth clearing. */
            ...(request.status !== MaintenanceRequestStatusEnum.Converted
              ? [
                  {
                    label: 'Delete',
                    icon: <i className="icon icon-trash text-sm" />,
                    action: () => setDeleting(request),
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

  const workOrderRowData = workOrders.map((workOrder) => ({
    id: workOrder.id,
    asset: assetCell(workOrder.assetCode, workOrder.assetName, workOrder.assetId),
    title: workOrder.title,
    classification: (
      <div className="flex flex-wrap items-center gap-1">
        {typeBadge(workOrder.workOrderType)}
        {priorityBadge(workOrder.priority)}
      </div>
    ),
    owner:
      workOrder.assignedToEmployeeName || workOrder.vendorName ? (
        <div>
          {workOrder.assignedToEmployeeName && (
            <div>{workOrder.assignedToEmployeeName}</div>
          )}
          {workOrder.vendorName && (
            <div className="text-xs text-gray-400">{workOrder.vendorName}</div>
          )}
        </div>
      ) : (
        '—'
      ),
    scheduled:
      workOrder.scheduledStartDate || workOrder.scheduledEndDate
        ? `${formatDate(workOrder.scheduledStartDate)} → ${formatDate(workOrder.scheduledEndDate)}`
        : '—',
    status: workOrderStatusBadge(workOrder.status),
    cost: formatAmount(workOrder.totalCost, workOrder.currencyId),
    actions: (
      <div className="flex gap-x-2 relative bg-white px-4 py-2 -m-2">
        <Dropdown
          buttonChildren={<RowKebab />}
        >
          {[
            {
              label: 'View Details',
              icon: <i className="icon icon-eye text-sm" />,
              action: () => setViewingWorkOrder(workOrder),
            },
            ...(workOrder.status === WorkOrderStatusEnum.Open
              ? [
                  {
                    label: 'Start',
                    icon: <i className="icon icon-check text-sm" />,
                    action: () => setStarting(workOrder),
                  },
                ]
              : []),
            ...(workOrder.status === WorkOrderStatusEnum.InProgress
              ? [
                  {
                    label: 'Complete',
                    icon: <i className="icon icon-clipboard text-sm" />,
                    action: () => openComplete(workOrder),
                  },
                ]
              : []),
            ...([WorkOrderStatusEnum.Open, WorkOrderStatusEnum.InProgress].includes(
              workOrder.status
            )
              ? [
                  {
                    label: 'Cancel',
                    icon: <i className="icon icon-close text-sm" />,
                    action: () => {
                      setCancelling(workOrder);
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

  const selectedOutcomeEffect = completeForm.outcome
    ? WORK_ORDER_OUTCOME_EFFECTS[Number(completeForm.outcome)]
    : '';

  const isBreakdownReport =
    Number(requestForm.requestType) === MaintenanceRequestTypeEnum.Breakdown;

  return (
    <div className="px-4 mt-2">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-secondaryColor">Maintenance</h1>
        <p className="mt-0.5 text-xs text-gray-500">
          Breakdown and preventive requests, triaged into work orders that record
          the work done and what it cost.
        </p>
      </div>

      {/* Tab switcher: triage queue vs the work itself */}
      <div className="flex border-b gap-x-10 mb-4">
        {(
          [
            { id: 'requests', label: 'Requests' },
            { id: 'workOrders', label: 'Work Orders' },
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

      {activeTab === 'requests' ? (
        <>
          {/* Status filter pills */}
          <div className="flex flex-wrap gap-2 mb-3">
            {REQUEST_STATUS_PILLS.map((pill) => (
              <button
                key={pill.label}
                type="button"
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  requestFilters.status === pill.value
                    ? 'bg-primarycolor text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                onClick={() =>
                  setRequestFilters((prev) => ({
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

          {/* Distinct key per tab: CustomTable seeds its column state from props
              once, so without this React reuses the instance across tabs and the
              second tab renders the first tab's columns. */}
          <CustomTable
            key="maintenance-requests-table"
            columns={requestColumns}
            rows={requestRowData}
            tableName="Maintenance Requests"
            serialOffset={
              ((requestFilters.pageNumber ?? 1) - 1) *
              (requestFilters.pageSize ?? DEFAULT_PAGE_SIZE)
            }
            isLoading={requestsLoading}
            entityLabel="request"
            tableHeaderLeft={
              <Button onClick={openRequest}>
                <i className="icon icon-plus text-xs"></i>
                <span>New Request</span>
              </Button>
            }
            tableHeaderRight={
              <>
                <FilterPanel
                  open={showRequestFilters}
                  onOpenChange={setShowRequestFilters}
                  activeCount={
                    [requestFilters.requestType, requestFilters.priority].filter(
                      (v) => v != null
                    ).length
                  }
                  onClearAll={() =>
                    setRequestFilters((prev) => ({
                      ...prev,
                      requestType: undefined,
                      priority: undefined,
                      pageNumber: 1,
                    }))
                  }
                >
                  <Select
                    label="Type"
                    placeholder="All"
                    options={Object.entries(MAINTENANCE_REQUEST_TYPE_LABELS).map(
                      ([v, l]) => ({ value: v, label: l })
                    )}
                    value={
                      requestFilters.requestType != null
                        ? String(requestFilters.requestType)
                        : ''
                    }
                    onChange={(e) =>
                      setRequestFilters((prev) => ({
                        ...prev,
                        requestType: e.target.value
                          ? (Number(e.target.value) as MaintenanceRequestTypeEnum)
                          : undefined,
                        pageNumber: 1,
                      }))
                    }
                  />
                  <Select
                    label="Priority"
                    placeholder="All"
                    options={Object.entries(MAINTENANCE_PRIORITY_LABELS).map(
                      ([v, l]) => ({ value: v, label: l })
                    )}
                    value={
                      requestFilters.priority != null
                        ? String(requestFilters.priority)
                        : ''
                    }
                    onChange={(e) =>
                      setRequestFilters((prev) => ({
                        ...prev,
                        priority: e.target.value
                          ? (Number(e.target.value) as MaintenancePriorityEnum)
                          : undefined,
                        pageNumber: 1,
                      }))
                    }
                  />
                </FilterPanel>
                <SearchBox
                  onSearch={setRequestSearch}
                  searchVal={requestSearch}
                />
              </>
            }
            updateFilters={updateRequestFilters}
            sortBy={requestFilters.sortBy}
            sortDesc={requestFilters.sortDesc}
          />

          <div className="mt-3">
            <Pagination
              pageNumber={requestFilters.pageNumber ?? 1}
              totalPages={requestPageCount}
              pageSize={requestFilters.pageSize ?? DEFAULT_PAGE_SIZE}
              totalCount={requestRowCount}
              updateFilters={updateRequestFilters}
            />
          </div>
        </>
      ) : (
        <>
          {/* Status filter pills */}
          <div className="flex flex-wrap gap-2 mb-3">
            {WORK_ORDER_STATUS_PILLS.map((pill) => (
              <button
                key={pill.label}
                type="button"
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  workOrderFilters.status === pill.value
                    ? 'bg-primarycolor text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                onClick={() =>
                  setWorkOrderFilters((prev) => ({
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
            key="work-orders-table"
            columns={workOrderColumns}
            rows={workOrderRowData}
            tableName="Work Orders"
            serialOffset={
              ((workOrderFilters.pageNumber ?? 1) - 1) *
              (workOrderFilters.pageSize ?? DEFAULT_PAGE_SIZE)
            }
            isLoading={workOrdersLoading}
            entityLabel="work order"
            tableHeaderLeft={
              <Button onClick={openWorkOrder}>
                <i className="icon icon-plus text-xs"></i>
                <span>New Work Order</span>
              </Button>
            }
            tableHeaderRight={
              <>
                <FilterPanel
                  open={showWorkOrderFilters}
                  onOpenChange={setShowWorkOrderFilters}
                  activeCount={
                    [
                      workOrderFilters.workOrderType,
                      workOrderFilters.priority,
                    ].filter((v) => v != null).length
                  }
                  onClearAll={() =>
                    setWorkOrderFilters((prev) => ({
                      ...prev,
                      workOrderType: undefined,
                      priority: undefined,
                      pageNumber: 1,
                    }))
                  }
                >
                  <Select
                    label="Type"
                    placeholder="All"
                    options={Object.entries(MAINTENANCE_REQUEST_TYPE_LABELS).map(
                      ([v, l]) => ({ value: v, label: l })
                    )}
                    value={
                      workOrderFilters.workOrderType != null
                        ? String(workOrderFilters.workOrderType)
                        : ''
                    }
                    onChange={(e) =>
                      setWorkOrderFilters((prev) => ({
                        ...prev,
                        workOrderType: e.target.value
                          ? (Number(e.target.value) as MaintenanceRequestTypeEnum)
                          : undefined,
                        pageNumber: 1,
                      }))
                    }
                  />
                  <Select
                    label="Priority"
                    placeholder="All"
                    options={Object.entries(MAINTENANCE_PRIORITY_LABELS).map(
                      ([v, l]) => ({ value: v, label: l })
                    )}
                    value={
                      workOrderFilters.priority != null
                        ? String(workOrderFilters.priority)
                        : ''
                    }
                    onChange={(e) =>
                      setWorkOrderFilters((prev) => ({
                        ...prev,
                        priority: e.target.value
                          ? (Number(e.target.value) as MaintenancePriorityEnum)
                          : undefined,
                        pageNumber: 1,
                      }))
                    }
                  />
                </FilterPanel>
                <SearchBox
                  onSearch={setWorkOrderSearch}
                  searchVal={workOrderSearch}
                />
              </>
            }
            updateFilters={updateWorkOrderFilters}
            sortBy={workOrderFilters.sortBy}
            sortDesc={workOrderFilters.sortDesc}
          />

          <div className="mt-3">
            <Pagination
              pageNumber={workOrderFilters.pageNumber ?? 1}
              totalPages={workOrderPageCount}
              pageSize={workOrderFilters.pageSize ?? DEFAULT_PAGE_SIZE}
              totalCount={workOrderRowCount}
              updateFilters={updateWorkOrderFilters}
            />
          </div>
        </>
      )}

      {/* Edit request modal. Deliberately narrower than New Request: the ASSET is fixed. A
          request names what was reported against a particular asset, and re-pointing it
          would rewrite that rather than correct it — so a wrong asset means withdraw and
          raise again, which is what the API enforces too. */}
      <Modal isOpen={!!editing} onClose={() => setEditing(null)} size="lg">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            Edit Maintenance Request
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            {editing?.assetCode ? `${editing.assetCode} — ` : ''}
            correct the type, priority or description. Only Open requests can be
            edited.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <Select
              label="Request Type"
              required
              options={Object.entries(MAINTENANCE_REQUEST_TYPE_LABELS).map(
                ([v, l]) => ({ value: v, label: l })
              )}
              value={editForm.requestType}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, requestType: e.target.value }))
              }
            />
            <Select
              label="Priority"
              required
              options={Object.entries(MAINTENANCE_PRIORITY_LABELS).map(
                ([v, l]) => ({ value: v, label: l })
              )}
              value={editForm.priority}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, priority: e.target.value }))
              }
            />
            <div className="md:col-span-2">
              <TextArea
                label="Description"
                required
                value={editForm.description}
                onChange={(e) => {
                  setEditForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }));
                  setEditError('');
                }}
                rows={3}
                maxLength={2000}
                placeholder="What is wrong, what was observed, when it started…"
              />
            </div>
          </div>
          {editError && (
            <p className="text-sm text-red-600 mt-3">{editError}</p>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={editSaving}>
              <i aria-hidden="true" className="icon icon-save text-xs" />
              {editSaving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation. Names the asset, because the row menu is the only thing that
          told the operator which request they were on. */}
      <Modal isOpen={!!deleting} onClose={() => setDeleting(null)} size="md">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            Delete this request?
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            {deleting?.assetCode ? `${deleting.assetCode} — ` : ''}
            {truncate(deleting?.description ?? '')}
          </p>
          <p className="text-xs text-gray-400 mt-3">
            A request already converted into a work order cannot be deleted —
            withdraw it instead.
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={deleteSaving}
            >
              {deleteSaving ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* New Request modal */}
      <Modal isOpen={requestOpen} onClose={() => setRequestOpen(false)} size="lg">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            New Maintenance Request
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Raises a triage item. Several open requests per asset are allowed —
            deduplication is a human call at triage.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <div className="md:col-span-2">
              <Select
                label="Asset"
                required
                placeholder="Select an Active asset"
                options={assetOptions}
                value={requestForm.assetId}
                onChange={(e) => {
                  setRequestForm((prev) => ({
                    ...prev,
                    assetId: e.target.value,
                  }));
                  setRequestError('');
                }}
              />
            </div>
            <Select
              label="Request Type"
              required
              options={Object.entries(MAINTENANCE_REQUEST_TYPE_LABELS).map(
                ([v, l]) => ({ value: v, label: l })
              )}
              value={requestForm.requestType}
              onChange={(e) =>
                setRequestForm((prev) => ({
                  ...prev,
                  requestType: e.target.value,
                }))
              }
            />
            <Select
              label="Priority"
              required
              options={Object.entries(MAINTENANCE_PRIORITY_LABELS).map(
                ([v, l]) => ({ value: v, label: l })
              )}
              value={requestForm.priority}
              onChange={(e) =>
                setRequestForm((prev) => ({
                  ...prev,
                  priority: e.target.value,
                }))
              }
            />
            <div className="md:col-span-2">
              <TextArea
                label="Description"
                required
                value={requestForm.description}
                onChange={(e) => {
                  setRequestForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }));
                  setRequestError('');
                }}
                rows={3}
                maxLength={2000}
                placeholder="What is wrong, what was observed, when it started…"
              />
            </div>
          </div>
          {isBreakdownReport && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2 mt-4">
              {BREAKDOWN_REPORT_NOTE}
            </p>
          )}
          {requestError && (
            <p className="text-sm text-red-600 mt-3">{requestError}</p>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setRequestOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateRequest} disabled={requestSaving}>
              {requestSaving ? 'Raising…' : 'Raise Request'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Convert modal */}
      <Modal
        isOpen={converting !== null}
        onClose={() => setConverting(null)}
        size="2xl"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            Convert to Work Order
          </h2>
          {converting && (
            <p className="text-sm text-gray-500 mb-2">
              {converting.assetCode} — {converting.assetName}
            </p>
          )}
          <p className="text-xs text-gray-400 mb-4">
            Fields are seeded from the request and are all overridable. One
            active work order per asset; a Quarantined or Out of Service asset
            must be released or recommissioned first.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <Input
              label="Title"
              required
              value={convertForm.title}
              onChange={(e) => {
                setConvertForm((prev) => ({ ...prev, title: e.target.value }));
                setConvertError('');
              }}
              maxLength={200}
            />
            <Select
              label="Priority"
              options={Object.entries(MAINTENANCE_PRIORITY_LABELS).map(
                ([v, l]) => ({ value: v, label: l })
              )}
              value={convertForm.priority}
              onChange={(e) =>
                setConvertForm((prev) => ({ ...prev, priority: e.target.value }))
              }
            />
            <div className="md:col-span-2">
              <TextArea
                label="Description"
                value={convertForm.description}
                onChange={(e) =>
                  setConvertForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={2}
                maxLength={2000}
              />
            </div>
            <Select
              label="Assigned To"
              placeholder="(unassigned)"
              options={employeeOptions}
              value={convertForm.assignedToEmployeeId}
              onChange={(e) =>
                setConvertForm((prev) => ({
                  ...prev,
                  assignedToEmployeeId: e.target.value,
                }))
              }
            />
            <Select
              label="Vendor"
              placeholder="(in-house)"
              options={vendorOptions}
              value={convertForm.vendorId}
              onChange={(e) =>
                setConvertForm((prev) => ({ ...prev, vendorId: e.target.value }))
              }
            />
            <Input
              label="Scheduled Start"
              type="date"
              value={convertForm.scheduledStartDate}
              onChange={(e) =>
                setConvertForm((prev) => ({
                  ...prev,
                  scheduledStartDate: e.target.value,
                }))
              }
            />
            <Input
              label="Scheduled End"
              type="date"
              value={convertForm.scheduledEndDate}
              onChange={(e) =>
                setConvertForm((prev) => ({
                  ...prev,
                  scheduledEndDate: e.target.value,
                }))
              }
            />
          </div>
          {convertError && (
            <p className="text-sm text-red-600 mt-3">{convertError}</p>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setConverting(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleConvert}
              disabled={convertSaving || !convertForm.title.trim()}
            >
              {convertSaving ? 'Converting…' : 'Create Work Order'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject modal */}
      <Modal
        isOpen={rejecting !== null}
        onClose={() => setRejecting(null)}
        size="md"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            Reject Request
          </h2>
          {rejecting && (
            <p className="text-sm text-gray-500 mb-2">
              {rejecting.assetCode} — {rejecting.assetName}
            </p>
          )}
          <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2 mb-4">
            Rejecting a breakdown report puts the asset back in service when
            nothing else is holding it down — no other open breakdown report and
            no active work order.
          </p>
          <TextArea
            label="Reason"
            required
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Why is this request being rejected?"
          />
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              Back
            </Button>
            <Button
              onClick={handleReject}
              disabled={!rejectReason.trim() || rejectSaving}
            >
              {rejectSaving ? 'Rejecting…' : 'Reject Request'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Withdraw (cancel request) modal */}
      <Modal
        isOpen={withdrawing !== null}
        onClose={() => setWithdrawing(null)}
        size="md"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            Withdraw Request
          </h2>
          {withdrawing && (
            <p className="text-sm text-gray-500 mb-2">
              {withdrawing.assetCode} — {withdrawing.assetName}
            </p>
          )}
          <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2 mb-4">
            Withdrawing a breakdown report puts the asset back in service when
            nothing else is holding it down. The person who raised it may
            withdraw their own; anyone else needs a manage permission.
          </p>
          <TextArea
            label="Reason"
            required
            value={withdrawReason}
            onChange={(e) => setWithdrawReason(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Why is this request being withdrawn?"
          />
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setWithdrawing(null)}>
              Back
            </Button>
            <Button
              onClick={handleWithdraw}
              disabled={!withdrawReason.trim() || withdrawSaving}
            >
              {withdrawSaving ? 'Withdrawing…' : 'Withdraw Request'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* New Work Order modal (direct) */}
      <Modal
        isOpen={workOrderOpen}
        onClose={() => setWorkOrderOpen(false)}
        size="2xl"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            New Work Order
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Raised directly, without a request. One active work order per asset;
            a Quarantined or Out of Service asset must be released or
            recommissioned first.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <div className="md:col-span-2">
              <Select
                label="Asset"
                required
                placeholder="Select an Active asset"
                options={assetOptions}
                value={workOrderForm.assetId}
                onChange={(e) => {
                  setWorkOrderForm((prev) => ({
                    ...prev,
                    assetId: e.target.value,
                  }));
                  setWorkOrderError('');
                }}
              />
            </div>
            <Select
              label="Type"
              required
              options={Object.entries(MAINTENANCE_REQUEST_TYPE_LABELS).map(
                ([v, l]) => ({ value: v, label: l })
              )}
              value={workOrderForm.workOrderType}
              onChange={(e) =>
                setWorkOrderForm((prev) => ({
                  ...prev,
                  workOrderType: e.target.value,
                }))
              }
            />
            <Select
              label="Priority"
              required
              options={Object.entries(MAINTENANCE_PRIORITY_LABELS).map(
                ([v, l]) => ({ value: v, label: l })
              )}
              value={workOrderForm.priority}
              onChange={(e) =>
                setWorkOrderForm((prev) => ({
                  ...prev,
                  priority: e.target.value,
                }))
              }
            />
            <div className="md:col-span-2">
              <Input
                label="Title"
                required
                value={workOrderForm.title}
                onChange={(e) => {
                  setWorkOrderForm((prev) => ({
                    ...prev,
                    title: e.target.value,
                  }));
                  setWorkOrderError('');
                }}
                maxLength={200}
                placeholder="Replace faulty battery…"
              />
            </div>
            <div className="md:col-span-2">
              <TextArea
                label="Description"
                value={workOrderForm.description}
                onChange={(e) =>
                  setWorkOrderForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={2}
                maxLength={2000}
              />
            </div>
            <Select
              label="Assigned To"
              placeholder="(unassigned)"
              options={employeeOptions}
              value={workOrderForm.assignedToEmployeeId}
              onChange={(e) =>
                setWorkOrderForm((prev) => ({
                  ...prev,
                  assignedToEmployeeId: e.target.value,
                }))
              }
            />
            <Select
              label="Vendor"
              placeholder="(in-house)"
              options={vendorOptions}
              value={workOrderForm.vendorId}
              onChange={(e) =>
                setWorkOrderForm((prev) => ({
                  ...prev,
                  vendorId: e.target.value,
                }))
              }
            />
            <Input
              label="Scheduled Start"
              type="date"
              value={workOrderForm.scheduledStartDate}
              onChange={(e) =>
                setWorkOrderForm((prev) => ({
                  ...prev,
                  scheduledStartDate: e.target.value,
                }))
              }
            />
            <Input
              label="Scheduled End"
              type="date"
              value={workOrderForm.scheduledEndDate}
              onChange={(e) =>
                setWorkOrderForm((prev) => ({
                  ...prev,
                  scheduledEndDate: e.target.value,
                }))
              }
            />
          </div>
          {workOrderError && (
            <p className="text-sm text-red-600 mt-3">{workOrderError}</p>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setWorkOrderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateWorkOrder} disabled={workOrderSaving}>
              {workOrderSaving ? 'Raising…' : 'Raise Work Order'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Complete modal */}
      <Modal
        isOpen={completing !== null}
        onClose={() => setCompleting(null)}
        size="2xl"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            Complete Work Order
          </h2>
          {completing && (
            <p className="text-sm text-gray-500 mb-4">
              {completing.assetCode} — {completing.assetName} · {completing.title}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <Select
              label="Condition After"
              required
              placeholder="Select condition"
              options={conditionOptions}
              emptyText={conditionEmptyText}
              value={completeForm.conditionAfterId}
              onChange={(e) => {
                setCompleteForm((prev) => ({
                  ...prev,
                  conditionAfterId: e.target.value,
                }));
                setCompleteError('');
              }}
            />
            <div>
              <Select
                label="Outcome"
                required
                placeholder="Select outcome"
                options={Object.entries(WORK_ORDER_OUTCOME_LABELS).map(
                  ([v, l]) => ({ value: v, label: l })
                )}
                value={completeForm.outcome}
                onChange={(e) => {
                  setCompleteForm((prev) => ({
                    ...prev,
                    outcome: e.target.value,
                  }));
                  setCompleteError('');
                }}
              />
              {selectedOutcomeEffect && (
                <p className="text-gray-400 text-xs mt-1 italic">
                  {selectedOutcomeEffect}
                </p>
              )}
            </div>
            <Input
              label="Downtime Hours"
              type="number"
              value={completeForm.downtimeHours}
              onChange={(e) => {
                setCompleteForm((prev) => ({
                  ...prev,
                  downtimeHours: e.target.value,
                }));
                setCompleteError('');
              }}
              placeholder="0.00"
            />
            <Input
              label="Currency"
              value={completeForm.currencyId}
              onChange={(e) => {
                setCompleteForm((prev) => ({
                  ...prev,
                  currencyId: e.target.value.toUpperCase(),
                }));
                setCompleteError('');
              }}
              maxLength={3}
              placeholder="NPR"
              helperText="3-letter code — required once any cost is entered"
            />
            <Input
              label="Labour Cost"
              type="number"
              value={completeForm.laborCost}
              onChange={(e) => updateCost('laborCost', e.target.value)}
              placeholder="0.00"
            />
            <Input
              label="Parts Cost"
              type="number"
              value={completeForm.partsCost}
              onChange={(e) => updateCost('partsCost', e.target.value)}
              placeholder="0.00"
            />
            <Input
              label="External Cost"
              type="number"
              value={completeForm.externalCost}
              onChange={(e) => updateCost('externalCost', e.target.value)}
              placeholder="0.00"
            />
            <div className="md:col-span-2">
              <TextArea
                label="Completion Notes"
                value={completeForm.completionNotes}
                onChange={(e) =>
                  setCompleteForm((prev) => ({
                    ...prev,
                    completionNotes: e.target.value,
                  }))
                }
                rows={2}
                maxLength={2000}
                placeholder="What was done, parts replaced, follow-ups…"
              />
            </div>
          </div>
          {completeError && (
            <p className="text-sm text-red-600 mt-3">{completeError}</p>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setCompleting(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleComplete}
              disabled={
                completeSaving ||
                !completeForm.conditionAfterId ||
                !completeForm.outcome
              }
            >
              {completeSaving ? 'Completing…' : 'Complete Work Order'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancel work order modal */}
      <Modal
        isOpen={cancelling !== null}
        onClose={() => setCancelling(null)}
        size="md"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            Cancel Work Order
          </h2>
          {cancelling && (
            <p className="text-sm text-gray-500 mb-2">
              {cancelling.assetCode} — {cancelling.assetName} ·{' '}
              {cancelling.title}
            </p>
          )}
          <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2 mb-4">
            Cancelling restores the status the asset had before the work started
            — a reported breakdown comes back rather than being silently healed
            — and reopens the request it came from.
          </p>
          <TextArea
            label="Reason"
            required
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Why is this work order being cancelled?"
          />
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setCancelling(null)}>
              Back
            </Button>
            <Button
              onClick={handleCancelWorkOrder}
              disabled={!cancelReason.trim() || cancelSaving}
            >
              {cancelSaving ? 'Cancelling…' : 'Cancel Work Order'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Start confirm — the step that takes the asset out of service */}
      <ConfirmationModal
        isOpen={starting !== null}
        message={`Start "${starting?.title ?? ''}"? Sets the asset to Under Maintenance and snapshots its current status so a cancel can restore it. A held asset must be released or recommissioned first.`}
        onConfirm={() => {
          if (starting)
            runWorkOrderTransition(() =>
              startWorkOrder(starting.id, {
                rowVersion: starting.rowVersion ?? '',
              })
            );
        }}
        onClose={() => setStarting(null)}
      />

      {/* Request detail modal (view-only) */}
      <Modal
        isOpen={viewingRequest !== null}
        onClose={() => setViewingRequest(null)}
        size="2xl"
      >
        {viewingRequest && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-secondaryColor mb-1">
              Request Details
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {viewingRequest.assetCode} — {viewingRequest.assetName}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <DetailField
                label="Type"
                value={typeBadge(viewingRequest.requestType)}
              />
              <DetailField
                label="Priority"
                value={priorityBadge(viewingRequest.priority)}
              />
              <DetailField
                label="Status"
                value={requestStatusBadge(viewingRequest.status)}
              />
              <DetailField
                label="Reported On"
                value={formatDate(viewingRequest.createdOn)}
              />
              <DetailField
                label="Reported By"
                value={viewingRequest.reportedByEmployeeName || '—'}
              />
              <DetailField
                label="Flipped To Breakdown"
                value={viewingRequest.wroteBreakdown ? 'Yes' : 'No'}
              />
              <DetailField
                label="Description"
                value={viewingRequest.description}
                wide
              />
              {viewingRequest.rejectReason && (
                <DetailField
                  label="Reject Reason"
                  value={`${viewingRequest.rejectReason} (${formatDate(viewingRequest.rejectedOn)})`}
                  wide
                />
              )}
              {viewingRequest.cancelReason && (
                <DetailField
                  label="Withdraw Reason"
                  value={`${viewingRequest.cancelReason} (${formatDate(viewingRequest.cancelledOn)})`}
                  wide
                />
              )}
              {viewingRequest.workOrders.length > 0 && (
                <div className="md:col-span-2">
                  <div className="text-xs font-medium text-gray-400 mb-1">
                    Work Orders
                  </div>
                  <div className="flex flex-col gap-1">
                    {viewingRequest.workOrders.map((workOrder) => (
                      <div
                        key={workOrder.id}
                        className="flex items-center gap-2 text-sm text-gray-700"
                      >
                        {workOrderStatusBadge(workOrder.status)}
                        <span>{workOrder.title}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1 italic">
                    Manage these on the Work Orders tab.
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-6">
              <Button
                variant="secondary"
                onClick={() => setViewingRequest(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Work order detail modal (view-only) */}
      <Modal
        isOpen={viewingWorkOrder !== null}
        onClose={() => setViewingWorkOrder(null)}
        size="2xl"
      >
        {viewingWorkOrder && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-secondaryColor mb-1">
              Work Order Details
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {viewingWorkOrder.assetCode} — {viewingWorkOrder.assetName} ·{' '}
              {viewingWorkOrder.title}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <DetailField
                label="Type"
                value={typeBadge(viewingWorkOrder.workOrderType)}
              />
              <DetailField
                label="Priority"
                value={priorityBadge(viewingWorkOrder.priority)}
              />
              <DetailField
                label="Status"
                value={workOrderStatusBadge(viewingWorkOrder.status)}
              />
              <DetailField
                label="Raised From"
                value={
                  viewingWorkOrder.maintenanceRequestId
                    ? 'A maintenance request'
                    : 'Raised directly'
                }
              />
              <DetailField
                label="Assigned To"
                value={viewingWorkOrder.assignedToEmployeeName || '—'}
              />
              <DetailField
                label="Vendor"
                value={viewingWorkOrder.vendorName || '—'}
              />
              <DetailField
                label="Scheduled"
                value={
                  viewingWorkOrder.scheduledStartDate ||
                  viewingWorkOrder.scheduledEndDate
                    ? `${formatDate(viewingWorkOrder.scheduledStartDate)} → ${formatDate(viewingWorkOrder.scheduledEndDate)}`
                    : '—'
                }
              />
              <DetailField
                label="Started On"
                value={formatDate(viewingWorkOrder.startedOn)}
              />
              {viewingWorkOrder.description && (
                <DetailField
                  label="Description"
                  value={viewingWorkOrder.description}
                  wide
                />
              )}
              {viewingWorkOrder.status === WorkOrderStatusEnum.Completed && (
                <>
                  <DetailField
                    label="Completed On"
                    value={formatDate(viewingWorkOrder.completedOn)}
                  />
                  <DetailField
                    label="Outcome"
                    value={outcomeBadge(viewingWorkOrder.completionOutcome)}
                  />
                  <DetailField
                    label="Condition After"
                    value={viewingWorkOrder.conditionAfterName || '—'}
                  />
                  <DetailField
                    label="Downtime"
                    value={
                      viewingWorkOrder.downtimeHours != null
                        ? `${viewingWorkOrder.downtimeHours} h`
                        : '—'
                    }
                  />
                  <DetailField
                    label="Labour / Parts / External"
                    value={`${formatAmount(viewingWorkOrder.laborCost, viewingWorkOrder.currencyId)} · ${formatAmount(viewingWorkOrder.partsCost, viewingWorkOrder.currencyId)} · ${formatAmount(viewingWorkOrder.externalCost, viewingWorkOrder.currencyId)}`}
                  />
                  <DetailField
                    label="Total Cost"
                    value={formatAmount(
                      viewingWorkOrder.totalCost,
                      viewingWorkOrder.currencyId
                    )}
                  />
                  <DetailField
                    label="Completion Notes"
                    value={viewingWorkOrder.completionNotes || '—'}
                    wide
                  />
                </>
              )}
              {viewingWorkOrder.status === WorkOrderStatusEnum.Cancelled && (
                <>
                  <DetailField
                    label="Cancelled On"
                    value={formatDate(viewingWorkOrder.cancelledOn)}
                  />
                  <DetailField
                    label="Cancel Reason"
                    value={viewingWorkOrder.cancelReason || '—'}
                  />
                </>
              )}
            </div>
            <div className="flex justify-end mt-6">
              <Button
                variant="secondary"
                onClick={() => setViewingWorkOrder(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MaintenancePage;
