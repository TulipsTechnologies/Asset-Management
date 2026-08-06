/**
 * Stable refusal codes emitted by the API, and how the UI should treat each one.
 *
 * The point of this file is that nothing anywhere parses a message. The backend rule that
 * detects a problem emits its own code; the wording of the sentence beside it is free to
 * change without breaking a single branch here.
 *
 * Values, not names, are the contract — several backend constants are named differently
 * from the string they carry.
 */

export const ReasonCodes = {
  // Depreciation runs
  DepreciationNothingDue: 'DEPRECIATION_NOTHING_DUE',
  DepreciationBaseExhausted: 'DEPRECIATION_BASE_EXHAUSTED',

  // Opening balance import
  MigrationSelfApprovalRefused: 'MIGRATION_SELF_APPROVAL_REFUSED',

  // Disposal ↔ Nepal tax pool
  DisposalTaxYearNotFound: 'DISPOSAL_TAX_YEAR_NOT_FOUND',
  DisposalTaxPoolNotResolved: 'DISPOSAL_TAX_POOL_NOT_RESOLVED',
  DisposalTaxConfigurationInvalid: 'DISPOSAL_TAX_CONFIGURATION_INVALID',
} as const;

/**
 * Whether a code describes something that BLOCKED the operation or something the user
 * should merely know. Anything unlisted is treated as an error, which is the safe default:
 * an unknown refusal is not a reassurance.
 */
export type TReasonSeverity = 'warning' | 'error';

const SEVERITY: Record<string, TReasonSeverity> = {
  // Nothing failed — the run simply had nothing to charge for these books.
  [ReasonCodes.DepreciationNothingDue]: 'warning',
  [ReasonCodes.DepreciationBaseExhausted]: 'warning',

  // These three abandoned the whole transaction; accounting and tax stayed consistent
  // precisely because nothing was written.
  [ReasonCodes.DisposalTaxYearNotFound]: 'error',
  [ReasonCodes.DisposalTaxPoolNotResolved]: 'error',
  [ReasonCodes.DisposalTaxConfigurationInvalid]: 'error',
};

/** Short human label for a code, shown beside the server's own sentence. */
const LABELS: Record<string, string> = {
  [ReasonCodes.MigrationSelfApprovalRefused]: 'Needs a second approver',
  [ReasonCodes.DepreciationNothingDue]: 'Nothing due this period',
  [ReasonCodes.DepreciationBaseExhausted]: 'Fully depreciated',
  [ReasonCodes.DisposalTaxYearNotFound]: 'No tax year covers this date',
  [ReasonCodes.DisposalTaxPoolNotResolved]: 'Tax pool could not be resolved',
  [ReasonCodes.DisposalTaxConfigurationInvalid]: 'Tax configuration is invalid',
};

export const reasonSeverity = (code?: string | null): TReasonSeverity =>
  (code && SEVERITY[code]) || 'error';

export const reasonLabel = (code?: string | null): string | null =>
  (code && LABELS[code]) || null;
