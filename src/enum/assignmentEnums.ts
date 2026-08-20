/**
 * Mirrors TulipsHRM.AssetManagement.Domain assignment enums — keep in sync
 * with the backend. Persisted ints; never renumber.
 */

export enum AssigneeTypeEnum {
  Employee = 1,
  Department = 2,
  Branch = 3,
  Location = 4,
  Contractor = 5,
  Project = 6,
}

export enum AssignmentStatusEnum {
  Open = 1,
  Returned = 2,
  /** Closed because custody moved to another employee via a transfer. */
  Transferred = 3,
}

export const ASSIGNMENT_STATUS_LABELS: Record<number, string> = {
  [AssignmentStatusEnum.Open]: 'Open',
  [AssignmentStatusEnum.Returned]: 'Returned',
  [AssignmentStatusEnum.Transferred]: 'Transferred',
};

export const ASSIGNMENT_STATUS_BADGE_CLASSES: Record<number, string> = {
  [AssignmentStatusEnum.Open]: 'bg-green-100 text-green-800',
  [AssignmentStatusEnum.Returned]: 'bg-gray-100 text-gray-800',
  [AssignmentStatusEnum.Transferred]: 'bg-amber-100 text-amber-800',
};
