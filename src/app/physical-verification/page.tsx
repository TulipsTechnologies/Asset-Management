'use client';

import { useCallback, useEffect, useState } from 'react';
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
import Modal from '@/components/UI/Modal';
import Input from '@/components/UI/Input';
import Select from '@/components/UI/Select';
import TextArea from '@/components/UI/TextArea';
import SearchBox from '@/components/SearchBox';
import Pagination from '@/components/UI/Pagination';
import {
  IAssetAuditCampaign,
  IAssetAuditCampaignFilter,
} from '@/interface/IAssetAudit';
import { IAssetCategory } from '@/interface/IAssetCategory';
import { IAssetLocation } from '@/interface/IAssetLocation';
import { IEmployee } from '@/interface/IEmployee';
import {
  approveCampaign,
  cancelCampaign,
  createCampaign,
  getCampaigns,
  startCampaign,
  submitCampaign,
  updateCampaign,
} from '@/services/assetAudit.service';
import { fetchAssetCategories } from '@/services/assetCategory.service';
import { fetchAssetLocations } from '@/services/assetLocation.service';
import { fetchEmployees } from '@/services/employee.service';
import { unwrapPaged } from '@/utils/serviceUtils';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';
import {
  AUDIT_CAMPAIGN_STATUS_BADGE_CLASSES,
  AUDIT_CAMPAIGN_STATUS_LABELS,
  AUDIT_SCOPE_TYPE_LABELS,
  AUDIT_SCOPE_TYPE_OPTIONS,
  AuditCampaignStatusEnum,
  AuditScopeTypeEnum,
} from '@/enum/auditEnums';
import useDebounce from '@/hooks/useDebounce';

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString() : '—';

type TScopeRow = { scopeType: string; scopeRefId: string };

type TCampaignForm = {
  name: string;
  description: string;
  scheduledFrom: string;
  scheduledTo: string;
  scopes: TScopeRow[];
};

const emptyCampaignForm: TCampaignForm = {
  name: '',
  description: '',
  scheduledFrom: '',
  scheduledTo: '',
  scopes: [{ scopeType: '', scopeRefId: '' }],
};

const STATUS_PILLS: { label: string; value?: AuditCampaignStatusEnum }[] = [
  { label: 'All' },
  { label: 'Draft', value: AuditCampaignStatusEnum.Draft },
  { label: 'In Progress', value: AuditCampaignStatusEnum.InProgress },
  { label: 'Under Review', value: AuditCampaignStatusEnum.UnderReview },
  { label: 'Approved', value: AuditCampaignStatusEnum.Approved },
  { label: 'Cancelled', value: AuditCampaignStatusEnum.Cancelled },
];

const statusBadge = (status: AuditCampaignStatusEnum) => (
  <span
    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
      AUDIT_CAMPAIGN_STATUS_BADGE_CLASSES[status] ?? 'bg-gray-100 text-gray-700'
    }`}
  >
    {AUDIT_CAMPAIGN_STATUS_LABELS[status] ?? status}
  </span>
);

/** Scope types needing a reference pick (everything offered except Company). */
const scopeNeedsRef = (scopeType: string) =>
  scopeType !== '' && Number(scopeType) !== AuditScopeTypeEnum.Company;

const PhysicalVerificationPage = () => {
  const router = useRouter();
  const { addToast } = useToast();

  const [campaigns, setCampaigns] = useState<IAssetAuditCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  const [filters, setFilters] = useState<IAssetAuditCampaignFilter>({
    pageNumber: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 400);

  // Scope-ref pickers (loaded once on modal open; 500-row cap is a known limit)
  const [locations, setLocations] = useState<IAssetLocation[]>([]);
  const [categories, setCategories] = useState<IAssetCategory[]>([]);
  const [employees, setEmployees] = useState<IEmployee[]>([]);
  const [pickersLoaded, setPickersLoaded] = useState(false);

  // Create / Edit modal (editing !== null means Draft edit)
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<IAssetAuditCampaign | null>(null);
  const [form, setForm] = useState<TCampaignForm>(emptyCampaignForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Cancel modal
  const [cancelling, setCancelling] = useState<IAssetAuditCampaign | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSaving, setCancelSaving] = useState(false);

  // Approve confirm
  const [approving, setApproving] = useState<IAssetAuditCampaign | null>(null);

  const columns: TTableColumn[] = [
    { key: 'name', label: 'Campaign', width: 200, type: 'string', name: 'name' },
    { key: 'status', label: 'Status', width: 115, name: 'status' },
    { key: 'progress', label: 'Progress', width: 120, name: 'progress' },
    { key: 'discrepancies', label: 'Discrepancies', width: 110, name: 'discrepancies' },
    { key: 'scheduled', label: 'Scheduled', width: 160, name: 'scheduled' },
    { key: 'createdOn', label: 'Created', width: 100, name: 'createdOn' },
    {
      key: 'actions',
      label: <i className="icon icon-actions text-[10px]" />,
      width: 45,
      canToggle: false,
      name: 'actions',
    },
  ];

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCampaigns(filters);
      if (res?.success) {
        const paged = unwrapPaged(res);
        setCampaigns(paged.items);
        setRowCount(paged.rowCount);
        setPageCount(paged.pageCount);
      } else {
        addToast.error(res?.message || 'Failed to fetch campaigns');
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      addToast.error('An error occurred while fetching campaigns');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

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

  const loadPickers = () => {
    if (pickersLoaded) return;
    setPickersLoaded(true);
    fetchAssetLocations({ pageNumber: 1, pageSize: 500, isActive: true })
      .then((res) => {
        if (res?.success) setLocations(unwrapPaged(res).items);
      })
      .catch(() => undefined);
    fetchAssetCategories({ pageNumber: 1, pageSize: 500, isActive: true })
      .then((res) => {
        if (res?.success) setCategories(unwrapPaged(res).items);
      })
      .catch(() => undefined);
    fetchEmployees({ pageNumber: 1, pageSize: 500, isActive: true })
      .then((res) => {
        if (res?.success) setEmployees(unwrapPaged(res).items);
      })
      .catch(() => undefined);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyCampaignForm);
    setFormError('');
    setFormOpen(true);
    loadPickers();
  };

  const openEdit = (campaign: IAssetAuditCampaign) => {
    setEditing(campaign);
    setForm({
      name: campaign.name,
      description: campaign.description ?? '',
      scheduledFrom: campaign.scheduledFrom?.slice(0, 10) ?? '',
      scheduledTo: campaign.scheduledTo?.slice(0, 10) ?? '',
      scopes:
        campaign.scopes.length > 0
          ? campaign.scopes.map((s) => ({
              scopeType: String(s.scopeType),
              scopeRefId: s.scopeRefId ?? '',
            }))
          : [{ scopeType: '', scopeRefId: '' }],
    });
    setFormError('');
    setFormOpen(true);
    loadPickers();
  };

  const updateScopeRow = (index: number, updates: Partial<TScopeRow>) => {
    setForm((prev) => ({
      ...prev,
      scopes: prev.scopes.map((row, i) =>
        i === index ? { ...row, ...updates } : row
      ),
    }));
    setFormError('');
  };

  const scopeRefOptions = (scopeType: string) => {
    switch (Number(scopeType)) {
      case AuditScopeTypeEnum.Location:
        return locations.map((l) => ({
          value: l.id,
          label: l.code ? `${l.code} — ${l.name}` : l.name,
        }));
      case AuditScopeTypeEnum.Category:
        return categories.map((c) => ({
          value: c.id,
          label: `${c.categoryCode} — ${c.name}`,
        }));
      case AuditScopeTypeEnum.Employee:
        return employees.map((e) => ({
          value: e.id,
          label: e.employeeCode
            ? `${e.fullName} (${e.employeeCode})`
            : e.fullName,
        }));
      default:
        return [];
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError('A campaign name is required');
      return;
    }
    if (form.scopes.length === 0 || form.scopes.some((s) => !s.scopeType)) {
      setFormError('Every scope row needs a scope type');
      return;
    }
    if (form.scopes.some((s) => scopeNeedsRef(s.scopeType) && !s.scopeRefId)) {
      setFormError('Location, Category and Employee scopes need a reference');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        scheduledFrom: form.scheduledFrom || undefined,
        scheduledTo: form.scheduledTo || undefined,
        scopes: form.scopes.map((s) => ({
          scopeType: Number(s.scopeType) as AuditScopeTypeEnum,
          scopeRefId: scopeNeedsRef(s.scopeType) ? s.scopeRefId : undefined,
        })),
      };
      const res = editing
        ? await updateCampaign(editing.id, {
            ...payload,
            rowVersion: editing.rowVersion ?? '',
          })
        : await createCampaign(payload);
      if (res?.success) {
        addToast.success(
          res.message || (editing ? 'Campaign updated' : 'Campaign created')
        );
        setFormOpen(false);
        loadCampaigns();
      } else if (editing) {
        // Stale-rowVersion rule: failed edits close and refresh, never retry.
        addToast.error(res?.message || 'Failed to update the campaign');
        setFormOpen(false);
        loadCampaigns();
      } else {
        addToast.error(res?.message || 'Failed to create the campaign');
      }
    } catch (error) {
      console.error('Error saving campaign:', error);
      addToast.error('An error occurred while saving the campaign');
      setFormOpen(false);
      loadCampaigns();
    } finally {
      setSaving(false);
    }
  };

  const runTransition = async (
    fn: () => Promise<{ success?: boolean; message?: string | null }>
  ) => {
    try {
      const res = await fn();
      if (res?.success) {
        addToast.success(res.message || 'Done');
      } else {
        // 400s (open discrepancies) / 409s (staleness details): show verbatim.
        addToast.error(res?.message || 'The operation failed');
      }
    } catch (error) {
      console.error('Campaign transition failed:', error);
      addToast.error('An error occurred');
    } finally {
      // Always refresh: transitions mutate rowversions, stale rows must not linger.
      loadCampaigns();
    }
  };

  const handleStart = (campaign: IAssetAuditCampaign) =>
    runTransition(() => startCampaign(campaign.id, campaign.rowVersion ?? ''));

  const handleSubmit = (campaign: IAssetAuditCampaign) =>
    runTransition(() => submitCampaign(campaign.id, campaign.rowVersion ?? ''));

  const handleCancel = async () => {
    if (!cancelling || !cancelReason.trim() || cancelSaving) return;
    setCancelSaving(true);
    await runTransition(() =>
      cancelCampaign(cancelling.id, cancelReason.trim(), cancelling.rowVersion ?? '')
    );
    setCancelSaving(false);
    setCancelling(null);
    setCancelReason('');
  };

  const progressOf = (campaign: IAssetAuditCampaign) =>
    campaign.status === AuditCampaignStatusEnum.Draft ? (
      '—'
    ) : (
      <span>
        {campaign.scannedCount}/{campaign.expectedCount}
        {campaign.adHocCount > 0 && (
          <span className="text-xs text-gray-400 ml-1">
            +{campaign.adHocCount} ad-hoc
          </span>
        )}
      </span>
    );

  const discrepanciesOf = (campaign: IAssetAuditCampaign) =>
    campaign.totalDiscrepancyCount === 0 ? (
      '—'
    ) : (
      <span
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
          campaign.openDiscrepancyCount > 0
            ? 'bg-red-50 text-red-700'
            : 'bg-green-100 text-green-800'
        }`}
      >
        {campaign.openDiscrepancyCount} open / {campaign.totalDiscrepancyCount}
      </span>
    );

  const rowData = campaigns.map((campaign) => ({
    id: campaign.id,
    name: (
      <span className="font-medium text-primarycolor">{campaign.name}</span>
    ),
    status: statusBadge(campaign.status),
    progress: progressOf(campaign),
    discrepancies: discrepanciesOf(campaign),
    scheduled:
      campaign.scheduledFrom || campaign.scheduledTo
        ? `${formatDate(campaign.scheduledFrom)} → ${formatDate(campaign.scheduledTo)}`
        : '—',
    createdOn: formatDate(campaign.createdOn),
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
            ...(campaign.status !== AuditCampaignStatusEnum.Draft
              ? [
                  {
                    label: 'Open',
                    icon: <i className="icon icon-eye text-sm" />,
                    action: () =>
                      router.push(`/physical-verification/${campaign.id}`),
                  },
                ]
              : []),
            ...(campaign.status === AuditCampaignStatusEnum.Draft
              ? [
                  {
                    label: 'Edit',
                    icon: <i className="icon icon-edit text-sm" />,
                    action: () => openEdit(campaign),
                  },
                  {
                    label: 'Start',
                    icon: <i className="icon icon-check text-sm" />,
                    action: () => handleStart(campaign),
                  },
                ]
              : []),
            ...(campaign.status === AuditCampaignStatusEnum.InProgress
              ? [
                  {
                    label: 'Submit for review',
                    icon: <i className="icon icon-checklist text-sm" />,
                    action: () => handleSubmit(campaign),
                  },
                ]
              : []),
            ...(campaign.status === AuditCampaignStatusEnum.UnderReview
              ? [
                  {
                    label: 'Approve',
                    icon: <i className="icon icon-check text-sm" />,
                    action: () => setApproving(campaign),
                  },
                ]
              : []),
            ...([
              AuditCampaignStatusEnum.Draft,
              AuditCampaignStatusEnum.InProgress,
              AuditCampaignStatusEnum.UnderReview,
            ].includes(campaign.status)
              ? [
                  {
                    label: 'Cancel',
                    icon: <i className="icon icon-close text-sm" />,
                    action: () => {
                      setCancelling(campaign);
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
        tableName="Verification Campaigns"
        serialOffset={
          ((filters.pageNumber ?? 1) - 1) *
          (filters.pageSize ?? DEFAULT_PAGE_SIZE)
        }
        isLoading={loading}
        entityLabel="campaign"
        tableHeaderLeft={
          <Button onClick={openCreate}>
            <i className="icon icon-plus text-xs"></i>
            <span>Create Campaign</span>
          </Button>
        }
        tableHeaderRight={
          <SearchBox onSearch={setSearchQuery} searchVal={searchQuery} />
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

      {/* Create / Edit Campaign modal */}
      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} size="2xl">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            {editing ? 'Edit Campaign' : 'Create Campaign'}
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Scopes union; Location and Category scopes include descendants when
            the campaign starts. Starting locks the scopes.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <Input
              label="Name"
              required
              value={form.name}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, name: e.target.value }));
                setFormError('');
              }}
              maxLength={200}
              placeholder="Q3 head-office audit…"
            />
            <div className="grid grid-cols-2 gap-x-4">
              <Input
                label="Scheduled From"
                type="date"
                value={form.scheduledFrom}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    scheduledFrom: e.target.value,
                  }))
                }
              />
              <Input
                label="Scheduled To"
                type="date"
                value={form.scheduledTo}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, scheduledTo: e.target.value }))
                }
              />
            </div>
            <div className="md:col-span-2">
              <TextArea
                label="Description"
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
                rows={2}
                maxLength={2000}
              />
            </div>
          </div>

          {/* Scope rows */}
          <div className="mt-6 border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">
                Scopes<span className="text-red-500 ml-1">*</span>
              </span>
              <Button
                variant="ghost"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    scopes: [...prev.scopes, { scopeType: '', scopeRefId: '' }],
                  }))
                }
              >
                <i className="icon icon-plus text-xs" />
                <span>Add Scope</span>
              </Button>
            </div>
            <div className="space-y-4">
              {form.scopes.map((row, index) => (
                <div key={index} className="flex items-end gap-x-4">
                  <Select
                    label="Scope Type"
                    className="w-44"
                    placeholder="Select type"
                    options={AUDIT_SCOPE_TYPE_OPTIONS.map((t) => ({
                      value: String(t),
                      label: AUDIT_SCOPE_TYPE_LABELS[t],
                    }))}
                    value={row.scopeType}
                    onChange={(e) =>
                      updateScopeRow(index, {
                        scopeType: e.target.value,
                        scopeRefId: '',
                      })
                    }
                  />
                  {scopeNeedsRef(row.scopeType) ? (
                    <Select
                      label="Reference"
                      className="flex-1"
                      placeholder={`Select ${AUDIT_SCOPE_TYPE_LABELS[
                        Number(row.scopeType)
                      ]?.toLowerCase()}`}
                      options={scopeRefOptions(row.scopeType)}
                      value={row.scopeRefId}
                      onChange={(e) =>
                        updateScopeRow(index, { scopeRefId: e.target.value })
                      }
                    />
                  ) : (
                    <p className="flex-1 text-xs text-gray-400 italic pb-2">
                      {Number(row.scopeType) === AuditScopeTypeEnum.Company
                        ? 'Covers every Active/Retired asset — no reference needed.'
                        : 'Pick a scope type first.'}
                    </p>
                  )}
                  {form.scopes.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          scopes: prev.scopes.filter((_, i) => i !== index),
                        }))
                      }
                      className="text-gray-400 hover:text-red-600 pb-2"
                      aria-label="Remove scope"
                    >
                      <i className="icon icon-close text-sm" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {formError && <p className="text-sm text-red-600 mt-3">{formError}</p>}
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving
                ? 'Saving…'
                : editing
                  ? 'Save Changes'
                  : 'Create Campaign'}
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
            Cancel Campaign
          </h2>
          {cancelling && (
            <p className="text-sm text-gray-500 mb-2">{cancelling.name}</p>
          )}
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
            <Button variant="secondary" onClick={() => setCancelling(null)}>
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
        isOpen={approving !== null}
        message={`Approve "${approving?.name ?? ''}"? This applies every reconciled effect to the assets (Verified stamps, accepted corrections, Missing custody) and cannot be undone.`}
        onConfirm={() => {
          if (approving)
            runTransition(() =>
              approveCampaign(approving.id, approving.rowVersion ?? '')
            );
        }}
        onClose={() => setApproving(null)}
      />
    </div>
  );
};

export default PhysicalVerificationPage;
