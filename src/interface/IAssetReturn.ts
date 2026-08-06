import {
  RecoveryCaseStatusEnum,
  ReturnOutcomeEnum,
  ReturnStatusEnum,
} from '@/enum/returnEnums';
import { ISortFilter } from '@/utils/serviceUtils';

/** Recovery-case summary embedded on a return row. */
export interface IReturnRecoveryCaseSummary {
  id: string;
  status: RecoveryCaseStatusEnum;
  estimatedAmount?: number | null;
  currencyId?: string | null;
}

export interface IAssetReturn {
  id: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  assetAssignmentId: string;
  returnedByEmployeeId: string;
  returnedByEmployeeName: string;
  returnedByEmployeeCode?: string | null;
  returnDate: string;
  status: ReturnStatusEnum;
  notes?: string | null;
  inspectedOn?: string | null;
  conditionAtReturnId?: string | null;
  conditionAtReturnName?: string | null;
  outcome?: ReturnOutcomeEnum | null;
  missingAccessories?: string | null;
  damageNotes?: string | null;
  inspectionNotes?: string | null;
  cancelledOn?: string | null;
  cancelReason?: string | null;
  recoveryCases: IReturnRecoveryCaseSummary[];
  createdOn: string;
  /** Base64 rowversion — REQUIRED on complete/cancel (concurrency contract). */
  rowVersion?: string | null;
}

export interface ICreateAssetReturn {
  assetAssignmentId: string;
  returnDate?: string;
  notes?: string;
  /** The ASSIGNMENT's rowVersion (from the assignments list/detail). */
  rowVersion: string;
}

export interface IReturnRecoveryCaseInput {
  /** Defaults server-side to the returning custodian. */
  employeeId?: string;
  description: string;
  estimatedAmount?: number;
  /** 3-char ISO currency code. */
  currencyId?: string;
  notes?: string;
}

export interface ICompleteAssetReturn {
  conditionAtReturnId: string;
  outcome: ReturnOutcomeEnum;
  missingAccessories?: string;
  damageNotes?: string;
  inspectionNotes?: string;
  recoveryCase?: IReturnRecoveryCaseInput;
  /** The RETURN's rowVersion. */
  rowVersion: string;
}

export interface ICancelAssetReturn {
  reason: string;
  rowVersion: string;
}

export interface IAssetReturnFilter extends ISortFilter {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  status?: ReturnStatusEnum;
  outcome?: ReturnOutcomeEnum;
  assetId?: string;
  employeeId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface IAssetRecoveryCase {
  id: string;
  assetReturnId: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  employeeId: string;
  employeeName: string;
  employeeCode?: string | null;
  description: string;
  estimatedAmount?: number | null;
  currencyId?: string | null;
  status: RecoveryCaseStatusEnum;
  notes?: string | null;
  resolutionNotes?: string | null;
  resolvedOn?: string | null;
  createdOn: string;
  /** Base64 rowversion — REQUIRED on close. */
  rowVersion?: string | null;
}

export interface ICloseAssetRecoveryCase {
  /** RecoveryCaseStatusEnum.Settled (2) or RecoveryCaseStatusEnum.Waived (3). */
  resolution: RecoveryCaseStatusEnum;
  resolutionNotes?: string;
  rowVersion: string;
}

export interface IAssetRecoveryCaseFilter extends ISortFilter {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  status?: RecoveryCaseStatusEnum;
  employeeId?: string;
  assetId?: string;
}
