'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Providers/ToastProvider';
import Button from '@/components/UI/Button';
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
import FilterPanel from '@/components/UI/FilterPanel';
import SearchBox from '@/components/SearchBox';
import Pagination from '@/components/UI/Pagination';
import {
  IAssetAssignment,
  IAssetAssignmentFilter,
} from '@/interface/IAssetAssignment';
import { IAssetListItem } from '@/interface/IAsset';
import { IEmployee } from '@/interface/IEmployee';
import {
  assignAsset,
  fetchAssetAssignments,
  returnAsset,
} from '@/services/assetAssignment.service';
import { fetchAssets } from '@/services/asset.service';
import { fetchEmployees } from '@/services/employee.service';
import { unwrapPaged } from '@/utils/serviceUtils';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';
import {
  ASSET_CONDITIONS,
  CustodyStatusEnum,
  LifecycleStatusEnum,
} from '@/enum/assetEnums';
import {
  ASSIGNMENT_STATUS_BADGE_CLASSES,
  ASSIGNMENT_STATUS_LABELS,
  AssignmentStatusEnum,
} from '@/enum/assignmentEnums';
import useDebounce from '@/hooks/useDebounce';

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString() : '—';

type TAssignForm = {
  assetId: string;
  employeeId: string;
  assignmentDate: string;
  expectedReturnDate: string;
  conditionAtIssueId: string;
  accessories: string;
  handoverNotes: string;
};

const emptyAssignForm: TAssignForm = {
  assetId: '',
  employeeId: '',
  assignmentDate: '',
  expectedReturnDate: '',
  conditionAtIssueId: '',
  accessories: '',
  handoverNotes: '',
};

const AssignmentsPage = () => {
  const { addToast } = useToast();
  const router = useRouter();

  const [assignments, setAssignments] = useState<IAssetAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  const [filters, setFilters] = useState<IAssetAssignmentFilter>({
    pageNumber: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 400);
  const [showFilters, setShowFilters] = useState(false);

  const [employees, setEmployees] = useState<IEmployee[]>([]);

  // Assign modal
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignableAssets, setAssignableAssets] = useState<IAssetListItem[]>([]);
  const [assignForm, setAssignForm] = useState<TAssignForm>(emptyAssignForm);
  const [assignError, setAssignError] = useState('');
  const [saving, setSaving] = useState(false);

  // Return modal
  const [returning, setReturning] = useState<IAssetAssignment | null>(null);
  const [returnConditionId, setReturnConditionId] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnSaving, setReturnSaving] = useState(false);

  const columns: TTableColumn[] = [
    { key: 'assetCode', label: 'Asset', width: 130, type: 'string', name: 'assetCode' },
    { key: 'assetName', label: 'Name', width: 190, type: 'string', name: 'assetName' },
    { key: 'employeeName', label: 'Custodian', width: 170, type: 'string', name: 'employeeName' },
    { key: 'assignmentDate', label: 'Assigned', width: 110, name: 'assignmentDate' },
    { key: 'expectedReturnDate', label: 'Expected Return', width: 130, name: 'expectedReturnDate' },
    { key: 'conditionAtIssueName', label: 'Condition @ Issue', width: 130, type: 'string', name: 'conditionAtIssueName' },
    { key: 'status', label: 'Status', width: 100, name: 'status' },
    {
      key: 'actions',
      label: <i className="icon icon-actions text-[10px]" />,
      width: 45,
      canToggle: false,
      name: 'actions',
    },
  ];

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAssetAssignments(filters);
      if (res?.success) {
        const paged = unwrapPaged(res);
        setAssignments(paged.items);
        setRowCount(paged.rowCount);
        setPageCount(paged.pageCount);
      } else {
        addToast.error(res?.message || 'Failed to fetch assignments');
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
      addToast.error('An error occurred while fetching assignments');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  useEffect(() => {
    fetchEmployees({ pageNumber: 1, pageSize: 500, isActive: true })
      .then((res) => {
        if (res?.success) setEmployees(unwrapPaged(res).items);
      })
      .catch(() => undefined);
  }, []);

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

  const openAssign = async () => {
    setAssignForm(emptyAssignForm);
    setAssignError('');
    setAssignOpen(true);
    try {
      // Only Active + Unassigned assets can be issued.
      const res = await fetchAssets({
        pageNumber: 1,
        pageSize: 500,
        lifecycleStatus: LifecycleStatusEnum.Active,
        custodyStatus: CustodyStatusEnum.Unassigned,
      });
      if (res?.success) setAssignableAssets(unwrapPaged(res).items);
    } catch {
      addToast.error('Failed to load assignable assets');
    }
  };

  const handleAssign = async () => {
    if (!assignForm.assetId || !assignForm.employeeId || !assignForm.conditionAtIssueId) {
      setAssignError('Asset, employee and condition are required');
      return;
    }
    setSaving(true);
    try {
      const res = await assignAsset({
        assetId: assignForm.assetId,
        employeeId: assignForm.employeeId,
        assignmentDate: assignForm.assignmentDate || undefined,
        expectedReturnDate: assignForm.expectedReturnDate || undefined,
        conditionAtIssueId: assignForm.conditionAtIssueId,
        accessories: assignForm.accessories.trim() || undefined,
        handoverNotes: assignForm.handoverNotes.trim() || undefined,
      });
      if (res?.success) {
        addToast.success(res.message || 'Asset assigned');
        setAssignOpen(false);
        loadAssignments();
      } else {
        addToast.error(res?.message || 'Failed to assign the asset');
      }
    } catch (error) {
      console.error('Error assigning asset:', error);
      addToast.error('An error occurred while assigning the asset');
    } finally {
      setSaving(false);
    }
  };

  const openReturn = (assignment: IAssetAssignment) => {
    setReturning(assignment);
    setReturnConditionId('');
    // Local "today" — the user can adjust; avoids UTC-offset surprises.
    setReturnDate(new Date().toLocaleDateString('en-CA'));
    setReturnNotes('');
  };

  const handleReturn = async () => {
    if (!returning || !returnConditionId) return;
    setReturnSaving(true);
    try {
      const res = await returnAsset(returning.id, {
        returnedDate: returnDate || undefined,
        conditionAtReturnId: returnConditionId,
        returnNotes: returnNotes.trim() || undefined,
        rowVersion: returning.rowVersion,
      });
      if (res?.success) {
        addToast.success(res.message || 'Asset returned');
        setReturning(null);
        loadAssignments();
      } else {
        // Stale row (already returned / modified elsewhere): close the modal and
        // refresh so a retry never loops on the same stale payload.
        addToast.error(res?.message || 'Failed to return the asset');
        setReturning(null);
        loadAssignments();
      }
    } catch (error) {
      console.error('Error returning asset:', error);
      addToast.error('An error occurred while returning the asset');
      setReturning(null);
      loadAssignments();
    } finally {
      setReturnSaving(false);
    }
  };

  const rowData = assignments.map((assignment) => ({
    id: assignment.id,
    assetCode: (
      <span className="font-medium text-primarycolor">
        {assignment.assetCode}
      </span>
    ),
    assetName: assignment.assetName,
    employeeName: (
      <span>
        {assignment.employeeName}
        {assignment.employeeCode && (
          <span className="text-xs text-gray-400 ml-1">
            ({assignment.employeeCode})
          </span>
        )}
      </span>
    ),
    assignmentDate: formatDate(assignment.assignmentDate),
    expectedReturnDate: formatDate(assignment.expectedReturnDate),
    conditionAtIssueName: assignment.conditionAtIssueName,
    status: (
      <span
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          ASSIGNMENT_STATUS_BADGE_CLASSES[assignment.status] ??
          'bg-gray-100 text-gray-700'
        }`}
      >
        {ASSIGNMENT_STATUS_LABELS[assignment.status] ?? assignment.status}
      </span>
    ),
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
            {
              label: 'View Asset',
              icon: <i className="icon icon-eye text-sm" />,
              action: () => router.push(`/assets/${assignment.assetId}`),
            },
            ...(assignment.status === AssignmentStatusEnum.Open
              ? [
                  {
                    label: 'Return',
                    icon: <i className="icon icon-redo text-sm" />,
                    action: () => openReturn(assignment),
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
      <CustomTable
        columns={columns}
        rows={rowData}
        tableName="Assignments"
        serialOffset={
          ((filters.pageNumber ?? 1) - 1) *
          (filters.pageSize ?? DEFAULT_PAGE_SIZE)
        }
        isLoading={loading}
        entityLabel="assignment"
        tableHeaderLeft={
          <Button onClick={openAssign}>
            <i className="icon icon-plus text-xs"></i>
            <span>Assign Asset</span>
          </Button>
        }
        tableHeaderRight={
          <>
            <FilterPanel
              open={showFilters}
              onOpenChange={setShowFilters}
              activeCount={
                [filters.status, filters.employeeId].filter((v) => v != null)
                  .length
              }
              onClearAll={() =>
                setFilters((prev) => ({
                  ...prev,
                  status: undefined,
                  employeeId: undefined,
                  pageNumber: 1,
                }))
              }
            >
              <Select
                label="Status"
                placeholder="All"
                options={[
                  { value: String(AssignmentStatusEnum.Open), label: 'Open' },
                  {
                    value: String(AssignmentStatusEnum.Returned),
                    label: 'Returned',
                  },
                  {
                    value: String(AssignmentStatusEnum.Transferred),
                    label: 'Transferred',
                  },
                ]}
                value={filters.status != null ? String(filters.status) : ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    status: e.target.value
                      ? (Number(e.target.value) as AssignmentStatusEnum)
                      : undefined,
                    pageNumber: 1,
                  }))
                }
              />
              <Select
                label="Custodian"
                placeholder="All employees"
                options={employees.map((e) => ({
                  value: e.id,
                  label: e.fullName,
                }))}
                value={filters.employeeId ?? ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    employeeId: e.target.value || undefined,
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

      {/* Assign modal */}
      <Modal isOpen={assignOpen} onClose={() => setAssignOpen(false)} size="lg">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-4">
            Assign Asset
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <Select
              label="Asset"
              required
              placeholder="Select an Active, unassigned asset"
              options={assignableAssets.map((a) => ({
                value: a.id,
                label: `${a.assetCode} — ${a.assetName}`,
              }))}
              value={assignForm.assetId}
              onChange={(e) => {
                setAssignForm((prev) => ({ ...prev, assetId: e.target.value }));
                setAssignError('');
              }}
            />
            <Select
              label="Employee"
              required
              placeholder="Select custodian"
              options={employees.map((e) => ({
                value: e.id,
                label: e.employeeCode
                  ? `${e.fullName} (${e.employeeCode})`
                  : e.fullName,
              }))}
              value={assignForm.employeeId}
              onChange={(e) => {
                setAssignForm((prev) => ({
                  ...prev,
                  employeeId: e.target.value,
                }));
                setAssignError('');
              }}
            />
            <Select
              label="Condition at Issue"
              required
              placeholder="Select condition"
              options={ASSET_CONDITIONS.map((c) => ({
                value: c.id,
                label: c.name,
              }))}
              value={assignForm.conditionAtIssueId}
              onChange={(e) => {
                setAssignForm((prev) => ({
                  ...prev,
                  conditionAtIssueId: e.target.value,
                }));
                setAssignError('');
              }}
            />
            <Input
              label="Assignment Date"
              type="date"
              value={assignForm.assignmentDate}
              onChange={(e) =>
                setAssignForm((prev) => ({
                  ...prev,
                  assignmentDate: e.target.value,
                }))
              }
            />
            <Input
              label="Expected Return"
              type="date"
              value={assignForm.expectedReturnDate}
              onChange={(e) =>
                setAssignForm((prev) => ({
                  ...prev,
                  expectedReturnDate: e.target.value,
                }))
              }
            />
            <Input
              label="Accessories"
              value={assignForm.accessories}
              onChange={(e) =>
                setAssignForm((prev) => ({
                  ...prev,
                  accessories: e.target.value,
                }))
              }
              placeholder="Charger, bag, dock…"
            />
            <div className="md:col-span-2">
              <TextArea
                label="Handover Notes"
                value={assignForm.handoverNotes}
                onChange={(e) =>
                  setAssignForm((prev) => ({
                    ...prev,
                    handoverNotes: e.target.value,
                  }))
                }
                rows={2}
              />
            </div>
          </div>
          {assignError && (
            <p className="text-sm text-red-600 mt-3">{assignError}</p>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={saving}>
              {saving ? 'Assigning…' : 'Assign'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Return modal */}
      <Modal
        isOpen={returning !== null}
        onClose={() => setReturning(null)}
        size="md"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            Return Asset
          </h2>
          {returning && (
            <p className="text-sm text-gray-500 mb-4">
              {returning.assetCode} — {returning.assetName} from{' '}
              {returning.employeeName}
            </p>
          )}
          <div className="grid grid-cols-1 gap-y-5">
            <Input
              label="Returned Date"
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
            />
            <Select
              label="Condition at Return"
              required
              placeholder="Select condition"
              options={ASSET_CONDITIONS.map((c) => ({
                value: c.id,
                label: c.name,
              }))}
              value={returnConditionId}
              onChange={(e) => setReturnConditionId(e.target.value)}
            />
            <TextArea
              label="Return Notes"
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
              rows={2}
              placeholder="Damage, missing accessories…"
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setReturning(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleReturn}
              disabled={returnSaving || !returnConditionId}
            >
              {returnSaving ? 'Returning…' : 'Confirm Return'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AssignmentsPage;
