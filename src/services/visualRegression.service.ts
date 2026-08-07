import { requestApi } from './httpService';
import { IPagedResponse, IResponse } from '@/interface/IGeneric';
import { VisualLevelEnum } from '@/enum/systemTestEnums';
import {
  IVisualApproveBaselineRequest,
  IVisualBaseline,
  IVisualDatasetState,
  IVisualException,
  IVisualExceptionCreateRequest,
  IVisualKeepBaselineRequest,
  IVisualResult,
  IVisualResultFilter,
  IVisualScenarioSet,
  IVisualSummary,
} from '@/interface/IVisualRegression';
import { buildQuery, sortQuery } from '@/utils/serviceUtils';

/**
 * VisualRegressionController client (visual design §8 as amended by §12.2). Review-side
 * calls only — run creation, ingest, heartbeat and complete belong to the Playwright CLI
 * in `visual/`; the web app cannot launch a browser runner and does not pretend to.
 */

export const fetchVisualScenarios = (
  level: VisualLevelEnum = VisualLevelEnum.Full,
  moduleKey?: string | null
): Promise<IResponse<IVisualScenarioSet>> =>
  requestApi({
    apiEndpoint: `/VisualRegression/scenarios${buildQuery({
      level,
      moduleKey: moduleKey || null,
    })}`,
    method: 'GET',
    completeData: true,
  });

export const fetchVisualDatasetState = (): Promise<IResponse<IVisualDatasetState>> =>
  requestApi({
    apiEndpoint: '/VisualRegression/dataset-state',
    method: 'GET',
    completeData: true,
  });

export const fetchVisualSummary = (): Promise<IResponse<IVisualSummary>> =>
  requestApi({
    apiEndpoint: '/VisualRegression/summary',
    method: 'GET',
    completeData: true,
  });

export const fetchVisualResults = (
  filter: IVisualResultFilter
): Promise<IPagedResponse<IVisualResult>> =>
  requestApi({
    apiEndpoint: `/VisualRegression/results${buildQuery({
      pageNumber: filter.pageNumber,
      pageSize: filter.pageSize,
      runId: filter.runId,
      moduleKey: filter.moduleKey,
      scenarioKey: filter.scenarioKey,
      viewport: filter.viewport,
      visualStatus: filter.visualStatus,
      functionalStatus: filter.functionalStatus,
      ...sortQuery(filter),
    })}`,
    method: 'GET',
    completeData: true,
  });

/** Baseline versions (history included) for the review modal (§10). */
export const fetchVisualBaselines = (
  scenarioKey?: string | null,
  viewport?: string | null
): Promise<IResponse<IVisualBaseline[]>> =>
  requestApi({
    apiEndpoint: `/VisualRegression/baselines${buildQuery({
      scenarioKey: scenarioKey || null,
      viewport: viewport || null,
    })}`,
    method: 'GET',
    completeData: true,
  });

/** The ONLY path that writes a baseline (§4): reason required, audited server-side. */
export const approveVisualBaseline = (
  resultId: string,
  request: IVisualApproveBaselineRequest
): Promise<IResponse<IVisualBaseline>> =>
  requestApi({
    apiEndpoint: `/VisualRegression/results/${resultId}/approve-baseline`,
    method: 'POST',
    body: JSON.stringify(request),
    contentType: 'application/json',
    completeData: true,
  });

export const keepVisualBaseline = (
  resultId: string,
  request: IVisualKeepBaselineRequest
): Promise<IResponse<IVisualResult>> =>
  requestApi({
    apiEndpoint: `/VisualRegression/results/${resultId}/keep-baseline`,
    method: 'POST',
    body: JSON.stringify(request),
    contentType: 'application/json',
    completeData: true,
  });

export const fetchVisualExceptions = (
  includeInactive = false
): Promise<IResponse<IVisualException[]>> =>
  requestApi({
    apiEndpoint: `/VisualRegression/exceptions${buildQuery({ includeInactive })}`,
    method: 'GET',
    completeData: true,
  });

export const createVisualException = (
  request: IVisualExceptionCreateRequest
): Promise<IResponse<IVisualException>> =>
  requestApi({
    apiEndpoint: '/VisualRegression/exceptions',
    method: 'POST',
    body: JSON.stringify(request),
    contentType: 'application/json',
    completeData: true,
  });

export const deactivateVisualException = (id: string): Promise<IResponse<null>> =>
  requestApi({
    apiEndpoint: `/VisualRegression/exceptions/${id}/deactivate`,
    method: 'POST',
    completeData: true,
  });

/**
 * Authenticated image fetch (§12.1). GET /VisualRegression/files/{id} sits behind the
 * bearer token and the company-scoped row lookup, so a plain `<img src>` cannot load it
 * — the browser would send no Authorization header. requestApi with `returnBlob` runs
 * the SAME header pipeline every other call uses (Bearer token, x-company-id,
 * Accept-Language) and hands back the raw Response; this helper turns it into an object
 * URL for an `<img>`. Callers own the URL's lifetime: revoke it when the image unmounts
 * (VisualImage does), or every opened modal leaks a decoded PNG.
 */
export const fetchVisualFileObjectUrl = async (fileId: string): Promise<string> => {
  const res: Response = await requestApi({
    apiEndpoint: `/VisualRegression/files/${fileId}`,
    method: 'GET',
    returnBlob: true,
  });
  const blob = await res.blob();
  return window.URL.createObjectURL(blob);
};
