/**
 * Mirrors TulipsHRM.AssetManagement.Domain maintenance enums — keep in sync
 * with the backend. Persisted ints; never renumber.
 */

export enum MaintenanceRequestTypeEnum {
  Corrective = 1,
  Preventive = 2,
  /** The asset has failed — reporting one flips Operational → Breakdown. */
  Breakdown = 3,
  Inspection = 4,
  Calibration = 5,
}

export enum MaintenancePriorityEnum {
  Low = 1,
  Medium = 2,
  High = 3,
  Critical = 4,
}

/**
 * Request lifecycle. Converted is NOT terminal: cancelling the work order a
 * request produced reopens it (phase design §3.5).
 */
export enum MaintenanceRequestStatusEnum {
  Open = 1,
  Converted = 2,
  Rejected = 3,
  Cancelled = 4,
}

/** Open → InProgress → Completed; Cancelled from either active state. */
export enum WorkOrderStatusEnum {
  Open = 1,
  InProgress = 2,
  Completed = 3,
  Cancelled = 4,
}

export enum WorkOrderOutcomeEnum {
  ReturnedToService = 1,
  Quarantined = 2,
  OutOfService = 3,
}

export const MAINTENANCE_REQUEST_TYPE_LABELS: Record<number, string> = {
  [MaintenanceRequestTypeEnum.Corrective]: 'Corrective',
  [MaintenanceRequestTypeEnum.Preventive]: 'Preventive',
  [MaintenanceRequestTypeEnum.Breakdown]: 'Breakdown',
  [MaintenanceRequestTypeEnum.Inspection]: 'Inspection',
  [MaintenanceRequestTypeEnum.Calibration]: 'Calibration',
};

/** Breakdown red — it is the one type that writes the asset's status. */
export const MAINTENANCE_REQUEST_TYPE_BADGE_CLASSES: Record<number, string> = {
  [MaintenanceRequestTypeEnum.Corrective]: 'bg-blue-50 text-blue-700',
  [MaintenanceRequestTypeEnum.Preventive]: 'bg-green-100 text-green-800',
  [MaintenanceRequestTypeEnum.Breakdown]: 'bg-red-100 text-red-700',
  [MaintenanceRequestTypeEnum.Inspection]: 'bg-purple-100 text-purple-800',
  [MaintenanceRequestTypeEnum.Calibration]: 'bg-gray-100 text-gray-700',
};

export const MAINTENANCE_PRIORITY_LABELS: Record<number, string> = {
  [MaintenancePriorityEnum.Low]: 'Low',
  [MaintenancePriorityEnum.Medium]: 'Medium',
  [MaintenancePriorityEnum.High]: 'High',
  [MaintenancePriorityEnum.Critical]: 'Critical',
};

export const MAINTENANCE_PRIORITY_BADGE_CLASSES: Record<number, string> = {
  [MaintenancePriorityEnum.Low]: 'bg-gray-100 text-gray-600',
  [MaintenancePriorityEnum.Medium]: 'bg-blue-50 text-blue-700',
  [MaintenancePriorityEnum.High]: 'bg-amber-100 text-amber-800',
  [MaintenancePriorityEnum.Critical]: 'bg-red-100 text-red-700',
};

export const MAINTENANCE_REQUEST_STATUS_LABELS: Record<number, string> = {
  [MaintenanceRequestStatusEnum.Open]: 'Open',
  [MaintenanceRequestStatusEnum.Converted]: 'Converted',
  [MaintenanceRequestStatusEnum.Rejected]: 'Rejected',
  [MaintenanceRequestStatusEnum.Cancelled]: 'Withdrawn',
};

export const MAINTENANCE_REQUEST_STATUS_BADGE_CLASSES: Record<number, string> = {
  [MaintenanceRequestStatusEnum.Open]: 'bg-amber-100 text-amber-800',
  [MaintenanceRequestStatusEnum.Converted]: 'bg-blue-50 text-blue-700',
  [MaintenanceRequestStatusEnum.Rejected]: 'bg-red-100 text-red-700',
  [MaintenanceRequestStatusEnum.Cancelled]: 'bg-gray-100 text-gray-600',
};

export const WORK_ORDER_STATUS_LABELS: Record<number, string> = {
  [WorkOrderStatusEnum.Open]: 'Open',
  [WorkOrderStatusEnum.InProgress]: 'In Progress',
  [WorkOrderStatusEnum.Completed]: 'Completed',
  [WorkOrderStatusEnum.Cancelled]: 'Cancelled',
};

export const WORK_ORDER_STATUS_BADGE_CLASSES: Record<number, string> = {
  [WorkOrderStatusEnum.Open]: 'bg-amber-100 text-amber-800',
  [WorkOrderStatusEnum.InProgress]: 'bg-blue-50 text-blue-700',
  [WorkOrderStatusEnum.Completed]: 'bg-green-100 text-green-800',
  [WorkOrderStatusEnum.Cancelled]: 'bg-gray-100 text-gray-600',
};

export const WORK_ORDER_OUTCOME_LABELS: Record<number, string> = {
  [WorkOrderOutcomeEnum.ReturnedToService]: 'Returned To Service',
  [WorkOrderOutcomeEnum.Quarantined]: 'Quarantined',
  [WorkOrderOutcomeEnum.OutOfService]: 'Out Of Service',
};

export const WORK_ORDER_OUTCOME_BADGE_CLASSES: Record<number, string> = {
  [WorkOrderOutcomeEnum.ReturnedToService]: 'bg-green-100 text-green-800',
  [WorkOrderOutcomeEnum.Quarantined]: 'bg-purple-100 text-purple-800',
  [WorkOrderOutcomeEnum.OutOfService]: 'bg-gray-200 text-gray-700',
};

/**
 * What completing a work order with each outcome does to the asset. The two
 * "park" outcomes are refused while the asset sits in someone's custody — a
 * hold must not be erasable by a routine return (phase design §3.3).
 */
export const WORK_ORDER_OUTCOME_EFFECTS: Record<number, string> = {
  [WorkOrderOutcomeEnum.ReturnedToService]: 'Asset goes back to Operational',
  [WorkOrderOutcomeEnum.Quarantined]:
    'Asset is held out of service (refused while it is in someone’s custody or has a return pending)',
  [WorkOrderOutcomeEnum.OutOfService]:
    'Asset is parked out of service (same custody restriction)',
};

/**
 * Surfaced under the request-type picker: the Breakdown type is the module's
 * one non-administrative status writer, so the flip only happens from
 * Operational and only for the asset's own custodian or a manager.
 */
export const BREAKDOWN_REPORT_NOTE =
  'Reporting a Breakdown also sets the asset’s operational status to Breakdown — but only from Operational, and only when you are its current custodian or hold a manage permission. Rejecting or withdrawing the report puts it back in service when nothing else is holding it down.';
