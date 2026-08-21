import { OperationalStatusEnum } from '@/enum/assetEnums';
import {
  MaintenancePriorityEnum,
  MaintenanceRequestStatusEnum,
  MaintenanceRequestTypeEnum,
  WorkOrderOutcomeEnum,
  WorkOrderStatusEnum,
} from '@/enum/maintenanceEnums';
import { ISortFilter } from '@/utils/serviceUtils';

/** Work order raised from a request (id + status), newest first. */
export interface IWorkOrderSummary {
  id: string;
  title: string;
  status: WorkOrderStatusEnum;
}

export interface IMaintenanceRequest {
  id: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  requestType: MaintenanceRequestTypeEnum;
  priority: MaintenancePriorityEnum;
  description: string;
  reportedByEmployeeId?: string | null;
  reportedByEmployeeName?: string | null;
  status: MaintenanceRequestStatusEnum;
  /** True when this request performed the Operational → Breakdown flip. */
  wroteBreakdown: boolean;
  rejectReason?: string | null;
  cancelReason?: string | null;
  convertedOn?: string | null;
  rejectedOn?: string | null;
  cancelledOn?: string | null;
  workOrders: IWorkOrderSummary[];
  createdOn: string;
  /** Base64 rowversion — REQUIRED on convert/reject/cancel (concurrency contract). */
  rowVersion?: string | null;
}

export interface ICreateMaintenanceRequest {
  assetId: string;
  requestType: MaintenanceRequestTypeEnum;
  priority: MaintenancePriorityEnum;
  description: string;
  /** Optional reporting-employee link (display/audit only). */
  reportedByEmployeeId?: string;
}

/**
 * Correcting a request already raised. The ASSET is deliberately absent: pointing a request
 * at a different asset would rewrite what was reported, not correct how it was worded, and
 * the backend refuses it. Wrong asset means withdraw and raise again.
 */
export interface IUpdateMaintenanceRequest {
  requestType: MaintenanceRequestTypeEnum;
  priority: MaintenancePriorityEnum;
  description: string;
  reportedByEmployeeId?: string;
  /** Round-tripped for the concurrency check — 400 when missing, 409 when stale. */
  rowVersion: string;
}

/** Convert seeds the work order from the request; every field is overridable. */
export interface IConvertMaintenanceRequest {
  title?: string;
  priority?: MaintenancePriorityEnum;
  description?: string;
  assignedToEmployeeId?: string;
  vendorId?: string;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  /** The REQUEST's rowVersion. */
  rowVersion: string;
}

export interface IRejectMaintenanceRequest {
  reason: string;
  rowVersion: string;
}

export interface ICancelMaintenanceRequest {
  reason: string;
  rowVersion: string;
}

export interface IMaintenanceRequestFilter extends ISortFilter {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  status?: MaintenanceRequestStatusEnum;
  requestType?: MaintenanceRequestTypeEnum;
  priority?: MaintenancePriorityEnum;
  assetId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface IWorkOrder {
  id: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  /** Null for work orders raised directly (without a request). */
  maintenanceRequestId?: string | null;
  workOrderType: MaintenanceRequestTypeEnum;
  priority: MaintenancePriorityEnum;
  title: string;
  description?: string | null;
  status: WorkOrderStatusEnum;

  assignedToEmployeeId?: string | null;
  assignedToEmployeeName?: string | null;
  vendorId?: string | null;
  vendorName?: string | null;

  scheduledStartDate?: string | null;
  scheduledEndDate?: string | null;

  /** Snapshot taken at start — cancel restores it verbatim. */
  operationalStatusAtStart?: OperationalStatusEnum | null;

  downtimeHours?: number | null;
  laborCost?: number | null;
  partsCost?: number | null;
  externalCost?: number | null;
  totalCost?: number | null;
  currencyId?: string | null;

  conditionAfterId?: string | null;
  conditionAfterName?: string | null;
  completionOutcome?: WorkOrderOutcomeEnum | null;
  completionNotes?: string | null;

  startedOn?: string | null;
  completedOn?: string | null;
  cancelledOn?: string | null;
  cancelReason?: string | null;

  createdOn: string;
  /** Base64 rowversion — REQUIRED on start/complete/cancel (concurrency contract). */
  rowVersion?: string | null;
}

export interface ICreateWorkOrder {
  assetId: string;
  workOrderType: MaintenanceRequestTypeEnum;
  priority: MaintenancePriorityEnum;
  title: string;
  description?: string;
  assignedToEmployeeId?: string;
  vendorId?: string;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
}

/** Start carries only the concurrency token — it takes no operator input. */
export interface IStartWorkOrder {
  rowVersion: string;
}

export interface ICompleteWorkOrder {
  /** Condition re-assessed after the work; written to the asset's condition dimension. */
  conditionAfterId: string;
  outcome: WorkOrderOutcomeEnum;
  downtimeHours?: number;
  laborCost?: number;
  partsCost?: number;
  externalCost?: number;
  /** 3-char ISO code — required when any cost is supplied, normalised away when none is. */
  currencyId?: string;
  completionNotes?: string;
  rowVersion: string;
}

export interface ICancelWorkOrder {
  reason: string;
  rowVersion: string;
}

export interface IWorkOrderFilter extends ISortFilter {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  status?: WorkOrderStatusEnum;
  workOrderType?: MaintenanceRequestTypeEnum;
  priority?: MaintenancePriorityEnum;
  assetId?: string;
  assignedToEmployeeId?: string;
  vendorId?: string;
  fromDate?: string;
  toDate?: string;
}

/**
 * Body of POST /Assets/{id}/release and /recommission — lifting a hold is an
 * accountable act, so the reason is mandatory. The ASSET's rowVersion.
 */
export interface IReleaseAssetHold {
  reason: string;
  rowVersion: string;
}
