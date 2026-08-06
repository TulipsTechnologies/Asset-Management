import { IReasonDetail } from '@/interface/IGeneric';

/**
 * Nepal IRD tax book. Deliberately mirrors the API's AssetTaxProfileDto and
 * TaxPoolYearDto field-for-field — the tax figures are the engine's, never recomputed here.
 */

export enum TaxTreatmentEnum {
  Pooled = 1,
  PerAssetUsefulLife = 2,
  NonDepreciable = 3,
}

export const TAX_TREATMENT_LABELS: Record<number, string> = {
  [TaxTreatmentEnum.Pooled]: 'Pooled',
  [TaxTreatmentEnum.PerAssetUsefulLife]: 'Per asset (useful life)',
  [TaxTreatmentEnum.NonDepreciable]: 'Non-depreciable',
};

/**
 * IRD class codes are strings on the wire, not an enum — the rule pack is data, and a
 * jurisdiction can add classes without a code change. These five are Nepal Schedule 2.
 */
/** Schedule 2 pool rates by class, numeric, for prefills. E has no rate — it amortises. */
export const NEPAL_CLASS_RATE_PCT: Record<string, number> = { A: 5, B: 25, C: 20, D: 15 };

/** Schedule 2 pool rates by class, for read-only display. E amortises over useful life. */
export const NEPAL_CLASS_RATES: Record<string, string> = {
  A: '5%',
  B: '25%',
  C: '20%',
  D: '15%',
  E: 'over useful life',
};

export const NEPAL_TAX_CLASSES = [
  { value: 'A', label: 'A — Buildings and structures (5%)' },
  { value: 'B', label: 'B — Computers, data equipment, furniture (25%)' },
  { value: 'C', label: 'C — Vehicles and plant (20%)' },
  { value: 'D', label: 'D — Other assets (15%)' },
  { value: 'E', label: 'E — Intangibles (over useful life)' },
];

/**
 * The tax entry period is a MONTH ORDINAL 1..12 with Shrawan = 1, not the absorption band.
 * The server derives the band (1–6 full, 7–9 two thirds, 10–12 one third) from the month,
 * so these three options send the first month of their band.
 */
export const TAX_ENTRY_PERIODS = [
  { value: '1', label: 'Shrawan–Poush (full year)' },
  { value: '7', label: 'Magh–Chaitra (two thirds)' },
  { value: '10', label: 'Baisakh–Ashad (one third)' },
];

export const taxEntryPeriodLabel = (ordinal?: number | null) => {
  if (ordinal == null) return null;
  if (ordinal <= 6) return 'Shrawan–Poush';
  if (ordinal <= 9) return 'Magh–Chaitra';
  return 'Baisakh–Ashad';
};

export interface ITaxJurisdiction {
  id: string;
  countryCode: string;
  name: string;
}

export interface IAssetTaxProfile {
  id: string;
  assetId: string;
  taxJurisdictionId: string;
  taxTreatment: number;
  classCode?: string | null;
  exclusionReason?: string | null;
  taxCostBasis: number;
  availableForUseDateAd: string;
  putToUseDateAd?: string | null;
  putToUseDateSource: number;
  entryTaxYearCode?: string | null;
  entryPeriodOrdinal?: number | null;
  usefulLifeYears?: number | null;
  taxPoolId?: string | null;
  poolIsPerAsset: boolean;
  rowVersion?: string | null;
}

export interface IAssignAssetTaxClass {
  taxJurisdictionId: string;
  taxTreatment: number;
  classCode?: string;
  entryTaxYearCode?: string;
  entryTaxStartYear?: number;
  entryPeriodOrdinal?: number;
  taxCostBasis?: number;
  usefulLifeYears?: number;
  exclusionReason?: string;
  rowVersion?: string;
}

/**
 * One pool for one tax year — the whole Schedule 2 calculation, exactly as the engine ran
 * it. `rateApplied` is a FRACTION (0.25, not 25), and `explanationSteps` is the engine's own
 * numbered derivation, which is the only thing that should ever explain a figure.
 */
export interface ITaxPoolYear {
  id: string;
  taxPoolId: string;
  classCode: string;
  /** Set for per-asset pools (Nepal class E); null for pooled classes. */
  assetId?: string | null;
  assetCode?: string | null;
  taxYearCode: string;
  status: number;
  openingWrittenDownValue: number;
  eligibleAdditions: number;
  deferredAdditionsBroughtForward: number;
  deferredAdditionsCarriedForward: number;
  disposalProceeds: number;
  depreciationBase: number;
  /** A fraction: 0.25 means 25%. */
  rateApplied: number;
  calculatedDepreciation: number;
  allowedTaxDeduction: number;
  balancingCharge: number;
  balancingAllowance: number;
  deMinimisWriteOff: number;
  closingWrittenDownValue: number;
  explanationSteps: string[];
}

export interface ITaxDepreciationRun {
  id: string;
  taxJurisdictionId: string;
  taxYearCode: string;
  taxYearStartYear: number;
  status: number;
  runDate: string;
  totalCalculatedDepreciation: number;
  totalAllowedDeduction: number;
  totalBalancingCharge: number;
  totalBalancingAllowance: number;
  poolCount: number;
  currencyId: string;
  engineVersion?: string | null;
  calculatedOn?: string | null;
  pools: ITaxPoolYear[];
}

/** One year of a multi-year projection. */
export interface ITaxYearProjection {
  taxYearCode: string;
  taxYearStartYear: number;
  /** Null when no rule pack covers the year — see the projection's `reasons`. */
  ruleSetVersion?: string | null;
  totalAllowedDeduction: number;
  totalClosingWrittenDownValue: number;
  /** False when the year was skipped; its `pools` are then empty. */
  wasCalculated: boolean;
  pools: ITaxPoolYear[];
}

/**
 * Tax depreciation across a span of years, each year's closing WDV opening the next.
 * Read-only: the server writes nothing, which is what lets it cross years the posting
 * workflow has not reached.
 */
export interface ITaxProjection {
  taxJurisdictionId: string;
  fromTaxYearStartYear: number;
  toTaxYearStartYear: number;
  currencyId: string;
  engineVersion: string;
  totalAllowedDeduction: number;
  years: ITaxYearProjection[];
  reasons: IReasonDetail[];
}

export interface IProjectTaxYears {
  taxJurisdictionId: string;
  fromTaxYearStartYear: number;
  toTaxYearStartYear: number;
  assetId?: string;
}

export interface ICalculateTaxRun {
  taxJurisdictionId: string;
  taxYearCode: string;
  taxYearStartYear: number;
  notes?: string;
}

export interface ISeedNepalRulePack {
  effectiveFromStartYear: number;
  effectiveFromTaxYear: string;
}
