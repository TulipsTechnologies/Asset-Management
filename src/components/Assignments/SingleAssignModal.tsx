'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/UI/Button';
import Modal from '@/components/UI/Modal';
import Input from '@/components/UI/Input';
import Select from '@/components/UI/Select';
import TextArea from '@/components/UI/TextArea';
import { useToast } from '@/components/Providers/ToastProvider';
import { IEmployee } from '@/interface/IEmployee';
import { assignAsset } from '@/services/assetAssignment.service';
import useAssetConditions from '@/hooks/useAssetConditions';

/**
 * Issue ONE known asset to one person.
 *
 * There is no asset picker here, because the asset is not in question — this opens from a
 * row that already names it. The old version on the assignments page had to ask, since it
 * started from nothing; starting from the asset removes the step that was the whole reason
 * the flow felt long.
 *
 * The eligibility of the asset is the server's call. The row that opens this hides itself
 * for anything obviously unassignable, but only the assign endpoint knows about operational
 * holds, active transfers, pending returns and approved disposals — so a refusal is shown
 * as it comes back rather than pre-judged here.
 */

export interface IAssignTarget {
  id: string;
  assetCode: string;
  assetName: string;
}

interface IProps {
  isOpen: boolean;
  onClose: () => void;
  asset: IAssignTarget | null;
  employees: IEmployee[];
  /** Raised after a successful assign so the caller can reload. */
  onAssigned: () => void;
}

const SingleAssignModal = ({ isOpen, onClose, asset, employees, onAssigned }: IProps) => {
  const { addToast } = useToast();
  const { options: conditionOptions, emptyText: conditionEmptyText } = useAssetConditions();

  const [employeeId, setEmployeeId] = useState('');
  const [conditionAtIssueId, setConditionAtIssueId] = useState('');
  const [assignmentDate, setAssignmentDate] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [accessories, setAccessories] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Cleared on every open, so the previous handover's notes never ride along to the next.
  useEffect(() => {
    if (!isOpen) return;
    setEmployeeId('');
    setConditionAtIssueId('');
    setAssignmentDate('');
    setExpectedReturnDate('');
    setAccessories('');
    setHandoverNotes('');
    setError('');
  }, [isOpen]);

  const submit = async () => {
    if (!asset) return;
    if (!employeeId || !conditionAtIssueId) {
      setError('Choose who is receiving it and the condition it is going out in.');
      return;
    }

    setSaving(true);
    try {
      const res = await assignAsset({
        assetId: asset.id,
        employeeId,
        assignmentDate: assignmentDate || undefined,
        expectedReturnDate: expectedReturnDate || undefined,
        conditionAtIssueId,
        accessories: accessories.trim() || undefined,
        handoverNotes: handoverNotes.trim() || undefined,
      });

      if (res?.success) {
        addToast.success(res.message || 'Asset assigned');
        onClose();
        onAssigned();
        return;
      }

      /*
       * Kept open with the reason inline rather than closed with a toast. A refusal here is
       * usually actionable — wrong custodian, an asset on hold — and closing would throw
       * away everything typed to reach it.
       */
      setError(res?.message || 'The asset could not be assigned.');
    } catch {
      setError('Something went wrong while assigning the asset.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={saving ? () => undefined : onClose} showCloseBtn={!saving} size="lg">
      <div className="p-5">
        <h2 className="text-lg font-semibold text-secondaryColor">Assign Asset</h2>
        {asset && (
          <p className="text-sm text-gray-500 mt-0.5">
            <span className="font-semibold text-primarycolor">{asset.assetCode}</span> ·{' '}
            {asset.assetName}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <Select
            label="Assign to"
            required
            placeholder="Select an employee"
            options={employees.map((employee) => ({
              value: employee.id,
              label: employee.employeeCode
                ? `${employee.fullName} (${employee.employeeCode})`
                : employee.fullName,
            }))}
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          />
          <Select
            label="Condition at issue"
            required
            placeholder="Select a condition"
            options={conditionOptions}
            emptyText={conditionEmptyText}
            value={conditionAtIssueId}
            onChange={(e) => setConditionAtIssueId(e.target.value)}
          />
          <Input
            label="Assignment date"
            type="date"
            value={assignmentDate}
            onChange={(e) => setAssignmentDate(e.target.value)}
            helperText="Defaults to today"
          />
          <Input
            label="Expected return date"
            type="date"
            value={expectedReturnDate}
            onChange={(e) => setExpectedReturnDate(e.target.value)}
            helperText="Leave blank for open-ended"
          />
          <Input
            label="Accessories"
            placeholder="Charger, bag, cable"
            value={accessories}
            onChange={(e) => setAccessories(e.target.value)}
          />
          <TextArea
            label="Handover notes"
            rows={2}
            value={handoverNotes}
            onChange={(e) => setHandoverNotes(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <div className="flex justify-end gap-3 mt-5">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Assigning…' : 'Assign'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default SingleAssignModal;
