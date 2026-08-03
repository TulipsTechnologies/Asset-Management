import {
  AuditCampaignStatusEnum,
  AuditDiscrepancyStatusEnum,
  AuditResultTypeEnum,
  AuditScopeTypeEnum,
  ReconciliationActionEnum,
} from '@/enum/auditEnums';
import { CustodyStatusEnum, LifecycleStatusEnum } from '@/enum/assetEnums';

export interface IAuditScope {
  scopeType: AuditScopeTypeEnum;
  scopeRefId?: string | null;
  /** Display name of the referenced location/category/employee (service-resolved). */
  scopeRefName?: string | null;
}

/** Required for Location/Category/Employee; must be omitted for Company. */
export interface IAuditScopeInput {
  scopeType: AuditScopeTypeEnum;
  scopeRefId?: string;
}

export interface IAssetAuditCampaign {
  id: string;
  name: string;
  description?: string | null;
  scheduledFrom?: string | null;
  scheduledTo?: string | null;
  status: AuditCampaignStatusEnum;
  /** Materialized snapshot size (expected rows; excludes ad-hoc). */
  expectedCount: number;
  /** Rows no longer Pending (inspected or auto-flipped at submit). */
  scannedCount: number;
  adHocCount: number;
  openDiscrepancyCount: number;
  totalDiscrepancyCount: number;
  startedOn?: string | null;
  submittedOn?: string | null;
  approvedOn?: string | null;
  cancelledOn?: string | null;
  cancelReason?: string | null;
  scopes: IAuditScope[];
  createdOn: string;
  /** Base64 rowversion — REQUIRED on update/start/submit/approve/cancel. */
  rowVersion?: string | null;
}

export interface ICreateAssetAuditCampaign {
  name: string;
  description?: string;
  scheduledFrom?: string;
  scheduledTo?: string;
  scopes: IAuditScopeInput[];
}

export interface IUpdateAssetAuditCampaign extends ICreateAssetAuditCampaign {
  rowVersion: string;
}

export interface IAssetAuditEvidence {
  id: string;
  caption?: string | null;
  fileName?: string | null;
  createdOn: string;
}

export interface IAssetAuditResult {
  id: string;
  assetAuditCampaignId: string;
  assetId?: string | null;
  assetCode?: string | null;
  assetName?: string | null;
  resultType: AuditResultTypeEnum;
  isAdHoc: boolean;
  tagDamaged: boolean;
  scannedCode?: string | null;
  description?: string | null;
  notes?: string | null;

  foundAssetLocationId?: string | null;
  foundAssetLocationName?: string | null;
  foundCustodianEmployeeId?: string | null;
  foundCustodianEmployeeName?: string | null;
  foundConditionTypeId?: string | null;
  foundConditionTypeName?: string | null;
  foundSerialNumber?: string | null;

  expectedAssetLocationId?: string | null;
  expectedAssetLocationName?: string | null;
  expectedCustodianEmployeeId?: string | null;
  expectedCustodianEmployeeName?: string | null;
  expectedConditionTypeId?: string | null;
  expectedConditionTypeName?: string | null;
  expectedSerialNumber?: string | null;
  expectedCustodyStatus?: CustodyStatusEnum | null;

  openDiscrepancyCount: number;
  discrepancyCount: number;
  evidences: IAssetAuditEvidence[];

  verifiedOn?: string | null;
  appliedOn?: string | null;
  applySkipReason?: string | null;

  createdOn: string;
  /** Base64 rowversion — REQUIRED when re-recording an existing row. */
  rowVersion?: string | null;
}

/**
 * Record an inspection. Registered path: assetId (or scannedCode). Unknown
 * path: explicitType UnregisteredFound (description required) or NotInRegister
 * (scannedCode required). explicitType NotFound marks an expected asset
 * "looked, not there". rowVersion is REQUIRED when updating an existing result
 * row (materialized Pending rows, re-scans); true first inserts are exempt.
 */
export interface IRecordAssetAuditResult {
  assetId?: string;
  scannedCode?: string;
  /** Only NotFound (6) / UnregisteredFound (7) / NotInRegister (11). */
  explicitType?: AuditResultTypeEnum;
  foundAssetLocationId?: string;
  foundCustodianEmployeeId?: string;
  foundConditionTypeId?: string;
  foundSerialNumber?: string;
  tagDamaged: boolean;
  description?: string;
  notes?: string;
  rowVersion?: string;
}

export interface IAuditResolveCandidate {
  assetId: string;
  assetCode: string;
  assetName: string;
  assetTag?: string | null;
  serialNumber?: string | null;
  lifecycleStatus: LifecycleStatusEnum;
  custodyStatus: CustodyStatusEnum;
  currentCustodianEmployeeId?: string | null;
  currentCustodianEmployeeName?: string | null;
  assetLocationId?: string | null;
  assetLocationName?: string | null;
  assetConditionTypeId: string;
  assetConditionTypeName?: string | null;
}

/** Scan resolution: one candidate = resolved; several = ambiguity (pick by code). */
export interface IAuditResolve {
  candidates: IAuditResolveCandidate[];
  /** The campaign's existing result row for the resolved asset, if any. */
  existingResult?: IAssetAuditResult | null;
}

export interface IAssetAuditReconciliation {
  action: ReconciliationActionEnum;
  notes: string;
  reconciledOn: string;
}

export interface IAssetAuditDiscrepancy {
  id: string;
  assetAuditCampaignId: string;
  assetAuditResultId: string;
  assetId?: string | null;
  assetCode?: string | null;
  assetName?: string | null;
  discrepancyType: AuditResultTypeEnum;
  expectedValue?: string | null;
  foundValue?: string | null;
  status: AuditDiscrepancyStatusEnum;
  latestAction?: ReconciliationActionEnum | null;
  /** Live custody context so the reconciler sees a re-issue that postdates the scan. */
  currentCustodyStatus?: CustodyStatusEnum | null;
  currentCustodianEmployeeName?: string | null;
  reconciliations: IAssetAuditReconciliation[];
  createdOn: string;
  /** Base64 rowversion — REQUIRED on reconcile. */
  rowVersion?: string | null;
}

/** ConfirmMissing only — materialized via AssetRecoveryCases at approval. */
export interface IAuditRecoveryCaseInput {
  /** Accountable person; defaults to the open assignment's custodian. */
  employeeId?: string;
  description: string;
  estimatedAmount?: number;
  /** 3-char ISO currency code. */
  currencyId?: string;
}

export interface IReconcileAssetAuditDiscrepancy {
  action: ReconciliationActionEnum;
  notes: string;
  recoveryCase?: IAuditRecoveryCaseInput;
  rowVersion: string;
}

export interface IAssetAuditCampaignFilter {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  status?: AuditCampaignStatusEnum;
  fromDate?: string;
  toDate?: string;
}

export interface IAssetAuditResultFilter {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  resultType?: AuditResultTypeEnum;
  hasOpenDiscrepancies?: boolean;
}

export interface IAssetAuditDiscrepancyFilter {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  status?: AuditDiscrepancyStatusEnum;
  discrepancyType?: AuditResultTypeEnum;
}
