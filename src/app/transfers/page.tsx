'use client';

import { useCallback, useEffect, useState } from 'react';
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
import Modal from '@/components/UI/Modal';
import Input from '@/components/UI/Input';
import Select from '@/components/UI/Select';
import TextArea from '@/components/UI/TextArea';
import FilterPanel from '@/components/UI/FilterPanel';
import SearchBox from '@/components/SearchBox';
import Pagination from '@/components/UI/Pagination';
import { IAssetTransfer, IAssetTransferFilter } from '@/interface/IAssetTransfer';
import { IAssetListItem } from '@/interface/IAsset';
import { IEmployee } from '@/interface/IEmployee';
import { IAssetLocation } from '@/interface/IAssetLocation';
import {
  approveAssetTransfer,
  cancelAssetTransfer,
  dispatchAssetTransfer,
  fetchAssetTransfers,
  receiveAssetTransfer,
  requestAssetTransfer,
} from '@/services/assetTransfer.service';
import { fetchAssets } from '@/services/asset.service';
import { fetchEmployees } from '@/services/employee.service';
import { fetchAssetLocations } from '@/services/assetLocation.service';
import { mergeTableFilters, unwrapPaged } from '@/utils/serviceUtils';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';
import {
  CUSTODY_LABELS,
  CustodyStatusEnum,
  LifecycleStatusEnum,
} from '@/enum/assetEnums';
import {
  TRANSFER_STATUS_BADGE_CLASSES,
  TRANSFER_STATUS_LABELS,
  TransferStatusEnum,
} from '@/enum/transferEnums';
import useDebounce from '@/hooks/useDebounce';
import useAssetConditions from '@/hooks/useAssetConditions';
import usePrintSheet, { usePrintIdentity } from '@/hooks/usePrintSheet';
import GatePassSheet from '@/components/Print/GatePassSheet';
import { fetchAssetById } from '@/services/asset.service';
import { shortDate } from '@/components/Assets/AssetViewShared';

// Delegates to the module's one date formatter. This was one of 18 identical local copies
// rendering the locale default ("8/20/2026"), which reads as a different day outside the US
// and disagreed with the dashboard and the printed sheets.
const formatDate = (value?: string | null) => shortDate(value);

type TConditionAction = 'dispatch' | 'receive';

const TransfersPage = () => {
  const { options: conditionOptions, emptyText: conditionEmptyText } = useAssetConditions();
  const { addToast } = useToast();
  const router = useRouter();

  // The gate pass. Armed only while a transfer is chosen, so nothing is mounted and no body
  // class is set during ordinary use of the page.
  const [gatePassFor, setGatePassFor] = useState<IAssetTransfer | null>(null);
  const [gatePassAsset, setGatePassAsset] = useState<{
    serialNumber?: string | null;
    assetTag?: string | null;
  } | null>(null);
  const printIdentity = usePrintIdentity();
  const { print: printGatePass, PrintSheet } = usePrintSheet(!!gatePassFor);

  /**
   * The transfer record carries no serial or tag, and a gate pass that identifies the goods
   * only by an internal code is weak at a barrier — the code is a sticker, the serial is
   * stamped into the metal. One call fills it in; a failure still prints, marked as not
   * recorded rather than left blank.
   */
  const openGatePass = async (transfer: IAssetTransfer) => {
    // Resolve FIRST, then arm. Arming before the fetch settles would print a pass that says
    // "no serial recorded" for an asset that has one — the sheet mounts on the next render
    // and the print fires against whatever is on it at that moment.
    let identity: { serialNumber?: string | null; assetTag?: string | null } | null = null;
    try {
      const response = await fetchAssetById(transfer.assetId);
      if (response?.data)
        identity = {
          serialNumber: response.data.serialNumber,
          assetTag: response.data.assetTag,
        };
    } catch {
      /* The pass is still valid without it; the sheet says so rather than leaving a blank. */
    }
    setGatePassAsset(identity);
    setGatePassFor(transfer);
  };

  // Print on the render AFTER the sheet mounts; inline would race the document snapshot.
  // No auto-print: the sheet opens as a PREVIEW and the operator presses Print once they can
  // see the document. Printing on the same tick the portal mounted is what produced blanks.

  const [transfers, setTransfers] = useState<IAssetTransfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  const [filters, setFilters] = useState<IAssetTransferFilter>({
    pageNumber: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 400);
  const [showFilters, setShowFilters] = useState(false);

  const [employees, setEmployees] = useState<IEmployee[]>([]);
  const [locations, setLocations] = useState<IAssetLocation[]>([]);

  // Request modal
  const [requestOpen, setRequestOpen] = useState(false);
  const [transferableAssets, setTransferableAssets] = useState<IAssetListItem[]>([]);
  const [form, setForm] = useState({
    assetId: '',
    toEmployeeId: '',
    toAssetLocationId: '',
    reason: '',
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Condition modal (dispatch/receive)
  const [conditionAction, setConditionAction] = useState<{
    action: TConditionAction;
    transfer: IAssetTransfer;
  } | null>(null);
  const [conditionId, setConditionId] = useState('');
  const [actionSaving, setActionSaving] = useState(false);

  // Cancel modal
  const [cancelling, setCancelling] = useState<IAssetTransfer | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSaving, setCancelSaving] = useState(false);

  // sortField names an AssetTransfer ENTITY property, so the server orders the whole
  // ledger and returns page 1. Asset code and name, the destination and both condition
  // names are joined in from other tables — the transfer row holds only their ids — so
  // the database cannot order by them and they carry no sort control.
  const columns: TTableColumn[] = [
    { key: 'assetCode', label: 'Asset', width: 120, type: 'string', name: 'assetCode' },
    { key: 'assetName', label: 'Name', width: 170, type: 'string', name: 'assetName' },
    { key: 'destination', label: 'Destination', width: 200, name: 'destination' },
    // "Requested" is the row's own CreatedOn — the request IS the row's creation.
    { key: 'requestedOn', label: 'Requested', width: 105, name: 'requestedOn', sortField: 'CreatedOn' },
    { key: 'status', label: 'Status', width: 105, name: 'status', sortField: 'Status' },
    { key: 'conditions', label: 'Condition (out → in)', width: 140, name: 'conditions' },
    {
      key: 'actions',
      label: <i className="icon icon-actions text-[10px]" />,
      width: 45,
      canToggle: false,
      name: 'actions',
    },
  ];

  const loadTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAssetTransfers(filters);
      if (res?.success) {
        const paged = unwrapPaged(res);
        setTransfers(paged.items);
        setRowCount(paged.rowCount);
        setPageCount(paged.pageCount);
      } else {
        addToast.error(res?.message || 'Failed to fetch transfers');
      }
    } catch (error) {
      console.error('Error fetching transfers:', error);
      addToast.error('An error occurred while fetching transfers');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    loadTransfers();
  }, [loadTransfers]);

  useEffect(() => {
    fetchEmployees({ pageNumber: 1, pageSize: 500, isActive: true })
      .then((res) => {
        if (res?.success) setEmployees(unwrapPaged(res).items);
      })
      .catch(() => undefined);
    fetchAssetLocations({ pageNumber: 1, pageSize: 500, isActive: true })
      .then((res) => {
        if (res?.success) setLocations(unwrapPaged(res).items);
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

  const openRequest = async () => {
    setForm({ assetId: '', toEmployeeId: '', toAssetLocationId: '', reason: '' });
    setFormError('');
    setRequestOpen(true);
    try {
      const res = await fetchAssets({
        pageNumber: 1,
        pageSize: 500,
        lifecycleStatus: LifecycleStatusEnum.Active,
      });
      if (res?.success) setTransferableAssets(unwrapPaged(res).items);
    } catch {
      addToast.error('Failed to load assets');
    }
  };

  const handleRequest = async () => {
    if (!form.assetId || (!form.toEmployeeId && !form.toAssetLocationId)) {
      setFormError('Pick an asset and at least one destination (employee or location)');
      return;
    }
    // Custodian transfers require an Assigned asset — catch it before the API does.
    const selected = transferableAssets.find((a) => a.id === form.assetId);
    if (
      form.toEmployeeId &&
      selected &&
      selected.custodyStatus !== CustodyStatusEnum.Assigned
    ) {
      setFormError(
        'Custodian transfers need an Assigned asset — use Assignments to issue unassigned assets'
      );
      return;
    }
    setSaving(true);
    try {
      const res = await requestAssetTransfer({
        assetId: form.assetId,
        toEmployeeId: form.toEmployeeId || undefined,
        toAssetLocationId: form.toAssetLocationId || undefined,
        reason: form.reason.trim() || undefined,
      });
      if (res?.success) {
        addToast.success(res.message || 'Transfer requested');
        setRequestOpen(false);
        loadTransfers();
      } else {
        addToast.error(res?.message || 'Failed to request the transfer');
      }
    } catch (error) {
      console.error('Error requesting transfer:', error);
      addToast.error('An error occurred while requesting the transfer');
    } finally {
      setSaving(false);
    }
  };

  const runTransition = async (fn: () => Promise<{ success?: boolean; message?: string | null }>) => {
    try {
      const res = await fn();
      if (res?.success) {
        addToast.success(res.message || 'Done');
      } else {
        addToast.error(res?.message || 'The operation failed');
      }
    } catch (error) {
      console.error('Transfer transition failed:', error);
      addToast.error('An error occurred');
    } finally {
      // Always refresh: transitions mutate rowversions, stale rows must not linger.
      loadTransfers();
    }
  };

  const handleApprove = (transfer: IAssetTransfer) =>
    runTransition(() => approveAssetTransfer(transfer.id, transfer.rowVersion ?? ''));

  const handleConditionAction = async () => {
    if (!conditionAction || !conditionId) return;
    setActionSaving(true);
    const { action, transfer } = conditionAction;
    await runTransition(() =>
      action === 'dispatch'
        ? dispatchAssetTransfer(transfer.id, conditionId, transfer.rowVersion ?? '')
        : receiveAssetTransfer(transfer.id, conditionId, transfer.rowVersion ?? '')
    );
    setActionSaving(false);
    setConditionAction(null);
    setConditionId('');
  };

  const handleCancel = async () => {
    if (!cancelling || !cancelReason.trim() || cancelSaving) return;
    setCancelSaving(true);
    await runTransition(() =>
      cancelAssetTransfer(cancelling.id, cancelReason.trim(), cancelling.rowVersion ?? '')
    );
    setCancelSaving(false);
    setCancelling(null);
    setCancelReason('');
  };

  const destinationOf = (transfer: IAssetTransfer) => {
    const parts: string[] = [];
    if (transfer.toEmployeeName) parts.push(`→ ${transfer.toEmployeeName}`);
    if (transfer.toAssetLocationName) parts.push(`📍 ${transfer.toAssetLocationName}`);
    return parts.length > 0 ? parts.join('  ') : '—';
  };

  const rowData = transfers.map((transfer) => ({
    id: transfer.id,
    assetCode: (
      <button
        type="button"
        className="font-medium text-primarycolor hover:underline"
        onClick={() => router.push(`/assets/${transfer.assetId}`)}
      >
        {transfer.assetCode}
      </button>
    ),
    assetName: transfer.assetName,
    destination: (
      <div>
        <div>{destinationOf(transfer)}</div>
        {transfer.fromEmployeeName && transfer.toEmployeeName && (
          <div className="text-xs text-gray-400">from {transfer.fromEmployeeName}</div>
        )}
      </div>
    ),
    requestedOn: formatDate(transfer.requestedOn),
    status: (
      <span
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          TRANSFER_STATUS_BADGE_CLASSES[transfer.status] ?? 'bg-gray-100 text-gray-700'
        }`}
      >
        {TRANSFER_STATUS_LABELS[transfer.status] ?? transfer.status}
      </span>
    ),
    conditions:
      transfer.conditionAtDispatchName || transfer.conditionAtReceiptName
        ? `${transfer.conditionAtDispatchName ?? '—'} → ${transfer.conditionAtReceiptName ?? '—'}`
        : '—',
    actions: (
      <div className="flex gap-x-2 relative bg-white px-4 py-2 -m-2">
        <Dropdown
          buttonChildren={<RowKebab />}
        >
          {[
            ...(transfer.status === TransferStatusEnum.Requested
              ? [{
                  label: 'Approve',
                  icon: <i className="icon icon-check text-sm" />,
                  action: () => handleApprove(transfer),
                }]
              : []),
            ...(transfer.status === TransferStatusEnum.Approved
              ? [{
                  label: 'Dispatch',
                  icon: <i className="icon icon-move text-sm" />,
                  action: () => {
                    setConditionAction({ action: 'dispatch', transfer });
                    setConditionId('');
                  },
                }]
              : []),
            ...(transfer.status === TransferStatusEnum.Dispatched
              ? [{
                  label: 'Receive',
                  icon: <i className="icon icon-download text-sm" />,
                  action: () => {
                    setConditionAction({ action: 'receive', transfer });
                    setConditionId('');
                  },
                }]
              : []),
            // Approved or Dispatched ONLY. A pass for a merely Requested transfer would
            // authorise an unapproved asset out of the gate, and someone would use it that
            // way; Received is history and needs no pass.
            ...([TransferStatusEnum.Approved, TransferStatusEnum.Dispatched].includes(
              transfer.status
            )
              ? [{
                  label: 'Print Gate Pass',
                  icon: <i className="icon icon-print text-sm" />,
                  action: () => openGatePass(transfer),
                }]
              : []),
            ...([TransferStatusEnum.Requested, TransferStatusEnum.Approved,
                 TransferStatusEnum.Dispatched].includes(transfer.status)
              ? [{
                  label: 'Cancel',
                  icon: <i className="icon icon-close text-sm" />,
                  action: () => {
                    setCancelling(transfer);
                    setCancelReason('');
                  },
                }]
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

  return (
    <div className="px-4 mt-2">
      <CustomTable
        columns={columns}
        rows={rowData}
        tableName="Transfers"
        serialOffset={
          ((filters.pageNumber ?? 1) - 1) *
          (filters.pageSize ?? DEFAULT_PAGE_SIZE)
        }
        isLoading={loading}
        entityLabel="transfer"
        tableHeaderLeft={
          <Button onClick={openRequest}>
            <i className="icon icon-plus text-xs"></i>
            <span>Request Transfer</span>
          </Button>
        }
        tableHeaderRight={
          <>
            <FilterPanel
              open={showFilters}
              onOpenChange={setShowFilters}
              activeCount={[filters.status].filter((v) => v != null).length}
              onClearAll={() =>
                setFilters((prev) => ({
                  ...prev,
                  status: undefined,
                  pageNumber: 1,
                }))
              }
            >
              <Select
                label="Status"
                placeholder="All"
                options={Object.entries(TRANSFER_STATUS_LABELS).map(([v, l]) => ({
                  value: v,
                  label: l,
                }))}
                value={filters.status != null ? String(filters.status) : ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    status: e.target.value
                      ? (Number(e.target.value) as TransferStatusEnum)
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

      {/* Request modal */}
      <Modal isOpen={requestOpen} onClose={() => setRequestOpen(false)} size="lg">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            Request Transfer
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Custodian transfers need an Assigned asset; location moves work for any
            Active asset. Fields update only when the receiving side confirms.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <Select
              label="Asset"
              required
              placeholder="Select an Active asset"
              options={transferableAssets.map((a) => ({
                value: a.id,
                label: `${a.assetCode} — ${a.assetName} (${
                  CUSTODY_LABELS[a.custodyStatus] ?? 'Unknown'
                })`,
              }))}
              value={form.assetId}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, assetId: e.target.value }));
                setFormError('');
              }}
            />
            <Select
              label="To Employee"
              placeholder="(keep current custodian)"
              options={employees.map((e) => ({
                value: e.id,
                label: e.employeeCode
                  ? `${e.fullName} (${e.employeeCode})`
                  : e.fullName,
              }))}
              value={form.toEmployeeId}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, toEmployeeId: e.target.value }));
                setFormError('');
              }}
            />
            <Select
              label="To Location"
              placeholder="(keep current location)"
              options={locations.map((l) => ({
                value: l.id,
                label: l.code ? `${l.code} — ${l.name}` : l.name,
              }))}
              value={form.toAssetLocationId}
              onChange={(e) => {
                setForm((prev) => ({
                  ...prev,
                  toAssetLocationId: e.target.value,
                }));
                setFormError('');
              }}
            />
            <Input
              label="Reason"
              value={form.reason}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, reason: e.target.value }))
              }
              placeholder="Team change, office move…"
            />
          </div>
          {formError && <p className="text-sm text-red-600 mt-3">{formError}</p>}
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setRequestOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRequest} disabled={saving}>
              {saving ? 'Requesting…' : 'Request'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Dispatch / Receive condition modal */}
      <Modal
        isOpen={conditionAction !== null}
        onClose={() => setConditionAction(null)}
        size="md"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            {conditionAction?.action === 'dispatch' ? 'Dispatch Asset' : 'Receive Asset'}
          </h2>
          {conditionAction && (
            <p className="text-sm text-gray-500 mb-4">
              {conditionAction.transfer.assetCode} —{' '}
              {conditionAction.transfer.assetName}
            </p>
          )}
          <Select
            label={
              conditionAction?.action === 'dispatch'
                ? 'Condition at Dispatch'
                : 'Condition at Receipt'
            }
            required
            placeholder="Select condition"
            options={conditionOptions}
            emptyText={conditionEmptyText}
            value={conditionId}
            onChange={(e) => setConditionId(e.target.value)}
          />
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setConditionAction(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleConditionAction}
              disabled={actionSaving || !conditionId}
            >
              {actionSaving
                ? 'Working…'
                : conditionAction?.action === 'dispatch'
                  ? 'Dispatch'
                  : 'Confirm Receipt'}
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
            Cancel Transfer
          </h2>
          {cancelling && (
            <p className="text-sm text-gray-500 mb-4">
              {cancelling.assetCode} — {cancelling.assetName}
              {cancelling.status === TransferStatusEnum.Dispatched &&
                ' (custody will be restored to the origin employee)'}
            </p>
          )}
          <TextArea
            label="Reason"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={2}
            placeholder="Why is this transfer being cancelled?"
          />
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setCancelling(null)}>
              Back
            </Button>
            <Button
              onClick={handleCancel}
              disabled={!cancelReason.trim() || cancelSaving}
            >
              {cancelSaving ? 'Cancelling…' : 'Cancel Transfer'}
            </Button>
          </div>
        </div>
      </Modal>

      {gatePassFor && (
        <PrintSheet
          title={`Gate pass — ${gatePassFor.assetCode}`}
          onClose={() => setGatePassFor(null)}
        >
          <GatePassSheet
            companyName={printIdentity.companyName}
            generatedBy={printIdentity.userName}
            generatedOn={new Date()}
            transferId={gatePassFor.id}
            assetCode={gatePassFor.assetCode}
            assetName={gatePassFor.assetName}
            serialNumber={gatePassAsset?.serialNumber}
            assetTag={gatePassAsset?.assetTag}
            conditionAtDispatchName={gatePassFor.conditionAtDispatchName}
            fromEmployeeName={gatePassFor.fromEmployeeName}
            fromAssetLocationName={gatePassFor.fromAssetLocationName}
            toEmployeeName={gatePassFor.toEmployeeName}
            toAssetLocationName={gatePassFor.toAssetLocationName}
            reason={gatePassFor.reason}
            notes={gatePassFor.notes}
            approvedOn={gatePassFor.approvedOn}
            dispatchedOn={gatePassFor.dispatchedOn}
          />
        </PrintSheet>
      )}
    </div>
  );
};

export default TransfersPage;
