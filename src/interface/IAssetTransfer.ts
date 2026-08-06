import { TransferStatusEnum } from '@/enum/transferEnums';
import { ISortFilter } from '@/utils/serviceUtils';

export interface IAssetTransfer {
  id: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  status: TransferStatusEnum;
  reason?: string | null;
  notes?: string | null;
  fromEmployeeId?: string | null;
  fromEmployeeName?: string | null;
  toEmployeeId?: string | null;
  toEmployeeName?: string | null;
  fromAssetLocationId?: string | null;
  fromAssetLocationName?: string | null;
  toAssetLocationId?: string | null;
  toAssetLocationName?: string | null;
  fromBranchId?: string | null;
  toBranchId?: string | null;
  fromDepartmentId?: string | null;
  toDepartmentId?: string | null;
  requestedOn: string;
  approvedOn?: string | null;
  dispatchedOn?: string | null;
  receivedOn?: string | null;
  cancelledOn?: string | null;
  cancelReason?: string | null;
  conditionAtDispatchId?: string | null;
  conditionAtDispatchName?: string | null;
  conditionAtReceiptId?: string | null;
  conditionAtReceiptName?: string | null;
  /** Base64 rowversion — REQUIRED on every transition. */
  rowVersion?: string | null;
}

export interface ICreateAssetTransfer {
  assetId: string;
  toEmployeeId?: string;
  toAssetLocationId?: string;
  toBranchId?: string;
  toDepartmentId?: string;
  reason?: string;
  notes?: string;
}

export interface IAssetTransferFilter extends ISortFilter {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  assetId?: string;
  toEmployeeId?: string;
  status?: TransferStatusEnum;
}
