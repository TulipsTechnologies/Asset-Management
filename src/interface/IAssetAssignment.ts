import { AssigneeTypeEnum, AssignmentStatusEnum } from '@/enum/assignmentEnums';

export interface IAssetAssignment {
  id: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  assigneeType: AssigneeTypeEnum;
  employeeId: string;
  employeeName: string;
  employeeCode?: string | null;
  assignmentDate: string;
  expectedReturnDate?: string | null;
  conditionAtIssueId: string;
  conditionAtIssueName: string;
  accessories?: string | null;
  handoverNotes?: string | null;
  status: AssignmentStatusEnum;
  returnedDate?: string | null;
  conditionAtReturnId?: string | null;
  conditionAtReturnName?: string | null;
  returnNotes?: string | null;
  createdOn: string;
  /** Base64 rowversion — round-trip unchanged on return (concurrency contract). */
  rowVersion?: string | null;
}

export interface ICreateAssetAssignment {
  assetId: string;
  employeeId: string;
  assignmentDate?: string;
  expectedReturnDate?: string;
  conditionAtIssueId: string;
  accessories?: string;
  handoverNotes?: string;
}

export interface IReturnAssetAssignment {
  returnedDate?: string;
  conditionAtReturnId: string;
  returnNotes?: string;
  rowVersion?: string | null;
}

export interface IAssetAssignmentFilter {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  assetId?: string;
  employeeId?: string;
  status?: AssignmentStatusEnum;
}

/* ------------------------------------------------------------------------- */
/* Bulk assignment — one employee, many assets                               */
/* ------------------------------------------------------------------------- */

/**
 * A row in the bulk picker. `eligible` is advisory: it describes the asset when the
 * feed was built, and the server re-checks on submit, so a row that looked issuable
 * can still come back blocked.
 */
export interface IAssignableAsset {
  id: string;
  assetCode: string;
  assetTag?: string | null;
  assetName: string;
  assetCategoryName: string;
  serialNumber?: string | null;
  assetLocationName?: string | null;
  assetConditionTypeId: string;
  conditionName: string;
  custodyStatus: number;
  eligible: boolean;
  /** Why it cannot be issued right now; null when it can. */
  blockedReason?: string | null;
}

export interface IAssignableAssetFilter {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  assetCategoryId?: string;
  /** Also return blocked assets, each carrying its reason. */
  includeIneligible?: boolean;
  /** Rehydrate a specific selection (retrying the remainder of a partial batch). */
  assetIds?: string[];
}

export interface IBulkAssignItem {
  assetId: string;
  conditionAtIssueId?: string;
  accessories?: string;
  handoverNotes?: string;
}

export interface IBulkAssignAssets {
  employeeId: string;
  assignmentDate?: string;
  expectedReturnDate?: string;
  conditionAtIssueId?: string;
  accessories?: string;
  handoverNotes?: string;
  items: IBulkAssignItem[];
}

/** Mirrors BulkAssignOutcomeEnum on the server. */
export enum BulkAssignOutcomeEnum {
  Assigned = 1,
  AlreadyAssigned = 2,
  Blocked = 3,
  NotFound = 4,
  Conflict = 5,
}

export interface IBulkAssignOutcome {
  assetId: string;
  /** Withheld when the asset was not found, so the client supplies the label. */
  assetCode?: string | null;
  outcome: BulkAssignOutcomeEnum;
  message: string;
  assignmentId?: string | null;
}

export interface IBulkAssignResult {
  employeeId: string;
  employeeName: string;
  requested: number;
  assigned: number;
  alreadyAssigned: number;
  failed: number;
  outcomes: IBulkAssignOutcome[];
}
