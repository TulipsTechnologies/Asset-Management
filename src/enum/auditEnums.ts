/**
 * Mirrors TulipsHRM.AssetManagement.Domain verification (audit) enums — keep in
 * sync with the backend. Persisted ints; never renumber.
 */

export enum AuditCampaignStatusEnum {
  Draft = 1,
  InProgress = 2,
  UnderReview = 3,
  Approved = 4,
  Cancelled = 5,
}

export enum AuditScopeTypeEnum {
  /** Whole company (scopeRefId null). */
  Company = 1,
  /** RESERVED until HRM org sync — the API rejects it. */
  Branch = 2,
  /** RESERVED until HRM org sync — the API rejects it. */
  Department = 3,
  Location = 4,
  Category = 5,
  /** Assets currently in the custody of one employee. */
  Employee = 6,
}

/** Values 3–11 double as the discrepancy type. */
export enum AuditResultTypeEnum {
  /** Materialized at campaign start; not yet inspected. */
  Pending = 1,
  Verified = 2,
  WrongLocation = 3,
  WrongCustodian = 4,
  ConditionMismatch = 5,
  /** Expected but not found (explicit scan, or auto-flip at submit). */
  NotFound = 6,
  /** Physical item bearing no code/tag and matching no record (assetId null). */
  UnregisteredFound = 7,
  TagDamaged = 8,
  SerialMismatch = 9,
  /** Scanned item resolves to a Disposed record. */
  DisposedButActive = 10,
  /** Item carries a code/tag that resolves to nothing (assetId null, code kept). */
  NotInRegister = 11,
}

export enum AuditDiscrepancyStatusEnum {
  Open = 1,
  Reconciled = 2,
}

export enum ReconciliationActionEnum {
  AcceptFound = 1,
  KeepRecord = 2,
  ConfirmMissing = 3,
  FoundLater = 4,
  Acknowledge = 5,
  DroppedFromScope = 6,
}

export const AUDIT_CAMPAIGN_STATUS_LABELS: Record<number, string> = {
  [AuditCampaignStatusEnum.Draft]: 'Draft',
  [AuditCampaignStatusEnum.InProgress]: 'In Progress',
  [AuditCampaignStatusEnum.UnderReview]: 'Under Review',
  [AuditCampaignStatusEnum.Approved]: 'Approved',
  [AuditCampaignStatusEnum.Cancelled]: 'Cancelled',
};

export const AUDIT_CAMPAIGN_STATUS_BADGE_CLASSES: Record<number, string> = {
  [AuditCampaignStatusEnum.Draft]: 'bg-gray-100 text-gray-800',
  [AuditCampaignStatusEnum.InProgress]: 'bg-blue-50 text-blue-800',
  [AuditCampaignStatusEnum.UnderReview]: 'bg-amber-100 text-amber-800',
  [AuditCampaignStatusEnum.Approved]: 'bg-green-100 text-green-800',
  [AuditCampaignStatusEnum.Cancelled]: 'bg-gray-100 text-gray-800',
};

export const AUDIT_SCOPE_TYPE_LABELS: Record<number, string> = {
  [AuditScopeTypeEnum.Company]: 'Whole Company',
  [AuditScopeTypeEnum.Branch]: 'Branch',
  [AuditScopeTypeEnum.Department]: 'Department',
  [AuditScopeTypeEnum.Location]: 'Location',
  [AuditScopeTypeEnum.Category]: 'Category',
  [AuditScopeTypeEnum.Employee]: 'Employee',
};

/**
 * Scope types offered in the picker. Branch (2) and Department (3) are
 * RESERVED backend-side until HRM organisation sync — excluded here.
 */
export const AUDIT_SCOPE_TYPE_OPTIONS: AuditScopeTypeEnum[] = [
  AuditScopeTypeEnum.Company,
  AuditScopeTypeEnum.Location,
  AuditScopeTypeEnum.Category,
  AuditScopeTypeEnum.Employee,
];

export const AUDIT_RESULT_TYPE_LABELS: Record<number, string> = {
  [AuditResultTypeEnum.Pending]: 'Pending',
  [AuditResultTypeEnum.Verified]: 'Verified',
  [AuditResultTypeEnum.WrongLocation]: 'Wrong Location',
  [AuditResultTypeEnum.WrongCustodian]: 'Wrong Custodian',
  [AuditResultTypeEnum.ConditionMismatch]: 'Condition Mismatch',
  [AuditResultTypeEnum.NotFound]: 'Not Found',
  [AuditResultTypeEnum.UnregisteredFound]: 'Unregistered Found',
  [AuditResultTypeEnum.TagDamaged]: 'Tag Damaged',
  [AuditResultTypeEnum.SerialMismatch]: 'Serial Mismatch',
  [AuditResultTypeEnum.DisposedButActive]: 'Disposed But Present',
  [AuditResultTypeEnum.NotInRegister]: 'Not In Register',
};

/** Verified green, Not Found red, mismatches amber, unknown-item types purple. */
export const AUDIT_RESULT_TYPE_BADGE_CLASSES: Record<number, string> = {
  [AuditResultTypeEnum.Pending]: 'bg-gray-100 text-gray-800',
  [AuditResultTypeEnum.Verified]: 'bg-green-100 text-green-800',
  [AuditResultTypeEnum.WrongLocation]: 'bg-amber-100 text-amber-800',
  [AuditResultTypeEnum.WrongCustodian]: 'bg-amber-100 text-amber-800',
  [AuditResultTypeEnum.ConditionMismatch]: 'bg-amber-100 text-amber-800',
  [AuditResultTypeEnum.NotFound]: 'bg-red-100 text-red-800',
  [AuditResultTypeEnum.UnregisteredFound]: 'bg-purple-100 text-purple-800',
  [AuditResultTypeEnum.TagDamaged]: 'bg-amber-100 text-amber-800',
  [AuditResultTypeEnum.SerialMismatch]: 'bg-amber-100 text-amber-800',
  [AuditResultTypeEnum.DisposedButActive]: 'bg-pink-100 text-pink-800',
  [AuditResultTypeEnum.NotInRegister]: 'bg-purple-100 text-purple-800',
};

export const AUDIT_DISCREPANCY_STATUS_LABELS: Record<number, string> = {
  [AuditDiscrepancyStatusEnum.Open]: 'Open',
  [AuditDiscrepancyStatusEnum.Reconciled]: 'Reconciled',
};

export const AUDIT_DISCREPANCY_STATUS_BADGE_CLASSES: Record<number, string> = {
  [AuditDiscrepancyStatusEnum.Open]: 'bg-red-50 text-red-800',
  [AuditDiscrepancyStatusEnum.Reconciled]: 'bg-green-100 text-green-800',
};

export const RECONCILIATION_ACTION_LABELS: Record<number, string> = {
  [ReconciliationActionEnum.AcceptFound]: 'Accept Found',
  [ReconciliationActionEnum.KeepRecord]: 'Keep Record',
  [ReconciliationActionEnum.ConfirmMissing]: 'Confirm Missing',
  [ReconciliationActionEnum.FoundLater]: 'Found Later',
  [ReconciliationActionEnum.Acknowledge]: 'Acknowledge',
  [ReconciliationActionEnum.DroppedFromScope]: 'Dropped From Scope',
};

/**
 * The backend's discrepancy type → allowed reconciliation actions matrix
 * (AssetAuditDiscrepancyService.AllowedActions) — keep in sync.
 */
export const RECONCILE_ACTION_MATRIX: Record<number, number[]> = {
  [AuditResultTypeEnum.WrongLocation]: [
    ReconciliationActionEnum.AcceptFound,
    ReconciliationActionEnum.KeepRecord,
  ],
  [AuditResultTypeEnum.ConditionMismatch]: [
    ReconciliationActionEnum.AcceptFound,
    ReconciliationActionEnum.KeepRecord,
  ],
  [AuditResultTypeEnum.SerialMismatch]: [
    ReconciliationActionEnum.AcceptFound,
    ReconciliationActionEnum.KeepRecord,
  ],
  [AuditResultTypeEnum.WrongCustodian]: [
    ReconciliationActionEnum.Acknowledge,
    ReconciliationActionEnum.KeepRecord,
  ],
  [AuditResultTypeEnum.NotFound]: [
    ReconciliationActionEnum.ConfirmMissing,
    ReconciliationActionEnum.FoundLater,
    ReconciliationActionEnum.DroppedFromScope,
  ],
  [AuditResultTypeEnum.TagDamaged]: [ReconciliationActionEnum.Acknowledge],
  [AuditResultTypeEnum.UnregisteredFound]: [ReconciliationActionEnum.Acknowledge],
  [AuditResultTypeEnum.NotInRegister]: [ReconciliationActionEnum.Acknowledge],
  [AuditResultTypeEnum.DisposedButActive]: [
    ReconciliationActionEnum.Acknowledge,
    ReconciliationActionEnum.DroppedFromScope,
  ],
};

/** What each reconciliation decision does — all effects apply at campaign approval. */
export const RECONCILE_ACTION_EFFECTS: Record<number, string> = {
  [ReconciliationActionEnum.AcceptFound]:
    'Updates the record to match what was found, applied at approval.',
  [ReconciliationActionEnum.KeepRecord]:
    'The record stands — the scan was noise or the asset moved back.',
  [ReconciliationActionEnum.ConfirmMissing]:
    'Marks the asset Missing (verification Discrepancy), closes any open assignment with a Missing return record.',
  [ReconciliationActionEnum.FoundLater]:
    'The asset was located after the scan — counts as verified present.',
  [ReconciliationActionEnum.Acknowledge]:
    'Recorded for the report; any corrective action happens through other workflows.',
  [ReconciliationActionEnum.DroppedFromScope]:
    'Closes the discrepancy with no asset changes.',
};
