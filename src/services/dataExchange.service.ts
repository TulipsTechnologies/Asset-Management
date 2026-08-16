import { requestApi } from './httpService';
import { IResponse } from '@/interface/IGeneric';

export type TExchangeEntity =
  | 'assets'
  | 'categories'
  | 'locations'
  | 'vendors'
  | 'employees';

export interface IImportProblem {
  /** The row number as Excel shows it (header is row 1). */
  row: number;
  problem: string;
  /** When one cell can fix the problem, the column it lives in — offer an inline fix. */
  column?: string | null;
  /** The offending value as read from the sheet. */
  currentValue?: string | null;
}

/** One corrected cell, typed in the preview instead of round-tripping through Excel. */
export interface ICellOverride {
  row: number;
  column: string;
  value: string;
}

/** One kind of side entity the import would create, with the FULL name list. */
export interface IPlannedEntityGroup {
  kind: 'categories' | 'locations' | 'suppliers' | string;
  names: string[];
  /** How many asset rows reference something in this group. */
  rowCount: number;
}

/** A single Bikram Sambat → AD reinterpretation, auditable per row. */
export interface IPlannedDateConversion {
  column: string;
  row: number;
  from: string;
  to: string;
}

/**
 * The Asset Code an imported row was given. Only rows that left Asset Code blank appear
 * here — paste these into the sheet's Asset Code column and the next upload of the same
 * file SKIPS those rows instead of creating a second copy of every one.
 */
export interface IAssignedCode {
  /** Row number as Excel shows it, so values can be pasted back by row. */
  row: number;
  assetCode: string;
  assetName: string;
}

export interface IImportResult {
  /** False means NOTHING was imported — fix the listed problems and re-upload. */
  imported: boolean;
  created: number;
  /** Existing assets rewritten from their matched rows (update mode only). */
  updated: number;
  skippedExisting: number;
  /**
   * ECHO of the request flag. The confirm step sends THIS value back, never the
   * checkbox's own state — so the previewed plan and the imported plan cannot disagree
   * about the mode, the same way the snapshotted bytes work.
   */
  updateExisting: boolean;
  problems: IImportProblem[];
  warnings: string[];
  /** True when this run planned only — nothing was written, nothing will be. */
  preview: boolean;
  rowsRead: number;
  wouldCreate: number;
  /** Existing assets that WOULD be rewritten (update mode). */
  wouldUpdate: number;
  wouldAutoGenerateCodes: number;
  /** What a generated code will look like, e.g. "AST-2026-00918" — shown so the
   * operator can fix the format under Settings BEFORE codes become permanent. */
  codeFormatExample: string | null;
  /** False when no format was ever saved and the example shows the default. */
  codeFormatConfigured: boolean;
  plannedEntities: IPlannedEntityGroup[];
  dateConversions: IPlannedDateConversion[];
  /** Populated only on a committed import; always empty on a preview. */
  assignedCodes: IAssignedCode[];
}

export const downloadImportTemplate = (
  entity: TExchangeEntity
): Promise<Response> =>
  requestApi({
    apiEndpoint: `/DataExchange/template/${entity}`,
    method: 'GET',
    returnBlob: true,
  }) as Promise<Response>;

export const downloadExport = (entity: TExchangeEntity): Promise<Response> =>
  requestApi({
    apiEndpoint: `/DataExchange/export/${entity}`,
    method: 'GET',
    returnBlob: true,
  }) as Promise<Response>;

/**
 * Bytes, not a File reference. A File is live — the OS can change it between the
 * check and the confirm — so the dialog snapshots it once and both requests send
 * the identical bytes: what was previewed is what imports, by construction.
 */
const asForm = (
  bytes: Blob,
  name: string,
  overrides?: ICellOverride[],
  importId?: string,
  updateExisting?: boolean
) => {
  const formData = new FormData();
  formData.append('file', bytes, name);
  // Fixes ride the same request as the bytes they correct — check and import always
  // see the identical (file + fixes) pair.
  if (overrides && overrides.length > 0)
    formData.append('overrides', JSON.stringify(overrides));
  // Correlates this request with the progress the browser polls for while it runs.
  if (importId) formData.append('importId', importId);
  // Assets only; the server refuses it anywhere else.
  if (updateExisting) formData.append('updateExisting', 'true');
  return formData;
};

/** How far an in-flight import has got. */
export interface IImportProgress {
  total: number;
  done: number;
  /** "Checking" while validating (no writes yet), "Importing" while committing. */
  phase: string;
  finished: boolean;
  percent: number;
}

/**
 * Polled WHILE the import POST is still in flight, so it is deliberately tiny and
 * touches no data. A 404 simply means the run has not registered yet or has already
 * been swept — never an error worth showing.
 */
export const fetchImportProgress = (
  importId: string
): Promise<IResponse<IImportProgress>> =>
  requestApi({
    apiEndpoint: `/DataExchange/import/progress/${importId}`,
    method: 'GET',
    completeData: true,
  });

/** All-or-nothing: any row problem means nothing was written. */
export const importFile = (
  entity: TExchangeEntity,
  bytes: Blob,
  name: string,
  overrides?: ICellOverride[],
  importId?: string,
  updateExisting?: boolean
): Promise<IResponse<IImportResult>> =>
  requestApi({
    apiEndpoint: `/DataExchange/import/${entity}`,
    method: 'POST',
    body: asForm(bytes, name, overrides, importId, updateExisting),
    completeData: true,
  });

/** The plan phase alone — full validation and every assumption, zero writes. */
export const previewImport = (
  entity: TExchangeEntity,
  bytes: Blob,
  name: string,
  overrides?: ICellOverride[],
  importId?: string,
  updateExisting?: boolean
): Promise<IResponse<IImportResult>> =>
  requestApi({
    apiEndpoint: `/DataExchange/import/${entity}/preview`,
    method: 'POST',
    body: asForm(bytes, name, overrides, importId, updateExisting),
    completeData: true,
  });
