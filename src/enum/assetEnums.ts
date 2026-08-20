/**
 * Mirrors TulipsHRM.AssetManagement.Domain enums — keep in sync with the backend.
 * All values are persisted ints; never renumber.
 */

export enum LifecycleStatusEnum {
  Draft = 1,
  Active = 2,
  Retired = 3,
  Disposed = 4,
}

export enum CustodyStatusEnum {
  Unassigned = 1,
  Reserved = 2,
  Assigned = 3,
  InTransfer = 4,
  Missing = 5,
}

export enum OperationalStatusEnum {
  Operational = 1,
  UnderMaintenance = 2,
  Breakdown = 3,
  Quarantined = 4,
  OutOfService = 5,
}

export enum FinancialStatusEnum {
  NotCapitalized = 1,
  Capitalized = 2,
  FullyDepreciated = 3,
  WrittenOff = 4,
}

export enum VerificationStatusEnum {
  NotVerified = 1,
  Verified = 2,
  Discrepancy = 3,
}

export enum OwnershipTypeEnum {
  Owned = 1,
  Leased = 2,
  Rented = 3,
  Loaned = 4,
  CustomerProperty = 5,
  Donated = 6,
}

export const LIFECYCLE_LABELS: Record<number, string> = {
  [LifecycleStatusEnum.Draft]: 'Draft',
  [LifecycleStatusEnum.Active]: 'Active',
  [LifecycleStatusEnum.Retired]: 'Retired',
  [LifecycleStatusEnum.Disposed]: 'Disposed',
};

export const LIFECYCLE_BADGE_CLASSES: Record<number, string> = {
  [LifecycleStatusEnum.Draft]: 'bg-gray-100 text-gray-800',
  [LifecycleStatusEnum.Active]: 'bg-green-100 text-green-800',
  [LifecycleStatusEnum.Retired]: 'bg-amber-100 text-amber-800',
  [LifecycleStatusEnum.Disposed]: 'bg-red-100 text-red-800',
};

export const CUSTODY_LABELS: Record<number, string> = {
  [CustodyStatusEnum.Unassigned]: 'Unassigned',
  [CustodyStatusEnum.Reserved]: 'Reserved',
  [CustodyStatusEnum.Assigned]: 'Assigned',
  [CustodyStatusEnum.InTransfer]: 'In Transfer',
  [CustodyStatusEnum.Missing]: 'Missing',
};

export const CUSTODY_BADGE_CLASSES: Record<number, string> = {
  [CustodyStatusEnum.Unassigned]: 'bg-gray-100 text-gray-800',
  [CustodyStatusEnum.Reserved]: 'bg-blue-100 text-blue-800',
  [CustodyStatusEnum.Assigned]: 'bg-green-100 text-green-800',
  [CustodyStatusEnum.InTransfer]: 'bg-amber-100 text-amber-800',
  [CustodyStatusEnum.Missing]: 'bg-red-100 text-red-800',
};

export const OPERATIONAL_LABELS: Record<number, string> = {
  [OperationalStatusEnum.Operational]: 'Operational',
  [OperationalStatusEnum.UnderMaintenance]: 'Under Maintenance',
  [OperationalStatusEnum.Breakdown]: 'Breakdown',
  [OperationalStatusEnum.Quarantined]: 'Quarantined',
  [OperationalStatusEnum.OutOfService]: 'Out of Service',
};

export const FINANCIAL_LABELS: Record<number, string> = {
  [FinancialStatusEnum.NotCapitalized]: 'Not Capitalized',
  [FinancialStatusEnum.Capitalized]: 'Capitalized',
  [FinancialStatusEnum.FullyDepreciated]: 'Fully Depreciated',
  [FinancialStatusEnum.WrittenOff]: 'Written Off',
};

export const VERIFICATION_LABELS: Record<number, string> = {
  [VerificationStatusEnum.NotVerified]: 'Not Verified',
  [VerificationStatusEnum.Verified]: 'Verified',
  [VerificationStatusEnum.Discrepancy]: 'Discrepancy',
};

export const VERIFICATION_BADGE_CLASSES: Record<number, string> = {
  [VerificationStatusEnum.NotVerified]: 'bg-gray-100 text-gray-800',
  [VerificationStatusEnum.Verified]: 'bg-green-100 text-green-800',
  [VerificationStatusEnum.Discrepancy]: 'bg-red-100 text-red-800',
};

export const OWNERSHIP_LABELS: Record<number, string> = {
  [OwnershipTypeEnum.Owned]: 'Owned',
  [OwnershipTypeEnum.Leased]: 'Leased',
  [OwnershipTypeEnum.Rented]: 'Rented',
  [OwnershipTypeEnum.Loaned]: 'Loaned',
  [OwnershipTypeEnum.CustomerProperty]: 'Customer Property',
  [OwnershipTypeEnum.Donated]: 'Donated',
};

export const enumOptions = (labels: Record<number, string>) =>
  Object.entries(labels).map(([value, label]) => ({
    value: Number(value),
    label,
  }));

/*
 * ASSET_CONDITIONS used to live here: the six seeded ids, mirrored client-side "until a
 * lookup endpoint ships". That endpoint now exists, and a company can define conditions of
 * its own — so a hardcoded list would show six options on a screen where the register has
 * eight, and would keep offering a condition the company had deactivated.
 *
 * Use the `useAssetConditions` hook (src/hooks/useAssetConditions.ts). It is cached
 * module-wide, so consuming it from several modals costs one request.
 *
 * Deliberately NOT left behind as a fallback: serving the six system ids to a tenant whose
 * own list failed to load writes a valid-but-wrong condition onto their asset, silently.
 */
