// Mirrors backend SequenceScopeEnum — integer values must match.
export enum SequenceScopeEnum {
  PerCompany = 1,
  PerCompanyAndCategory = 2,
}

// Mirrors backend YearTokenStyleEnum — integer values must match.
export enum YearTokenStyleEnum {
  None = 0,
  CalendarYear = 1,
  /** Rendered like FY83/84 from the fiscal calendar. */
  FiscalYear = 2,
}

export interface IAssetCodeConfiguration {
  prefix: string;
  includeCategoryToken: boolean;
  categoryTokenLength?: number | null;
  yearTokenStyle: YearTokenStyleEnum;
  includeCategoryInitialsToken: boolean;
  sequencePadding: number;
  sequenceScope: SequenceScopeEnum;
  separator: string;
  /** False while the company still runs on the built-in default. */
  isPersisted: boolean;
  rowVersion?: string | null;
  /** Server-composed sample — the authoritative preview. */
  exampleCode: string;
  maxCodeLength: number;
  longestCategoryCode?: string | null;
  longestCategoryInitials?: string | null;
  /** Set when the fiscal token is on and the calendar is missing or about to lapse. */
  fiscalYearWarning?: string | null;
}

export interface ISaveAssetCodeConfiguration {
  prefix: string;
  includeCategoryToken: boolean;
  categoryTokenLength?: number | null;
  yearTokenStyle: YearTokenStyleEnum;
  includeCategoryInitialsToken: boolean;
  sequencePadding: number;
  sequenceScope: SequenceScopeEnum;
  separator: string;
  /** Required when a saved configuration exists. */
  rowVersion?: string | null;
}
