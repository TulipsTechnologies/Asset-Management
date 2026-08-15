import {
  CustodyStatusEnum,
  FinancialStatusEnum,
  LifecycleStatusEnum,
  OperationalStatusEnum,
  OwnershipTypeEnum,
  VerificationStatusEnum,
} from '@/enum/assetEnums';
import { ISortFilter } from '@/utils/serviceUtils';

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
  /** Free-text physical size as supplied, e.g. "39.5in L, 39.5in W, 16in H". */
  dimension?: string | null;
  assetLocationName?: string | null;
  currentCustodianEmployeeId?: string | null;
  /** Who holds the asset right now — null while it is unassigned. */
  currentCustodianEmployeeName?: string | null;
  /** From the asset's book — null until capitalized. */
  accumulatedDepreciation?: number | null;
  /** Book cost minus accumulated depreciation — null until capitalized. */
  netBookValue?: number | null;
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
  /**
   * Units to register (1–50). The register is item-level: each unit becomes its
   * own asset row with its own code, assignable to a different person. Requires
   * tag and serial blank when above 1.
   */
  quantity?: number;
  assetLocationId?: string;
  assetTag?: string;
  manufacturer?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  description?: string;
  notes?: string;
  dimension?: string;
  ownershipType?: OwnershipTypeEnum;
  purchaseDate?: string;
  purchaseCost?: number;
  currencyId?: string;
  supplierId?: string;
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

/**
 * PUT /Assets/{id} body. AssetCode is immutable (never sent); condition and
 * the four statuses are owned by workflows and are NOT editable here.
 * Unrendered ids (class/type/branch/department/location/parent) are
 * round-tripped unchanged from the GET so a save never clears them.
 */
export interface IUpdateAsset {
  assetName: string;
  assetCategoryId: string;
  assetTag?: string;
  manufacturer?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  description?: string;
  notes?: string;
  dimension?: string;
  ownershipType?: OwnershipTypeEnum;
  purchaseDate?: string;
  purchaseCost?: number;
  currencyId?: string;
  assetClassId?: string;
  assetTypeId?: string;
  supplierId?: string;
  invoiceNumber?: string;
  purchaseOrderReference?: string;
  receiptDate?: string;
  commissioningDate?: string;
  placedInServiceDate?: string;
  branchId?: string;
  departmentId?: string;
  assetLocationId?: string;
  parentAssetId?: string;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  insurancePolicyNumber?: string;
  insuranceExpiryDate?: string;
  /** Base64 rowversion from the GET — round-trip unchanged (concurrency contract). */
  rowVersion: string;
}

export interface IAssetFilter extends ISortFilter {
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

/* ------------------------------------------------------------------------- */
/* Calendar view                                                             */
/* ------------------------------------------------------------------------- */

/** Mirrors AssetCalendarEventTypeEnum on the server. */
export enum AssetCalendarEventTypeEnum {
  Maintenance = 1,
  Warranty = 2,
  Insurance = 3,
  Verification = 4,
}

export interface IAssetCalendarEvent {
  assetId: string;
  assetCode: string;
  assetName: string;
  assetCategoryName?: string | null;
  assetLocationName?: string | null;
  eventType: AssetCalendarEventTypeEnum;
  date: string;
  title: string;
  detail?: string | null;
}

/* ------------------------------------------------------------------------- */
/* Analytics view                                                            */
/* ------------------------------------------------------------------------- */

export interface IAssetAnalyticsBucket {
  label: string;
  count: number;
  value: number;
}

export interface IAssetAcquisitionPoint {
  year: number;
  month: number;
  count: number;
  cost: number;
}

export interface IAssetAnalytics {
  totalAssets: number;
  totalPurchaseCost: number;
  totalAccumulatedDepreciation: number;
  totalNetBookValue: number;
  capitalizedCount: number;
  /** > 1 means the money totals mix currencies and must not be shown as one figure. */
  currencyCount: number;
  primaryCurrency?: string | null;
  byCategory: IAssetAnalyticsBucket[];
  byLifecycle: IAssetAnalyticsBucket[];
  byCustody: IAssetAnalyticsBucket[];
  byOperational: IAssetAnalyticsBucket[];
  byCondition: IAssetAnalyticsBucket[];
  byLocation: IAssetAnalyticsBucket[];
  acquisitionByMonth: IAssetAcquisitionPoint[];
}
