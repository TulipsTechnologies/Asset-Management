'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/Providers/ToastProvider';
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
  IAssetAuditCampaign,
  IAssetAuditDiscrepancy,
  IAssetAuditDiscrepancyFilter,
  IAssetAuditEvidence,
  IAssetAuditResult,
  IAssetAuditResultFilter,
  IAuditResolveCandidate,
} from '@/interface/IAssetAudit';
import { IAssetLocation } from '@/interface/IAssetLocation';
import { IEmployee } from '@/interface/IEmployee';
import {
  approveCampaign,
  cancelCampaign,
  deleteEvidence,
  downloadEvidence,
  getCampaign,
  getDiscrepancies,
  getResults,
  recordResult,
  reconcileDiscrepancy,
  resolveCode,
  startCampaign,
  submitCampaign,
  uploadEvidence,
} from '@/services/assetAudit.service';
import { fetchAssetLocations } from '@/services/assetLocation.service';
import { fetchEmployees } from '@/services/employee.service';
import { saveBlobResponse, unwrapPaged } from '@/utils/serviceUtils';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';
import { ASSET_CONDITIONS, CustodyStatusEnum } from '@/enum/assetEnums';
import {
  AUDIT_CAMPAIGN_STATUS_BADGE_CLASSES,
  AUDIT_CAMPAIGN_STATUS_LABELS,
  AUDIT_DISCREPANCY_STATUS_BADGE_CLASSES,
  AUDIT_DISCREPANCY_STATUS_LABELS,
  AUDIT_RESULT_TYPE_BADGE_CLASSES,
  AUDIT_RESULT_TYPE_LABELS,
  AUDIT_SCOPE_TYPE_LABELS,
  AuditCampaignStatusEnum,
  AuditResultTypeEnum,
  AuditScopeTypeEnum,
  RECONCILE_ACTION_EFFECTS,
  RECONCILE_ACTION_MATRIX,
  RECONCILIATION_ACTION_LABELS,
  ReconciliationActionEnum,
} from '@/enum/auditEnums';
import useDebounce from '@/hooks/useDebounce';

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString() : '—';

const resultTypeBadge = (type: AuditResultTypeEnum) => (
  <span
    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
      AUDIT_RESULT_TYPE_BADGE_CLASSES[type] ?? 'bg-gray-100 text-gray-700'
    }`}
  >
    {AUDIT_RESULT_TYPE_LABELS[type] ?? type}
  </span>
);

const discrepancyStatusBadge = (
  status: number,
  labels: Record<number, string> = AUDIT_DISCREPANCY_STATUS_LABELS,
  classes: Record<number, string> = AUDIT_DISCREPANCY_STATUS_BADGE_CLASSES
) => (
  <span
    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
      classes[status] ?? 'bg-gray-100 text-gray-700'
    }`}
  >
    {labels[status] ?? status}
  </span>
);

const StatCard = ({
  label,
  value,
  alert,
}: {
  label: string;
  value: number;
  alert?: boolean;
}) => (
  <div className="bg-white rounded-xl p-4">
    <div className="text-xs text-gray-400 uppercase tracking-wide">{label}</div>
    <div
      className={`text-2xl font-semibold mt-1 ${
        alert && value > 0 ? 'text-red-600' : 'text-secondaryColor'
      }`}
    >
      {value}
    </div>
  </div>
);

/** What the scan panel currently shows. */
type TScanState =
  | { kind: 'resolved'; candidate: IAuditResolveCandidate; existingResult: IAssetAuditResult | null }
  | { kind: 'ambiguous'; candidates: IAuditResolveCandidate[] }
  | { kind: 'nomatch'; message: string };

/** The asset the Record modal is recording against (scan-resolved or re-scan). */
type TRecordTarget = {
  assetId: string;
  assetCode: string;
  assetName: string;
  scannedCode?: string;
  /** The existing result row's rowVersion — required for updates, absent on true inserts. */
  rowVersion?: string | null;
};

type TRecordForm = {
  foundAssetLocationId: string;
  foundCustodianEmployeeId: string;
  foundConditionTypeId: string;
  foundSerialNumber: string;
  tagDamaged: boolean;
  notFound: boolean;
  notes: string;
};

const emptyRecordForm: TRecordForm = {
  foundAssetLocationId: '',
  foundCustodianEmployeeId: '',
  foundConditionTypeId: '',
  foundSerialNumber: '',
  tagDamaged: false,
  notFound: false,
  notes: '',
};

type TUnknownForm = {
  explicitType: string;
  scannedCode: string;
  description: string;
  notes: string;
};

const emptyUnknownForm: TUnknownForm = {
  explicitType: String(AuditResultTypeEnum.NotInRegister),
  scannedCode: '',
  description: '',
  notes: '',
};

type TReconcileForm = {
  action: string;
  notes: string;
  openRecovery: boolean;
  recoveryEmployeeId: string;
  recoveryDescription: string;
  recoveryAmount: string;
  recoveryCurrency: string;
};

const emptyReconcileForm: TReconcileForm = {
  action: '',
  notes: '',
  openRecovery: false,
  recoveryEmployeeId: '',
  recoveryDescription: '',
  recoveryAmount: '',
  recoveryCurrency: 'NPR',
};

const CampaignDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();

  const [campaign, setCampaign] = useState<IAssetAuditCampaign | null>(null);
  const [loadingCampaign, setLoadingCampaign] = useState(true);
  const [activeTab, setActiveTab] = useState<'results' | 'discrepancies'>('results');

  const [locations, setLocations] = useState<IAssetLocation[]>([]);
  const [employees, setEmployees] = useState<IEmployee[]>([]);

  // Results tab
  const [results, setResults] = useState<IAssetAuditResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultRowCount, setResultRowCount] = useState(0);
  const [resultPageCount, setResultPageCount] = useState(0);
  const [resultFilters, setResultFilters] = useState<IAssetAuditResultFilter>({
    pageNumber: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [resultSearch, setResultSearch] = useState('');
  const debouncedResultSearch = useDebounce(resultSearch, 400);
  const [showResultFilters, setShowResultFilters] = useState(false);

  // Scan panel (InProgress only)
  const [scanCode, setScanCode] = useState('');
  const [scanState, setScanState] = useState<TScanState | null>(null);
  const [resolving, setResolving] = useState(false);

  // Record modal (registered path: scan-resolved or re-scan)
  const [recordTarget, setRecordTarget] = useState<TRecordTarget | null>(null);
  const [recordForm, setRecordForm] = useState<TRecordForm>(emptyRecordForm);
  const [recordError, setRecordError] = useState('');
  const [recordSaving, setRecordSaving] = useState(false);

  // Record Unknown Item modal
  const [unknownOpen, setUnknownOpen] = useState(false);
  const [unknownForm, setUnknownForm] = useState<TUnknownForm>(emptyUnknownForm);
  const [unknownError, setUnknownError] = useState('');
  const [unknownSaving, setUnknownSaving] = useState(false);

  // Evidence modal — derived from the results list so reloads keep it fresh
  const [evidenceResultId, setEvidenceResultId] = useState<string | null>(null);
  const [evidenceCaption, setEvidenceCaption] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [deletingEvidence, setDeletingEvidence] = useState<IAssetAuditEvidence | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Discrepancies tab
  const [discrepancies, setDiscrepancies] = useState<IAssetAuditDiscrepancy[]>([]);
  const [discLoading, setDiscLoading] = useState(false);
  const [discRowCount, setDiscRowCount] = useState(0);
  const [discPageCount, setDiscPageCount] = useState(0);
  const [discFilters, setDiscFilters] = useState<IAssetAuditDiscrepancyFilter>({
    pageNumber: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [discSearch, setDiscSearch] = useState('');
  const debouncedDiscSearch = useDebounce(discSearch, 400);
  const [showDiscFilters, setShowDiscFilters] = useState(false);

  // Reconcile modal
  const [reconciling, setReconciling] = useState<IAssetAuditDiscrepancy | null>(null);
  const [reconcileForm, setReconcileForm] = useState<TReconcileForm>(emptyReconcileForm);
  const [reconcileError, setReconcileError] = useState('');
  const [reconcileSaving, setReconcileSaving] = useState(false);

  // Cancel modal / Approve confirm
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSaving, setCancelSaving] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);

  const loadCampaign = useCallback(() => {
    if (!id) return;
    getCampaign(id)
      .then((res) => {
        if (res?.success && res.data) {
          setCampaign(res.data);
        } else {
          addToast.error(res?.message || 'Campaign not found');
          router.replace('/physical-verification');
        }
      })
      .catch(() => {
        addToast.error('An error occurred while loading the campaign');
        router.replace('/physical-verification');
      })
      .finally(() => setLoadingCampaign(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    loadCampaign();
  }, [loadCampaign]);

  useEffect(() => {
    fetchAssetLocations({ pageNumber: 1, pageSize: 500, isActive: true })
      .then((res) => {
        if (res?.success) setLocations(unwrapPaged(res).items);
      })
      .catch(() => undefined);
    fetchEmployees({ pageNumber: 1, pageSize: 500, isActive: true })
      .then((res) => {
        if (res?.success) setEmployees(unwrapPaged(res).items);
      })
      .catch(() => undefined);
  }, []);

  const loadResults = useCallback(async () => {
    if (!id) return;
    setResultsLoading(true);
    try {
      const res = await getResults(id, resultFilters);
      if (res?.success) {
        const paged = unwrapPaged(res);
        setResults(paged.items);
        setResultRowCount(paged.rowCount);
        setResultPageCount(paged.pageCount);
      } else {
        addToast.error(res?.message || 'Failed to fetch results');
      }
    } catch (error) {
      console.error('Error fetching results:', error);
      addToast.error('An error occurred while fetching results');
    } finally {
      setResultsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, resultFilters]);

  const loadDiscrepancies = useCallback(async () => {
    if (!id) return;
    setDiscLoading(true);
    try {
      const res = await getDiscrepancies(id, discFilters);
      if (res?.success) {
        const paged = unwrapPaged(res);
        setDiscrepancies(paged.items);
        setDiscRowCount(paged.rowCount);
        setDiscPageCount(paged.pageCount);
      } else {
        addToast.error(res?.message || 'Failed to fetch discrepancies');
      }
    } catch (error) {
      console.error('Error fetching discrepancies:', error);
      addToast.error('An error occurred while fetching discrepancies');
    } finally {
      setDiscLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, discFilters]);

  useEffect(() => {
    if (activeTab === 'results') loadResults();
    else loadDiscrepancies();
  }, [activeTab, loadResults, loadDiscrepancies]);

  useEffect(() => {
    setResultFilters((prev) => ({
      ...prev,
      search: debouncedResultSearch || undefined,
      pageNumber: 1,
    }));
  }, [debouncedResultSearch]);

  useEffect(() => {
    setDiscFilters((prev) => ({
      ...prev,
      search: debouncedDiscSearch || undefined,
      pageNumber: 1,
    }));
  }, [debouncedDiscSearch]);

  const updateResultFilters = (updates: Partial<ITableFilters>) => {
    setResultFilters((prev) => ({
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

  const updateDiscFilters = (updates: Partial<ITableFilters>) => {
    setDiscFilters((prev) => ({
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

  /** Refreshes the campaign header/stat counts plus whichever tab is showing. */
  const reloadAll = () => {
    loadCampaign();
    if (activeTab === 'results') loadResults();
    else loadDiscrepancies();
  };

  const runTransition = async (
    fn: () => Promise<{ success?: boolean; message?: string | null }>
  ) => {
    try {
      const res = await fn();
      if (res?.success) {
        addToast.success(res.message || 'Done');
      } else {
        // 400s (open-discrepancy count) / 409s (staleness details): show verbatim.
        addToast.error(res?.message || 'The operation failed');
      }
    } catch (error) {
      console.error('Campaign transition failed:', error);
      addToast.error('An error occurred');
    } finally {
      // Always refresh: transitions mutate rowversions, stale rows must not linger.
      reloadAll();
    }
  };

  const handleCancel = async () => {
    if (!campaign || !cancelReason.trim() || cancelSaving) return;
    setCancelSaving(true);
    await runTransition(() =>
      cancelCampaign(campaign.id, cancelReason.trim(), campaign.rowVersion ?? '')
    );
    setCancelSaving(false);
    setCancelOpen(false);
    setCancelReason('');
  };

  // ---- Scan panel ----

  const handleResolve = async () => {
    if (!scanCode.trim() || resolving) return;
    setResolving(true);
    setScanState(null);
    try {
      const res = await resolveCode(id, scanCode.trim());
      if (res?.success && res.data) {
        if (res.data.candidates.length === 1) {
          setScanState({
            kind: 'resolved',
            candidate: res.data.candidates[0],
            existingResult: res.data.existingResult ?? null,
          });
        } else {
          setScanState({ kind: 'ambiguous', candidates: res.data.candidates });
        }
      } else {
        // Unknown and cross-tenant codes answer identically — offer the
        // unknown-item capture path.
        setScanState({
          kind: 'nomatch',
          message: res?.message || 'No asset matches the scanned code.',
        });
      }
    } catch (error) {
      console.error('Error resolving code:', error);
      addToast.error('An error occurred while resolving the code');
    } finally {
      setResolving(false);
    }
  };

  /**
   * Ambiguity pick: re-resolve by the candidate's Asset Code (unique) so the
   * existing result row's rowVersion rides along like a clean single hit.
   */
  const pickCandidate = async (candidate: IAuditResolveCandidate) => {
    setResolving(true);
    try {
      const res = await resolveCode(id, candidate.assetCode);
      if (res?.success && res.data && res.data.candidates.length === 1) {
        setScanState({
          kind: 'resolved',
          candidate: res.data.candidates[0],
          existingResult: res.data.existingResult ?? null,
        });
      } else {
        setScanState({ kind: 'resolved', candidate, existingResult: null });
      }
    } catch {
      setScanState({ kind: 'resolved', candidate, existingResult: null });
    } finally {
      setResolving(false);
    }
  };

  const openRecordFromScan = (
    candidate: IAuditResolveCandidate,
    existingResult: IAssetAuditResult | null
  ) => {
    setRecordTarget({
      assetId: candidate.assetId,
      assetCode: candidate.assetCode,
      assetName: candidate.assetName,
      scannedCode: scanCode.trim() || undefined,
      rowVersion: existingResult?.rowVersion ?? undefined,
    });
    setRecordForm({
      foundAssetLocationId: existingResult?.foundAssetLocationId ?? '',
      foundCustodianEmployeeId: existingResult?.foundCustodianEmployeeId ?? '',
      foundConditionTypeId: existingResult?.foundConditionTypeId ?? '',
      foundSerialNumber: existingResult?.foundSerialNumber ?? '',
      tagDamaged: existingResult?.tagDamaged ?? false,
      notFound: existingResult?.resultType === AuditResultTypeEnum.NotFound,
      notes: existingResult?.notes ?? '',
    });
    setRecordError('');
  };

  /** Re-scan an already-listed row — the API 409s if it has reconciled decisions. */
  const openRescan = (result: IAssetAuditResult) => {
    if (!result.assetId) return;
    setRecordTarget({
      assetId: result.assetId,
      assetCode: result.assetCode ?? '',
      assetName: result.assetName ?? '',
      scannedCode: result.scannedCode ?? undefined,
      rowVersion: result.rowVersion,
    });
    setRecordForm({
      foundAssetLocationId: result.foundAssetLocationId ?? '',
      foundCustodianEmployeeId: result.foundCustodianEmployeeId ?? '',
      foundConditionTypeId: result.foundConditionTypeId ?? '',
      foundSerialNumber: result.foundSerialNumber ?? '',
      tagDamaged: result.tagDamaged,
      notFound: result.resultType === AuditResultTypeEnum.NotFound,
      notes: result.notes ?? '',
    });
    setRecordError('');
  };

  // House pattern: after ANY failed workflow action, close the modal and
  // refresh so retries never reuse a stale rowVersion.
  const handleRecord = async () => {
    if (!recordTarget || recordSaving) return;
    setRecordSaving(true);
    try {
      const res = await recordResult(id, {
        assetId: recordTarget.assetId,
        scannedCode: recordTarget.scannedCode,
        explicitType: recordForm.notFound
          ? AuditResultTypeEnum.NotFound
          : undefined,
        foundAssetLocationId:
          (!recordForm.notFound && recordForm.foundAssetLocationId) || undefined,
        foundCustodianEmployeeId:
          (!recordForm.notFound && recordForm.foundCustodianEmployeeId) ||
          undefined,
        foundConditionTypeId:
          (!recordForm.notFound && recordForm.foundConditionTypeId) || undefined,
        foundSerialNumber:
          (!recordForm.notFound && recordForm.foundSerialNumber.trim()) ||
          undefined,
        tagDamaged: !recordForm.notFound && recordForm.tagDamaged,
        notes: recordForm.notes.trim() || undefined,
        rowVersion: recordTarget.rowVersion ?? undefined,
      });
      if (res?.success) {
        addToast.success(res.message || 'Result recorded');
      } else {
        // 409s (concurrent scan / reconciled decisions): show verbatim.
        addToast.error(res?.message || 'Failed to record the result');
      }
    } catch (error) {
      console.error('Error recording result:', error);
      addToast.error('An error occurred while recording the result');
    } finally {
      setRecordSaving(false);
      setRecordTarget(null);
      setScanState(null);
      setScanCode('');
      loadCampaign();
      loadResults();
    }
  };

  const openUnknown = () => {
    setUnknownForm({
      ...emptyUnknownForm,
      scannedCode: scanCode.trim(),
    });
    setUnknownError('');
    setUnknownOpen(true);
  };

  const handleRecordUnknown = async () => {
    const explicitType = Number(unknownForm.explicitType) as AuditResultTypeEnum;
    if (
      explicitType === AuditResultTypeEnum.NotInRegister &&
      !unknownForm.scannedCode.trim()
    ) {
      setUnknownError('NotInRegister needs the scanned code that failed to resolve');
      return;
    }
    if (
      explicitType === AuditResultTypeEnum.UnregisteredFound &&
      !unknownForm.description.trim()
    ) {
      setUnknownError('UnregisteredFound needs a description of the item');
      return;
    }
    setUnknownSaving(true);
    try {
      const res = await recordResult(id, {
        explicitType,
        scannedCode: unknownForm.scannedCode.trim() || undefined,
        description: unknownForm.description.trim() || undefined,
        notes: unknownForm.notes.trim() || undefined,
        tagDamaged: false,
      });
      if (res?.success) {
        addToast.success(res.message || 'Unknown item recorded');
      } else {
        addToast.error(res?.message || 'Failed to record the unknown item');
      }
    } catch (error) {
      console.error('Error recording unknown item:', error);
      addToast.error('An error occurred while recording the unknown item');
    } finally {
      setUnknownSaving(false);
      setUnknownOpen(false);
      setScanState(null);
      setScanCode('');
      loadCampaign();
      loadResults();
    }
  };

  // ---- Evidence ----

  const evidenceResult =
    results.find((result) => result.id === evidenceResultId) ?? null;
  const campaignClosed =
    campaign?.status === AuditCampaignStatusEnum.Approved ||
    campaign?.status === AuditCampaignStatusEnum.Cancelled;

  const openEvidence = (result: IAssetAuditResult) => {
    setEvidenceResultId(result.id);
    setEvidenceCaption('');
    setEvidenceFile(null);
  };

  const handleUploadEvidence = async () => {
    if (!evidenceResult || !evidenceFile || evidenceUploading) return;
    setEvidenceUploading(true);
    try {
      const res = await uploadEvidence(
        evidenceResult.id,
        evidenceFile,
        evidenceCaption.trim() || undefined
      );
      if (res?.success) {
        addToast.success(res.message || 'Evidence attached');
        setEvidenceCaption('');
        setEvidenceFile(null);
      } else {
        addToast.error(res?.message || 'Failed to upload the evidence');
      }
    } catch (error) {
      console.error('Error uploading evidence:', error);
      addToast.error('An error occurred while uploading the evidence');
    } finally {
      setEvidenceUploading(false);
      loadResults();
    }
  };

  const handleDownloadEvidence = async (evidence: IAssetAuditEvidence) => {
    setDownloadingId(evidence.id);
    try {
      const res = await downloadEvidence(evidence.id);
      await saveBlobResponse(res, evidence.fileName ?? 'evidence');
    } catch (error) {
      console.error('Error downloading evidence:', error);
      addToast.error('Failed to download the evidence');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDeleteEvidence = async (evidence: IAssetAuditEvidence) => {
    try {
      const res = await deleteEvidence(evidence.id);
      if (res?.success) {
        addToast.success(res.message || 'Evidence removed');
      } else {
        addToast.error(res?.message || 'Failed to remove the evidence');
      }
    } catch (error) {
      console.error('Error deleting evidence:', error);
      addToast.error('An error occurred while removing the evidence');
    } finally {
      loadResults();
    }
  };

  // ---- Reconcile ----

  const openReconcile = (discrepancy: IAssetAuditDiscrepancy) => {
    setReconciling(discrepancy);
    setReconcileForm(emptyReconcileForm);
    setReconcileError('');
  };

  const handleReconcile = async () => {
    if (!reconciling || reconcileSaving) return;
    if (!reconcileForm.action || !reconcileForm.notes.trim()) {
      setReconcileError('An action and notes are required');
      return;
    }
    if (reconcileForm.openRecovery) {
      if (!reconcileForm.recoveryDescription.trim()) {
        setReconcileError('A description is required to open a recovery case');
        return;
      }
      if (
        reconcileForm.recoveryCurrency &&
        !/^[A-Za-z]{3}$/.test(reconcileForm.recoveryCurrency.trim())
      ) {
        setReconcileError('Currency must be a 3-letter code (e.g. NPR)');
        return;
      }
      if (
        reconcileForm.recoveryAmount &&
        (Number.isNaN(Number(reconcileForm.recoveryAmount)) ||
          Number(reconcileForm.recoveryAmount) < 0)
      ) {
        setReconcileError('Estimated amount must be a positive number');
        return;
      }
    }
    setReconcileSaving(true);
    try {
      const res = await reconcileDiscrepancy(reconciling.id, {
        action: Number(reconcileForm.action) as ReconciliationActionEnum,
        notes: reconcileForm.notes.trim(),
        recoveryCase:
          reconcileForm.openRecovery &&
          Number(reconcileForm.action) === ReconciliationActionEnum.ConfirmMissing
            ? {
                employeeId: reconcileForm.recoveryEmployeeId || undefined,
                description: reconcileForm.recoveryDescription.trim(),
                estimatedAmount: reconcileForm.recoveryAmount
                  ? Number(reconcileForm.recoveryAmount)
                  : undefined,
                currencyId: reconcileForm.recoveryCurrency
                  ? reconcileForm.recoveryCurrency.trim().toUpperCase()
                  : undefined,
              }
            : undefined,
        rowVersion: reconciling.rowVersion ?? '',
      });
      if (res?.success) {
        addToast.success(res.message || 'Discrepancy reconciled');
        setReconciling(null);
        loadCampaign();
        loadDiscrepancies();
      } else {
        // 400 (matrix violation) / 409 (stale): show verbatim, close, refresh.
        addToast.error(res?.message || 'Failed to reconcile the discrepancy');
        setReconciling(null);
        loadCampaign();
        loadDiscrepancies();
      }
    } catch (error) {
      console.error('Error reconciling discrepancy:', error);
      addToast.error('An error occurred while reconciling the discrepancy');
      setReconciling(null);
      loadCampaign();
      loadDiscrepancies();
    } finally {
      setReconcileSaving(false);
    }
  };

  // ---- Tables ----

  const resultColumns: TTableColumn[] = [
    { key: 'item', label: 'Item', width: 190, name: 'item' },
    { key: 'resultType', label: 'Result', width: 130, name: 'resultType' },
    { key: 'location', label: 'Location (found / expected)', width: 170, name: 'location' },
    { key: 'discrepancies', label: 'Discrepancies', width: 105, name: 'discrepancies' },
    { key: 'verifiedOn', label: 'Verified', width: 95, name: 'verifiedOn' },
    { key: 'applied', label: 'Applied', width: 110, name: 'applied' },
    { key: 'evidence', label: 'Evidence', width: 80, name: 'evidence' },
    {
      key: 'actions',
      label: <i className="icon icon-actions text-[10px]" />,
      width: 45,
      canToggle: false,
      name: 'actions',
    },
  ];

  const resultRows = results.map((result) => ({
    id: result.id,
    item: result.assetId ? (
      <div>
        <span className="font-medium text-primarycolor">{result.assetCode}</span>
        <span className="ml-2">{result.assetName}</span>
        {result.isAdHoc && (
          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700">
            ad-hoc
          </span>
        )}
      </div>
    ) : (
      <div className="text-gray-600 italic">
        {result.scannedCode ? `Code '${result.scannedCode}'` : result.description}
      </div>
    ),
    resultType: resultTypeBadge(result.resultType),
    location: (
      <div>
        <div>{result.foundAssetLocationName ?? '—'}</div>
        {result.expectedAssetLocationName && (
          <div className="text-xs text-gray-400">
            expected {result.expectedAssetLocationName}
          </div>
        )}
      </div>
    ),
    discrepancies:
      result.discrepancyCount === 0 ? (
        '—'
      ) : (
        <span
          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
            result.openDiscrepancyCount > 0
              ? 'bg-red-50 text-red-700'
              : 'bg-green-100 text-green-800'
          }`}
        >
          {result.openDiscrepancyCount} open / {result.discrepancyCount}
        </span>
      ),
    verifiedOn: formatDate(result.verifiedOn),
    applied: result.appliedOn ? (
      formatDate(result.appliedOn)
    ) : result.applySkipReason ? (
      <span className="text-xs text-amber-700">{result.applySkipReason}</span>
    ) : (
      '—'
    ),
    evidence: result.evidences.length > 0 ? result.evidences.length : '—',
    actions: (
      <div className="flex gap-x-2 relative bg-white px-4 py-2 -m-2">
        <Dropdown
          buttonChildren={<RowKebab />}
        >
          {[
            {
              label: 'Evidence',
              icon: <i className="icon icon-documents text-sm" />,
              action: () => openEvidence(result),
            },
            ...(campaign?.status === AuditCampaignStatusEnum.InProgress &&
            result.assetId
              ? [
                  {
                    label: 'Re-scan',
                    icon: <i className="icon icon-redo text-sm" />,
                    action: () => openRescan(result),
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

  const discColumns: TTableColumn[] = [
    { key: 'asset', label: 'Asset', width: 180, name: 'asset' },
    { key: 'type', label: 'Type', width: 130, name: 'type' },
    { key: 'values', label: 'Expected / Found', width: 220, name: 'values' },
    { key: 'status', label: 'Status', width: 110, name: 'status' },
    { key: 'latestAction', label: 'Latest Action', width: 120, name: 'latestAction' },
    {
      key: 'actions',
      label: <i className="icon icon-actions text-[10px]" />,
      width: 45,
      canToggle: false,
      name: 'actions',
    },
  ];

  const canReconcile =
    campaign?.status === AuditCampaignStatusEnum.InProgress ||
    campaign?.status === AuditCampaignStatusEnum.UnderReview;

  /** A NotFound discrepancy on an asset that is Assigned NOW was re-issued after the scan. */
  const reissuedWarning = (discrepancy: IAssetAuditDiscrepancy) =>
    discrepancy.discrepancyType === AuditResultTypeEnum.NotFound &&
    discrepancy.currentCustodyStatus === CustodyStatusEnum.Assigned;

  const discRows = discrepancies.map((discrepancy) => ({
    id: discrepancy.id,
    asset: discrepancy.assetId ? (
      <div>
        <span className="font-medium text-primarycolor">
          {discrepancy.assetCode}
        </span>
        <span className="ml-2">{discrepancy.assetName}</span>
      </div>
    ) : (
      <span className="text-gray-600 italic">Unknown item</span>
    ),
    type: resultTypeBadge(discrepancy.discrepancyType),
    values: (
      <div className="text-xs">
        <div>
          <span className="text-gray-400">Expected:</span>{' '}
          {discrepancy.expectedValue ?? '—'}
        </div>
        <div>
          <span className="text-gray-400">Found:</span>{' '}
          {discrepancy.foundValue ?? '—'}
        </div>
      </div>
    ),
    status: (
      <div>
        {discrepancyStatusBadge(discrepancy.status)}
        {reissuedWarning(discrepancy) && (
          <div className="text-[10px] text-amber-700 mt-1">
            re-issued
            {discrepancy.currentCustodianEmployeeName
              ? ` to ${discrepancy.currentCustodianEmployeeName}`
              : ''}{' '}
            — check before confirming missing
          </div>
        )}
      </div>
    ),
    latestAction:
      discrepancy.latestAction != null
        ? RECONCILIATION_ACTION_LABELS[discrepancy.latestAction]
        : '—',
    actions: (
      <div className="flex gap-x-2 relative bg-white px-4 py-2 -m-2">
        <Dropdown
          buttonChildren={<RowKebab />}
        >
          {[
            ...(canReconcile
              ? [
                  {
                    label: 'Reconcile',
                    icon: <i className="icon icon-clipboard text-sm" />,
                    action: () => openReconcile(discrepancy),
                  },
                ]
              : [
                  {
                    label: 'View History',
                    icon: <i className="icon icon-eye text-sm" />,
                    action: () => openReconcile(discrepancy),
                  },
                ]),
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

  // ---- Render ----

  if (loadingCampaign) {
    return (
      <div className="px-4 mt-10 text-center text-gray-400 text-sm">
        Loading campaign…
      </div>
    );
  }

  if (!campaign) return null;

  const inProgress = campaign.status === AuditCampaignStatusEnum.InProgress;

  const scopesSummary = campaign.scopes
    .map((scope) =>
      scope.scopeType === AuditScopeTypeEnum.Company
        ? AUDIT_SCOPE_TYPE_LABELS[scope.scopeType]
        : `${AUDIT_SCOPE_TYPE_LABELS[scope.scopeType]}: ${
            scope.scopeRefName ?? scope.scopeRefId
          }`
    )
    .join(' · ');

  const allowedActions = reconciling
    ? (RECONCILE_ACTION_MATRIX[reconciling.discrepancyType] ?? [])
    : [];
  const selectedActionEffect = reconcileForm.action
    ? RECONCILE_ACTION_EFFECTS[Number(reconcileForm.action)]
    : '';
  const confirmMissingSelected =
    Number(reconcileForm.action) === ReconciliationActionEnum.ConfirmMissing;

  return (
    <div className="px-4 mt-2 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-y-2">
        <div>
          <button
            onClick={() => router.push('/physical-verification')}
            className="text-sm text-gray-500 hover:text-primarycolor"
          >
            <i className="icon icon-left text-xs mr-1" /> Physical
            Verification
          </button>
          <h1 className="text-lg font-semibold text-secondaryColor mt-1 flex items-center gap-3">
            {campaign.name}
            <span
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                AUDIT_CAMPAIGN_STATUS_BADGE_CLASSES[campaign.status] ??
                'bg-gray-100 text-gray-700'
              }`}
            >
              {AUDIT_CAMPAIGN_STATUS_LABELS[campaign.status] ?? campaign.status}
            </span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">Scopes: {scopesSummary}</p>
          {campaign.description && (
            <p className="text-xs text-gray-400 mt-0.5">{campaign.description}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {campaign.status === AuditCampaignStatusEnum.Draft && (
            <Button
              onClick={() =>
                runTransition(() =>
                  startCampaign(campaign.id, campaign.rowVersion ?? '')
                )
              }
            >
              Start Scanning
            </Button>
          )}
          {campaign.status === AuditCampaignStatusEnum.InProgress && (
            <Button
              onClick={() =>
                runTransition(() =>
                  submitCampaign(campaign.id, campaign.rowVersion ?? '')
                )
              }
            >
              Submit for Review
            </Button>
          )}
          {campaign.status === AuditCampaignStatusEnum.UnderReview && (
            <Button onClick={() => setApproveOpen(true)}>Approve</Button>
          )}
          {[
            AuditCampaignStatusEnum.Draft,
            AuditCampaignStatusEnum.InProgress,
            AuditCampaignStatusEnum.UnderReview,
          ].includes(campaign.status) && (
            <Button
              variant="danger"
              onClick={() => {
                setCancelReason('');
                setCancelOpen(true);
              }}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      {campaign.status === AuditCampaignStatusEnum.Cancelled && (
        <p className="text-xs text-gray-600 bg-gray-100 rounded px-3 py-2">
          Cancelled {formatDate(campaign.cancelledOn)}
          {campaign.cancelReason ? ` — ${campaign.cancelReason}` : ''}
        </p>
      )}

      {/* Progress stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Expected" value={campaign.expectedCount} />
        <StatCard label="Scanned" value={campaign.scannedCount} />
        <StatCard label="Ad-hoc" value={campaign.adHocCount} />
        <StatCard
          label="Open Discrepancies"
          value={campaign.openDiscrepancyCount}
          alert
        />
      </div>

      {/* Tab switcher: results vs discrepancies */}
      <div className="flex border-b gap-x-10">
        {(
          [
            { id: 'results', label: 'Results' },
            { id: 'discrepancies', label: 'Discrepancies' },
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

      {activeTab === 'results' ? (
        <>
          {/* Scan panel — recording is only open while InProgress */}
          {inProgress && (
            <div className="bg-white rounded-xl p-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Scan / Enter Code
              </h2>
              <div className="flex items-end gap-x-4 max-w-xl">
                <Input
                  label="Asset code, tag or identifier"
                  className="flex-1"
                  value={scanCode}
                  onChange={(e) => setScanCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleResolve();
                  }}
                  placeholder="AST-0001, QR/barcode value…"
                />
                <Button onClick={handleResolve} disabled={resolving || !scanCode.trim()}>
                  {resolving ? 'Resolving…' : 'Resolve'}
                </Button>
              </div>

              {scanState?.kind === 'resolved' && (
                <div className="mt-4 border rounded-lg p-4 flex flex-wrap items-center justify-between gap-y-2">
                  <div className="text-sm">
                    <span className="font-medium text-primarycolor">
                      {scanState.candidate.assetCode}
                    </span>
                    <span className="ml-2 text-secondaryColor">
                      {scanState.candidate.assetName}
                    </span>
                    <div className="text-xs text-gray-400 mt-1">
                      {scanState.candidate.assetLocationName ?? 'No location'} ·{' '}
                      {scanState.candidate.currentCustodianEmployeeName ??
                        'Unassigned'}{' '}
                      · {scanState.candidate.assetConditionTypeName ?? '—'}
                      {scanState.candidate.serialNumber
                        ? ` · SN ${scanState.candidate.serialNumber}`
                        : ''}
                    </div>
                    {scanState.existingResult && (
                      <div className="text-xs text-amber-700 mt-1">
                        Already in this campaign as{' '}
                        {AUDIT_RESULT_TYPE_LABELS[
                          scanState.existingResult.resultType
                        ] ?? scanState.existingResult.resultType}
                        {' — recording again updates that row.'}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setScanState(null);
                        setScanCode('');
                      }}
                    >
                      Clear
                    </Button>
                    <Button
                      onClick={() =>
                        openRecordFromScan(
                          scanState.candidate,
                          scanState.existingResult
                        )
                      }
                    >
                      Record Result
                    </Button>
                  </div>
                </div>
              )}

              {scanState?.kind === 'ambiguous' && (
                <div className="mt-4 border rounded-lg p-4">
                  <p className="text-sm text-amber-700 mb-2">
                    The code matches more than one asset — pick the intended one.
                  </p>
                  <div className="space-y-2">
                    {scanState.candidates.map((candidate) => (
                      <button
                        key={candidate.assetId}
                        type="button"
                        onClick={() => pickCandidate(candidate)}
                        className="block w-full text-left text-sm border rounded px-3 py-2 hover:border-primarycolor"
                      >
                        <span className="font-medium text-primarycolor">
                          {candidate.assetCode}
                        </span>
                        <span className="ml-2">{candidate.assetName}</span>
                        <span className="text-xs text-gray-400 ml-2">
                          {candidate.assetLocationName ?? 'No location'}
                          {candidate.serialNumber
                            ? ` · SN ${candidate.serialNumber}`
                            : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {scanState?.kind === 'nomatch' && (
                <div className="mt-4 border rounded-lg p-4 flex flex-wrap items-center justify-between gap-y-2">
                  <p className="text-sm text-gray-600">
                    {scanState.message} Capture it as an unknown item instead?
                  </p>
                  <Button variant="outline" onClick={openUnknown}>
                    Record Unknown Item
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Distinct key per tab: CustomTable seeds its column state from props
              once, so a reused instance would render the other tab's columns. */}
          <CustomTable
            key="verification-results-table"
            columns={resultColumns}
            rows={resultRows}
            tableName="Verification Results"
            serialOffset={
              ((resultFilters.pageNumber ?? 1) - 1) *
              (resultFilters.pageSize ?? DEFAULT_PAGE_SIZE)
            }
            isLoading={resultsLoading}
            entityLabel="result"
            tableHeaderLeft={
              inProgress ? (
                <Button variant="ghost" onClick={openUnknown}>
                  <i className="icon icon-plus text-xs"></i>
                  <span>Record Unknown Item</span>
                </Button>
              ) : undefined
            }
            tableHeaderRight={
              <>
                <FilterPanel
                  open={showResultFilters}
                  onOpenChange={setShowResultFilters}
                  activeCount={
                    [resultFilters.resultType, resultFilters.hasOpenDiscrepancies].filter(
                      (v) => v != null
                    ).length
                  }
                  onClearAll={() =>
                    setResultFilters((prev) => ({
                      ...prev,
                      resultType: undefined,
                      hasOpenDiscrepancies: undefined,
                      pageNumber: 1,
                    }))
                  }
                >
                  <Select
                    label="Result Type"
                    placeholder="All"
                    options={Object.entries(AUDIT_RESULT_TYPE_LABELS).map(
                      ([v, l]) => ({ value: v, label: l })
                    )}
                    value={
                      resultFilters.resultType != null
                        ? String(resultFilters.resultType)
                        : ''
                    }
                    onChange={(e) =>
                      setResultFilters((prev) => ({
                        ...prev,
                        resultType: e.target.value
                          ? (Number(e.target.value) as AuditResultTypeEnum)
                          : undefined,
                        pageNumber: 1,
                      }))
                    }
                  />
                  <Select
                    label="Open Discrepancies"
                    placeholder="All"
                    options={[
                      { value: 'true', label: 'With open' },
                      { value: 'false', label: 'Without open' },
                    ]}
                    value={
                      resultFilters.hasOpenDiscrepancies != null
                        ? String(resultFilters.hasOpenDiscrepancies)
                        : ''
                    }
                    onChange={(e) =>
                      setResultFilters((prev) => ({
                        ...prev,
                        hasOpenDiscrepancies: e.target.value
                          ? e.target.value === 'true'
                          : undefined,
                        pageNumber: 1,
                      }))
                    }
                  />
                </FilterPanel>
                <SearchBox onSearch={setResultSearch} searchVal={resultSearch} />
              </>
            }
            updateFilters={updateResultFilters}
          />

          <div className="mt-3">
            <Pagination
              pageNumber={resultFilters.pageNumber ?? 1}
              totalPages={resultPageCount}
              pageSize={resultFilters.pageSize ?? DEFAULT_PAGE_SIZE}
              totalCount={resultRowCount}
              updateFilters={updateResultFilters}
            />
          </div>
        </>
      ) : (
        <>
          <CustomTable
            key="verification-discrepancies-table"
            columns={discColumns}
            rows={discRows}
            tableName="Verification Discrepancies"
            serialOffset={
              ((discFilters.pageNumber ?? 1) - 1) *
              (discFilters.pageSize ?? DEFAULT_PAGE_SIZE)
            }
            isLoading={discLoading}
            entityLabel="discrepancy"
            tableHeaderRight={
              <>
                <FilterPanel
                  open={showDiscFilters}
                  onOpenChange={setShowDiscFilters}
                  activeCount={
                    [discFilters.status, discFilters.discrepancyType].filter(
                      (v) => v != null
                    ).length
                  }
                  onClearAll={() =>
                    setDiscFilters((prev) => ({
                      ...prev,
                      status: undefined,
                      discrepancyType: undefined,
                      pageNumber: 1,
                    }))
                  }
                >
                  <Select
                    label="Status"
                    placeholder="All"
                    options={Object.entries(AUDIT_DISCREPANCY_STATUS_LABELS).map(
                      ([v, l]) => ({ value: v, label: l })
                    )}
                    value={
                      discFilters.status != null ? String(discFilters.status) : ''
                    }
                    onChange={(e) =>
                      setDiscFilters((prev) => ({
                        ...prev,
                        status: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                        pageNumber: 1,
                      }))
                    }
                  />
                  <Select
                    label="Type"
                    placeholder="All"
                    options={Object.entries(AUDIT_RESULT_TYPE_LABELS)
                      .filter(
                        ([v]) =>
                          Number(v) !== AuditResultTypeEnum.Pending &&
                          Number(v) !== AuditResultTypeEnum.Verified
                      )
                      .map(([v, l]) => ({ value: v, label: l }))}
                    value={
                      discFilters.discrepancyType != null
                        ? String(discFilters.discrepancyType)
                        : ''
                    }
                    onChange={(e) =>
                      setDiscFilters((prev) => ({
                        ...prev,
                        discrepancyType: e.target.value
                          ? (Number(e.target.value) as AuditResultTypeEnum)
                          : undefined,
                        pageNumber: 1,
                      }))
                    }
                  />
                </FilterPanel>
                <SearchBox onSearch={setDiscSearch} searchVal={discSearch} />
              </>
            }
            updateFilters={updateDiscFilters}
          />

          <div className="mt-3">
            <Pagination
              pageNumber={discFilters.pageNumber ?? 1}
              totalPages={discPageCount}
              pageSize={discFilters.pageSize ?? DEFAULT_PAGE_SIZE}
              totalCount={discRowCount}
              updateFilters={updateDiscFilters}
            />
          </div>
        </>
      )}

      {/* Record result modal (registered path) */}
      <Modal
        isOpen={recordTarget !== null}
        onClose={() => setRecordTarget(null)}
        size="2xl"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            Record Inspection
          </h2>
          {recordTarget && (
            <p className="text-sm text-gray-500 mb-4">
              {recordTarget.assetCode} — {recordTarget.assetName}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <Select
              label="Found Location"
              placeholder="(not observed)"
              disabled={recordForm.notFound}
              options={locations.map((l) => ({
                value: l.id,
                label: l.code ? `${l.code} — ${l.name}` : l.name,
              }))}
              value={recordForm.foundAssetLocationId}
              onChange={(e) =>
                setRecordForm((prev) => ({
                  ...prev,
                  foundAssetLocationId: e.target.value,
                }))
              }
            />
            <Select
              label="Found Custodian"
              placeholder="(not observed)"
              disabled={recordForm.notFound}
              options={employees.map((e) => ({
                value: e.id,
                label: e.employeeCode
                  ? `${e.fullName} (${e.employeeCode})`
                  : e.fullName,
              }))}
              value={recordForm.foundCustodianEmployeeId}
              onChange={(e) =>
                setRecordForm((prev) => ({
                  ...prev,
                  foundCustodianEmployeeId: e.target.value,
                }))
              }
            />
            <Select
              label="Found Condition"
              placeholder="(not observed)"
              disabled={recordForm.notFound}
              options={ASSET_CONDITIONS.map((c) => ({
                value: c.id,
                label: c.name,
              }))}
              value={recordForm.foundConditionTypeId}
              onChange={(e) =>
                setRecordForm((prev) => ({
                  ...prev,
                  foundConditionTypeId: e.target.value,
                }))
              }
            />
            <Input
              label="Found Serial Number"
              disabled={recordForm.notFound}
              value={recordForm.foundSerialNumber}
              onChange={(e) =>
                setRecordForm((prev) => ({
                  ...prev,
                  foundSerialNumber: e.target.value,
                }))
              }
              maxLength={100}
              placeholder="As printed on the unit"
            />
            <div className="md:col-span-2 flex flex-col gap-3">
              {!recordForm.notFound && (
                <CustomCheckbox
                  title="Tag damaged / unreadable"
                  checked={recordForm.tagDamaged}
                  onChange={() =>
                    setRecordForm((prev) => ({
                      ...prev,
                      tagDamaged: !prev.tagDamaged,
                    }))
                  }
                />
              )}
              {/* Only expected/existing rows can be NotFound — hidden on true inserts */}
              {recordTarget?.rowVersion && (
                <CustomCheckbox
                  title="Mark as Not Found (looked, not there)"
                  checked={recordForm.notFound}
                  onChange={() =>
                    setRecordForm((prev) => ({
                      ...prev,
                      notFound: !prev.notFound,
                      // NotFound cannot carry found-details — clear them.
                      ...(prev.notFound
                        ? {}
                        : {
                            foundAssetLocationId: '',
                            foundCustodianEmployeeId: '',
                            foundConditionTypeId: '',
                            foundSerialNumber: '',
                            tagDamaged: false,
                          }),
                    }))
                  }
                />
              )}
            </div>
            <div className="md:col-span-2">
              <TextArea
                label="Notes"
                value={recordForm.notes}
                onChange={(e) =>
                  setRecordForm((prev) => ({ ...prev, notes: e.target.value }))
                }
                rows={2}
                maxLength={2000}
              />
            </div>
          </div>
          {recordError && (
            <p className="text-sm text-red-600 mt-3">{recordError}</p>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setRecordTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleRecord} disabled={recordSaving}>
              {recordSaving ? 'Recording…' : 'Record'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Record Unknown Item modal */}
      <Modal
        isOpen={unknownOpen}
        onClose={() => setUnknownOpen(false)}
        size="lg"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            Record Unknown Item
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            An item on the floor that the register does not explain — a labelled
            code that resolves to nothing, or a device with no tag at all.
          </p>
          <div className="grid grid-cols-1 gap-y-5">
            <Select
              label="Kind"
              required
              options={[
                {
                  value: String(AuditResultTypeEnum.NotInRegister),
                  label: 'Not In Register (labelled, but the code resolves to nothing)',
                },
                {
                  value: String(AuditResultTypeEnum.UnregisteredFound),
                  label: 'Unregistered Found (no code/tag at all)',
                },
              ]}
              value={unknownForm.explicitType}
              onChange={(e) => {
                setUnknownForm((prev) => ({
                  ...prev,
                  explicitType: e.target.value,
                }));
                setUnknownError('');
              }}
            />
            <Input
              label="Scanned Code"
              required={
                Number(unknownForm.explicitType) ===
                AuditResultTypeEnum.NotInRegister
              }
              value={unknownForm.scannedCode}
              onChange={(e) => {
                setUnknownForm((prev) => ({
                  ...prev,
                  scannedCode: e.target.value,
                }));
                setUnknownError('');
              }}
              maxLength={200}
              placeholder="The code that failed to resolve"
            />
            <TextArea
              label="Description"
              required={
                Number(unknownForm.explicitType) ===
                AuditResultTypeEnum.UnregisteredFound
              }
              value={unknownForm.description}
              onChange={(e) => {
                setUnknownForm((prev) => ({
                  ...prev,
                  description: e.target.value,
                }));
                setUnknownError('');
              }}
              rows={2}
              maxLength={1000}
              placeholder="What the item is, where it sits…"
            />
            <TextArea
              label="Notes"
              value={unknownForm.notes}
              onChange={(e) =>
                setUnknownForm((prev) => ({ ...prev, notes: e.target.value }))
              }
              rows={2}
              maxLength={2000}
            />
          </div>
          {unknownError && (
            <p className="text-sm text-red-600 mt-3">{unknownError}</p>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setUnknownOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRecordUnknown} disabled={unknownSaving}>
              {unknownSaving ? 'Recording…' : 'Record'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Evidence modal */}
      <Modal
        isOpen={evidenceResultId !== null}
        onClose={() => setEvidenceResultId(null)}
        size="lg"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            Evidence
          </h2>
          {evidenceResult && (
            <p className="text-sm text-gray-500 mb-4">
              {evidenceResult.assetCode
                ? `${evidenceResult.assetCode} — ${evidenceResult.assetName}`
                : (evidenceResult.scannedCode ?? evidenceResult.description)}
            </p>
          )}

          {evidenceResult && evidenceResult.evidences.length === 0 ? (
            <p className="text-sm text-gray-400 mb-4">
              No evidence attached to this result yet.
            </p>
          ) : (
            <div className="space-y-3 mb-4">
              {evidenceResult?.evidences.map((evidence) => (
                <div
                  key={evidence.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm border-b border-gray-50 pb-3 last:border-0 last:pb-0"
                >
                  <span className="font-medium text-secondaryColor">
                    {evidence.fileName ?? 'file'}
                  </span>
                  {evidence.caption && (
                    <span className="text-gray-500">{evidence.caption}</span>
                  )}
                  <span className="text-gray-400">
                    {formatDate(evidence.createdOn)}
                  </span>
                  <span className="ml-auto flex items-center gap-3">
                    <button
                      onClick={() => handleDownloadEvidence(evidence)}
                      disabled={downloadingId === evidence.id}
                      className="text-xs text-primarycolor hover:underline disabled:opacity-50"
                    >
                      {downloadingId === evidence.id
                        ? 'Downloading…'
                        : 'Download'}
                    </button>
                    {!campaignClosed && (
                      <button
                        onClick={() => setDeletingEvidence(evidence)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Upload — blocked once the campaign is Approved or Cancelled */}
          {!campaignClosed && (
            <div className="border-t pt-4 grid grid-cols-1 gap-y-5">
              <div className="flex flex-col">
                <label className="block text-sm font-medium text-gray-500">
                  File<span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="file"
                  onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
                  className="w-full py-2 text-sm text-gray-600 border-b border-gray-300"
                />
              </div>
              <Input
                label="Caption"
                value={evidenceCaption}
                onChange={(e) => setEvidenceCaption(e.target.value)}
                maxLength={200}
                placeholder="Optional label, e.g. Serial plate photo"
              />
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setEvidenceResultId(null)}>
              Close
            </Button>
            {!campaignClosed && (
              <Button
                onClick={handleUploadEvidence}
                disabled={evidenceUploading || !evidenceFile}
              >
                {evidenceUploading ? 'Uploading…' : 'Upload'}
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* Reconcile modal (view-only history when the campaign is closed) */}
      <Modal
        isOpen={reconciling !== null}
        onClose={() => setReconciling(null)}
        size="2xl"
      >
        {reconciling && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-secondaryColor mb-1">
              {canReconcile ? 'Reconcile Discrepancy' : 'Reconciliation History'}
            </h2>
            <p className="text-sm text-gray-500 mb-1">
              {reconciling.assetCode
                ? `${reconciling.assetCode} — ${reconciling.assetName}`
                : 'Unknown item'}
            </p>
            <div className="flex items-center gap-2 mb-4">
              {resultTypeBadge(reconciling.discrepancyType)}
              {discrepancyStatusBadge(reconciling.status)}
            </div>
            <div className="text-xs text-gray-600 mb-4">
              <span className="text-gray-400">Expected:</span>{' '}
              {reconciling.expectedValue ?? '—'}
              <span className="text-gray-400 ml-4">Found:</span>{' '}
              {reconciling.foundValue ?? '—'}
            </div>
            {reissuedWarning(reconciling) && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2 mb-4">
                This asset is Assigned
                {reconciling.currentCustodianEmployeeName
                  ? ` to ${reconciling.currentCustodianEmployeeName}`
                  : ''}{' '}
                right now — it was re-issued after the scan. Check before
                confirming missing.
              </p>
            )}

            {canReconcile && (
              <div className="grid grid-cols-1 gap-y-5">
                <div>
                  <Select
                    label="Action"
                    required
                    placeholder="Select action"
                    options={allowedActions.map((action) => ({
                      value: String(action),
                      label: RECONCILIATION_ACTION_LABELS[action],
                    }))}
                    value={reconcileForm.action}
                    onChange={(e) => {
                      setReconcileForm((prev) => ({
                        ...prev,
                        action: e.target.value,
                        openRecovery: false,
                      }));
                      setReconcileError('');
                    }}
                  />
                  {selectedActionEffect && (
                    <p className="text-gray-400 text-xs mt-1 italic">
                      {selectedActionEffect}
                    </p>
                  )}
                </div>
                <TextArea
                  label="Notes"
                  required
                  value={reconcileForm.notes}
                  onChange={(e) => {
                    setReconcileForm((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }));
                    setReconcileError('');
                  }}
                  rows={2}
                  maxLength={2000}
                  placeholder="What was checked and why this decision"
                />

                {/* Recovery case section — ConfirmMissing only */}
                {confirmMissingSelected && (
                  <div className="border-t pt-4">
                    <CustomCheckbox
                      title="Open recovery case (materialized at approval)"
                      checked={reconcileForm.openRecovery}
                      onChange={() => {
                        setReconcileForm((prev) => ({
                          ...prev,
                          openRecovery: !prev.openRecovery,
                        }));
                        setReconcileError('');
                      }}
                    />
                    {reconcileForm.openRecovery && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 mt-4">
                        <div className="md:col-span-2">
                          <Select
                            label="Accountable Employee"
                            placeholder="(default: open assignment's custodian)"
                            options={employees.map((e) => ({
                              value: e.id,
                              label: e.employeeCode
                                ? `${e.fullName} (${e.employeeCode})`
                                : e.fullName,
                            }))}
                            value={reconcileForm.recoveryEmployeeId}
                            onChange={(e) =>
                              setReconcileForm((prev) => ({
                                ...prev,
                                recoveryEmployeeId: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="md:col-span-2">
                          <TextArea
                            label="Description"
                            required
                            value={reconcileForm.recoveryDescription}
                            onChange={(e) => {
                              setReconcileForm((prev) => ({
                                ...prev,
                                recoveryDescription: e.target.value,
                              }));
                              setReconcileError('');
                            }}
                            rows={2}
                            maxLength={1000}
                            placeholder="What is being recovered from the custodian and why"
                          />
                        </div>
                        <Input
                          label="Estimated Amount"
                          type="number"
                          value={reconcileForm.recoveryAmount}
                          onChange={(e) =>
                            setReconcileForm((prev) => ({
                              ...prev,
                              recoveryAmount: e.target.value,
                            }))
                          }
                          placeholder="0.00"
                        />
                        <Input
                          label="Currency"
                          value={reconcileForm.recoveryCurrency}
                          onChange={(e) =>
                            setReconcileForm((prev) => ({
                              ...prev,
                              recoveryCurrency: e.target.value.toUpperCase(),
                            }))
                          }
                          maxLength={3}
                          placeholder="NPR"
                          helperText="3-letter currency code"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Reconciliation history (latest decision stands) */}
            {reconciling.reconciliations.length > 0 && (
              <div className="mt-6 border-t pt-4">
                <div className="text-xs font-medium text-gray-400 mb-2">
                  History
                </div>
                <div className="space-y-2">
                  {reconciling.reconciliations.map((entry, index) => (
                    <div key={index} className="text-sm text-gray-700">
                      <span className="font-medium text-secondaryColor">
                        {RECONCILIATION_ACTION_LABELS[entry.action] ??
                          entry.action}
                      </span>
                      <span className="text-gray-400 ml-2">
                        {formatDate(entry.reconciledOn)}
                      </span>
                      <div className="text-xs text-gray-500">{entry.notes}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {reconcileError && (
              <p className="text-sm text-red-600 mt-3">{reconcileError}</p>
            )}
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="secondary" onClick={() => setReconciling(null)}>
                {canReconcile ? 'Cancel' : 'Close'}
              </Button>
              {canReconcile && (
                <Button
                  onClick={handleReconcile}
                  disabled={
                    reconcileSaving ||
                    !reconcileForm.action ||
                    !reconcileForm.notes.trim()
                  }
                >
                  {reconcileSaving ? 'Reconciling…' : 'Reconcile'}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Cancel modal */}
      <Modal isOpen={cancelOpen} onClose={() => setCancelOpen(false)} size="md">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            Cancel Campaign
          </h2>
          <p className="text-sm text-gray-500 mb-2">{campaign.name}</p>
          <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2 mb-4">
            Cancelling touches no assets — recorded results stay frozen as-was
            for the audit trail.
          </p>
          <TextArea
            label="Reason"
            required
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Why is this campaign being cancelled?"
          />
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              Back
            </Button>
            <Button
              onClick={handleCancel}
              disabled={!cancelReason.trim() || cancelSaving}
            >
              {cancelSaving ? 'Cancelling…' : 'Cancel Campaign'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Approve confirm — the only step that applies effects to assets */}
      <ConfirmationModal
        isOpen={approveOpen}
        message={`Approve "${campaign.name}"? This applies every reconciled effect to the assets (Verified stamps, accepted corrections, Missing custody) and cannot be undone.`}
        onConfirm={() =>
          runTransition(() =>
            approveCampaign(campaign.id, campaign.rowVersion ?? '')
          )
        }
        onClose={() => setApproveOpen(false)}
      />
    </div>
  );
};

export default CampaignDetailPage;
