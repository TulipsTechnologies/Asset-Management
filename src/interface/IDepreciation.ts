import { IReasonDetail } from '@/interface/IGeneric';

export interface IAssetBook {
  id: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  assetCategoryName: string;
  assetLifecycleStatus: number;
  assetFinancialStatus: number;
  bookType: number;
  cost: number;
  currencyId: string;
  residualValue: number;
  /** Null on rate-based books with no life cap. */
  usefulLifeMonths?: number | null;
  /** The named annual rate (20 = 20%); null on legacy factor-derived books. */
  annualRatePercent?: number | null;
  useStraightLineCrossover: boolean;
  depreciationMethodId: string;
  depreciationMethodName: string;
  depreciationMethodCode: string;
  decliningBalanceFactor: number;
  depreciationConvention: number;
  depreciationStartDate: string;
  /** The in-service date the daily engine anchors every rate segment on. */
  availableForUseDate: string;
  /** Nothing on or before this date is ever charged again. Null on a fresh book. */
  lastDepreciationThroughDate?: string | null;
  status: number;
  accumulatedDepreciation: number;
  openingAccumulatedDepreciation: number;
  netBookValue: number;
  depreciableBase: number;
  /** Once true the basis is frozen — edits are refused, revision is the way forward. */
  hasPostedDepreciation: boolean;
  notes?: string | null;
  createdOn: string;
  rowVersion: string;
}

export interface IDepreciationSchedule {
  fiscalYearCode: string;
  periodOrdinal: number;
  amount: number;
  cumulativeAmount: number;
  isPosted: boolean;
  /** Null on a whole-month book — there, the period is the unit. */
  chargedDays?: number | null;
  dailyRate?: number | null;
}

export interface ICapitalizeAsset {
  assetId: string;
  cost: number;
  currencyId: string;
  residualValue: number;
  /** Required for straight line; optional cap for rate-based methods. */
  usefulLifeMonths?: number;
  /** The annual rate for rate-based methods, in percent. */
  annualRatePercent?: number;
  /** Diminishing balance policy: consume the base by end of life. Needs a life. */
  useStraightLineCrossover?: boolean;
  depreciationMethodId: string;
  decliningBalanceFactor: number;
  depreciationStartDate: string;
  openingAccumulatedDepreciation: number;
  /** Defaults server-side from depreciationStartDate when omitted. Never 0001-01-01. */
  availableForUseDate?: string;
  /** Omitted means Full Month, which is what every pre-existing book uses. */
  depreciationConvention?: number;
  /** Required by the server for a day-based book carrying an opening balance. */
  lastDepreciationThroughDate?: string;
  /** Optional cross-check: must equal cost − openingAccumulatedDepreciation. */
  openingNetBookValue?: number;
  notes?: string;
  /** The ASSET's rowversion — capitalization changes the asset's financial status. */
  rowVersion: string;
}

export interface IUpdateAssetBook {
  cost: number;
  residualValue: number;
  usefulLifeMonths?: number;
  annualRatePercent?: number;
  depreciationMethodId: string;
  decliningBalanceFactor: number;
  depreciationStartDate: string;
  openingAccumulatedDepreciation: number;
  notes?: string;
  rowVersion: string;
}

export interface IReviseEstimate {
  residualValue: number;
  usefulLifeMonths: number;
  reason?: string;
  rowVersion: string;
}

export interface IAssetBookFilter {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  assetId?: string;
  assetCategoryId?: string;
  status?: number;
  depreciationMethodId?: string;
}

export interface IDepreciationRun {
  id: string;
  fiscalPeriodId: string;
  fiscalYearCode: string;
  periodOrdinal: number;
  monthName: string;
  status: number;
  runDate: string;
  totalAmount: number;
  assetCount: number;
  /** Books the run considered and charged nothing for. Detailed in `exclusions`. */
  excludedAssetCount: number;
  /** Populated when a single run is fetched; empty on the list projection. */
  exclusions?: IDepreciationExclusion[];
  /** Total swept from fiscal years before this run's own — historical catch-up. */
  priorYearCatchUpTotal: number;
  /** The remainder of totalAmount: this fiscal year's depreciation. */
  currentYearTotal: number;
  currencyId: string;
  approvedOn?: string | null;
  postedOn?: string | null;
  reversedOn?: string | null;
  reversalReason?: string | null;
  notes?: string | null;
  createdOn: string;
  rowVersion: string;
}

export interface IDepreciationRunDetail {
  id: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  assetBookId: string;
  amount: number;
  openingAccumulated: number;
  closingAccumulated: number;
  netBookValueAfter: number;
  /** Amount owed from an earlier period that was never run — charged here, flagged. */
  isCatchUp: boolean;
  /** Calendar days charged. Null on a whole-month book. */
  chargedDays?: number | null;
  /** "OpeningBalance" | "HistoricalCatchup" — how this book's history entered the register. */
  startingMode: string;
  priorYearCatchUpAmount: number;
  currentYearAmount: number;
  openingAccumulatedDepreciation: number;
  cost: number;
  residualValue: number;
  netBookValueBefore: number;
  depreciationConvention: number;
  availableForUseDate: string;
  lastDepreciationThroughDate?: string | null;
  currencyId: string;
}

/** A book the run deliberately charged nothing for, with the code that says why. */
export interface IDepreciationExclusion {
  assetId: string;
  assetBookId: string;
  assetCode: string;
  assetName: string;
  reasonCode: string;
  message: string;
}

// ---------------------------------------------------------------- opening balance import

export interface IMigrationLineInput {
  assetReference: string;
  sourceRowNumber: number;
  cost?: number;
  currencyId?: string;
  availableForUseDate?: string;
  depreciationMethodCode?: string;
  usefulLifeMonths?: number;
  remainingUsefulLifeMonths?: number;
  residualValue?: number;
  openingAccumulatedDepreciation?: number;
  openingNetBookValue?: number;
  lastDepreciationThroughDate?: string;
}

export interface ICreateMigrationBatch {
  batchReference: string;
  fileName?: string;
  cutoverDate: string;
  notes?: string;
  lines: IMigrationLineInput[];
}

export interface IMigrationLine {
  id: string;
  sourceRowNumber: number;
  assetReference: string;
  assetId?: string | null;
  isValid: boolean;
  cost?: number | null;
  residualValue?: number | null;
  openingAccumulatedDepreciation?: number | null;
  openingNetBookValue?: number | null;
  availableForUseDate?: string | null;
  lastDepreciationThroughDate?: string | null;
  usefulLifeMonths?: number | null;
  remainingUsefulLifeMonths?: number | null;
}

export interface IMigrationBatch {
  id: string;
  batchReference: string;
  status: number;
  cutoverDate: string;
  lineCount: number;
  problemCount: number;
  validationSnapshotHash?: string | null;
  rowVersion?: string | null;
  lines: IMigrationLine[];
}

// ---------------------------------------------------------------- projection

export interface IProjectAssetDepreciation {
  depreciationMethodId: string;
  cost: number;
  residualValue: number;
  usefulLifeMonths?: number;
  annualRatePercent?: number;
  /** Display horizon (years) for a life-less projection. Never stored. */
  forecastYears?: number;
  decliningBalanceFactor: number;
  depreciationStartDate: string;
  asOfDate?: string;
  openingAccumulated?: number;
}

export interface IDepreciationProjectionMonth {
  periodOrdinal: number;
  /** Configured fiscal month name (e.g. Shrawan); null on the synthetic fallback. */
  monthName?: string | null;
  from: string;
  to: string;
  charge: number;
  accumulatedAtEnd: number;
  closingNetBookValue: number;
  elapsed: boolean;
}

export interface IDepreciationProjectionYear {
  yearNumber: number;
  /** The configured fiscal year this row is (e.g. "2073/74"); null on the fallback. */
  fiscalYearCode?: string | null;
  from: string;
  to: string;
  months: number;
  openingNetBookValue: number;
  charge: number;
  accumulatedAtEnd: number;
  closingNetBookValue: number;
  elapsed: boolean;
  isCurrent: boolean;
  /** The year's monthly periods — the expandable detail under the year row. */
  periods: IDepreciationProjectionMonth[];
}

/** What an asset bought years ago is worth today. Writes nothing. */
export interface IDepreciationProjection {
  methodCode: string;
  methodName: string;
  cost: number;
  residualValue: number;
  depreciableBase: number;
  decliningBalanceFactor: number;
  usefulLifeMonths: number;
  depreciationStartDate: string;
  lifeEndDate: string;
  asOfDate: string;
  elapsedMonths: number;
  remainingMonths: number;
  accumulatedToDate: number;
  netBookValueToDate: number;
  currentYearCharge: number;
  fullyDepreciated: boolean;
  /** True when rows are the company's configured fiscal years and the cutover is set. */
  isFiscalAligned: boolean;
  /** History through the last fully-ended fiscal year — what the cutover saves. */
  lastClosedFiscalYearCode?: string | null;
  cutoverThroughDate?: string | null;
  accumulatedThroughCutover?: number | null;
  netBookValueAtCutover?: number | null;
  currentFiscalYearCode?: string | null;
  years: IDepreciationProjectionYear[];
  notes: string[];
}

// ---------------------------------------------------------------- book convention

export interface IConventionChangePeriod {
  fiscalYearCode: string;
  periodOrdinal: number;
  underCurrent: number;
  underProposed: number;
  difference: number;
  chargedDays?: number | null;
}

export interface IConventionChangePreview {
  assetBookId: string;
  assetCode?: string | null;
  currentConvention: number;
  proposedConvention: number;
  effectiveFrom: string;
  lastPostedThrough?: string | null;
  postedToDate: number;
  remainingBase: number;
  projectedUnderCurrent: number;
  projectedUnderProposed: number;
  projectedDifference: number;
  periods: IConventionChangePeriod[];
  canApply: boolean;
  blockers: IReasonDetail[];
}

export interface IChangeBookConvention {
  rowVersion: string;
  effectiveFrom: string;
  reason?: string;
}

export interface IDepreciationRunFilter {
  pageNumber?: number;
  pageSize?: number;
  fiscalYearCode?: string;
  status?: number;
  fiscalPeriodId?: string;
}

export interface IFiscalYear {
  id: string;
  code: string;
  hrmFiscalYearId?: number | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
  /** Owned by HRM — every local mutation is refused. */
  isMirrored: boolean;
  periodCount: number;
  openPeriodCount: number;
  rowVersion: string;
}

export interface IFiscalPeriod {
  id: string;
  fiscalYearId: string;
  fiscalYearCode: string;
  periodOrdinal: number;
  monthName: string;
  monthNameLocal?: string | null;
  startDate: string;
  endDate: string;
  status: number;
  closedOn?: string | null;
  reopenedOn?: string | null;
  reopenReason?: string | null;
  hasPostedRun: boolean;
  rowVersion: string;
}

export interface IUpsertFiscalPeriod {
  periodOrdinal: number;
  monthName: string;
  monthNameLocal?: string;
  startDate: string;
  endDate: string;
}

export interface IUpsertFiscalYear {
  code: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  periods: IUpsertFiscalPeriod[];
}

export interface ICapitalizationPolicy {
  id: string;
  capitalizationThreshold: number;
  currencyId: string;
  effectiveFrom: string;
  notes?: string | null;
  createdOn: string;
}

export interface IUpsertCapitalizationPolicy {
  capitalizationThreshold: number;
  currencyId: string;
  effectiveFrom: string;
  notes?: string;
}

export interface IDepreciationAccountMapping {
  id: string;
  assetCategoryId?: string | null;
  assetCategoryName?: string | null;
  depreciationExpenseAccount: string;
  accumulatedDepreciationAccount: string;
  assetCostAccount?: string | null;
  disposalProceedsAccount?: string | null;
  disposalGainAccount?: string | null;
  disposalLossAccount?: string | null;
  notes?: string | null;
  rowVersion: string;
}

export interface IUpsertDepreciationAccountMapping {
  assetCategoryId?: string | null;
  depreciationExpenseAccount: string;
  accumulatedDepreciationAccount: string;
  assetCostAccount?: string;
  disposalProceedsAccount?: string;
  disposalGainAccount?: string;
  disposalLossAccount?: string;
  notes?: string;
}

export interface IJournalProposalLine {
  lineNumber: number;
  accountCode: string;
  debit: number;
  credit: number;
  description?: string | null;
}

export interface IJournalProposal {
  id: string;
  sourceType: number;
  sourceId: string;
  fiscalYearCode: string;
  periodOrdinal: number;
  proposalDate: string;
  status: number;
  totalDebit: number;
  totalCredit: number;
  currencyId: string;
  narration?: string | null;
  lines: IJournalProposalLine[];
  createdOn: string;
  rowVersion: string;
}

export interface IJournalProposalFilter {
  pageNumber?: number;
  pageSize?: number;
  sourceType?: number;
  status?: number;
  fiscalYearCode?: string;
}

export interface IDepreciationMethod {
  id: string;
  code: string;
  name: string;
}
