/** Warranty, insurance and claims (§9). Mirrors the backend DTOs. */

export enum WarrantyType {
  Manufacturer = 1,
  Supplier = 2,
  Extended = 3,
}

export const WARRANTY_TYPE_LABEL: Record<WarrantyType, string> = {
  [WarrantyType.Manufacturer]: 'Manufacturer',
  [WarrantyType.Supplier]: 'Supplier',
  [WarrantyType.Extended]: 'Extended',
};

export enum ClaimStatus {
  Draft = 1,
  Submitted = 2,
  Approved = 3,
  Rejected = 4,
  Settled = 5,
  Withdrawn = 6,
}

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  [ClaimStatus.Draft]: 'Draft',
  [ClaimStatus.Submitted]: 'Submitted',
  [ClaimStatus.Approved]: 'Approved',
  [ClaimStatus.Rejected]: 'Rejected',
  [ClaimStatus.Settled]: 'Settled',
  [ClaimStatus.Withdrawn]: 'Withdrawn',
};

/**
 * What each status may become — the same table the service enforces. Mirrored so the UI
 * offers only reachable transitions instead of letting the user pick one and be refused.
 */
export const CLAIM_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  [ClaimStatus.Draft]: [ClaimStatus.Submitted, ClaimStatus.Withdrawn],
  [ClaimStatus.Submitted]: [ClaimStatus.Approved, ClaimStatus.Rejected, ClaimStatus.Withdrawn],
  [ClaimStatus.Approved]: [ClaimStatus.Settled, ClaimStatus.Rejected],
  [ClaimStatus.Rejected]: [],
  [ClaimStatus.Settled]: [],
  [ClaimStatus.Withdrawn]: [],
};

export interface IWarranty {
  id: string;
  assetId: string;
  assetCode?: string | null;
  warrantyType: WarrantyType;
  provider: string;
  vendorId?: string | null;
  vendorName?: string | null;
  contractNumber?: string | null;
  startDate: string;
  endDate: string;
  cost?: number | null;
  currencyId?: string | null;
  coverageNotes?: string | null;
  cancelledOn?: string | null;
  cancelReason?: string | null;
  isInForce: boolean;
  claimCount: number;
  rowVersion: string;
}

export interface IInsurancePolicy {
  id: string;
  assetId: string;
  assetCode?: string | null;
  insurer: string;
  vendorId?: string | null;
  vendorName?: string | null;
  policyNumber: string;
  startDate: string;
  endDate: string;
  sumInsured?: number | null;
  premium?: number | null;
  deductible?: number | null;
  currencyId?: string | null;
  notes?: string | null;
  cancelledOn?: string | null;
  cancelReason?: string | null;
  isInForce: boolean;
  claimCount: number;
  rowVersion: string;
}

export interface IClaim {
  id: string;
  assetId: string;
  assetCode?: string | null;
  assetWarrantyId?: string | null;
  assetInsurancePolicyId?: string | null;
  coverKind: string;
  coverReference?: string | null;
  claimNumber?: string | null;
  claimDate: string;
  incidentDate: string;
  description: string;
  claimedAmount?: number | null;
  approvedAmount?: number | null;
  currencyId?: string | null;
  status: ClaimStatus;
  settledOn?: string | null;
  resolution?: string | null;
  rowVersion: string;
}

export interface IAssetCoverage {
  assetId: string;
  assetCode?: string | null;
  warranties: IWarranty[];
  insurancePolicies: IInsurancePolicy[];
  claims: IClaim[];
  /** The asset's own columns, shown only when no coverage rows supersede them. */
  summaryWarrantyEndDate?: string | null;
  summaryInsurancePolicyNumber?: string | null;
  summaryInsuranceExpiryDate?: string | null;
}

export interface ICoverageExpiry {
  assetId: string;
  assetCode?: string | null;
  assetName?: string | null;
  coverKind: string;
  provider?: string | null;
  reference?: string | null;
  endDate: string;
  daysRemaining: number;
  expired: boolean;
  fromSummaryFields: boolean;
}

export interface IUpsertWarranty {
  assetId: string;
  warrantyType: WarrantyType;
  provider: string;
  vendorId?: string | null;
  contractNumber?: string | null;
  startDate: string;
  endDate: string;
  cost?: number | null;
  currencyId?: string | null;
  coverageNotes?: string | null;
  rowVersion?: string | null;
}

export interface IUpsertInsurancePolicy {
  assetId: string;
  insurer: string;
  vendorId?: string | null;
  policyNumber: string;
  startDate: string;
  endDate: string;
  sumInsured?: number | null;
  premium?: number | null;
  deductible?: number | null;
  currencyId?: string | null;
  notes?: string | null;
  rowVersion?: string | null;
}

export interface IUpsertClaim {
  assetId: string;
  assetWarrantyId?: string | null;
  assetInsurancePolicyId?: string | null;
  claimNumber?: string | null;
  claimDate: string;
  incidentDate: string;
  description: string;
  claimedAmount?: number | null;
  currencyId?: string | null;
}

export interface IClaimStatusChange {
  status: ClaimStatus;
  approvedAmount?: number | null;
  /**
   * Currency for `approvedAmount`. A claim filed without a claimed amount carries no
   * currency of its own, and the server refuses a figure without one — so settlement has
   * to be able to supply it, or such a claim can never reach Settled at all.
   */
  currencyId?: string | null;
  resolution?: string | null;
  rowVersion: string;
}
