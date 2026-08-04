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

export interface IImportResult {
  /** False means NOTHING was imported — fix the listed problems and re-upload. */
  imported: boolean;
  created: number;
  skippedExisting: number;
  problems: IImportProblem[];
  warnings: string[];
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

/** All-or-nothing: any row problem means nothing was written. */
export const importFile = (
  entity: TExchangeEntity,
  file: File
): Promise<IResponse<IImportResult>> => {
  const formData = new FormData();
  formData.append('file', file);
  return requestApi({
    apiEndpoint: `/DataExchange/import/${entity}`,
    method: 'POST',
    body: formData,
    completeData: true,
  });
};
