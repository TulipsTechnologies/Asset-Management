// Mirrors the backend ints exactly (house rule). Append-only on both sides.

export enum AssetBookStatusEnum {
  Active = 1,
  Closed = 2,
}

export enum DepreciationRunStatusEnum {
  Draft = 1,
  Calculated = 2,
  Approved = 3,
  Posted = 4,
  Reversed = 5,
  Discarded = 6,
}

export enum FiscalPeriodStatusEnum {
  Open = 1,
  Closed = 2,
}

export enum JournalProposalStatusEnum {
  Pending = 1,
  Sent = 2,
  Posted = 3,
  Rejected = 4,
}

export enum JournalSourceTypeEnum {
  Depreciation = 1,
  DepreciationReversal = 2,
  DisposalDerecognition = 3,
}

export const BOOK_STATUS_LABELS: Record<number, string> = {
  [AssetBookStatusEnum.Active]: 'Active',
  [AssetBookStatusEnum.Closed]: 'Closed',
};

export const BOOK_STATUS_BADGE_CLASSES: Record<number, string> = {
  [AssetBookStatusEnum.Active]: 'bg-green-100 text-green-700',
  [AssetBookStatusEnum.Closed]: 'bg-gray-100 text-gray-600',
};

export const RUN_STATUS_LABELS: Record<number, string> = {
  [DepreciationRunStatusEnum.Draft]: 'Draft',
  [DepreciationRunStatusEnum.Calculated]: 'Calculated',
  [DepreciationRunStatusEnum.Approved]: 'Approved',
  [DepreciationRunStatusEnum.Posted]: 'Posted',
  [DepreciationRunStatusEnum.Reversed]: 'Reversed',
  [DepreciationRunStatusEnum.Discarded]: 'Discarded',
};

export const RUN_STATUS_BADGE_CLASSES: Record<number, string> = {
  [DepreciationRunStatusEnum.Draft]: 'bg-gray-100 text-gray-700',
  [DepreciationRunStatusEnum.Calculated]: 'bg-blue-100 text-blue-700',
  [DepreciationRunStatusEnum.Approved]: 'bg-amber-100 text-amber-700',
  [DepreciationRunStatusEnum.Posted]: 'bg-green-100 text-green-700',
  [DepreciationRunStatusEnum.Reversed]: 'bg-red-100 text-red-700',
  [DepreciationRunStatusEnum.Discarded]: 'bg-gray-100 text-gray-500',
};

export const PERIOD_STATUS_LABELS: Record<number, string> = {
  [FiscalPeriodStatusEnum.Open]: 'Open',
  [FiscalPeriodStatusEnum.Closed]: 'Closed',
};

export const PROPOSAL_STATUS_LABELS: Record<number, string> = {
  [JournalProposalStatusEnum.Pending]: 'Pending',
  [JournalProposalStatusEnum.Sent]: 'Sent',
  [JournalProposalStatusEnum.Posted]: 'Posted',
  [JournalProposalStatusEnum.Rejected]: 'Rejected',
};

export const PROPOSAL_STATUS_BADGE_CLASSES: Record<number, string> = {
  [JournalProposalStatusEnum.Pending]: 'bg-amber-100 text-amber-700',
  [JournalProposalStatusEnum.Sent]: 'bg-blue-100 text-blue-700',
  [JournalProposalStatusEnum.Posted]: 'bg-green-100 text-green-700',
  [JournalProposalStatusEnum.Rejected]: 'bg-red-100 text-red-700',
};

export const PROPOSAL_SOURCE_LABELS: Record<number, string> = {
  [JournalSourceTypeEnum.Depreciation]: 'Depreciation',
  [JournalSourceTypeEnum.DepreciationReversal]: 'Reversal',
  [JournalSourceTypeEnum.DisposalDerecognition]: 'Disposal',
};

/** Seeded global lookup — the engine resolves by CODE, so the UI does too. */
export const DEPRECIATION_METHOD_CODES = {
  StraightLine: 'StraightLine',
  DecliningBalance: 'DecliningBalance',
  None: 'None',
} as const;

/**
 * Shown next to the run workspace. Depreciation continues for assets that are idle,
 * under maintenance or withdrawn from use (IAS 16.52 and 16.55) — it stops only when the
 * asset leaves the register. Operators ask about this constantly.
 */
export const RUN_INCLUSION_NOTE =
  'A run includes every capitalized asset with an active book — including assets that are out of service, under maintenance or retired from use. Depreciation stops only at disposal.';
