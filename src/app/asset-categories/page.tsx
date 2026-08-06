'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/Providers/ToastProvider';
import Button from '@/components/UI/Button';
import CustomTable from '@/components/CustomTable/CustomTable';
import ImportExportOptions from '@/components/ImportExport/ImportExportOptions';
import {
  ITableFilters,
  TTableColumn,
} from '@/components/CustomTable/CustomTableInterface';
import Modal from '@/components/UI/Modal';
import Input from '@/components/UI/Input';
import Select from '@/components/UI/Select';
import TextArea from '@/components/UI/TextArea';
import ToggleSwitch from '@/components/UI/ToggleSwitch';
import SearchBox from '@/components/SearchBox';
import Pagination from '@/components/UI/Pagination';
import {
  IAssetCategory,
  IAssetCategoryFilter,
  IAssetCategoryTree,
} from '@/interface/IAssetCategory';
import Dropdown from '@/components/UI/Dropdown';
import RowKebab from '@/components/UI/RowKebab';
import CustomMenuItem from '@/components/UI/CustomMenuItem';
import ConfirmationModal from '@/components/UI/ConfirmationModel';
import {
  createAssetCategory,
  deleteAssetCategory,
  fetchAssetCategories,
  fetchAssetCategoryTree,
  updateAssetCategory,
} from '@/services/assetCategory.service';
import { fetchDepreciationMethods } from '@/services/depreciation.service';
import { IDepreciationMethod } from '@/interface/IDepreciation';
import { DEPRECIATION_METHOD_CODES } from '@/enum/depreciationEnums';
import { unwrapPaged } from '@/utils/serviceUtils';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';
import useDebounce from '@/hooks/useDebounce';

type TFormState = {
  categoryCode: string;
  name: string;
  description: string;
  parentAssetCategoryId: string;
  isActive: boolean;
  // Depreciation defaults — prefill capitalization for assets in this category.
  defaultDepreciationMethodId: string;
  defaultUsefulLifeMonths: string;
  defaultResidualRate: string;
};

const emptyForm: TFormState = {
  categoryCode: '',
  name: '',
  description: '',
  parentAssetCategoryId: '',
  isActive: true,
  defaultDepreciationMethodId: '',
  defaultUsefulLifeMonths: '',
  defaultResidualRate: '',
};

const DetailField = ({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) => (
  <div>
    <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
    <div className="text-sm text-secondaryColor mt-0.5">{value || '—'}</div>
  </div>
);

const TreeNode = ({
  node,
  depth,
}: {
  node: IAssetCategoryTree;
  depth: number;
}) => (
  <>
    <div
      className="flex items-center gap-2 py-1.5"
      style={{ paddingLeft: depth * 20 }}
    >
      <i
        className={`icon ${depth === 0 ? 'icon-modules' : 'icon-arrow-right'} text-[11px] text-gray-400`}
      />
      <span className="text-xs font-mono text-gray-400">
        {node.categoryCode}
      </span>
      <span className="text-sm text-secondaryColor">{node.name}</span>
      {!node.isActive && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
          Inactive
        </span>
      )}
    </div>
    {node.children.map((child) => (
      <TreeNode key={child.id} node={child} depth={depth + 1} />
    ))}
  </>
);

const AssetCategoriesPage = () => {
  const { addToast } = useToast();

  const [categories, setCategories] = useState<IAssetCategory[]>([]);
  const [allCategories, setAllCategories] = useState<IAssetCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  const [filters, setFilters] = useState<IAssetCategoryFilter>({
    pageNumber: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 400);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<TFormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Edit reuses the create modal; null means "creating".
  const [editing, setEditing] = useState<IAssetCategory | null>(null);
  const [viewing, setViewing] = useState<IAssetCategory | null>(null);
  const [deleting, setDeleting] = useState<IAssetCategory | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const [treeOpen, setTreeOpen] = useState(false);
  const [tree, setTree] = useState<IAssetCategoryTree[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);

  // Global seeded lookup — loaded once, on first form open.
  const [methods, setMethods] = useState<IDepreciationMethod[]>([]);

  const columns: TTableColumn[] = [
    { key: 'categoryCode', label: 'Code', width: 120, type: 'string', name: 'categoryCode' },
    { key: 'name', label: 'Name', width: 220, type: 'string', name: 'name' },
    { key: 'parentAssetCategoryName', label: 'Parent', width: 180, type: 'string', name: 'parentAssetCategoryName' },
    { key: 'defaultDepreciationMethodName', label: 'Depreciation Default', width: 170, type: 'string', name: 'defaultDepreciationMethodName' },
    { key: 'defaultResidualRate', label: 'Residual Rate (%)', width: 140, name: 'defaultResidualRate' },
    { key: 'assetCount', label: 'Assets', width: 80, name: 'assetCount' },
    { key: 'isActive', label: 'Active', width: 90, name: 'isActive' },
    {
      key: 'actions',
      label: <i className="icon icon-actions text-[10px]" />,
      width: 45,
      canToggle: false,
      name: 'actions',
    },
  ];

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAssetCategories(filters);
      if (res?.success) {
        const paged = unwrapPaged(res);
        setCategories(paged.items);
        setRowCount(paged.rowCount);
        setPageCount(paged.pageCount);
      } else {
        addToast.error(res?.message || 'Failed to fetch categories');
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      addToast.error('An error occurred while fetching categories');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      search: debouncedSearch || undefined,
      pageNumber: 1,
    }));
  }, [debouncedSearch]);

  const loadParentOptions = () => {
    fetchAssetCategories({ pageNumber: 1, pageSize: 500 })
      .then((res) => {
        if (res?.success) setAllCategories(unwrapPaged(res).items);
      })
      .catch(() => undefined);
  };

  const loadMethods = () => {
    if (methods.length > 0) return;
    fetchDepreciationMethods()
      .then((res) => {
        if (res?.success && res.data) setMethods(res.data);
      })
      .catch(() => undefined);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    loadParentOptions();
    loadMethods();
    setFormOpen(true);
  };

  const openTree = () => {
    setTreeOpen(true);
    setTreeLoading(true);
    fetchAssetCategoryTree()
      .then((res) => {
        if (res?.success && res.data) setTree(res.data);
        else addToast.error(res?.message || 'Failed to load the tree');
      })
      .catch(() => addToast.error('An error occurred while loading the tree'))
      .finally(() => setTreeLoading(false));
  };

  // When editing, a category may not be its own parent — nor its own descendant's
  // child, which would close a loop. Both are refused by the API; excluding them here
  // means the operator is never offered a choice that cannot work.
  const parentOptions = (() => {
    const excluded = new Set<string>();
    if (editing) {
      excluded.add(editing.id);
      let frontier = [editing.id];
      while (frontier.length > 0) {
        const children = allCategories
          .filter(
            (c) =>
              c.parentAssetCategoryId &&
              frontier.includes(c.parentAssetCategoryId) &&
              !excluded.has(c.id)
          )
          .map((c) => c.id);
        children.forEach((id) => excluded.add(id));
        frontier = children;
      }
    }
    return allCategories
      .filter((c) => !excluded.has(c.id))
      .map((c) => ({ value: c.id, label: `${c.categoryCode} — ${c.name}` }));
  })();

  const openEdit = (category: IAssetCategory) => {
    setEditing(category);
    setForm({
      categoryCode: category.categoryCode,
      name: category.name,
      description: category.description ?? '',
      parentAssetCategoryId: category.parentAssetCategoryId ?? '',
      isActive: category.isActive,
      defaultDepreciationMethodId: category.defaultDepreciationMethodId ?? '',
      defaultUsefulLifeMonths:
        category.defaultUsefulLifeMonths != null
          ? String(category.defaultUsefulLifeMonths)
          : '',
      defaultResidualRate:
        category.defaultResidualRate != null
          ? String(category.defaultResidualRate)
          : '',
    });
    setFormError('');
    loadParentOptions();
    loadMethods();
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.categoryCode.trim() || !form.name.trim()) {
      setFormError('Code and name are required');
      return;
    }
    const life = form.defaultUsefulLifeMonths.trim()
      ? Number(form.defaultUsefulLifeMonths)
      : undefined;
    const rate = form.defaultResidualRate.trim()
      ? Number(form.defaultResidualRate)
      : undefined;
    if (life !== undefined && (!Number.isInteger(life) || life < 1 || life > 1200)) {
      setFormError('Default useful life must be a whole number of months (1–1200)');
      return;
    }
    if (rate !== undefined && (Number.isNaN(rate) || rate < 0 || rate > 100)) {
      setFormError('Default residual rate must be between 0 and 100');
      return;
    }
    setSaving(true);
    const payload = {
      categoryCode: form.categoryCode.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      parentAssetCategoryId: form.parentAssetCategoryId || undefined,
      isActive: form.isActive,
      // Blank fields clear the default — the API assigns these unconditionally.
      defaultDepreciationMethodId: form.defaultDepreciationMethodId || undefined,
      defaultUsefulLifeMonths: life,
      defaultResidualRate: rate,
    };
    try {
      const res = editing
        ? await updateAssetCategory(editing.id, {
            ...payload,
            rowVersion: editing.rowVersion,
          })
        : await createAssetCategory(payload);

      if (res?.success) {
        addToast.success(
          res.message || (editing ? 'Category updated' : 'Category created')
        );
        setFormOpen(false);
        setEditing(null);
        loadCategories();
      } else if (editing) {
        // House rule: a failed rowVersion-carrying save closes and reloads, so a
        // stale token is never retried. The server message carries the real reason
        // (duplicate code, cycle, depth limit).
        addToast.error(res?.message || 'Failed to update the category');
        setFormOpen(false);
        setEditing(null);
        loadCategories();
      } else {
        // Creates carry no rowVersion, so the form can stay open to be corrected.
        setFormError(res?.message || 'Failed to create the category');
      }
    } catch (error) {
      console.error('Error saving category:', error);
      addToast.error('An error occurred while saving the category');
      if (editing) {
        setFormOpen(false);
        setEditing(null);
        loadCategories();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteSaving(true);
    try {
      const res = await deleteAssetCategory(deleting.id);
      if (res?.success) {
        addToast.success(res.message || 'Category deleted');
      } else {
        // The 409 explains exactly what still uses the category.
        addToast.error(res?.message || 'Failed to delete the category');
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      addToast.error('An error occurred while deleting the category');
    } finally {
      setDeleteSaving(false);
      setDeleting(null);
      loadCategories();
    }
  };

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

  const rowData = categories.map((category) => ({
    id: category.id,
    categoryCode: (
      <span className="font-mono text-xs text-gray-500">
        {category.categoryCode}
      </span>
    ),
    name: category.name,
    parentAssetCategoryName: category.parentAssetCategoryName || '—',
    defaultDepreciationMethodName:
      category.defaultDepreciationMethodName || '—',
    defaultResidualRate:
      category.defaultResidualRate != null ? (
        <span className="tabular-nums">{category.defaultResidualRate}%</span>
      ) : (
        '—'
      ),
    assetCount: category.assetCount || '—',
    isActive: category.isActive ? (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Active
      </span>
    ) : (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        Inactive
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
              icon: <i className="icon icon-eye text-xs" />,
              action: () => setViewing(category),
            },
            {
              label: 'Edit',
              icon: <i className="icon icon-edit text-xs" />,
              action: () => openEdit(category),
            },
            {
              label: 'Delete',
              icon: <i className="icon icon-trash text-xs" />,
              action: () => setDeleting(category),
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

  return (
    <div className="px-4 mt-2">
      <CustomTable
        columns={columns}
        rows={rowData}
        tableName="Asset Categories"
        serialOffset={
          ((filters.pageNumber ?? 1) - 1) *
          (filters.pageSize ?? DEFAULT_PAGE_SIZE)
        }
        isLoading={loading}
        entityLabel="category"
        tableHeaderLeft={
          <div className="flex gap-2">
            <Button onClick={openCreate}>
              <i className="icon icon-plus text-xs"></i>
              <span>Add Category</span>
            </Button>
            <Button variant="secondary" onClick={openTree}>
              <i className="icon icon-modules text-xs"></i>
              <span>Tree View</span>
            </Button>
          </div>
        }
        tableHeaderRight={
          <>
            <ImportExportOptions
              entity="categories"
              entityLabel="Asset Categories"
              onImported={loadCategories}
            />
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

      <Modal
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        size="lg"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            {editing ? `Edit ${editing.name}` : 'Add Category'}
          </h2>
          {editing && editing.assetCount > 0 && (
            <p className="text-xs text-gray-400 mb-4">
              {editing.assetCount} asset{editing.assetCount === 1 ? '' : 's'} use
              this category. Changing the code only affects asset codes generated
              from now on; existing codes never change.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <Input
              label="Category Code"
              required
              value={form.categoryCode}
              onChange={(e) => {
                setForm((prev) => ({
                  ...prev,
                  categoryCode: e.target.value.toUpperCase(),
                }));
                setFormError('');
              }}
              placeholder="e.g. IT-EQ (A–Z, 0–9, dash)"
              maxLength={20}
              error={formError}
            />
            <Input
              label="Name"
              required
              value={form.name}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, name: e.target.value }));
                setFormError('');
              }}
            />
            <Select
              label="Parent Category"
              placeholder="None (top level)"
              options={parentOptions}
              value={form.parentAssetCategoryId}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  parentAssetCategoryId: e.target.value,
                }))
              }
            />
            <div className="flex items-end pb-1">
              <ToggleSwitch
                label="Active"
                checked={form.isActive}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, isActive: e.target.checked }))
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
              />
            </div>

            <div className="md:col-span-2 border-t border-gray-100 pt-4">
              <h3 className="text-sm font-semibold text-secondaryColor">
                Depreciation Defaults
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Prefilled when an asset in this category is capitalized — the
                accountant can still override per asset. Leave blank for no
                default.
              </p>
            </div>
            <Select
              label="Default Method"
              placeholder="No default"
              options={methods
                // Straight Line and Diminishing Balance only — the same two the
                // capitalize form offers, so a category default can never prefill a
                // method that form will not show. A category already carrying one of
                // the retired methods keeps it selectable so editing does not silently
                // clear it.
                .filter(
                  (m) =>
                    m.code === DEPRECIATION_METHOD_CODES.StraightLine ||
                    m.code === DEPRECIATION_METHOD_CODES.DecliningBalance ||
                    m.id === form.defaultDepreciationMethodId
                )
                .map((m) => ({ value: m.id, label: m.name }))}
              value={form.defaultDepreciationMethodId}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  defaultDepreciationMethodId: e.target.value,
                }))
              }
            />
            <Input
              label="Default Useful Life (months)"
              type="number"
              value={form.defaultUsefulLifeMonths}
              onChange={(e) => {
                setForm((prev) => ({
                  ...prev,
                  defaultUsefulLifeMonths: e.target.value,
                }));
                setFormError('');
              }}
              placeholder="e.g. 60"
            />
            <Input
              label="Default Residual Rate (%)"
              type="number"
              value={form.defaultResidualRate}
              onChange={(e) => {
                setForm((prev) => ({
                  ...prev,
                  defaultResidualRate: e.target.value,
                }));
                setFormError('');
              }}
              placeholder="e.g. 5"
              helperText="Resolved to an amount at capitalization: cost × rate."
            />
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Hierarchy is limited to 3 levels; codes are unique per company.
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="secondary"
              onClick={() => {
                setFormOpen(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* View details — read-only, reachable for every row */}
      <Modal isOpen={viewing !== null} onClose={() => setViewing(null)} size="2xl">
        <div className="flex max-h-[85vh] flex-col">
          {/* Identity band: what this category IS, and its standing at a glance. */}
          <div className="shrink-0 border-b border-gray-100 px-6 pb-4 pr-14 pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-semibold text-secondaryColor">
                    {viewing?.name}
                  </h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      viewing?.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {viewing?.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-600">
                    {viewing?.categoryCode}
                  </span>
                  {viewing?.parentAssetCategoryName ? (
                    <span>under {viewing.parentAssetCategoryName}</span>
                  ) : (
                    <span>top-level category</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {/* The two numbers that matter operationally. */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Assets classified here
                </p>
                <p className="mt-1 text-2xl font-bold leading-none tabular-nums text-secondaryColor">
                  {viewing?.assetCount ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Child categories
                </p>
                <p className="mt-1 text-2xl font-bold leading-none text-secondaryColor">
                  {viewing?.hasChildren ? 'Yes' : 'None'}
                </p>
              </div>
            </div>

            <section>
              <h3 className="mb-2 border-b border-gray-100 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Depreciation defaults
              </h3>
              <p className="mb-3 text-xs text-gray-400">
                Prefilled when an asset in this category is capitalized; the accountant
                can still override each one per asset.
              </p>
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
                <DetailField
                  label="Method"
                  value={viewing?.defaultDepreciationMethodName}
                />
                <DetailField
                  label="Useful life"
                  value={
                    viewing?.defaultUsefulLifeMonths
                      ? `${viewing.defaultUsefulLifeMonths} months`
                      : null
                  }
                />
                <DetailField
                  label="Residual rate"
                  value={
                    viewing?.defaultResidualRate != null
                      ? `${viewing.defaultResidualRate}%`
                      : null
                  }
                />
              </div>
            </section>

            <section>
              <h3 className="mb-2 border-b border-gray-100 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Classification
              </h3>
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
                <DetailField
                  label="Parent"
                  value={viewing?.parentAssetCategoryName}
                />
                <DetailField
                  label="Display order"
                  value={
                    viewing?.displayOrder != null ? String(viewing.displayOrder) : null
                  }
                />
                <DetailField
                  label="Status"
                  value={viewing?.isActive ? 'Active' : 'Inactive'}
                />
              </div>
            </section>

            <section>
              <h3 className="mb-2 border-b border-gray-100 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Description
              </h3>
              <p className="text-sm leading-relaxed text-secondaryColor">
                {viewing?.description || (
                  <span className="text-gray-400">No description recorded.</span>
                )}
              </p>
            </section>
          </div>

          <div className="flex shrink-0 justify-end gap-3 border-t border-gray-100 px-6 py-4">
            <Button variant="secondary" onClick={() => setViewing(null)}>
              Close
            </Button>
            <Button
              onClick={() => {
                const target = viewing;
                setViewing(null);
                if (target) openEdit(target);
              }}
            >
              Edit
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete — the API refuses while children or assets remain, and says which */}
      <ConfirmationModal
        isOpen={deleting !== null}
        loading={deleteSaving}
        message={
          deleting
            ? deleting.hasChildren || deleting.assetCount > 0
              ? `"${deleting.name}" still has ${
                  deleting.hasChildren ? 'child categories' : ''
                }${deleting.hasChildren && deleting.assetCount > 0 ? ' and ' : ''}${
                  deleting.assetCount > 0
                    ? `${deleting.assetCount} asset${deleting.assetCount === 1 ? '' : 's'}`
                    : ''
                }, so it cannot be deleted. Deactivate it instead to stop new registrations. Try anyway?`
              : `Delete "${deleting.name}"? Its code becomes available for reuse.`
            : ''
        }
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />

      <Modal isOpen={treeOpen} onClose={() => setTreeOpen(false)} size="lg">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-4">
            Category Tree
          </h2>
          {treeLoading ? (
            <div className="text-sm text-gray-400 py-6 text-center">
              Loading…
            </div>
          ) : tree.length === 0 ? (
            <div className="text-sm text-gray-400 py-6 text-center">
              No categories yet.
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              {tree.map((node) => (
                <TreeNode key={node.id} node={node} depth={0} />
              ))}
            </div>
          )}
          <div className="flex justify-end mt-6">
            <Button variant="secondary" onClick={() => setTreeOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AssetCategoriesPage;
