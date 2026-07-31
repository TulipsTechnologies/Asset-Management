'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/Providers/ToastProvider';
import Button from '@/components/UI/Button';
import CustomTable from '@/components/CustomTable/CustomTable';
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
import {
  createAssetCategory,
  fetchAssetCategories,
  fetchAssetCategoryTree,
} from '@/services/assetCategory.service';
import { unwrapPaged } from '@/utils/serviceUtils';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';
import useDebounce from '@/hooks/useDebounce';

type TFormState = {
  categoryCode: string;
  name: string;
  description: string;
  parentAssetCategoryId: string;
  isActive: boolean;
};

const emptyForm: TFormState = {
  categoryCode: '',
  name: '',
  description: '',
  parentAssetCategoryId: '',
  isActive: true,
};

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
        className={`icon ${depth === 0 ? 'icon-category' : 'icon-arrow-right'} text-[11px] text-gray-400`}
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

  const [treeOpen, setTreeOpen] = useState(false);
  const [tree, setTree] = useState<IAssetCategoryTree[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);

  const columns: TTableColumn[] = [
    { key: 'categoryCode', label: 'Code', width: 120, type: 'string', name: 'categoryCode' },
    { key: 'name', label: 'Name', width: 220, type: 'string', name: 'name' },
    { key: 'parentAssetCategoryName', label: 'Parent', width: 180, type: 'string', name: 'parentAssetCategoryName' },
    { key: 'defaultDepreciationMethodName', label: 'Depreciation Default', width: 170, type: 'string', name: 'defaultDepreciationMethodName' },
    { key: 'isActive', label: 'Active', width: 90, name: 'isActive' },
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

  const openCreate = () => {
    setForm(emptyForm);
    setFormError('');
    loadParentOptions();
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

  const handleSave = async () => {
    if (!form.categoryCode.trim() || !form.name.trim()) {
      setFormError('Code and name are required');
      return;
    }
    setSaving(true);
    try {
      const res = await createAssetCategory({
        categoryCode: form.categoryCode.trim().toUpperCase(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        parentAssetCategoryId: form.parentAssetCategoryId || undefined,
        isActive: form.isActive,
      });
      if (res?.success) {
        addToast.success('Category created successfully');
        setFormOpen(false);
        loadCategories();
      } else {
        addToast.error(res?.message || 'Failed to create the category');
      }
    } catch (error) {
      console.error('Error creating category:', error);
      addToast.error('An error occurred while creating the category');
    } finally {
      setSaving(false);
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
    isActive: category.isActive ? (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Active
      </span>
    ) : (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        Inactive
      </span>
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
              <i className="icon icon-category text-xs"></i>
              <span>Tree View</span>
            </Button>
          </div>
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

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} size="lg">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-4">
            Add Category
          </h2>
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
              options={allCategories.map((c) => ({
                value: c.id,
                label: `${c.categoryCode} — ${c.name}`,
              }))}
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
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Hierarchy is limited to 3 levels; codes are unique per company.
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

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
