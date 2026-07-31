import {
  CustodyStatusEnum,
  FinancialStatusEnum,
  LifecycleStatusEnum,
  OperationalStatusEnum,
  OwnershipTypeEnum,
  VerificationStatusEnum,
} from '@/enum/assetEnums';

export interface IAssetListItem {
  id: string;
  assetCode: string;
  assetTag?: string | null;
  assetName: string;
  assetCategoryId: string;
  assetCategoryName: string;
  serialNumber?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  ownershipType: OwnershipTypeEnum;
  purchaseDate?: string | null;
  purchaseCost?: number | null;
  currencyId?: string | null;
  lifecycleStatus: LifecycleStatusEnum;
  custodyStatus: CustodyStatusEnum;
  operationalStatus: OperationalStatusEnum;
  financialStatus: FinancialStatusEnum;
  verificationStatus: VerificationStatusEnum;
  conditionName: string;
  assetLocationName?: string | null;
  currentCustodianEmployeeId?: string | null;
  /** Base64 rowversion — round-trip unchanged on future updates (concurrency contract). */
  rowVersion?: string | null;
}

export interface IAsset extends IAssetListItem {
  brand?: string | null;
  description?: string | null;
  notes?: string | null;
  assetClassId?: string | null;
  assetClassName?: string | null;
  assetTypeId?: string | null;
  assetTypeName?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  invoiceNumber?: string | null;
  purchaseOrderReference?: string | null;
  receiptDate?: string | null;
  commissioningDate?: string | null;
  placedInServiceDate?: string | null;
  branchId?: string | null;
  departmentId?: string | null;
  assetLocationId?: string | null;
  parentAssetId?: string | null;
  parentAssetCode?: string | null;
  warrantyStartDate?: string | null;
  warrantyEndDate?: string | null;
  insurancePolicyNumber?: string | null;
  insuranceExpiryDate?: string | null;
  assetConditionTypeId: string;
  createdOn: string;
  modifiedOn?: string | null;
}

export interface ICreateAsset {
  assetName: string;
  assetCategoryId: string;
  assetConditionTypeId: string;
  assetTag?: string;
  manufacturer?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  description?: string;
  notes?: string;
  ownershipType?: OwnershipTypeEnum;
  purchaseDate?: string;
  purchaseCost?: number;
  currencyId?: string;
  invoiceNumber?: string;
  purchaseOrderReference?: string;
  receiptDate?: string;
  commissioningDate?: string;
  placedInServiceDate?: string;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  insurancePolicyNumber?: string;
  insuranceExpiryDate?: string;
}

export interface IAssetFilter {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  assetCategoryId?: string;
  lifecycleStatus?: LifecycleStatusEnum;
  custodyStatus?: CustodyStatusEnum;
  operationalStatus?: OperationalStatusEnum;
  financialStatus?: FinancialStatusEnum;
  verificationStatus?: VerificationStatusEnum;
  ownershipType?: OwnershipTypeEnum;
}
