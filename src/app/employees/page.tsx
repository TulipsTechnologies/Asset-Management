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
import SearchBox from '@/components/SearchBox';
import Pagination from '@/components/UI/Pagination';
import { IEmployee, IEmployeeFilter } from '@/interface/IEmployee';
import { createEmployee, fetchEmployees } from '@/services/employee.service';
import { unwrapPaged } from '@/utils/serviceUtils';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';
import useDebounce from '@/hooks/useDebounce';

type TFormState = {
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
};

const emptyForm: TFormState = {
  employeeCode: '',
  fullName: '',
  email: '',
  phone: '',
  department: '',
  designation: '',
};

const EmployeesPage = () => {
  const { addToast } = useToast();

  const [employees, setEmployees] = useState<IEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  const [filters, setFilters] = useState<IEmployeeFilter>({
    pageNumber: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 400);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<TFormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const columns: TTableColumn[] = [
    { key: 'employeeCode', label: 'Code', width: 100, type: 'string', name: 'employeeCode' },
    { key: 'fullName', label: 'Name', width: 190, type: 'string', name: 'fullName' },
    { key: 'department', label: 'Department', width: 140, type: 'string', name: 'department' },
    { key: 'designation', label: 'Designation', width: 160, type: 'string', name: 'designation' },
    { key: 'email', label: 'Email', width: 190, type: 'string', name: 'email' },
    { key: 'openAssignmentCount', label: 'Assets Held', width: 100, name: 'openAssignmentCount' },
    { key: 'isActive', label: 'Active', width: 80, name: 'isActive' },
  ];

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchEmployees(filters);
      if (res?.success) {
        const paged = unwrapPaged(res);
        setEmployees(paged.items);
        setRowCount(paged.rowCount);
        setPageCount(paged.pageCount);
      } else {
        addToast.error(res?.message || 'Failed to fetch employees');
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      addToast.error('An error occurred while fetching employees');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

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

  const handleSave = async () => {
    if (!form.fullName.trim()) {
      setFormError('Full name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await createEmployee({
        employeeCode: form.employeeCode.trim() || undefined,
        fullName: form.fullName.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        department: form.department.trim() || undefined,
        designation: form.designation.trim() || undefined,
        isActive: true,
      });
      if (res?.success) {
        addToast.success('Employee created successfully');
        setFormOpen(false);
        loadEmployees();
      } else {
        addToast.error(res?.message || 'Failed to create the employee');
      }
    } catch (error) {
      console.error('Error creating employee:', error);
      addToast.error('An error occurred while creating the employee');
    } finally {
      setSaving(false);
    }
  };

  const rowData = employees.map((employee) => ({
    id: employee.id,
    employeeCode: (
      <span className="font-mono text-xs text-gray-500">
        {employee.employeeCode || '—'}
      </span>
    ),
    fullName: employee.fullName,
    department: employee.department || '—',
    designation: employee.designation || '—',
    email: employee.email || '—',
    openAssignmentCount:
      employee.openAssignmentCount > 0 ? (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
          {employee.openAssignmentCount}
        </span>
      ) : (
        '—'
      ),
    isActive: employee.isActive ? (
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
        tableName="Employees"
        serialOffset={
          ((filters.pageNumber ?? 1) - 1) *
          (filters.pageSize ?? DEFAULT_PAGE_SIZE)
        }
        isLoading={loading}
        entityLabel="employee"
        tableHeaderLeft={
          <Button
            onClick={() => {
              setForm(emptyForm);
              setFormError('');
              setFormOpen(true);
            }}
          >
            <i className="icon icon-plus text-xs"></i>
            <span>Add Employee</span>
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

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} size="lg">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            Add Employee
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Custodian registry for asset assignments. Once HRM integration is
            wired, this list is populated automatically from TulipsHRM.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <Input
              label="Full Name"
              required
              value={form.fullName}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, fullName: e.target.value }));
                setFormError('');
              }}
              error={formError}
            />
            <Input
              label="Employee Code"
              value={form.employeeCode}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  employeeCode: e.target.value.toUpperCase(),
                }))
              }
              placeholder="e.g. EMP-005"
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, email: e.target.value }))
              }
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, phone: e.target.value }))
              }
            />
            <Input
              label="Department"
              value={form.department}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, department: e.target.value }))
              }
            />
            <Input
              label="Designation"
              value={form.designation}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, designation: e.target.value }))
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

export default EmployeesPage;
