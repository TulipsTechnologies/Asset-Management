'use client';

import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { money, shortDate } from '@/components/Assets/AssetViewShared';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Providers/ToastProvider';
import ReasonBanner from '@/components/UI/ReasonBanner';
import Button from '@/components/UI/Button';
import ConfirmationModal from '@/components/UI/ConfirmationModel';
import CustomTable from '@/components/CustomTable/CustomTable';
import {
  ITableFilters,
  TTableColumn,
} from '@/components/CustomTable/CustomTableInterface';
import CustomCheckbox from '@/components/UI/CustomCheckBox';
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
  IDataWipeCertificate,
  IDisposalDocument,
  IDisposalRequest,
  IDisposalRequestFilter,
} from '@/interface/IDisposal';
import { IAssetListItem } from '@/interface/IAsset';
import { IEmployee } from '@/interface/IEmployee';
import {
  approveRequest,
  cancelRequest,
  createRequest,
  downloadDocument,
  downloadWipeCertificate,
  executeRequest,
  getDocuments,
  getRequests,
  getWipeCertificates,
  recordWipeCertificate,
  rejectRequest,
  uploadDocument,
} from '@/services/disposal.service';
import { fetchAssets } from '@/services/asset.service';
import { fetchEmployees } from '@/services/employee.service';
import {
  mergeTableFilters,
  saveBlobResponse,
  unwrapPaged,
} from '@/utils/serviceUtils';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';
import {
  CUSTODY_LABELS,
  CustodyStatusEnum,
  LIFECYCLE_LABELS,
  LifecycleStatusEnum,
} from '@/enum/assetEnums';
import {
  AssetDocumentTypeEnum,
  DOCUMENT_TYPE_LABELS,
} from '@/enum/assetDocumentEnums';
import {
  DISPOSAL_METHOD_BADGE_CLASSES,
  DISPOSAL_METHOD_HINTS,
  DISPOSAL_METHOD_LABELS,
  DISPOSAL_REQUEST_STATUS_BADGE_CLASSES,
  DISPOSAL_REQUEST_STATUS_LABELS,
  DisposalMethodEnum,
  DisposalRequestStatusEnum,
  MISSING_CUSTODY_NOTE,
  MISSING_PERMITTED_METHODS,
  PROCEEDS_REQUIRED_METHODS,
  REQUIRES_DATA_WIPE_NOTE,
  RETIRE_FIRST_NOTE,
} from '@/enum/disposalEnums';
import useDebounce from '@/hooks/useDebounce';

// Delegates to the module's one date formatter. This was one of 18 identical local copies
// rendering the locale default ("8/20/2026"), which reads as a different day outside the US
// and disagreed with the dashboard and the printed sheets.
const formatDate = (value?: string | null) => shortDate(value);

/**
 * Money, through the module's one formatter.
 *
 * This was a local copy calling bare toLocaleString(), which uses the locale's DEFAULT
 * fraction digits — so 1234.50 rendered as "1,234.5" and the paise silently disappeared on a
 * financial figure. Delegating to `money` fixes the format and keeps every screen agreeing.
 */
const formatAmount = (amount?: number | null, currencyId?: string | null) =>
  money(amount, currencyId);

/** Today in the operator's own timezone — toISOString() would drift a day. */
const todayLocal = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

type TCreateForm = {
  assetId: string;
  disposalMethod: string;
  reason: string;
  proposedProceeds: string;
  currencyId: string;
  requestedByEmployeeId: string;
  requiresDataWipe: boolean;
};

const emptyCreateForm: TCreateForm = {
  assetId: '',
  disposalMethod: String(DisposalMethodEnum.Sale),
  reason: '',
  proposedProceeds: '',
  currencyId: '',
  requestedByEmployeeId: '',
  requiresDataWipe: false,
};

type TExecuteForm = {
  disposalDate: string;
  actualProceeds: string;
  currencyId: string;
  counterpartyName: string;
  counterpartyReference: string;
  notes: string;
};

type TCertificateForm = {
  wipeMethod: string;
  wipedOn: string;
  wipedByEmployeeId: string;
  certificateReference: string;
  notes: string;
};

const emptyCertificateForm: TCertificateForm = {
  wipeMethod: '',
  wipedOn: '',
  wipedByEmployeeId: '',
  certificateReference: '',
  notes: '',
};

type TDocumentForm = {
  documentType: string;
  title: string;
  notes: string;
};

const emptyDocumentForm: TDocumentForm = {
  documentType: '',
  title: '',
  notes: '',
};

const STATUS_PILLS: { label: string; value?: DisposalRequestStatusEnum }[] = [
  { label: 'All' },
  { label: 'Requested', value: DisposalRequestStatusEnum.Requested },
  { label: 'Approved', value: DisposalRequestStatusEnum.Approved },
  { label: 'Executed', value: DisposalRequestStatusEnum.Executed },
  { label: 'Rejected', value: DisposalRequestStatusEnum.Rejected },
  { label: 'Cancelled', value: DisposalRequestStatusEnum.Cancelled },
];

/** Statuses past the point of any transition — View Details only. */
const TERMINAL_STATUSES: DisposalRequestStatusEnum[] = [
  DisposalRequestStatusEnum.Executed,
  DisposalRequestStatusEnum.Rejected,
  DisposalRequestStatusEnum.Cancelled,
];

const methodBadge = (method: DisposalMethodEnum) => (
  <span
    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
      DISPOSAL_METHOD_BADGE_CLASSES[method] ?? 'bg-gray-100 text-gray-700'
    }`}
  >
    {DISPOSAL_METHOD_LABELS[method] ?? method}
  </span>
);

const statusBadge = (status: DisposalRequestStatusEnum) => (
  <span
    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
      DISPOSAL_REQUEST_STATUS_BADGE_CLASSES[status] ?? 'bg-gray-100 text-gray-700'
    }`}
  >
    {DISPOSAL_REQUEST_STATUS_LABELS[status] ?? status}
  </span>
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

type TExecuteBlock = { tag: string; message: string };

/**
 * THE pre-flight. Execute is the largest form in the module and its most likely
 * answer is a 409 — which the close-and-reload rule would honour by discarding
 * everything typed. Every row already carries the asset's lifecycle, its
 * custody and its wipe-certificate count, so the guards this client CAN see are
 * checked here and a doomed Execute is never offered. Returns the blocker, or
 * null when the visible guards pass.
 *
 * The guards that cannot be seen from a row — a stale RowVersion, open work on
 * the asset, a live verification campaign — still come back as genuine 409s and
 * still close and reload. That is the point there.
 */
const executePreflight = (request: IDisposalRequest): TExecuteBlock | null => {
  if (request.assetLifecycleStatus === LifecycleStatusEnum.Disposed)
    return {
      tag: 'Already disposed',
      message: `${request.assetCode} is already Disposed — there is nothing left to execute.`,
    };

  if (request.assetLifecycleStatus !== LifecycleStatusEnum.Retired)
    return {
      tag: 'Retire first',
      message: `${request.assetCode} is ${
        LIFECYCLE_LABELS[request.assetLifecycleStatus] ?? 'not Retired'
      }. ${RETIRE_FIRST_NOTE}`,
    };

  if (
    request.assetCustodyStatus === CustodyStatusEnum.Missing &&
    !MISSING_PERMITTED_METHODS.includes(request.disposalMethod)
  )
    return {
      tag: 'Missing asset',
      message: `${request.assetCode} is Missing and this is a ${
        DISPOSAL_METHOD_LABELS[request.disposalMethod]
      } disposal. ${MISSING_CUSTODY_NOTE}`,
    };

  if (
    request.assetCustodyStatus !== CustodyStatusEnum.Missing &&
    request.assetCustodyStatus !== CustodyStatusEnum.Unassigned
  )
    return {
      tag: 'Return it first',
      message: `${request.assetCode} has custody status ${
        CUSTODY_LABELS[request.assetCustodyStatus] ?? 'unknown'
      } — return it before disposing of it.`,
    };

  if (request.requiresDataWipe && request.wipeCertificateCount === 0)
    return {
      tag: 'Wipe certificate',
      message:
        'This disposal requires a data wipe — record the data-wipe certificate first. Open View Details to record one.',
    };

  return null;
};

const DisposalPage = () => {
  const { addToast } = useToast();
  const router = useRouter();

  const [requests, setRequests] = useState<IDisposalRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  const [filters, setFilters] = useState<IDisposalRequestFilter>({
    pageNumber: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 400);
  const [showFilters, setShowFilters] = useState(false);

  // Pickers loaded once on the first modal open (500-row cap is a known limit)
  const [assets, setAssets] = useState<IAssetListItem[]>([]);
  const [employees, setEmployees] = useState<IEmployee[]>([]);
  const [pickersLoaded, setPickersLoaded] = useState(false);

  // New Request modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<TCreateForm>(emptyCreateForm);
  const [createError, setCreateError] = useState('');
  const [createSaving, setCreateSaving] = useState(false);

  // Approve confirm
  const [approving, setApproving] = useState<IDisposalRequest | null>(null);

  // Reject modal
  const [rejecting, setRejecting] = useState<IDisposalRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSaving, setRejectSaving] = useState(false);

  // Cancel modal
  const [cancelling, setCancelling] = useState<IDisposalRequest | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSaving, setCancelSaving] = useState(false);

  // Execute modal — only ever opened for a row whose pre-flight passed
  const [executing, setExecuting] = useState<IDisposalRequest | null>(null);
  const [executeForm, setExecuteForm] = useState<TExecuteForm>({
    disposalDate: todayLocal(),
    actualProceeds: '',
    currencyId: '',
    counterpartyName: '',
    counterpartyReference: '',
    notes: '',
  });
  const [executeError, setExecuteError] = useState('');
  const [executeSaving, setExecuteSaving] = useState(false);

  // "Why can't I execute?" — the pre-flight's explanation
  const [blocked, setBlocked] = useState<{
    request: IDisposalRequest;
    block: TExecuteBlock;
  } | null>(null);

  // Details modal (request + certificates + documents)
  const [viewing, setViewing] = useState<IDisposalRequest | null>(null);
  const [certificates, setCertificates] = useState<IDataWipeCertificate[]>([]);
  const [documents, setDocuments] = useState<IDisposalDocument[]>([]);
  const [paperworkLoading, setPaperworkLoading] = useState(false);

  const [certificateForm, setCertificateForm] =
    useState<TCertificateForm>(emptyCertificateForm);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [certificateSaving, setCertificateSaving] = useState(false);

  const [documentForm, setDocumentForm] =
    useState<TDocumentForm>(emptyDocumentForm);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentSaving, setDocumentSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // sortField names a DisposalRequest ENTITY property, so the server orders every request
  // and hands back page 1. Asset and Requested By are joined in from the asset and the
  // employee (the entity holds only their ids), and Proceeds prints the executed figure
  // from the transaction row when there is one and the estimate otherwise — a choice made
  // per row in the browser, which no single ORDER BY reproduces. None of the three offers
  // a sort control. The badges sort by the enum stored behind them.
  const columns: TTableColumn[] = [
    { key: 'asset', label: 'Asset', width: 190, type: 'string', name: 'asset' },
    { key: 'method', label: 'Method', width: 130, name: 'method', sortField: 'DisposalMethod' },
    { key: 'proceeds', label: 'Proceeds', width: 120, name: 'proceeds' },
    { key: 'status', label: 'Status', width: 145, name: 'status', sortField: 'Status' },
    { key: 'requestedBy', label: 'Requested By', width: 150, name: 'requestedBy' },
    { key: 'createdOn', label: 'Requested', width: 100, name: 'createdOn', sortField: 'CreatedOn' },
    {
      key: 'actions',
      label: <i className="icon icon-actions text-[10px]" />,
      width: 45,
      canToggle: false,
      name: 'actions',
    },
  ];

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequests(filters);
      if (res?.success) {
        const paged = unwrapPaged(res);
        setRequests(paged.items);
        setRowCount(paged.rowCount);
        setPageCount(paged.pageCount);
      } else {
        addToast.error(res?.message || 'Failed to fetch disposal requests');
      }
    } catch (error) {
      console.error('Error fetching disposal requests:', error);
      addToast.error('An error occurred while fetching disposal requests');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

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
   * Disposal accepts Active OR Retired assets and the list filter takes one
   * lifecycle at a time, so both pages are fetched and merged.
   */
  const loadPickers = () => {
    if (pickersLoaded) return;
    setPickersLoaded(true);
    Promise.all([
      fetchAssets({
        pageNumber: 1,
        pageSize: 500,
        lifecycleStatus: LifecycleStatusEnum.Active,
      }),
      fetchAssets({
        pageNumber: 1,
        pageSize: 500,
        lifecycleStatus: LifecycleStatusEnum.Retired,
      }),
    ])
      .then(([active, retired]) => {
        const items = [
          ...(active?.success ? unwrapPaged(active).items : []),
          ...(retired?.success ? unwrapPaged(retired).items : []),
        ];
        setAssets(
          items.sort((a, b) => a.assetCode.localeCompare(b.assetCode))
        );
      })
      .catch(() => undefined);
    fetchEmployees({ pageNumber: 1, pageSize: 500, isActive: true })
      .then((res) => {
        if (res?.success) setEmployees(unwrapPaged(res).items);
      })
      .catch(() => undefined);
  };

  const assetOptions = assets.map((a) => ({
    value: a.id,
    label: `${a.assetCode} — ${a.assetName} (${
      LIFECYCLE_LABELS[a.lifecycleStatus] ?? 'Unknown'
    })`,
  }));

  const employeeOptions = employees.map((e) => ({
    value: e.id,
    label: e.employeeCode ? `${e.fullName} (${e.employeeCode})` : e.fullName,
  }));

  /**
   * Every rowVersion-carrying verb runs through here. Always refresh:
   * transitions mutate rowversions, stale rows must not linger.
   */
  const runTransition = async (
    fn: () => Promise<{
      success?: boolean;
      message?: string | null;
      reasonCode?: string | null;
    }>
  ) => {
    try {
      const res = await fn();
      if (res?.success) {
        // On a completed disposal the server appends what happened to the Nepal tax pool —
        // either the movement it created, or that the asset carries no tax classification
        // so none was. Shown verbatim; the frontend does not classify it.
        addToast.success(res.message || 'Done');
      } else {
        // 409s ("retire the asset first", "only a Loss or Theft disposal…",
        // "a verification campaign in progress", stale rowVersion) carry the
        // real UX — show them verbatim. The tax-integration refusals additionally
        // carry a stable code, which is what a client should branch on.
        addToast.error(
          <ReasonBanner
            code={res?.reasonCode}
            message={res?.message || 'The operation failed'}
            severity="error"
          />
        );
      }
    } catch (error) {
      console.error('Disposal transition failed:', error);
      addToast.error('An error occurred');
    } finally {
      loadRequests();
    }
  };

  const openCreate = () => {
    setCreateForm(emptyCreateForm);
    setCreateError('');
    setCreateOpen(true);
    loadPickers();
  };

  const handleCreate = async () => {
    if (!createForm.assetId || !createForm.reason.trim()) {
      setCreateError('Pick the asset and say why it is being disposed of');
      return;
    }
    if (
      createForm.proposedProceeds !== '' &&
      (Number.isNaN(Number(createForm.proposedProceeds)) ||
        Number(createForm.proposedProceeds) < 0)
    ) {
      setCreateError('Proposed proceeds must be a positive number');
      return;
    }
    // The module's asymmetric money rule: money needs a currency; a bare
    // currency is simply dropped server-side.
    if (createForm.proposedProceeds !== '' && !createForm.currencyId.trim()) {
      setCreateError('Proposed proceeds need a 3-letter currency code');
      return;
    }
    if (
      createForm.currencyId &&
      !/^[A-Za-z]{3}$/.test(createForm.currencyId.trim())
    ) {
      setCreateError('Currency must be a 3-letter code (e.g. NPR)');
      return;
    }
    setCreateSaving(true);
    try {
      const res = await createRequest({
        assetId: createForm.assetId,
        disposalMethod: Number(createForm.disposalMethod) as DisposalMethodEnum,
        reason: createForm.reason.trim(),
        proposedProceeds:
          createForm.proposedProceeds !== ''
            ? Number(createForm.proposedProceeds)
            : undefined,
        currencyId: createForm.currencyId.trim()
          ? createForm.currencyId.trim().toUpperCase()
          : undefined,
        requestedByEmployeeId: createForm.requestedByEmployeeId || undefined,
        requiresDataWipe: createForm.requiresDataWipe,
      });
      if (res?.success) {
        addToast.success(res.message || 'Disposal requested');
        setCreateOpen(false);
        loadRequests();
      } else {
        // No rowVersion rides on a create, so the modal stays open for a
        // different asset — the 409 here is the one-active-request rule.
        addToast.error(res?.message || 'Failed to raise the disposal request');
      }
    } catch (error) {
      console.error('Error raising disposal request:', error);
      addToast.error('An error occurred while raising the request');
    } finally {
      setCreateSaving(false);
    }
  };

  const handleReject = async () => {
    if (!rejecting || !rejectReason.trim() || rejectSaving) return;
    setRejectSaving(true);
    await runTransition(() =>
      rejectRequest(rejecting.id, {
        reason: rejectReason.trim(),
        rowVersion: rejecting.rowVersion ?? '',
      })
    );
    setRejectSaving(false);
    setRejecting(null);
    setRejectReason('');
  };

  const handleCancel = async () => {
    if (!cancelling || !cancelReason.trim() || cancelSaving) return;
    setCancelSaving(true);
    await runTransition(() =>
      cancelRequest(cancelling.id, {
        reason: cancelReason.trim(),
        rowVersion: cancelling.rowVersion ?? '',
      })
    );
    setCancelSaving(false);
    setCancelling(null);
    setCancelReason('');
  };

  /** Only ever reached for a row whose pre-flight returned null. */
  const openExecute = (request: IDisposalRequest) => {
    setExecuting(request);
    setExecuteForm({
      disposalDate: todayLocal(),
      actualProceeds: '',
      // The proposed estimate's currency is the sane default for the real one.
      currencyId: request.currencyId ?? '',
      counterpartyName: '',
      counterpartyReference: '',
      notes: '',
    });
    setExecuteError('');
  };

  const handleExecute = async () => {
    if (!executing || executeSaving) return;
    const proceedsRequired = PROCEEDS_REQUIRED_METHODS.includes(
      executing.disposalMethod
    );
    if (proceedsRequired && executeForm.actualProceeds.trim() === '') {
      setExecuteError(
        `A ${DISPOSAL_METHOD_LABELS[executing.disposalMethod]} disposal must record the proceeds.`
      );
      return;
    }
    if (
      executeForm.actualProceeds !== '' &&
      (Number.isNaN(Number(executeForm.actualProceeds)) ||
        Number(executeForm.actualProceeds) < 0)
    ) {
      setExecuteError('Actual proceeds must be a positive number');
      return;
    }
    if (executeForm.actualProceeds !== '' && !executeForm.currencyId.trim()) {
      setExecuteError('Proceeds need a 3-letter currency code');
      return;
    }
    if (
      executeForm.currencyId &&
      !/^[A-Za-z]{3}$/.test(executeForm.currencyId.trim())
    ) {
      setExecuteError('Currency must be a 3-letter code (e.g. NPR)');
      return;
    }
    setExecuteSaving(true);
    await runTransition(() =>
      executeRequest(executing.id, {
        disposalDate: executeForm.disposalDate || undefined,
        actualProceeds:
          executeForm.actualProceeds !== ''
            ? Number(executeForm.actualProceeds)
            : undefined,
        currencyId: executeForm.currencyId.trim()
          ? executeForm.currencyId.trim().toUpperCase()
          : undefined,
        counterpartyName: executeForm.counterpartyName.trim() || undefined,
        counterpartyReference:
          executeForm.counterpartyReference.trim() || undefined,
        notes: executeForm.notes.trim() || undefined,
        rowVersion: executing.rowVersion ?? '',
      })
    );
    setExecuteSaving(false);
    setExecuting(null);
  };

  // ---- Details modal: certificates and documents ----

  // Last-write-wins guard: open request A, close, open request B — a slower A can
  // otherwise land after B and fill B's modal with A's paperwork, at which point the
  // Download buttons fetch the wrong request's files.
  const paperworkRequestRef = useRef<string | null>(null);

  const loadPaperwork = useCallback((requestId: string) => {
    paperworkRequestRef.current = requestId;
    setPaperworkLoading(true);
    Promise.all([getWipeCertificates(requestId), getDocuments(requestId)])
      .then(([certificateRes, documentRes]) => {
        if (paperworkRequestRef.current !== requestId) return;
        setCertificates(certificateRes?.success ? (certificateRes.data ?? []) : []);
        setDocuments(documentRes?.success ? (documentRes.data ?? []) : []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (paperworkRequestRef.current === requestId) setPaperworkLoading(false);
      });
  }, []);

  const openDetails = (request: IDisposalRequest) => {
    setViewing(request);
    setCertificates([]);
    setDocuments([]);
    setCertificateForm(emptyCertificateForm);
    setCertificateFile(null);
    setDocumentForm(emptyDocumentForm);
    setDocumentFile(null);
    loadPaperwork(request.id);
    loadPickers();
  };

  const handleRecordCertificate = async () => {
    if (!viewing || !certificateForm.wipeMethod.trim() || certificateSaving)
      return;
    setCertificateSaving(true);
    try {
      const res = await recordWipeCertificate(viewing.id, {
        wipeMethod: certificateForm.wipeMethod.trim(),
        wipedOn: certificateForm.wipedOn || undefined,
        wipedByEmployeeId: certificateForm.wipedByEmployeeId || undefined,
        certificateReference:
          certificateForm.certificateReference.trim() || undefined,
        notes: certificateForm.notes.trim() || undefined,
        file: certificateFile,
      });
      if (res?.success) {
        addToast.success(res.message || 'Data-wipe certificate recorded');
        setCertificateForm(emptyCertificateForm);
        setCertificateFile(null);
        loadPaperwork(viewing.id);
        // The row's certificate count gates the Execute pre-flight.
        loadRequests();
      } else {
        addToast.error(res?.message || 'Failed to record the certificate');
      }
    } catch (error) {
      console.error('Error recording data-wipe certificate:', error);
      addToast.error('An error occurred while recording the certificate');
    } finally {
      setCertificateSaving(false);
    }
  };

  const handleUploadDocument = async () => {
    if (!viewing || !documentForm.documentType || !documentFile || documentSaving)
      return;
    setDocumentSaving(true);
    try {
      const res = await uploadDocument(viewing.id, {
        documentType: Number(
          documentForm.documentType
        ) as AssetDocumentTypeEnum,
        title: documentForm.title.trim() || undefined,
        notes: documentForm.notes.trim() || undefined,
        file: documentFile,
      });
      if (res?.success) {
        addToast.success(res.message || 'Disposal document added');
        setDocumentForm(emptyDocumentForm);
        setDocumentFile(null);
        loadPaperwork(viewing.id);
        loadRequests();
      } else {
        addToast.error(res?.message || 'Failed to upload the document');
      }
    } catch (error) {
      console.error('Error uploading disposal document:', error);
      addToast.error('An error occurred while uploading the document');
    } finally {
      setDocumentSaving(false);
    }
  };

  const handleDownloadDocument = async (document: IDisposalDocument) => {
    setDownloadingId(document.id);
    try {
      const res = await downloadDocument(document.id);
      await saveBlobResponse(res, document.fileName ?? 'disposal-document');
    } catch (error) {
      console.error('Error downloading disposal document:', error);
      addToast.error('Failed to download the document');
    } finally {
      setDownloadingId(null);
    }
  };

  // The scanned certificate is the evidence that gates execution, so it has to be
  // retrievable — it was upload-only until the phase review caught it.
  const handleDownloadCertificate = async (certificate: IDataWipeCertificate) => {
    setDownloadingId(certificate.id);
    try {
      const res = await downloadWipeCertificate(certificate.id);
      await saveBlobResponse(res, certificate.fileName ?? 'wipe-certificate');
    } catch (error) {
      console.error('Error downloading data-wipe certificate:', error);
      addToast.error('Failed to download the certificate');
    } finally {
      setDownloadingId(null);
    }
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

  /** Actual beats proposed; the estimate is labelled as one. */
  const proceedsCell = (request: IDisposalRequest) => {
    if (request.transaction?.actualProceeds != null)
      return formatAmount(
        request.transaction.actualProceeds,
        request.transaction.currencyId
      );
    if (request.proposedProceeds != null)
      return (
        <span>
          {formatAmount(request.proposedProceeds, request.currencyId)}
          <span className="text-xs text-gray-400 ml-1">est.</span>
        </span>
      );
    return '—';
  };

  /** The pre-flight's verdict rides alongside the status badge. */
  const statusCell = (request: IDisposalRequest, block: TExecuteBlock | null) => (
    <div>
      {statusBadge(request.status)}
      {block && (
        <div
          className="text-[11px] text-amber-700 mt-1 leading-snug"
          title={block.message}
        >
          Execute: {block.tag}
        </div>
      )}
    </div>
  );

  const rowData = requests.map((request) => {
    // Pre-flighted once per row: the same verdict gates the menu and the cell.
    const block =
      request.status === DisposalRequestStatusEnum.Approved
        ? executePreflight(request)
        : null;

    return {
      id: request.id,
      asset: assetCell(request.assetCode, request.assetName, request.assetId),
      method: methodBadge(request.disposalMethod),
      proceeds: proceedsCell(request),
      status: statusCell(request, block),
      requestedBy: request.requestedByEmployeeName || '—',
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
                action: () => openDetails(request),
              },
              ...(request.status === DisposalRequestStatusEnum.Requested
                ? [
                    {
                      label: 'Approve',
                      icon: <i className="icon icon-check text-sm" />,
                      action: () => setApproving(request),
                    },
                    {
                      label: 'Reject',
                      icon: <i className="icon icon-close text-sm" />,
                      action: () => {
                        setRejecting(request);
                        setRejectReason('');
                      },
                    },
                  ]
                : []),
              // Approved: the real Execute only when the pre-flight passes;
              // otherwise the explanation, never a doomed form.
              ...(request.status === DisposalRequestStatusEnum.Approved
                ? block
                  ? [
                      {
                        label: 'Why can’t I execute?',
                        icon: <i className="icon icon-info text-sm" />,
                        action: () => setBlocked({ request, block }),
                      },
                    ]
                  : [
                      {
                        label: 'Execute',
                        icon: <i className="icon icon-clipboard text-sm" />,
                        action: () => openExecute(request),
                      },
                    ]
                : []),
              ...(!TERMINAL_STATUSES.includes(request.status)
                ? [
                    {
                      label: 'Cancel',
                      icon: <i className="icon icon-redo text-sm" />,
                      action: () => {
                        setCancelling(request);
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
    };
  });

  const selectedMethodHint =
    DISPOSAL_METHOD_HINTS[Number(createForm.disposalMethod)] ?? '';

  const executeProceedsRequired = executing
    ? PROCEEDS_REQUIRED_METHODS.includes(executing.disposalMethod)
    : false;

  /** Certificates and documents are refused once a request is Rejected or Cancelled. */
  const paperworkAllowed =
    viewing != null &&
    viewing.status !== DisposalRequestStatusEnum.Rejected &&
    viewing.status !== DisposalRequestStatusEnum.Cancelled;

  return (
    <div className="px-4 mt-2">
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
        tableName="Disposal Requests"
        serialOffset={
          ((filters.pageNumber ?? 1) - 1) *
          (filters.pageSize ?? DEFAULT_PAGE_SIZE)
        }
        isLoading={loading}
        entityLabel="disposal request"
        tableHeaderLeft={
          <Button onClick={openCreate}>
            <i className="icon icon-plus text-xs"></i>
            <span>New Request</span>
          </Button>
        }
        tableHeaderRight={
          <>
            <FilterPanel
              open={showFilters}
              onOpenChange={setShowFilters}
              activeCount={[filters.disposalMethod].filter((v) => v != null).length}
              onClearAll={() =>
                setFilters((prev) => ({
                  ...prev,
                  disposalMethod: undefined,
                  pageNumber: 1,
                }))
              }
            >
              <Select
                label="Method"
                placeholder="All"
                options={Object.entries(DISPOSAL_METHOD_LABELS).map(
                  ([v, l]) => ({ value: v, label: l })
                )}
                value={
                  filters.disposalMethod != null
                    ? String(filters.disposalMethod)
                    : ''
                }
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    disposalMethod: e.target.value
                      ? (Number(e.target.value) as DisposalMethodEnum)
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

      {/* New Request modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} size="2xl">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            New Disposal Request
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            A proposal, not a decision — the asset keeps working until someone
            approves. Active or Retired assets only (a Draft asset is deleted,
            not disposed), and one active request per asset.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <div className="md:col-span-2">
              <Select
                label="Asset"
                required
                placeholder="Select an Active or Retired asset"
                options={assetOptions}
                value={createForm.assetId}
                onChange={(e) => {
                  setCreateForm((prev) => ({
                    ...prev,
                    assetId: e.target.value,
                  }));
                  setCreateError('');
                }}
              />
            </div>
            <div className="md:col-span-2">
              <Select
                label="Disposal Method"
                required
                options={Object.entries(DISPOSAL_METHOD_LABELS).map(
                  ([v, l]) => ({ value: v, label: l })
                )}
                value={createForm.disposalMethod}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    disposalMethod: e.target.value,
                  }))
                }
              />
              {selectedMethodHint && (
                <p className="text-gray-400 text-xs mt-1 italic">
                  {selectedMethodHint}
                </p>
              )}
            </div>
            <div className="md:col-span-2">
              <TextArea
                label="Reason"
                required
                value={createForm.reason}
                onChange={(e) => {
                  setCreateForm((prev) => ({
                    ...prev,
                    reason: e.target.value,
                  }));
                  setCreateError('');
                }}
                rows={3}
                maxLength={2000}
                placeholder="Why is this asset leaving the register?"
              />
            </div>
            <Input
              label="Proposed Proceeds"
              type="number"
              value={createForm.proposedProceeds}
              onChange={(e) => {
                setCreateForm((prev) => ({
                  ...prev,
                  proposedProceeds: e.target.value,
                }));
                setCreateError('');
              }}
              placeholder="0.00"
              helperText="Optional planning estimate — the real figure is captured at execution"
            />
            <Input
              label="Currency"
              value={createForm.currencyId}
              onChange={(e) => {
                setCreateForm((prev) => ({
                  ...prev,
                  currencyId: e.target.value.toUpperCase(),
                }));
                setCreateError('');
              }}
              maxLength={3}
              placeholder="NPR"
              helperText="3-letter code — required once an estimate is entered"
            />
            <div className="md:col-span-2">
              <Select
                label="Requested By"
                placeholder="(not recorded)"
                options={employeeOptions}
                value={createForm.requestedByEmployeeId}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    requestedByEmployeeId: e.target.value,
                  }))
                }
              />
            </div>
            <div className="md:col-span-2">
              <CustomCheckbox
                title="This asset holds data and requires a wipe"
                checked={createForm.requiresDataWipe}
                onChange={() =>
                  setCreateForm((prev) => ({
                    ...prev,
                    requiresDataWipe: !prev.requiresDataWipe,
                  }))
                }
              />
            </div>
          </div>
          {createForm.requiresDataWipe && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2 mt-4">
              {REQUIRES_DATA_WIPE_NOTE}
            </p>
          )}
          {createError && (
            <p className="text-sm text-red-600 mt-3">{createError}</p>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createSaving}>
              {createSaving ? 'Requesting…' : 'Request Disposal'}
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
            Reject Disposal
          </h2>
          {rejecting && (
            <p className="text-sm text-gray-500 mb-2">
              {rejecting.assetCode} — {rejecting.assetName}
            </p>
          )}
          <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2 mb-4">
            Rejection is terminal — the asset stays exactly as it is, and a new
            request must be raised if the decision changes.
          </p>
          <TextArea
            label="Reason"
            required
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Why is this disposal being rejected?"
          />
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              Back
            </Button>
            <Button
              onClick={handleReject}
              disabled={!rejectReason.trim() || rejectSaving}
            >
              {rejectSaving ? 'Rejecting…' : 'Reject Disposal'}
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
            Cancel Disposal
          </h2>
          {cancelling && (
            <p className="text-sm text-gray-500 mb-2">
              {cancelling.assetCode} — {cancelling.assetName}
            </p>
          )}
          <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2 mb-4">
            A disposal can be called off right up until it executes, approval
            included — cancelling releases the interlocks that were holding the
            asset back from assignment, transfer and new work. The person who
            raised it may cancel their own; anyone else needs approve rights.
          </p>
          <TextArea
            label="Reason"
            required
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Why is this disposal being cancelled?"
          />
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setCancelling(null)}>
              Back
            </Button>
            <Button
              onClick={handleCancel}
              disabled={!cancelReason.trim() || cancelSaving}
            >
              {cancelSaving ? 'Cancelling…' : 'Cancel Disposal'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Execute modal — the terminal apply */}
      <Modal
        isOpen={executing !== null}
        onClose={() => setExecuting(null)}
        size="2xl"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            Execute Disposal
          </h2>
          {executing && (
            <>
              <p className="text-sm text-gray-500 mb-3">
                {executing.assetCode} — {executing.assetName} ·{' '}
                {DISPOSAL_METHOD_LABELS[executing.disposalMethod]}
              </p>
              <p className="text-xs text-red-700 bg-red-50 rounded px-3 py-2 mb-4">
                <strong>This cannot be undone.</strong> Executing disposes{' '}
                {executing.assetCode} by {
                  DISPOSAL_METHOD_LABELS[executing.disposalMethod]
                }
                : the asset becomes Disposed and Out of Service, a capitalized
                asset is written off, and there is no un-dispose.
                {executing.assetCustodyStatus === CustodyStatusEnum.Missing &&
                  ' Its Missing custody is cleared to Unassigned as it goes — the verification record stays as a Discrepancy, because the asset was never recovered.'}
              </p>
            </>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-500">
                Disposal Date
              </label>
              <input
                type="date"
                value={executeForm.disposalDate}
                onChange={(e) =>
                  setExecuteForm((prev) => ({
                    ...prev,
                    disposalDate: e.target.value,
                  }))
                }
                className="w-full px-0 py-2 border-b border-gray-300 text-base bg-transparent"
              />
            </div>
            <Input
              label="Currency"
              required={executeProceedsRequired}
              value={executeForm.currencyId}
              onChange={(e) => {
                setExecuteForm((prev) => ({
                  ...prev,
                  currencyId: e.target.value.toUpperCase(),
                }));
                setExecuteError('');
              }}
              maxLength={3}
              placeholder="NPR"
              helperText="3-letter code — required once proceeds are recorded"
            />
            <Input
              label="Actual Proceeds"
              required={executeProceedsRequired}
              type="number"
              value={executeForm.actualProceeds}
              onChange={(e) => {
                setExecuteForm((prev) => ({
                  ...prev,
                  actualProceeds: e.target.value,
                }));
                setExecuteError('');
              }}
              placeholder="0.00"
              helperText={
                executeProceedsRequired
                  ? `A ${executing ? DISPOSAL_METHOD_LABELS[executing.disposalMethod] : ''} disposal must record the proceeds — zero is allowed, blank is not`
                  : 'Optional for this method'
              }
            />
            <Input
              label="Counterparty"
              value={executeForm.counterpartyName}
              onChange={(e) =>
                setExecuteForm((prev) => ({
                  ...prev,
                  counterpartyName: e.target.value,
                }))
              }
              maxLength={200}
              placeholder="Buyer, recycler, donee…"
            />
            <div className="md:col-span-2">
              <Input
                label="Counterparty Reference"
                value={executeForm.counterpartyReference}
                onChange={(e) =>
                  setExecuteForm((prev) => ({
                    ...prev,
                    counterpartyReference: e.target.value,
                  }))
                }
                maxLength={100}
                placeholder="Invoice, gate pass or certificate number"
              />
            </div>
            <div className="md:col-span-2">
              <TextArea
                label="Notes"
                value={executeForm.notes}
                onChange={(e) =>
                  setExecuteForm((prev) => ({ ...prev, notes: e.target.value }))
                }
                rows={2}
                maxLength={2000}
                placeholder="How the disposal was carried out, who witnessed it…"
              />
            </div>
          </div>
          {executeError && (
            <p className="text-sm text-red-600 mt-3">{executeError}</p>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setExecuting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleExecute}
              disabled={executeSaving}
            >
              {executeSaving ? 'Executing…' : 'Execute Disposal'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Pre-flight explanation — shown instead of a doomed Execute form */}
      <Modal isOpen={blocked !== null} onClose={() => setBlocked(null)} size="md">
        {blocked && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-secondaryColor mb-1">
              Execute Unavailable
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {blocked.request.assetCode} — {blocked.request.assetName}
            </p>
            <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2">
              {blocked.block.message}
            </p>
            <p className="text-xs text-gray-400 mt-3 italic">
              The disposal stays Approved in the meantime — resolve this and
              Execute comes back on its own. Cancel it if the decision has
              changed.
            </p>
            <div className="flex justify-end mt-6">
              <Button variant="secondary" onClick={() => setBlocked(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Approve confirm — segregation of duties lives on the server */}
      <ConfirmationModal
        isOpen={approving !== null}
        message={`Approve the ${
          approving ? DISPOSAL_METHOD_LABELS[approving.disposalMethod] : ''
        } disposal of "${approving?.assetCode ?? ''}"? Approval commits the asset to leaving: it can no longer be assigned, transferred, reactivated or given new work until the disposal is executed or cancelled. The person who raised the request cannot approve their own unless they hold ManageAssets.`}
        onConfirm={() => {
          if (approving)
            runTransition(() =>
              approveRequest(approving.id, {
                rowVersion: approving.rowVersion ?? '',
              })
            );
        }}
        onClose={() => setApproving(null)}
      />

      {/* Details modal — request, transaction, certificates and paperwork */}
      <Modal isOpen={viewing !== null} onClose={() => setViewing(null)} size="3xl">
        {viewing && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-secondaryColor mb-1">
              Disposal Details
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {viewing.assetCode} — {viewing.assetName}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <DetailField
                label="Method"
                value={methodBadge(viewing.disposalMethod)}
              />
              <DetailField
                label="Status"
                value={statusBadge(viewing.status)}
              />
              <DetailField
                label="Requested By"
                value={viewing.requestedByEmployeeName || '—'}
              />
              <DetailField
                label="Requested On"
                value={formatDate(viewing.createdOn)}
              />
              <DetailField
                label="Asset Lifecycle"
                value={LIFECYCLE_LABELS[viewing.assetLifecycleStatus] ?? '—'}
              />
              <DetailField
                label="Asset Custody"
                value={CUSTODY_LABELS[viewing.assetCustodyStatus] ?? '—'}
              />
              <DetailField
                label="Proposed Proceeds"
                value={formatAmount(viewing.proposedProceeds, viewing.currencyId)}
              />
              <DetailField
                label="Requires Data Wipe"
                value={viewing.requiresDataWipe ? 'Yes' : 'No'}
              />
              <DetailField label="Reason" value={viewing.reason} wide />
              {viewing.approvedOn && (
                <DetailField
                  label="Approved On"
                  value={formatDate(viewing.approvedOn)}
                />
              )}
              {viewing.rejectReason && (
                <DetailField
                  label="Reject Reason"
                  value={`${viewing.rejectReason} (${formatDate(viewing.rejectedOn)})`}
                  wide
                />
              )}
              {viewing.cancelReason && (
                <DetailField
                  label="Cancel Reason"
                  value={`${viewing.cancelReason} (${formatDate(viewing.cancelledOn)})`}
                  wide
                />
              )}
            </div>

            {/* The execution record */}
            {viewing.transaction && (
              <div className="mt-6 border-t pt-4">
                <div className="flex flex-wrap items-center justify-between gap-y-2 mb-3">
                  <span className="text-sm font-medium text-gray-500">
                    Execution
                  </span>
                  <span className="text-xs text-gray-400">
                    Executed {formatDate(viewing.executedOn)}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <DetailField
                    label="Disposal Date"
                    value={formatDate(viewing.transaction.disposalDate)}
                  />
                  <DetailField
                    label="Actual Proceeds"
                    value={formatAmount(
                      viewing.transaction.actualProceeds,
                      viewing.transaction.currencyId
                    )}
                  />
                  <DetailField
                    label="Counterparty"
                    value={viewing.transaction.counterpartyName || '—'}
                  />
                  <DetailField
                    label="Counterparty Reference"
                    value={viewing.transaction.counterpartyReference || '—'}
                  />
                  <DetailField
                    label="Notes"
                    value={viewing.transaction.notes || '—'}
                    wide
                  />
                </div>
              </div>
            )}

            {/* Data-wipe certificates — recordable after execution too */}
            <div className="mt-6 border-t pt-4">
              <span className="text-sm font-medium text-gray-500">
                Data-Wipe Certificates
              </span>
              {paperworkLoading ? (
                <p className="text-sm text-gray-400 mt-2">Loading…</p>
              ) : certificates.length === 0 ? (
                <p className="text-sm text-gray-400 mt-2">
                  No certificates recorded against this request yet.
                </p>
              ) : (
                <div className="space-y-3 mt-3">
                  {certificates.map((certificate) => (
                    <div
                      key={certificate.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm border-b border-gray-50 pb-3 last:border-0 last:pb-0"
                    >
                      <span className="font-medium text-secondaryColor">
                        {certificate.wipeMethod}
                      </span>
                      <span className="text-gray-400">
                        {formatDate(certificate.wipedOn)}
                      </span>
                      {certificate.certificateReference && (
                        <span className="text-gray-500">
                          {certificate.certificateReference}
                        </span>
                      )}
                      {certificate.wipedByEmployeeName && (
                        <span className="text-gray-500">
                          {certificate.wipedByEmployeeName}
                        </span>
                      )}
                      {certificate.hasFile && (
                        <button
                          type="button"
                          className="text-xs text-primarycolor hover:underline disabled:opacity-50"
                          onClick={() => handleDownloadCertificate(certificate)}
                          disabled={downloadingId === certificate.id}
                        >
                          {downloadingId === certificate.id
                            ? 'Downloading…'
                            : (certificate.fileName ?? 'Download')}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {paperworkAllowed && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  <Input
                    label="Wipe Method"
                    required
                    value={certificateForm.wipeMethod}
                    onChange={(e) =>
                      setCertificateForm((prev) => ({
                        ...prev,
                        wipeMethod: e.target.value,
                      }))
                    }
                    maxLength={100}
                    placeholder="NIST 800-88 Purge, degauss, shred…"
                  />
                  <div className="flex flex-col">
                    <label className="block text-sm font-medium text-gray-500">
                      Wiped On
                    </label>
                    <input
                      type="date"
                      value={certificateForm.wipedOn}
                      onChange={(e) =>
                        setCertificateForm((prev) => ({
                          ...prev,
                          wipedOn: e.target.value,
                        }))
                      }
                      className="w-full px-0 py-2 border-b border-gray-300 text-base bg-transparent"
                    />
                  </div>
                  <Input
                    label="Certificate Reference"
                    value={certificateForm.certificateReference}
                    onChange={(e) =>
                      setCertificateForm((prev) => ({
                        ...prev,
                        certificateReference: e.target.value,
                      }))
                    }
                    maxLength={100}
                    placeholder="Certificate number"
                  />
                  <Select
                    label="Wiped By"
                    placeholder="(not recorded)"
                    options={employeeOptions}
                    value={certificateForm.wipedByEmployeeId}
                    onChange={(e) =>
                      setCertificateForm((prev) => ({
                        ...prev,
                        wipedByEmployeeId: e.target.value,
                      }))
                    }
                  />
                  <div className="flex flex-col">
                    <label className="block text-sm font-medium text-gray-500">
                      Scanned Certificate
                    </label>
                    <input
                      type="file"
                      onChange={(e) =>
                        setCertificateFile(e.target.files?.[0] ?? null)
                      }
                      className="w-full py-2 text-sm text-gray-600 border-b border-gray-300"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <TextArea
                      label="Notes"
                      rows={2}
                      value={certificateForm.notes}
                      onChange={(e) =>
                        setCertificateForm((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
                      maxLength={2000}
                      placeholder="Anything worth recording about the wipe…"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="ghost"
                      onClick={handleRecordCertificate}
                      disabled={
                        certificateSaving || !certificateForm.wipeMethod.trim()
                      }
                    >
                      <i className="icon icon-plus text-xs" />
                      <span>
                        {certificateSaving ? 'Recording…' : 'Record certificate'}
                      </span>
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Paperwork — hung off the REQUEST so it survives the asset */}
            <div className="mt-6 border-t pt-4">
              <span className="text-sm font-medium text-gray-500">
                Documents
              </span>
              <p className="text-xs text-gray-400 mt-1 italic">
                Sale invoice, gate pass, certificate of destruction — filed
                against the request, not the asset, precisely so they can still
                be attached after the disposal has executed.
              </p>
              {paperworkLoading ? (
                <p className="text-sm text-gray-400 mt-2">Loading…</p>
              ) : documents.length === 0 ? (
                <p className="text-sm text-gray-400 mt-2">
                  No paperwork attached to this request yet.
                </p>
              ) : (
                <div className="space-y-3 mt-3">
                  {documents.map((document) => (
                    <div
                      key={document.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm border-b border-gray-50 pb-3 last:border-0 last:pb-0"
                    >
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {DOCUMENT_TYPE_LABELS[document.documentType] ?? 'Other'}
                      </span>
                      <span className="font-medium text-secondaryColor">
                        {document.fileName ?? 'file'}
                      </span>
                      {document.title && (
                        <span className="text-gray-500">{document.title}</span>
                      )}
                      <span className="text-gray-400">
                        {formatDate(document.createdOn)}
                      </span>
                      <span className="ml-auto flex items-center gap-3">
                        <button
                          onClick={() => handleDownloadDocument(document)}
                          disabled={downloadingId === document.id}
                          className="text-xs text-primarycolor hover:underline disabled:opacity-50"
                        >
                          {downloadingId === document.id
                            ? 'Downloading…'
                            : 'Download'}
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {paperworkAllowed && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  <Select
                    label="Document Type"
                    required
                    placeholder="Select type"
                    options={Object.entries(DOCUMENT_TYPE_LABELS).map(
                      ([value, label]) => ({ value, label })
                    )}
                    value={documentForm.documentType}
                    onChange={(e) =>
                      setDocumentForm((prev) => ({
                        ...prev,
                        documentType: e.target.value,
                      }))
                    }
                  />
                  <Input
                    label="Title"
                    value={documentForm.title}
                    onChange={(e) =>
                      setDocumentForm((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    maxLength={200}
                    placeholder="Optional label, e.g. Sale invoice 2026-114"
                  />
                  <div className="flex flex-col">
                    <label className="block text-sm font-medium text-gray-500">
                      File<span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                      type="file"
                      onChange={(e) =>
                        setDocumentFile(e.target.files?.[0] ?? null)
                      }
                      className="w-full py-2 text-sm text-gray-600 border-b border-gray-300"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="ghost"
                      onClick={handleUploadDocument}
                      disabled={
                        documentSaving ||
                        !documentForm.documentType ||
                        !documentFile
                      }
                    >
                      <i className="icon icon-plus text-xs" />
                      <span>{documentSaving ? 'Uploading…' : 'Upload'}</span>
                    </Button>
                  </div>
                  <div className="md:col-span-2">
                    <TextArea
                      label="Notes"
                      value={documentForm.notes}
                      onChange={(e) =>
                        setDocumentForm((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
                      rows={2}
                      maxLength={2000}
                    />
                  </div>
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

export default DisposalPage;
