export interface IReportDescriptor {
  code: string;
  name: string;
  description: string;
  isPaginated: boolean;
  supportsDateRange: boolean;
  supportsFiscalYear: boolean;
  supportsDimension: boolean;
  supportsLocation: boolean;
}

export interface IReportFilter {
  pageNumber?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  fiscalYearCode?: string;
  dimension?: string;
  /** assets-by-location only: the building/floor/room to report on. */
  locationId?: string;
  /** assets-by-location only. Absent/true = subtree; explicit false = the node itself. */
  includeChildren?: boolean;
  /** assets-by-location only: code / name / tag / serial / custodian name. */
  search?: string;
  /** assets-by-location only. */
  categoryId?: string;
  /** assets-by-location only: a label from the availability chips ("Available", "In Use", …). */
  availability?: string;
  /** assets-by-location only: VerificationStatusEnum name — NotVerified | Verified | Discrepancy. */
  verificationStatus?: string;
  /** assets-by-location only: the "(No location)" slice. Mutually exclusive with locationId. */
  unlocated?: boolean;
  /** assets-by-location only: false = rows without chips/money totals (the explorer's
   * fetch — its header numbers come from the summary endpoint instead). */
  includeAggregates?: boolean;
}

/* ------------------------------------------------ assets-by-location summary */

export interface ILocationPathSegment {
  id: string;
  name: string;
}

export interface ILocationCategoryCount {
  id: string;
  name: string;
  count: number;
}

export interface INameCount {
  name: string;
  count: number;
}

/** Current-register verification truth — counts of the rows' own status, not campaign history. */
export interface ILocationVerificationSummary {
  verified: number;
  notVerified: number;
  discrepancy: number;
  lastVerifiedOn: string | null;
}

/** One grouped-view row; id is null exactly for the "(No location)" bucket at root. */
export interface ILocationDescendantSummary {
  id: string | null;
  parentId: string | null;
  name: string;
  depth: number;
  assetCount: number;
  topCategories: INameCount[];
}

export interface IReportSummaryChip {
  label: string;
  count: number;
}

/** Everything the explorer header + grouped view need for one selection, in one call. */
export interface ILocationSummary {
  id: string | null;
  name: string | null;
  path: ILocationPathSegment[];
  hasChildren: boolean;
  directCount: number;
  subtreeCount: number;
  availability: IReportSummaryChip[];
  categories: ILocationCategoryCount[];
  verification: ILocationVerificationSummary;
  totals: { currencyId: string; total: number }[];
  descendants: ILocationDescendantSummary[];
}
