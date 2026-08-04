// Mirrors backend SequenceScopeEnum — integer values must match.
export enum SequenceScopeEnum {
  PerCompany = 1,
  PerCompanyAndCategory = 2,
}

export interface IAssetCodeConfiguration {
  prefix: string;
  includeCategoryToken: boolean;
  includeYearToken: boolean;
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
}

export interface ISaveAssetCodeConfiguration {
  prefix: string;
  includeCategoryToken: boolean;
  includeYearToken: boolean;
  sequencePadding: number;
  sequenceScope: SequenceScopeEnum;
  separator: string;
  /** Required when a saved configuration exists. */
  rowVersion?: string | null;
}
