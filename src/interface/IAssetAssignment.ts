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
