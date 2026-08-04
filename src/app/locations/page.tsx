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
import { IAssetLocation, IAssetLocationFilter } from '@/interface/IAssetLocation';
import {
  createAssetLocation,
  deleteAssetLocation,
  updateAssetLocation,
  fetchAssetLocations,
} from '@/services/assetLocation.service';
import CustomMenuItem from '@/components/UI/CustomMenuItem';
import Dropdown from '@/components/UI/Dropdown';
import ConfirmationModal from '@/components/UI/ConfirmationModel';
import { unwrapPaged } from '@/utils/serviceUtils';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';
import useDebounce from '@/hooks/useDebounce';

const LocationsPage = () => {
  const { addToast } = useToast();

  const [locations, setLocations] = useState<IAssetLocation[]>([]);
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

  const columns: TTableColumn[] = [
    { key: 'code', label: 'Code', width: 100, type: 'string', name: 'code' },
    { key: 'name', label: 'Name', width: 200, type: 'string', name: 'name' },
    { key: 'parentAssetLocationName', label: 'Parent', width: 170, type: 'string', name: 'parentAssetLocationName' },
    { key: 'address', label: 'Address', width: 220, type: 'string', name: 'address' },
    { key: 'assetCount', label: 'Assets', width: 80, name: 'assetCount' },
    { key: 'isActive', label: 'Active', width: 80, name: 'isActive' },
    {
      key: 'actions',
      label: <i className="icon icon-actions text-[10px]" />,
      width: 45,
      canToggle: false,
      name: 'actions',
    },
  ];

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
      } else {
        addToast.error(res?.message || 'Failed to save the location');
        if (editing) {
          setFormOpen(false);
          loadLocations();
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
      location.assetCount > 0 ? (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
          {location.assetCount}
        </span>
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
          buttonChildren={<i className="icon icon-actions text-[10px]" />}
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
        tableHeaderLeft={
          <Button onClick={openCreate}>
            <i className="icon icon-plus text-xs"></i>
            <span>Add Location</span>
          </Button>
        }
        tableHeaderRight={
          <>
            <ImportExportOptions
              entity="locations"
              entityLabel="Locations"
              onImported={loadLocations}
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

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} size="lg">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-4">
            Add Location
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
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>
      <ConfirmationModal
        isOpen={!!deleting}
        message={`Delete location '${deleting?.name}'? The API refuses while child locations or assets still reference it.`}
        loading={saving}
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
};

export default LocationsPage;
