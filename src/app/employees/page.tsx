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
import SearchBox from '@/components/SearchBox';
import Pagination from '@/components/UI/Pagination';
import { IEmployee, IEmployeeFilter } from '@/interface/IEmployee';
import {
  createEmployee,
  deleteEmployee,
  fetchEmployees,
  updateEmployee,
} from '@/services/employee.service';
import { fetchAssetAssignments } from '@/services/assetAssignment.service';
import { IAssetAssignment } from '@/interface/IAssetAssignment';
import { AssignmentStatusEnum } from '@/enum/assignmentEnums';
import CustomMenuItem from '@/components/UI/CustomMenuItem';
import Dropdown from '@/components/UI/Dropdown';
import RowKebab from '@/components/UI/RowKebab';
import ConfirmationModal from '@/components/UI/ConfirmationModel';
import BulkDeleteModal from '@/components/UI/BulkDeleteModal';
import { IBulkResult, runBulkAction, summariseBulk } from '@/utils/bulkActions';
import { mergeTableFilters, unwrapPaged } from '@/utils/serviceUtils';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';
import useDebounce from '@/hooks/useDebounce';
import { shortDate } from '@/components/Assets/AssetViewShared';

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

  /*
   * hasOpenAssignments is pinned on for THIS page only. The register answers "who is
   * responsible for what we own", and against that question an employee holding nothing is
   * noise. Every other consumer of the employee list — the assignment custodian picker above
   * all — must keep seeing everyone, or you could never hand someone their first asset.
   */
  const [filters, setFilters] = useState<IEmployeeFilter>({
    pageNumber: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    hasOpenAssignments: true,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 400);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<TFormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [editing, setEditing] = useState<IEmployee | null>(null);
  const [deleting, setDeleting] = useState<IEmployee | null>(null);
  const [saving, setSaving] = useState(false);

  // Assets-held drill-down: which custodian's holdings are on screen, and what they are.
  const [holdingsFor, setHoldingsFor] = useState<IEmployee | null>(null);
  const [holdings, setHoldings] = useState<IAssetAssignment[]>([]);
  const [holdingsLoading, setHoldingsLoading] = useState(false);

  // sortField names an Employee ENTITY property, so the server orders the whole register
  // and hands back page 1. Assets Held has none: it counts open assignments in the
  // projection, so there is no stored column for the database to order by.
  const columns: TTableColumn[] = [
    { key: 'employeeCode', label: 'Code', width: 100, type: 'string', name: 'employeeCode', sortField: 'EmployeeCode' },
    { key: 'fullName', label: 'Name', width: 190, type: 'string', name: 'fullName', sortField: 'FullName' },
    { key: 'department', label: 'Department', width: 140, type: 'string', name: 'department', sortField: 'Department' },
    { key: 'designation', label: 'Designation', width: 160, type: 'string', name: 'designation', sortField: 'Designation' },
    { key: 'email', label: 'Email', width: 190, type: 'string', name: 'email', sortField: 'Email' },
    { key: 'openAssignmentCount', label: 'Assets Held', width: 100, name: 'openAssignmentCount' },
    { key: 'isActive', label: 'Active', width: 80, name: 'isActive', sortField: 'IsActive' },
    {
      key: 'actions',
      label: <i className="icon icon-actions text-[10px]" />,
      width: 45,
      canToggle: false,
      name: 'actions',
    },
  ];

  /**
   * The count in the row was a dead end: it told an operator that someone holds four things
   * and gave them no way to find out WHICH four without leaving for the assignments page and
   * filtering it by hand. Open assignments only — the number they clicked counts exactly
   * those, and a list that quietly included returned items would not add up.
   */
  const openHoldings = async (employee: IEmployee) => {
    setHoldingsFor(employee);
    setHoldings([]);
    setHoldingsLoading(true);
    try {
      const res = await fetchAssetAssignments({
        employeeId: employee.id,
        status: AssignmentStatusEnum.Open,
        pageNumber: 1,
        pageSize: 100,
      });
      if (res?.success) {
        setHoldings(unwrapPaged(res).items);
      } else {
        addToast.error(res?.message || 'Failed to load the assets held');
      }
    } catch (error) {
      console.error('Error loading assets held:', error);
      addToast.error('An error occurred while loading the assets held');
    } finally {
      setHoldingsLoading(false);
    }
  };

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
    setFilters((prev) => mergeTableFilters(prev, updates));
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
        <button
          type="button"
          onClick={() => openHoldings(employee)}
          title={`Show the ${employee.openAssignmentCount} asset${employee.openAssignmentCount === 1 ? '' : 's'} ${employee.fullName} holds`}
          className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 hover:text-blue-800"
        >
          {employee.openAssignmentCount}
        </button>
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
        tableHeaderRight={
          <>
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

      {/* What this custodian is actually holding. */}
      <Modal isOpen={!!holdingsFor} onClose={() => setHoldingsFor(null)} size="lg">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            Assets held by {holdingsFor?.fullName}
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            {holdingsFor?.employeeCode ? `${holdingsFor.employeeCode} · ` : ''}
            currently issued and not yet returned.
          </p>

          {holdingsLoading ? (
            <p className="py-8 text-center text-sm text-gray-400">Loading…</p>
          ) : holdings.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              Nothing currently issued.
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3 font-medium">Asset</th>
                    <th className="py-2 pr-3 font-medium">Issued</th>
                    <th className="py-2 pr-3 font-medium">Due back</th>
                    <th className="py-2 font-medium">Condition at issue</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((held) => (
                    <tr key={held.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-2.5 pr-3">
                        <span className="block font-medium text-primarycolor">
                          {held.assetCode}
                        </span>
                        <span className="block text-xs text-gray-500">
                          {held.assetName}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-gray-600">
                        {shortDate(held.assignmentDate) || '—'}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-600">
                        {/* An open-ended issue is not overdue and must not read as a missed
                            date — nothing was ever promised back by one. Tested on the value,
                            not on shortDate's output: it answers null with '—', so the
                            fallback could never have fired. */}
                        {held.expectedReturnDate
                          ? shortDate(held.expectedReturnDate)
                          : 'Open-ended'}
                      </td>
                      <td className="py-2.5 text-gray-600">
                        {held.conditionAtIssueName || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <Button variant="secondary" onClick={() => setHoldingsFor(null)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} size="lg">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            {editing ? 'Edit Custodian' : 'Add Custodian'}
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            {/* The old copy promised HRM integration in the future tense. It has been wired
                for a while — the sync runs nightly — and the heading said "Add" even when
                the row menu had opened this to EDIT someone. */}
            Synced nightly from TulipsHRM for linked companies; standalone
            companies keep their own list.
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
              <i aria-hidden="true" className="icon icon-save text-xs" />
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
