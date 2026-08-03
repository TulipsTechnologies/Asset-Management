'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/Providers/ToastProvider';
import Button from '@/components/UI/Button';
import CustomTable from '@/components/CustomTable/CustomTable';
import {
  ITableFilters,
  TTableColumn,
} from '@/components/CustomTable/CustomTableInterface';
import CustomCheckbox from '@/components/UI/CustomCheckBox';
import FilterPanel from '@/components/UI/FilterPanel';
import Modal from '@/components/UI/Modal';
import Input from '@/components/UI/Input';
import Select from '@/components/UI/Select';
import TextArea from '@/components/UI/TextArea';
import SearchBox from '@/components/SearchBox';
import Pagination from '@/components/UI/Pagination';
import { IVendor, IVendorFilter } from '@/interface/IVendor';
import { createVendor, fetchVendors } from '@/services/vendor.service';
import { unwrapPaged } from '@/utils/serviceUtils';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';
import { VENDOR_TYPE_LABELS, VendorTypeEnum } from '@/enum/vendorEnums';
import useDebounce from '@/hooks/useDebounce';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type TVendorFormErrors = Partial<Record<'name' | 'email', string>>;

const VendorsPage = () => {
  const { addToast } = useToast();

  const [vendors, setVendors] = useState<IVendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  const [filters, setFilters] = useState<IVendorFilter>({
    pageNumber: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 400);
  const [showFilters, setShowFilters] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    vendorType: String(VendorTypeEnum.GeneralSupplier),
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    panNumber: '',
    notes: '',
    isActive: true,
  });
  const [formErrors, setFormErrors] = useState<TVendorFormErrors>({});
  const [saving, setSaving] = useState(false);

  const columns: TTableColumn[] = [
    { key: 'name', label: 'Name', width: 190, type: 'string', name: 'name' },
    { key: 'vendorType', label: 'Type', width: 130, name: 'vendorType' },
    { key: 'contactPerson', label: 'Contact', width: 150, type: 'string', name: 'contactPerson' },
    { key: 'phone', label: 'Phone', width: 120, type: 'string', name: 'phone' },
    { key: 'email', label: 'Email', width: 180, type: 'string', name: 'email' },
    { key: 'assetCount', label: 'Assets', width: 80, name: 'assetCount' },
    { key: 'isActive', label: 'Active', width: 80, name: 'isActive' },
  ];

  const loadVendors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchVendors(filters);
      if (res?.success) {
        const paged = unwrapPaged(res);
        setVendors(paged.items);
        setRowCount(paged.rowCount);
        setPageCount(paged.pageCount);
      } else {
        addToast.error(res?.message || 'Failed to fetch vendors');
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
      addToast.error('An error occurred while fetching vendors');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

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
    setForm({
      name: '',
      vendorType: String(VendorTypeEnum.GeneralSupplier),
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      panNumber: '',
      notes: '',
      isActive: true,
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const handleSave = async () => {
    const nextErrors: TVendorFormErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Name is required';
    if (form.email.trim() && !EMAIL_PATTERN.test(form.email.trim()))
      nextErrors.email = 'Enter a valid email address';
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      return;
    }
    setSaving(true);
    try {
      const res = await createVendor({
        name: form.name.trim(),
        vendorType: Number(form.vendorType) as VendorTypeEnum,
        contactPerson: form.contactPerson.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        panNumber: form.panNumber.trim() || undefined,
        notes: form.notes.trim() || undefined,
        isActive: form.isActive,
      });
      if (res?.success) {
        addToast.success(res.message || 'Vendor created successfully');
        setFormOpen(false);
        loadVendors();
      } else {
        // 409 = duplicate name — the message says so; show it verbatim.
        addToast.error(res?.message || 'Failed to create the vendor');
      }
    } catch (error) {
      console.error('Error creating vendor:', error);
      addToast.error('An error occurred while creating the vendor');
    } finally {
      setSaving(false);
    }
  };

  const setField =
    (key: keyof typeof form) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
      setFormErrors((prev) => ({ ...prev, [key]: undefined }));
    };

  const rowData = vendors.map((vendor) => ({
    id: vendor.id,
    name: <span className="font-medium text-secondaryColor">{vendor.name}</span>,
    vendorType: VENDOR_TYPE_LABELS[vendor.vendorType] ?? '—',
    contactPerson: vendor.contactPerson || '—',
    phone: vendor.phone || '—',
    email: vendor.email || '—',
    assetCount:
      vendor.assetCount > 0 ? (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
          {vendor.assetCount}
        </span>
      ) : (
        '—'
      ),
    isActive: vendor.isActive ? (
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
        tableName="Vendors"
        serialOffset={
          ((filters.pageNumber ?? 1) - 1) *
          (filters.pageSize ?? DEFAULT_PAGE_SIZE)
        }
        isLoading={loading}
        entityLabel="vendor"
        tableHeaderLeft={
          <Button onClick={openCreate}>
            <i className="icon icon-plus text-xs"></i>
            <span>Add Vendor</span>
          </Button>
        }
        tableHeaderRight={
          <>
            <FilterPanel
              open={showFilters}
              onOpenChange={setShowFilters}
              activeCount={
                [filters.vendorType, filters.isActive].filter(
                  (v) => v != null
                ).length
              }
              onClearAll={() =>
                setFilters((prev) => ({
                  ...prev,
                  vendorType: undefined,
                  isActive: undefined,
                  pageNumber: 1,
                }))
              }
            >
              <Select
                label="Type"
                placeholder="All"
                options={Object.entries(VENDOR_TYPE_LABELS).map(
                  ([value, label]) => ({ value, label })
                )}
                value={
                  filters.vendorType != null ? String(filters.vendorType) : ''
                }
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    vendorType: e.target.value
                      ? (Number(e.target.value) as VendorTypeEnum)
                      : undefined,
                    pageNumber: 1,
                  }))
                }
              />
              <Select
                label="Status"
                placeholder="All"
                options={[
                  { value: 'true', label: 'Active' },
                  { value: 'false', label: 'Inactive' },
                ]}
                value={
                  filters.isActive != null ? String(filters.isActive) : ''
                }
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    isActive: e.target.value
                      ? e.target.value === 'true'
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

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} size="lg">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-4">
            Add Vendor
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <Input
              label="Name"
              required
              value={form.name}
              onChange={setField('name')}
              error={formErrors.name}
            />
            <Select
              label="Type"
              options={Object.entries(VENDOR_TYPE_LABELS).map(
                ([value, label]) => ({ value, label })
              )}
              value={form.vendorType}
              onChange={setField('vendorType')}
            />
            <Input
              label="Contact Person"
              value={form.contactPerson}
              onChange={setField('contactPerson')}
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={setField('phone')}
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={setField('email')}
              error={formErrors.email}
            />
            <Input
              label="PAN Number"
              value={form.panNumber}
              onChange={setField('panNumber')}
            />
            <Input
              label="Address"
              value={form.address}
              onChange={setField('address')}
              className="md:col-span-2"
            />
            <TextArea
              label="Notes"
              value={form.notes}
              onChange={setField('notes')}
              rows={2}
              className="md:col-span-2"
            />
          </div>
          <div className="mt-5">
            <CustomCheckbox
              title="Active"
              checked={form.isActive}
              onChange={() =>
                setForm((prev) => ({ ...prev, isActive: !prev.isActive }))
              }
            />
          </div>
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
    </div>
  );
};

export default VendorsPage;
