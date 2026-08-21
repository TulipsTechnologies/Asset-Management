import { requestApi } from './httpService';
import { IPagedResponse, IResponse } from '@/interface/IGeneric';
import {
  ISystemTestDemoDataRequest,
  ISystemTestEnvironment,
  ISystemTestModules,
  ISystemTestProvisionResult,
  ISystemTestRegressionRequest,
  ISystemTestRun,
  ISystemTestRunFilter,
} from '@/interface/ISystemTest';
import { buildQuery, sortQuery } from '@/utils/serviceUtils';

/**
 * SystemTestController client (§8 as amended by §12). Destructive calls carry the PIN in
 * the request body and are verified server-side in the same call — the PIN is never stored
 * here, never echoed back, and never appears in a URL.
 */

export const fetchSystemTestModules = (): Promise<IResponse<ISystemTestModules>> =>
  requestApi({
    apiEndpoint: '/SystemTest/modules',
    method: 'GET',
    completeData: true,
  });

export const fetchSystemTestEnvironment = (): Promise<IResponse<ISystemTestEnvironment>> =>
  requestApi({
    apiEndpoint: '/SystemTest/environment',
    method: 'GET',
    completeData: true,
  });

/** §5: provisions 'Asset Test Company' and 'Asset Demo Company'. Destructive-class: PIN. */
export const provisionSystemTestCompanies = (
  pin: string
): Promise<IResponse<ISystemTestProvisionResult>> =>
  requestApi({
    apiEndpoint: '/SystemTest/provision',
    method: 'POST',
    body: JSON.stringify({ pin }),
    contentType: 'application/json',
    completeData: true,
  });

/** Read-only diagnosis of the current company; synchronous, returns the persisted run. */
export const runSystemTestHealthCheck = (
  moduleKey?: string | null
): Promise<IResponse<ISystemTestRun>> =>
  requestApi({
    apiEndpoint: '/SystemTest/health-check',
    method: 'POST',
    body: JSON.stringify({ moduleKey: moduleKey || null }),
    contentType: 'application/json',
    completeData: true,
  });

/** Demo load (refresh ⇒ module reset first). Registered demo/test company only. */
export const runSystemTestDemoData = (
  request: ISystemTestDemoDataRequest
): Promise<IResponse<ISystemTestRun>> =>
  requestApi({
    apiEndpoint: '/SystemTest/demo-data',
    method: 'POST',
    body: JSON.stringify(request),
    contentType: 'application/json',
    completeData: true,
  });

/**
 * Environment reset — permanently erases ONE company's asset data. Any company the caller
 * is a member of (not only test/demo): the deliberate "client finished testing, start the
 * real system fresh" wipe. PIN-gated and name-confirmed, both verified server-side.
 */
export const resetCompanyData = (
  companyId: string,
  confirmationPhrase: string,
  pin: string
): Promise<IResponse<{ totalRows: number; deleted: Record<string, number> }>> =>
  requestApi({
    apiEndpoint: '/SystemTest/reset',
    method: 'POST',
    body: JSON.stringify({ companyId, confirmationPhrase, pin }),
    contentType: 'application/json',
    completeData: true,
  });

/** Deterministic regression. Registered TEST company only — never the demo company. */
export const runSystemTestRegression = (
  request: ISystemTestRegressionRequest
): Promise<IResponse<ISystemTestRun>> =>
  requestApi({
    apiEndpoint: '/SystemTest/regression',
    method: 'POST',
    body: JSON.stringify(request),
    contentType: 'application/json',
    completeData: true,
  });

export const fetchSystemTestRuns = (
  filter: ISystemTestRunFilter
): Promise<IPagedResponse<ISystemTestRun>> =>
  requestApi({
    apiEndpoint: `/SystemTest/runs${buildQuery({
      pageNumber: filter.pageNumber,
      pageSize: filter.pageSize,
      kind: filter.kind,
      status: filter.status,
      moduleKey: filter.moduleKey,
      ...sortQuery(filter),
    })}`,
    method: 'GET',
    completeData: true,
  });

export const fetchSystemTestRun = (id: string): Promise<IResponse<ISystemTestRun>> =>
  requestApi({
    apiEndpoint: `/SystemTest/runs/${id}`,
    method: 'GET',
    completeData: true,
  });

/** §12.4: force-terminates a Running row. PIN-verified in the service. */
export const abortSystemTestRun = (id: string, pin: string): Promise<IResponse<null>> =>
  requestApi({
    apiEndpoint: `/SystemTest/runs/${id}/abort`,
    method: 'POST',
    body: JSON.stringify({ pin }),
    contentType: 'application/json',
    completeData: true,
  });

/** §12.10: changing the PIN requires the current PIN alongside both permissions. */
export const changeSystemTestPin = (
  currentPin: string,
  newPin: string
): Promise<IResponse<null>> =>
  requestApi({
    apiEndpoint: '/SystemTest/pin',
    method: 'POST',
    body: JSON.stringify({ currentPin, newPin }),
    contentType: 'application/json',
    completeData: true,
  });
