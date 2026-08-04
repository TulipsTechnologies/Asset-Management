'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/Providers/ToastProvider';
import Button from '@/components/UI/Button';
import CustomTable from '@/components/CustomTable/CustomTable';
import {
  ITableFilters,
  TTableColumn,
} from '@/components/CustomTable/CustomTableInterface';
import CustomMenuItem from '@/components/UI/CustomMenuItem';
import ConfirmationModal from '@/components/UI/ConfirmationModel';
import Dropdown from '@/components/UI/Dropdown';
import Select from '@/components/UI/Select';
import FilterPanel from '@/components/UI/FilterPanel';
import SearchBox from '@/components/SearchBox';
import Pagination from '@/components/UI/Pagination';
import { IAssetFilter, IAssetListItem } from '@/interface/IAsset';
import { IAssetCategory } from '@/interface/IAssetCategory';
import { deleteAsset, fetchAssets } from '@/services/asset.service';
import { fetchAssetCategories } from '@/services/assetCategory.service';
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

const StatusBadge = ({
  value,
  labels,
  classes,
}: {
  value: number;
  labels: Record<number, string>;
  classes?: Record<number, string>;
}) => (
  <span
    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
      classes?.[value] ?? 'bg-gray-100 text-gray-700'
    }`}
  >
    {labels[value] ?? value}
  </span>
);

/** Nepal standard VAT. Display-only — the register stores net prices. */
const VAT_RATE = 0.13;

const money = (value?: number | null, currency?: string | null) =>
  value != null
    ? `${value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}${currency ? ` ${currency}` : ''}`
    : '—';

const AssetsPage = () => {
  const { addToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialLifecycle = searchParams.get('lifecycleStatus');

  const [assets, setAssets] = useState<IAssetListItem[]>([]);
  const [deleting, setDeleting] = useState<IAssetListItem | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [categories, setCategories] = useState<IAssetCategory[]>([]);
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

  const columns: TTableColumn[] = [
    { key: 'assetCode', label: 'Code', width: 140, type: 'string', name: 'assetCode' },
    { key: 'assetName', label: 'Asset Name', width: 190, type: 'string', name: 'assetName' },
    { key: 'netPrice', label: 'Net Price', width: 120, name: 'netPrice' },
    { key: 'units', label: 'Units', width: 60, name: 'units' },
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
    setLoading(true);
    try {
      const res = await fetchAssets(filters);
      if (res?.success) {
        const paged = unwrapPaged(res);
        setAssets(paged.items);
        setRowCount(paged.rowCount);
        setPageCount(paged.pageCount);
      } else {
        addToast.error(res?.message || 'Failed to fetch assets');
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
      addToast.error('An error occurred while fetching assets');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    // Categories for the filter dropdown (first 500 covers real-world category counts).
    fetchAssetCategories({ pageNumber: 1, pageSize: 500 })
      .then((res) => {
        if (res?.success) setCategories(unwrapPaged(res).items);
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

  const activeFilterCount = [
    filters.assetCategoryId,
    filters.lifecycleStatus,
    filters.custodyStatus,
    filters.operationalStatus,
  ].filter((value) => value != null).length;

  const rowData = assets.map((asset) => ({
    id: asset.id,
    assetCode: (
      <span className="font-medium text-primarycolor">{asset.assetCode}</span>
    ),
    assetName: asset.assetName,
    netPrice: money(asset.purchaseCost, asset.currencyId),
    // Item-level register: every row IS one unit. Registering with Quantity > 1
    // creates that many rows, each independently assignable.
    units: 1,
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
              label: 'View',
              icon: <i className="icon icon-eye text-sm" />,
              action: () => router.push(`/assets/${asset.id}`),
            },
            {
              label: 'Edit',
              icon: <i className="icon icon-edit text-sm" />,
              action: () => router.push(`/assets/${asset.id}/edit`),
            },
            // A Draft was never in service — deletion is its honest exit. Anything
            // past Draft leaves through retirement and disposal, never deletion.
            ...(asset.lifecycleStatus === LifecycleStatusEnum.Draft
              ? [
                  {
                    label: 'Delete',
                    icon: <i className="icon icon-trash text-sm" />,
                    action: () => setDeleting(asset),
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

  return (
    <div className="px-4 mt-2">
      <CustomTable
        columns={columns}
        rows={rowData}
        tableName="Assets"
        serialOffset={
          ((filters.pageNumber ?? 1) - 1) *
          (filters.pageSize ?? DEFAULT_PAGE_SIZE)
        }
        isLoading={loading}
        entityLabel="asset"
        tableHeaderLeft={
          <Button onClick={() => router.push('/assets/create')}>
            <i className="icon icon-plus text-xs"></i>
            <span>Register Asset</span>
          </Button>
        }
        tableHeaderRight={
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
                value={
                  filters.lifecycleStatus != null
                    ? String(filters.lifecycleStatus)
                    : ''
                }
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
                value={
                  filters.custodyStatus != null
                    ? String(filters.custodyStatus)
                    : ''
                }
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
                value={
                  filters.operationalStatus != null
                    ? String(filters.operationalStatus)
                    : ''
                }
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
