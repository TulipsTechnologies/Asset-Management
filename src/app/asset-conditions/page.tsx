'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/Providers/ToastProvider';
import Button from '@/components/UI/Button';
import CustomTable from '@/components/CustomTable/CustomTable';
import { TTableColumn } from '@/components/CustomTable/CustomTableInterface';
import CustomMenuItem from '@/components/UI/CustomMenuItem';
import ConfirmationModal from '@/components/UI/ConfirmationModel';
import Dropdown from '@/components/UI/Dropdown';
import Input from '@/components/UI/Input';
import Modal from '@/components/UI/Modal';
import Pagination from '@/components/UI/Pagination';
import RowKebab from '@/components/UI/RowKebab';
import SearchBox from '@/components/SearchBox';
import TextArea from '@/components/UI/TextArea';
import ToggleSwitch from '@/components/UI/ToggleSwitch';
import {
  IAssetConditionType,
  IAssetConditionTypeFilter,
} from '@/interface/IAssetConditionType';
import {
  createAssetConditionType,
  deleteAssetConditionType,
  fetchAssetConditionTypes,
  updateAssetConditionType,
} from '@/services/assetConditionType.service';
import { refreshAssetConditions } from '@/hooks/useAssetConditions';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { Permission } from '@/enum/permissions';
import { unwrapPaged } from '@/utils/serviceUtils';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';
import useDebounce from '@/hooks/useDebounce';

/**
 * Settings → Asset Conditions.
 *
 * The condition an asset is graded at, everywhere one is recorded: registration, issue,
 * return, transfer, work-order completion and physical verification. Six conditions ship
 * with the module and are shared by every company — this screen adds the ones a particular
 * operation needs ("Refurbished", "Awaiting Parts") on top of them.
 *
 * Built-in rows carry a Built-in pill and offer NO edit or delete control — absent, not
 * disabled. A greyed-out button invites a click and then explains itself; the sentence above
 * the table says the rule once, for everyone, before anyone hunts for the missing action.
 *
 * No bulk-delete affordance here on purpose: the list is a handful of rows, six of which can
 * never be deleted, so a selection column would be mostly decorative.
 */

type TFormErrors = Partial<Record<'name' | 'displayOrder', string>>;

const emptyForm = {
  name: '',
  description: '',
  displayOrder: '',
  isActive: true,
};

const AssetConditionsPage = () => {
  const { addToast } = useToast();
  const { can } = useUserPermissions();
  const canManage = can(Permission.ManageAssetSettings);

  const [conditions, setConditions] = useState<IAssetConditionType[]>([]);
  const [loading, setLoading] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  const [filters, setFilters] = useState<IAssetConditionTypeFilter>({
    pageNumber: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 400);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<TFormErrors>({});
  const [formError, setFormError] = useState('');
  const [editing, setEditing] = useState<IAssetConditionType | null>(null);
  const [deleting, setDeleting] = useState<IAssetConditionType | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchAssetConditionTypes({
        ...filters,
        search: debouncedSearch.trim() || undefined,
      });
      const paged = unwrapPaged<IAssetConditionType>(response);
      setConditions(paged.items);
      setRowCount(paged.rowCount);
      setPageCount(paged.pageCount);
    } catch {
      addToast.error('Could not load asset conditions.');
    } finally {
      setLoading(false);
    }
  }, [filters, debouncedSearch, addToast]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormErrors({});
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (condition: IAssetConditionType) => {
    setEditing(condition);
    setForm({
      name: condition.name,
      description: condition.description ?? '',
      displayOrder: String(condition.displayOrder),
      isActive: condition.isActive,
    });
    setFormErrors({});
    setFormError('');
    setFormOpen(true);
  };

  const validate = (): boolean => {
    const errors: TFormErrors = {};
    if (!form.name.trim()) errors.name = 'Name is required';
    else if (form.name.trim().length > 100)
      errors.name = 'Name must be 100 characters or fewer';
    if (form.displayOrder && Number.isNaN(Number(form.displayOrder)))
      errors.displayOrder = 'Display order must be a number';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        displayOrder: Number(form.displayOrder) || 0,
        isActive: form.isActive,
      };

      if (editing) {
        const response = await updateAssetConditionType(editing.id, {
          ...payload,
          rowVersion: editing.rowVersion ?? '',
        });
        if (response?.success) {
          addToast.success(response.message || 'Condition updated');
          setFormOpen(false);
          refreshAssetConditions();
          load();
        } else {
          // An edit carried a RowVersion, so the payload must never be retried as-is:
          // close, surface the reason, and reload to pick up a fresh token.
          addToast.error(response?.message || 'Could not update the condition');
          setFormOpen(false);
          load();
        }
      } else {
        const response = await createAssetConditionType(payload);
        if (response?.success) {
          addToast.success(response.message || 'Condition created');
          setFormOpen(false);
          refreshAssetConditions();
          load();
        } else {
          // No token was sent, so this is safely retryable — keep the modal open with
          // the typed name still in it.
          setFormError(response?.message || 'Could not create the condition');
        }
      }
    } catch {
      setFormError('An error occurred while saving the condition');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      const response = await deleteAssetConditionType(deleting.id);
      if (response?.success) {
        addToast.success(response.message || 'Condition deleted');
        refreshAssetConditions();
      } else {
        addToast.error(response?.message || 'Could not delete the condition');
      }
    } catch {
      addToast.error('Could not delete the condition');
    } finally {
      setSaving(false);
      setDeleting(null);
      load();
    }
  };

  const updateFilters = (updates: Record<string, unknown>) =>
    setFilters((prev) => ({
      ...prev,
      ...updates,
      pageNumber:
        (updates.pageNumber as number) ?? (updates.pageSize ? 1 : prev.pageNumber),
    }));

  const columns: TTableColumn[] = [
    { key: 'name', label: 'Condition', width: 220, name: 'name' },
    { key: 'description', label: 'Description', width: 300, name: 'description' },
    { key: 'displayOrder', label: 'Order', width: 80, name: 'displayOrder' },
    { key: 'assetCount', label: 'Assets', width: 90, name: 'assetCount' },
    { key: 'isActive', label: 'Status', width: 110, name: 'isActive' },
    {
      key: 'actions',
      label: <i className="icon icon-actions text-[10px]" />,
      width: 45,
      canToggle: false,
      name: 'actions',
    },
  ];

  const rowData = conditions.map((condition) => ({
    id: condition.id,
    name: (
      <span className="flex items-center gap-2">
        <span className="font-medium text-secondaryColor">{condition.name}</span>
        {condition.isSystem && (
          <span
            className="rounded-full bg-gray-100 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-gray-500"
            title="Shipped with the module and shared by every company — it can be neither renamed nor deleted."
          >
            Built-in
          </span>
        )}
      </span>
    ),
    description: condition.description || '—',
    displayOrder: <span className="tabular-nums">{condition.displayOrder}</span>,
    assetCount:
      condition.assetCount > 0 ? (
        <span className="tabular-nums text-secondaryColor">{condition.assetCount}</span>
      ) : (
        '—'
      ),
    isActive: condition.isActive ? (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
        Active
      </span>
    ) : (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
        Inactive
      </span>
    ),
    // A built-in row gets no menu at all rather than a menu of disabled items: there is
    // nothing here the operator can do, and the pill already says why.
    actions:
      canManage && !condition.isSystem ? (
        <div className="flex justify-center">
          <Dropdown ariaLabel="Row actions" buttonChildren={<RowKebab />} position="fixed">
            <CustomMenuItem
              label="Edit"
              onClick={() => openEdit(condition)}
              icon={<i className="icon icon-edit text-sm" />}
              border
              className="!py-2"
            />
            <CustomMenuItem
              label="Delete"
              onClick={() => setDeleting(condition)}
              icon={<i className="icon icon-trash text-sm" />}
              className="!py-2"
            />
          </Dropdown>
        </div>
      ) : (
        ''
      ),
  }));

  /** Pre-state the refusal: the server will reject a delete of a condition in use, and
   *  learning that only after confirming is a worse experience than not offering it. */
  const deleteMessage = deleting
    ? deleting.assetCount > 0
      ? `'${deleting.name}' is recorded on ${deleting.assetCount} asset${
          deleting.assetCount === 1 ? '' : 's'
        } and cannot be deleted. Deactivate it instead to stop it being chosen for new records.`
      : deleting.isReferenced
        ? `'${deleting.name}' appears in past assignments, transfers, returns or audits and cannot be deleted. Deactivate it instead to stop it being chosen for new records.`
        : `Delete the condition '${deleting.name}'? It is not recorded on any asset or history.`
    : '';

  return (
    <div className="px-4 mt-2">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-secondaryColor">Asset Conditions</h1>
        <p className="mt-0.5 text-xs text-gray-500">
          The scale an asset is graded on when it is registered, issued, returned,
          transferred, serviced or verified. The six built-in conditions are shared by every
          company and cannot be changed — add your own alongside them.
        </p>
      </div>

      <CustomTable
        columns={columns}
        rows={rowData}
        tableName="AssetConditions"
        serialOffset={
          ((filters.pageNumber ?? 1) - 1) * (filters.pageSize ?? DEFAULT_PAGE_SIZE)
        }
        isLoading={loading}
        entityLabel="condition"
        selectable={false}
        tableHeaderLeft={
          canManage ? (
            <Button onClick={openCreate}>
              <i className="icon icon-plus text-xs"></i>
              <span>Add Condition</span>
            </Button>
          ) : undefined
        }
        tableHeaderRight={<SearchBox onSearch={setSearchQuery} searchVal={searchQuery} />}
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

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} size="lg">
        <div className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-secondaryColor">
            {editing ? 'Edit Condition' : 'Add Condition'}
          </h2>

          {formError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            <Input
              label="Name"
              required
              maxLength={100}
              placeholder="e.g. Refurbished"
              value={form.name}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, name: e.target.value }));
                setFormErrors((prev) => ({ ...prev, name: undefined }));
              }}
              error={formErrors.name}
              helperText="Shown in every condition picker — keep it short enough to read in a dropdown."
            />
            <Input
              label="Display Order"
              type="number"
              placeholder="Leave blank to add at the end"
              value={form.displayOrder}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, displayOrder: e.target.value }));
                setFormErrors((prev) => ({ ...prev, displayOrder: undefined }));
              }}
              error={formErrors.displayOrder}
              helperText="Where it sits in the list. The built-ins occupy 1–6."
            />
            <div className="md:col-span-2">
              <TextArea
                label="Description"
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
                helperText="A note for whoever maintains this list. The pickers show the name only."
              />
            </div>
            <div className="md:col-span-2">
              <ToggleSwitch
                label="Active"
                checked={form.isActive}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, isActive: e.target.checked }))
                }
              />
              <p className="mt-1 text-xs text-gray-500">
                An inactive condition stays on every record that already carries it, but is
                no longer offered when registering, issuing, returning or auditing.
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              <span>Cancel</span>
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <span>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Condition'}</span>
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={!!deleting}
        message={deleteMessage}
        loading={saving}
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
};

export default AssetConditionsPage;
