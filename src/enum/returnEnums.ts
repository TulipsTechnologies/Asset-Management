/**
 * Mirrors TulipsHRM.AssetManagement.Domain return/recovery enums — keep in
 * sync with the backend. Persisted ints; never renumber.
 */

export enum ReturnStatusEnum {
  Initiated = 1,
  Completed = 2,
  Cancelled = 3,
}

export enum ReturnOutcomeEnum {
  Available = 1,
  Repair = 2,
  Quarantine = 3,
  Missing = 4,
  DisposalRecommended = 5,
}

export enum RecoveryCaseStatusEnum {
  Open = 1,
  Settled = 2,
  Waived = 3,
}

export const RETURN_STATUS_LABELS: Record<number, string> = {
  [ReturnStatusEnum.Initiated]: 'Pending Inspection',
  [ReturnStatusEnum.Completed]: 'Completed',
  [ReturnStatusEnum.Cancelled]: 'Cancelled',
};

export const RETURN_STATUS_BADGE_CLASSES: Record<number, string> = {
  [ReturnStatusEnum.Initiated]: 'bg-amber-100 text-amber-800',
  [ReturnStatusEnum.Completed]: 'bg-green-100 text-green-800',
  [ReturnStatusEnum.Cancelled]: 'bg-gray-100 text-gray-800',
};

export const RETURN_OUTCOME_LABELS: Record<number, string> = {
  [ReturnOutcomeEnum.Available]: 'Available',
  [ReturnOutcomeEnum.Repair]: 'Repair',
  [ReturnOutcomeEnum.Quarantine]: 'Quarantine',
  [ReturnOutcomeEnum.Missing]: 'Missing',
  [ReturnOutcomeEnum.DisposalRecommended]: 'Disposal Recommended',
};

/** Distinct colors — Missing red-ish, Available green-ish. */
export const RETURN_OUTCOME_BADGE_CLASSES: Record<number, string> = {
  [ReturnOutcomeEnum.Available]: 'bg-green-100 text-green-800',
  [ReturnOutcomeEnum.Repair]: 'bg-amber-100 text-amber-800',
  [ReturnOutcomeEnum.Quarantine]: 'bg-purple-100 text-purple-800',
  [ReturnOutcomeEnum.Missing]: 'bg-red-100 text-red-800',
  [ReturnOutcomeEnum.DisposalRecommended]: 'bg-gray-100 text-gray-800',
};

/** What completing a return with each outcome does to the asset. */
export const RETURN_OUTCOME_EFFECTS: Record<number, string> = {
  [ReturnOutcomeEnum.Available]: 'Asset goes back into circulation.',
  [ReturnOutcomeEnum.Repair]:
    'Asset operational status becomes Under Maintenance.',
  [ReturnOutcomeEnum.Quarantine]: 'Asset operational status becomes Quarantined.',
  [ReturnOutcomeEnum.Missing]:
    'Asset custody becomes Missing and verification becomes Discrepancy.',
  [ReturnOutcomeEnum.DisposalRecommended]:
    'Asset operational status becomes Out Of Service.',
};

export const RECOVERY_CASE_STATUS_LABELS: Record<number, string> = {
  [RecoveryCaseStatusEnum.Open]: 'Open',
  [RecoveryCaseStatusEnum.Settled]: 'Settled',
  [RecoveryCaseStatusEnum.Waived]: 'Waived',
};

export const RECOVERY_CASE_STATUS_BADGE_CLASSES: Record<number, string> = {
  [RecoveryCaseStatusEnum.Open]: 'bg-red-50 text-red-800',
  [RecoveryCaseStatusEnum.Settled]: 'bg-green-100 text-green-800',
  [RecoveryCaseStatusEnum.Waived]: 'bg-gray-100 text-gray-800',
};
