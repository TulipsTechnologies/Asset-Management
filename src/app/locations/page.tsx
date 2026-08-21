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
import SearchBox from '@/components/SearchBox';
import Pagination from '@/components/UI/Pagination';
import {
  IAssetLocation,
  IAssetLocationFilter,
  IAssetLocationTree,
} from '@/interface/IAssetLocation';
import {
  createAssetLocation,
  deleteAssetLocation,
  updateAssetLocation,
  fetchAssetLocations,
  fetchAssetLocationTree,
} from '@/services/assetLocation.service';
import LocationTree from '@/components/Locations/LocationTree';
import ViewSwitcher, { IViewOption, readStoredView } from '@/components/UI/ViewSwitcher';
import CustomMenuItem from '@/components/UI/CustomMenuItem';
import Dropdown from '@/components/UI/Dropdown';
import RowKebab from '@/components/UI/RowKebab';
import ConfirmationModal from '@/components/UI/ConfirmationModel';
import BulkDeleteModal from '@/components/UI/BulkDeleteModal';
import { IBulkResult, runBulkAction, summariseBulk } from '@/utils/bulkActions';
import { mergeTableFilters, unwrapPaged } from '@/utils/serviceUtils';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';
import useDebounce from '@/hooks/useDebounce';

type TLocationView = 'tree' | 'table';

const VIEW_VALUES = ['tree', 'table'] as const;
const VIEW_STORAGE_KEY = 'locations.viewMode';

const VIEW_OPTIONS: IViewOption<TLocationView>[] = [
  { value: 'tree', label: 'Tree', iconName: 'stream', title: 'Browse the hierarchy: Building → Floor → Room' },
  { value: 'table', label: 'Table', iconName: 'menu', title: 'Sort, page and bulk-manage locations' },
];

const LocationsPage = () => {
  const { addToast } = useToast();

  // Tree is the DEFAULT: a location master exists to answer "where is this room",
  // and only the parent→child view answers it. The table stays for sorting/bulk work.
  const [view, setView] = useState<TLocationView>('tree');
  const [tree, setTree] = useState<IAssetLocationTree[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);

  const [locations, setLocations] = useState<IAssetLocation[]>([]);

  // Bulk delete: the selection handed over by the table, and the report that follows.
  const [bulkIds, setBulkIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkResult, setBulkResult] = useState<IBulkResult | null>(null);
  const [allLocations, setAllLocations] = useState<IAssetLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  const [filters, setFilters] = useState<IAssetLocationFilter>({
    pageNumber: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 400);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    code: '',
    parentAssetLocationId: '',
    address: '',
  });
  const [formError, setFormError] = useState('');
  const [editing, setEditing] = useState<IAssetLocation | null>(null);
  const [deleting, setDeleting] = useState<IAssetLocation | null>(null);
  const [saving, setSaving] = useState(false);

  // sortField names an AssetLocation ENTITY property, so the server orders the whole tree
  // and hands back page 1. Parent is the joined parent row's name and Assets is a subquery
  // count — neither is a stored column here, so neither offers a sort control.
  const columns: TTableColumn[] = [
    { key: 'code', label: 'Code', width: 100, type: 'string', name: 'code', sortField: 'Code' },
    { key: 'name', label: 'Name', width: 200, type: 'string', name: 'name', sortField: 'Name' },
    { key: 'parentAssetLocationName', label: 'Parent', width: 170, type: 'string', name: 'parentAssetLocationName' },
    { key: 'address', label: 'Address', width: 220, type: 'string', name: 'address', sortField: 'Address' },
    { key: 'assetCount', label: 'Assets', width: 80, name: 'assetCount' },
    { key: 'isActive', label: 'Active', width: 80, name: 'isActive', sortField: 'IsActive' },
    {
      key: 'actions',
      label: <i className="icon icon-actions text-[10px]" />,
      width: 45,
      canToggle: false,
      name: 'actions',
    },
  ];

  useEffect(() => {
    const stored = readStoredView(VIEW_STORAGE_KEY, VIEW_VALUES);
    if (stored) setView(stored);
  }, []);

  const loadTree = useCallback(async () => {
    setTreeLoading(true);
    try {
      const res = await fetchAssetLocationTree();
      if (res?.success && res.data) setTree(res.data);
      else addToast.error(res?.message || 'Failed to fetch the location tree');
    } catch {
      addToast.error('An error occurred while fetching the location tree');
    } finally {
      setTreeLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const loadLocations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAssetLocations(filters);
      if (res?.success) {
        const paged = unwrapPaged(res);
        setLocations(paged.items);
        setRowCount(paged.rowCount);
        setPageCount(paged.pageCount);
      } else {
        addToast.error(res?.message || 'Failed to fetch locations');
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
      addToast.error('An error occurred while fetching locations');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

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

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', code: '', parentAssetLocationId: '', address: '' });
    setFormError('');
    fetchAssetLocations({ pageNumber: 1, pageSize: 500 })
      .then((res) => {
        if (res?.success) setAllLocations(unwrapPaged(res).items);
      })
      .catch(() => undefined);
    setFormOpen(true);
  };

  const openEdit = (location: IAssetLocation) => {
    setEditing(location);
    setForm({
      name: location.name,
      code: location.code ?? '',
      parentAssetLocationId: location.parentAssetLocationId ?? '',
      address: location.address ?? '',
    });
    setFormError('');
    fetchAssetLocations({ pageNumber: 1, pageSize: 500 })
      .then((res) => {
        if (res?.success) setAllLocations(unwrapPaged(res).items);
      })
      .catch(() => undefined);
    setFormOpen(true);
  };

  /** Tree rows carry no RowVersion, so edit/delete resolve the full record first. */
  const findFullRecord = async (id: string): Promise<IAssetLocation | null> => {
    try {
      const res = await fetchAssetLocations({ pageNumber: 1, pageSize: 500 });
      if (!res?.success) return null;
      return unwrapPaged(res).items.find((item) => item.id === id) ?? null;
    } catch {
      return null;
    }
  };

  const openEditFromTree = async (node: IAssetLocationTree) => {
    const full = await findFullRecord(node.id);
    if (full) openEdit(full);
    else addToast.error('Could not load that location — refresh and try again.');
  };

  const openDeleteFromTree = async (node: IAssetLocationTree) => {
    const full = await findFullRecord(node.id);
    if (full) setDeleting(full);
    else addToast.error('Could not load that location — refresh and try again.');
  };

  /** The tree's + button: create a child with the parent already chosen. */
  const openCreateUnder = (parent: IAssetLocationTree) => {
    setEditing(null);
    setForm({ name: '', code: '', parentAssetLocationId: parent.id, address: '' });
    setFormError('');
    fetchAssetLocations({ pageNumber: 1, pageSize: 500 })
      .then((res) => {
        if (res?.success) setAllLocations(unwrapPaged(res).items);
      })
      .catch(() => undefined);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError('Name is required');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || undefined,
      parentAssetLocationId: form.parentAssetLocationId || undefined,
      address: form.address.trim() || undefined,
      isActive: editing ? editing.isActive : true,
    };
    try {
      const res = editing
        ? await updateAssetLocation(editing.id, { ...payload, rowVersion: editing.rowVersion })
        : await createAssetLocation(payload);
      if (res?.success) {
        addToast.success(res.message || 'Location saved successfully');
        setFormOpen(false);
        loadLocations();
        loadTree();
      } else {
        addToast.error(res?.message || 'Failed to save the location');
        if (editing) {
          setFormOpen(false);
          loadLocations();
          loadTree();
        }
      }
    } catch (error) {
      console.error('Error saving location:', error);
      addToast.error('An error occurred while saving the location');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      const res = await deleteAssetLocation(deleting.id);
      if (res?.success) addToast.success(res.message || 'Location deleted');
      else addToast.error(res?.message || 'Could not delete the location');
    } catch {
      addToast.error('Could not delete the location');
    } finally {
      setSaving(false);
      setDeleting(null);
      loadLocations();
      loadTree();
    }
  };

  const rowData = locations.map((location) => ({
    id: location.id,
    code: (
      <span className="font-mono text-xs text-gray-500">
        {location.code || '—'}
      </span>
    ),
    name: location.name,
    parentAssetLocationName: location.parentAssetLocationName || '—',
    address: location.address || '—',
    assetCount:
      // A table cell needs no pill — the number in the table's own type is quieter
      // and sorts visually with its column.
      location.assetCount > 0 ? (
        <span className="tabular-nums text-secondaryColor">{location.assetCount}</span>
      ) : (
        '—'
      ),
    isActive: location.isActive ? (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Active
      </span>
    ) : (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        Inactive
      </span>
    ),
    actions: (
      <div className="flex justify-center">
        <Dropdown
          ariaLabel="Row actions"
          buttonChildren={<RowKebab />}
          position="fixed"
        >
          <CustomMenuItem
            label="Edit"
            onClick={() => openEdit(location)}
            icon={<i className="icon icon-edit text-sm" />}
            border
            className="!py-2"
          />
          <CustomMenuItem
            label="Delete"
            onClick={() => setDeleting(location)}
            icon={<i className="icon icon-trash text-sm" />}
            className="!py-2"
          />
        </Dropdown>
      </div>
    ),
  }));


  /**
   * Bulk delete. Each row still goes through the same endpoint as the row action, so a
   * referential refusal is the server's own sentence and is reported per row.
   */
  const runBulkDelete = async () => {
    if (bulkIds.length === 0) return;
    setBulkRunning(true);
    try {
      const targets = bulkIds.map((id) => ({
        id,
        label: locations.find((item) => item.id === id)?.name ?? id,
      }));
      const result = await runBulkAction(targets, (id) => deleteAssetLocation(id));
      setBulkResult(result);
      if (result.refused.length === 0) addToast.success(summariseBulk(result));
      else if (result.succeeded.length === 0) addToast.error(summariseBulk(result));
      else addToast.warning(summariseBulk(result));
    } finally {
      setBulkRunning(false);
      loadLocations();
      loadTree();
    }
  };

  const locationModals = (
    <>
      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} size="lg">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-4">
            {editing ? 'Edit Location' : 'Add Location'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <Input
              label="Name"
              required
              value={form.name}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, name: e.target.value }));
                setFormError('');
              }}
              error={formError}
            />
            <Input
              label="Code"
              value={form.code}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  code: e.target.value.toUpperCase(),
                }))
              }
              placeholder="e.g. HQ-3F"
              maxLength={20}
            />
            <Select
              label="Parent Location"
              placeholder="None (top level)"
              options={allLocations
                .filter((l) => l.isActive && l.level < 3)
                .map((l) => ({
                  value: l.id,
                  label: l.code ? `${l.code} — ${l.name}` : l.name,
                }))}
              value={form.parentAssetLocationId}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  parentAssetLocationId: e.target.value,
                }))
              }
            />
            <Input
              label="Address"
              value={form.address}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, address: e.target.value }))
              }
            />
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Hierarchy is limited to 3 levels (e.g. Building → Floor → Room).
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <i aria-hidden="true" className="icon icon-save text-xs" />
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>
      <BulkDeleteModal
        open={bulkOpen}
        entityLabel="location"
        count={bulkIds.length}
        running={bulkRunning}
        result={bulkResult}
        onConfirm={runBulkDelete}
        onClose={() => {
          setBulkOpen(false);
          setBulkResult(null);
          setBulkIds([]);
        }}
      />

      <ConfirmationModal
        isOpen={!!deleting}
        message={`Delete location '${deleting?.name}'? The API refuses while child locations or assets still reference it.`}
        loading={saving}
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );

  const headerRight = (
    <>
      <ImportExportOptions
        entity="locations"
        entityLabel="Locations"
        onImported={() => {
          loadLocations();
          loadTree();
        }}
      />
      <SearchBox onSearch={setSearchQuery} searchVal={searchQuery} />
      <ViewSwitcher
        options={VIEW_OPTIONS}
        value={view}
        onChange={setView}
        storageKey={VIEW_STORAGE_KEY}
      />
    </>
  );

  if (view === 'tree') {
    return (
      <div className="px-4 mt-2">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          <Button onClick={openCreate}>
            <i className="icon icon-plus text-xs"></i>
            <span>Add Location</span>
          </Button>
          <div className="flex flex-wrap items-center gap-2">{headerRight}</div>
        </div>

        <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4">
          <LocationTree
            tree={tree}
            loading={treeLoading}
            search={searchQuery}
            onAddChild={openCreateUnder}
            onEdit={openEditFromTree}
            onDelete={openDeleteFromTree}
          />
        </div>

        {locationModals}
      </div>
    );
  }

  return (
    <div className="px-4 mt-2">
      <CustomTable
        columns={columns}
        rows={rowData}
        tableName="Asset Locations"
        serialOffset={
          ((filters.pageNumber ?? 1) - 1) *
          (filters.pageSize ?? DEFAULT_PAGE_SIZE)
        }
        isLoading={loading}
        entityLabel="location"
        bulkActions={[
          {
            label: 'Delete',
            danger: true,
            onClick: (selectedIds) => {
              setBulkIds(selectedIds.map(String));
              setBulkResult(null);
              setBulkOpen(true);
            },
          },
        ]}
        tableHeaderLeft={
          <Button onClick={openCreate}>
            <i className="icon icon-plus text-xs"></i>
            <span>Add Location</span>
          </Button>
        }
        tableHeaderRight={headerRight}
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

      {locationModals}
    </div>
  );
};

export default LocationsPage;
