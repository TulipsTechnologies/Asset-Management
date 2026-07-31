/**
 * Mirrors TulipsHRM.AssetManagement.Domain transfer enums — keep in sync with
 * the backend. Persisted ints; never renumber.
 */

export enum TransferStatusEnum {
  Requested = 1,
  Approved = 2,
  Dispatched = 3,
  Received = 4,
  Cancelled = 5,
}

export const TRANSFER_STATUS_LABELS: Record<number, string> = {
  [TransferStatusEnum.Requested]: 'Requested',
  [TransferStatusEnum.Approved]: 'Approved',
  [TransferStatusEnum.Dispatched]: 'In Transit',
  [TransferStatusEnum.Received]: 'Received',
  [TransferStatusEnum.Cancelled]: 'Cancelled',
};

export const TRANSFER_STATUS_BADGE_CLASSES: Record<number, string> = {
  [TransferStatusEnum.Requested]: 'bg-blue-50 text-blue-700',
  [TransferStatusEnum.Approved]: 'bg-indigo-50 text-indigo-700',
  [TransferStatusEnum.Dispatched]: 'bg-amber-100 text-amber-800',
  [TransferStatusEnum.Received]: 'bg-green-100 text-green-800',
  [TransferStatusEnum.Cancelled]: 'bg-gray-100 text-gray-600',
};

export const ACTIVE_TRANSFER_STATUSES = [
  TransferStatusEnum.Requested,
  TransferStatusEnum.Approved,
  TransferStatusEnum.Dispatched,
];
