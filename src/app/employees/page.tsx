'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/Providers/ToastProvider';
import Button from '@/components/UI/Button';
import CustomTable from '@/components/CustomTable/CustomTable';
import ImportExportOptions from '@/components/ImportExport/ImportExportOptions';
import { syncEmployeesFromHrm } from '@/services/employeeSync.service';
import {
  ITableFilters,
  TTableColumn,
} from '@/components/CustomTable/CustomTableInterface';
import Modal from '@/components/UI/Modal';
import Input from '@/components/UI/Input';
import SearchBox from '@/components/SearchBox';
import Pagination from '@/components/UI/Pagination';
import { IEmployee, IEmployeeFilter } from '@/interface/IEmployee';
import {
  createEmployee,
  deleteEmployee,
  fetchEmployees,
  updateEmployee,
} from '@/services/employee.service';
import CustomMenuItem from '@/components/UI/CustomMenuItem';
import Dropdown from '@/components/UI/Dropdown';
import RowKebab from '@/components/UI/RowKebab';
import ConfirmationModal from '@/components/UI/ConfirmationModel';
import BulkDeleteModal from '@/components/UI/BulkDeleteModal';
import { IBulkResult, runBulkAction, summariseBulk } from '@/utils/bulkActions';
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

  // Bulk delete: the selection handed over by the table, and the report that follows.
  const [bulkIds, setBulkIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkResult, setBulkResult] = useState<IBulkResult | null>(null);
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
  const [editing, setEditing] = useState<IEmployee | null>(null);
  const [deleting, setDeleting] = useState<IEmployee | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const columns: TTableColumn[] = [
    { key: 'employeeCode', label: 'Code', width: 100, type: 'string', name: 'employeeCode' },
    { key: 'fullName', label: 'Name', width: 190, type: 'string', name: 'fullName' },
    { key: 'department', label: 'Department', width: 140, type: 'string', name: 'department' },
    { key: 'designation', label: 'Designation', width: 160, type: 'string', name: 'designation' },
    { key: 'email', label: 'Email', width: 190, type: 'string', name: 'email' },
    { key: 'openAssignmentCount', label: 'Assets Held', width: 100, name: 'openAssignmentCount' },
    { key: 'isActive', label: 'Active', width: 80, name: 'isActive' },
    {
      key: 'actions',
      label: <i className="icon icon-actions text-[10px]" />,
      width: 45,
      canToggle: false,
      name: 'actions',
    },
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

  const openEdit = (employee: IEmployee) => {
    setEditing(employee);
    setForm({
      employeeCode: employee.employeeCode ?? '',
      fullName: employee.fullName,
      email: employee.email ?? '',
      phone: employee.phone ?? '',
      department: employee.department ?? '',
      designation: employee.designation ?? '',
    });
    setFormError('');
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.fullName.trim()) {
      setFormError('Full name is required');
      return;
    }
    setSaving(true);
    const payload = {
      employeeCode: form.employeeCode.trim() || undefined,
      fullName: form.fullName.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      department: form.department.trim() || undefined,
      designation: form.designation.trim() || undefined,
      isActive: editing ? editing.isActive : true,
    };
    try {
      const res = editing
        ? await updateEmployee(editing.id, { ...payload, rowVersion: editing.rowVersion })
        : await createEmployee(payload);
      if (res?.success) {
        addToast.success(res.message || 'Employee saved successfully');
        setFormOpen(false);
        loadEmployees();
      } else {
        addToast.error(res?.message || 'Failed to save the employee');
        if (editing) {
          setFormOpen(false);
          loadEmployees();
        }
      }
    } catch (error) {
      console.error('Error saving employee:', error);
      addToast.error('An error occurred while saving the employee');
    } finally {
      setSaving(false);
    }
  };

  /**
   * TulipsHRM owns the register for linked companies; this pulls it. Nobody is
   * deleted — people who left HRM come back deactivated — so the outcome is
   * reported as counts rather than a bare success.
   */
  const handleSyncFromHrm = async () => {
    setSyncing(true);
    try {
      const res = await syncEmployeesFromHrm();
      if (res?.success) {
        addToast.success(res.message || 'Employees synced from TulipsHRM');
        // Data problems in HRM the sync worked around (duplicate codes, …).
        (res.data?.warnings ?? []).forEach((warning) =>
          addToast.info(warning, 12000)
        );
        loadEmployees();
      } else {
        addToast.error(res?.message || 'Could not sync employees from TulipsHRM');
      }
    } catch (error) {
      console.error('Error syncing employees:', error);
      addToast.error('An error occurred while syncing employees');
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      const res = await deleteEmployee(deleting.id);
      if (res?.success) addToast.success(res.message || 'Employee deleted');
      else addToast.error(res?.message || 'Could not delete the employee');
    } catch {
      addToast.error('Could not delete the employee');
    } finally {
      setSaving(false);
      setDeleting(null);
      loadEmployees();
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
    actions: (
      <div className="flex justify-center">
        <Dropdown
          ariaLabel="Row actions"
          buttonChildren={<RowKebab />}
          position="fixed"
        >
          <CustomMenuItem
            label="Edit"
            onClick={() => openEdit(employee)}
            icon={<i className="icon icon-edit text-sm" />}
            border
            className="!py-2"
          />
          <CustomMenuItem
            label="Delete"
            onClick={() => setDeleting(employee)}
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
        label: employees.find((item) => item.id === id)?.fullName ?? id,
      }));
      const result = await runBulkAction(targets, (id) => deleteEmployee(id));
      setBulkResult(result);
      if (result.refused.length === 0) addToast.success(summariseBulk(result));
      else if (result.succeeded.length === 0) addToast.error(summariseBulk(result));
      else addToast.warning(summariseBulk(result));
    } finally {
      setBulkRunning(false);
      loadEmployees();
    }
  };

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
          <>
            <button
              type="button"
              onClick={handleSyncFromHrm}
              disabled={syncing}
              className="text-sm flex items-center gap-x-2 font-medium whitespace-nowrap disabled:opacity-50"
              title="Pull the employee register from TulipsHRM"
            >
              <i
                className={`icon icon-redo text-base ${syncing ? 'animate-spin text-gray-400' : 'text-gray-500'}`}
              />
              <span>{syncing ? 'Syncing…' : 'Sync from HRM'}</span>
            </button>
            <ImportExportOptions
              entity="employees"
              entityLabel="Employees"
              onImported={loadEmployees}
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
      <BulkDeleteModal
        open={bulkOpen}
        entityLabel="employee"
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
        message={`Delete employee '${deleting?.fullName}'? The API refuses while they hold custody, open assignments or open recovery cases.`}
        loading={saving}
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
};

export default EmployeesPage;
