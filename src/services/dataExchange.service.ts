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

export interface IImportResult {
  /** False means NOTHING was imported — fix the listed problems and re-upload. */
  imported: boolean;
  created: number;
  skippedExisting: number;
  problems: IImportProblem[];
  warnings: string[];
  /** True when this run planned only — nothing was written, nothing will be. */
  preview: boolean;
  rowsRead: number;
  wouldCreate: number;
  wouldAutoGenerateCodes: number;
  plannedEntities: IPlannedEntityGroup[];
  dateConversions: IPlannedDateConversion[];
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
const asForm = (bytes: Blob, name: string) => {
  const formData = new FormData();
  formData.append('file', bytes, name);
  return formData;
};

/** All-or-nothing: any row problem means nothing was written. */
export const importFile = (
  entity: TExchangeEntity,
  bytes: Blob,
  name: string
): Promise<IResponse<IImportResult>> =>
  requestApi({
    apiEndpoint: `/DataExchange/import/${entity}`,
    method: 'POST',
    body: asForm(bytes, name),
    completeData: true,
  });

/** The plan phase alone — full validation and every assumption, zero writes. */
export const previewImport = (
  entity: TExchangeEntity,
  bytes: Blob,
  name: string
): Promise<IResponse<IImportResult>> =>
  requestApi({
    apiEndpoint: `/DataExchange/import/${entity}/preview`,
    method: 'POST',
    body: asForm(bytes, name),
    completeData: true,
  });
