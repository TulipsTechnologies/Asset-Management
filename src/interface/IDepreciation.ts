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
  usefulLifeMonths: number;
  depreciationMethodId: string;
  depreciationMethodName: string;
  depreciationMethodCode: string;
  decliningBalanceFactor: number;
  depreciationConvention: number;
  depreciationStartDate: string;
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
}

export interface ICapitalizeAsset {
  assetId: string;
  cost: number;
  currencyId: string;
  residualValue: number;
  usefulLifeMonths: number;
  depreciationMethodId: string;
  decliningBalanceFactor: number;
  depreciationStartDate: string;
  openingAccumulatedDepreciation: number;
  notes?: string;
  /** The ASSET's rowversion — capitalization changes the asset's financial status. */
  rowVersion: string;
}

export interface IUpdateAssetBook {
  cost: number;
  residualValue: number;
  usefulLifeMonths: number;
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
