'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/Providers/ToastProvider';
import Button from '@/components/UI/Button';
import CustomTable from '@/components/CustomTable/CustomTable';
import {
  ITableFilters,
  TTableColumn,
} from '@/components/CustomTable/CustomTableInterface';
import CustomMenuItem from '@/components/UI/CustomMenuItem';
import Dropdown from '@/components/UI/Dropdown';
import Modal from '@/components/UI/Modal';
import Select from '@/components/UI/Select';
import TextArea from '@/components/UI/TextArea';
import FilterPanel from '@/components/UI/FilterPanel';
import SearchBox from '@/components/SearchBox';
import Pagination from '@/components/UI/Pagination';
import {
  IAssetRecoveryCase,
  IAssetRecoveryCaseFilter,
} from '@/interface/IAssetReturn';
import {
  closeAssetRecoveryCase,
  fetchAssetRecoveryCases,
} from '@/services/assetRecoveryCase.service';
import { unwrapPaged } from '@/utils/serviceUtils';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';
import {
  RECOVERY_CASE_STATUS_BADGE_CLASSES,
  RECOVERY_CASE_STATUS_LABELS,
  RecoveryCaseStatusEnum,
} from '@/enum/returnEnums';
import useDebounce from '@/hooks/useDebounce';

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString() : '—';

const formatAmount = (amount?: number | null, currencyId?: string | null) =>
  amount != null
    ? `${amount.toLocaleString()}${currencyId ? ` ${currencyId}` : ''}`
    : '—';

const RecoveryCasesTab = () => {
  const { addToast } = useToast();

  const [cases, setCases] = useState<IAssetRecoveryCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  const [filters, setFilters] = useState<IAssetRecoveryCaseFilter>({
    pageNumber: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 400);
  const [showFilters, setShowFilters] = useState(false);

  // Resolve modal
  const [resolving, setResolving] = useState<IAssetRecoveryCase | null>(null);
  const [resolution, setResolution] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolveSaving, setResolveSaving] = useState(false);

  // View modal
  const [viewing, setViewing] = useState<IAssetRecoveryCase | null>(null);

  const columns: TTableColumn[] = [
    { key: 'assetCode', label: 'Asset', width: 110, type: 'string', name: 'assetCode' },
    { key: 'assetName', label: 'Name', width: 150, type: 'string', name: 'assetName' },
    { key: 'employeeName', label: 'Employee', width: 160, type: 'string', name: 'employeeName' },
    { key: 'description', label: 'Description', width: 220, type: 'string', name: 'description' },
    { key: 'amount', label: 'Est. Amount', width: 110, name: 'amount' },
    { key: 'status', label: 'Status', width: 90, name: 'status' },
    { key: 'createdOn', label: 'Opened', width: 100, name: 'createdOn' },
    {
      key: 'actions',
      label: <i className="icon icon-actions text-[10px]" />,
      width: 45,
      canToggle: false,
      name: 'actions',
    },
  ];

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAssetRecoveryCases(filters);
      if (res?.success) {
        const paged = unwrapPaged(res);
        setCases(paged.items);
        setRowCount(paged.rowCount);
        setPageCount(paged.pageCount);
      } else {
        addToast.error(res?.message || 'Failed to fetch recovery cases');
      }
    } catch (error) {
      console.error('Error fetching recovery cases:', error);
      addToast.error('An error occurred while fetching recovery cases');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

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

  const openResolve = (recoveryCase: IAssetRecoveryCase) => {
    setResolving(recoveryCase);
    setResolution('');
    setResolutionNotes('');
  };

  const handleResolve = async () => {
    if (!resolving || !resolution || resolveSaving) return;
    setResolveSaving(true);
    try {
      const res = await closeAssetRecoveryCase(resolving.id, {
        resolution: Number(resolution) as RecoveryCaseStatusEnum,
        resolutionNotes: resolutionNotes.trim() || undefined,
        rowVersion: resolving.rowVersion ?? '',
      });
      if (res?.success) {
        addToast.success(res.message || 'Recovery case closed');
      } else {
        // Stale row (closed elsewhere): surface the server message and refresh
        // so a retry never reuses the same stale rowVersion.
        addToast.error(res?.message || 'Failed to close the recovery case');
      }
    } catch (error) {
      console.error('Error closing recovery case:', error);
      addToast.error('An error occurred while closing the recovery case');
    } finally {
      setResolveSaving(false);
      setResolving(null);
      loadCases();
    }
  };

  const statusBadge = (status: RecoveryCaseStatusEnum) => (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
        RECOVERY_CASE_STATUS_BADGE_CLASSES[status] ?? 'bg-gray-100 text-gray-700'
      }`}
    >
      {RECOVERY_CASE_STATUS_LABELS[status] ?? status}
    </span>
  );

  const rowData = cases.map((recoveryCase) => ({
    id: recoveryCase.id,
    assetCode: (
      <span className="font-medium text-primarycolor">
        {recoveryCase.assetCode}
      </span>
    ),
    assetName: recoveryCase.assetName,
    employeeName: (
      <span>
        {recoveryCase.employeeName}
        {recoveryCase.employeeCode && (
          <span className="text-xs text-gray-400 ml-1">
            ({recoveryCase.employeeCode})
          </span>
        )}
      </span>
    ),
    description: (
      <span className="block truncate" title={recoveryCase.description}>
        {recoveryCase.description}
      </span>
    ),
    amount: formatAmount(recoveryCase.estimatedAmount, recoveryCase.currencyId),
    status: statusBadge(recoveryCase.status),
    createdOn: formatDate(recoveryCase.createdOn),
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
              action: () => setViewing(recoveryCase),
            },
            ...(recoveryCase.status === RecoveryCaseStatusEnum.Open
              ? [
                  {
                    label: 'Resolve',
                    icon: <i className="icon icon-check text-sm" />,
                    action: () => openResolve(recoveryCase),
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

  return (
    <>
      <CustomTable
        columns={columns}
        rows={rowData}
        tableName="RecoveryCases"
        serialOffset={
          ((filters.pageNumber ?? 1) - 1) *
          (filters.pageSize ?? DEFAULT_PAGE_SIZE)
        }
        isLoading={loading}
        entityLabel="recovery case"
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
                options={Object.entries(RECOVERY_CASE_STATUS_LABELS).map(
                  ([v, l]) => ({ value: v, label: l })
                )}
                value={filters.status != null ? String(filters.status) : ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    status: e.target.value
                      ? (Number(e.target.value) as RecoveryCaseStatusEnum)
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

      {/* Resolve modal */}
      <Modal
        isOpen={resolving !== null}
        onClose={() => setResolving(null)}
        size="md"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            Resolve Recovery Case
          </h2>
          {resolving && (
            <p className="text-sm text-gray-500 mb-4">
              {resolving.assetCode} — {resolving.assetName} ·{' '}
              {resolving.employeeName} ·{' '}
              {formatAmount(resolving.estimatedAmount, resolving.currencyId)}
            </p>
          )}
          <div className="grid grid-cols-1 gap-y-5">
            <Select
              label="Resolution"
              required
              placeholder="Select resolution"
              options={[
                {
                  value: String(RecoveryCaseStatusEnum.Settled),
                  label: 'Settled — the amount was recovered',
                },
                {
                  value: String(RecoveryCaseStatusEnum.Waived),
                  label: 'Waived — the amount is written off',
                },
              ]}
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
            />
            <TextArea
              label="Resolution Notes"
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              rows={2}
              placeholder="Payment reference, waiver approval…"
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setResolving(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleResolve}
              disabled={resolveSaving || !resolution}
            >
              {resolveSaving ? 'Closing…' : 'Close Case'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* View modal */}
      <Modal isOpen={viewing !== null} onClose={() => setViewing(null)} size="lg">
        {viewing && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-secondaryColor mb-1">
              Recovery Case
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {viewing.assetCode} — {viewing.assetName}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <div className="text-xs font-medium text-gray-400">Employee</div>
                <div className="text-sm text-gray-700 mt-0.5">
                  {viewing.employeeName}
                  {viewing.employeeCode ? ` (${viewing.employeeCode})` : ''}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-400">Status</div>
                <div className="mt-0.5">{statusBadge(viewing.status)}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-400">
                  Estimated Amount
                </div>
                <div className="text-sm text-gray-700 mt-0.5">
                  {formatAmount(viewing.estimatedAmount, viewing.currencyId)}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-400">Opened</div>
                <div className="text-sm text-gray-700 mt-0.5">
                  {formatDate(viewing.createdOn)}
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="text-xs font-medium text-gray-400">
                  Description
                </div>
                <div className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">
                  {viewing.description}
                </div>
              </div>
              {viewing.notes && (
                <div className="md:col-span-2">
                  <div className="text-xs font-medium text-gray-400">Notes</div>
                  <div className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">
                    {viewing.notes}
                  </div>
                </div>
              )}
              {viewing.resolvedOn && (
                <div>
                  <div className="text-xs font-medium text-gray-400">
                    Resolved
                  </div>
                  <div className="text-sm text-gray-700 mt-0.5">
                    {formatDate(viewing.resolvedOn)}
                  </div>
                </div>
              )}
              {viewing.resolutionNotes && (
                <div className="md:col-span-2">
                  <div className="text-xs font-medium text-gray-400">
                    Resolution Notes
                  </div>
                  <div className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">
                    {viewing.resolutionNotes}
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
    </>
  );
};

export default RecoveryCasesTab;
