import { requestApi } from './httpService';
import { IResponse } from '@/interface/IGeneric';

export interface IEmployeeSyncSummary {
  companiesSynced: number;
  created: number;
  updated: number;
  deactivated: number;
  /** Companies skipped, and why — a skip is never silent. */
  skipped: string[];
  /** Data problems in TulipsHRM the sync worked around. */
  warnings: string[];
}

/**
 * Pulls this company's employees from TulipsHRM. HRM-linked companies only;
 * nobody is ever deleted — people who left HRM are deactivated so their
 * custody history survives.
 */
export const syncEmployeesFromHrm = (): Promise<
  IResponse<IEmployeeSyncSummary>
> =>
  requestApi({
    apiEndpoint: '/Employees/sync-from-hrm',
    method: 'POST',
    completeData: true,
  });
