import { requestApi } from './httpService';
import { IResponse } from '@/interface/IGeneric';

export interface IResetPreview {
  companyName: string;
  /** The exact phrase the operator must type to arm the reset. */
  confirmationPhrase: string;
  /** Entity name → rows that would be destroyed. */
  counts: Record<string, number>;
  /** Set when the reset is refused; null when it may proceed. */
  blocker?: string | null;
  canReset: boolean;
}

export interface IResetResult {
  deleted: Record<string, number>;
  totalRows: number;
}

export interface IDemoSeedResult {
  categories: number;
  locations: number;
  vendors: number;
  employees: number;
  assets: number;
  skipped: string[];
}

export const fetchResetPreview = (): Promise<IResponse<IResetPreview>> =>
  requestApi({
    apiEndpoint: '/MasterData/reset/preview',
    method: 'GET',
    completeData: true,
  });

/** Permanently deletes this company's asset data. There is no undo. */
export const resetCompanyData = (
  confirmationPhrase: string
): Promise<IResponse<IResetResult>> =>
  requestApi({
    apiEndpoint: '/MasterData/reset',
    method: 'POST',
    body: JSON.stringify({ confirmationPhrase }),
    contentType: 'application/json',
    completeData: true,
  });

export const seedDemoData = (): Promise<IResponse<IDemoSeedResult>> =>
  requestApi({
    apiEndpoint: '/MasterData/demo-data',
    method: 'POST',
    completeData: true,
  });
