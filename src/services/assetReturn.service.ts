import { requestApi } from './httpService';
import { buildQuery, sortQuery } from '@/utils/serviceUtils';
import { IPagedResponse, IResponse } from '@/interface/IGeneric';
import {
  IAssetReturn,
  IAssetReturnFilter,
  ICancelAssetReturn,
  ICompleteAssetReturn,
  ICreateAssetReturn,
} from '@/interface/IAssetReturn';

export const fetchAssetReturns = (
  filter: IAssetReturnFilter = {}
): Promise<IPagedResponse<IAssetReturn>> => {
  return requestApi({
    apiEndpoint:
      '/AssetReturns' +
      buildQuery({
        PageNumber: filter.pageNumber,
        PageSize: filter.pageSize,
        ...sortQuery(filter),
        Search: filter.search,
        Status: filter.status,
        Outcome: filter.outcome,
        AssetId: filter.assetId,
        EmployeeId: filter.employeeId,
        FromDate: filter.fromDate,
        ToDate: filter.toDate,
      }),
    method: 'GET',
    completeData: true,
  });
};

export const fetchAssetReturnById = (
  id: string
): Promise<IResponse<IAssetReturn>> => {
  return requestApi({
    apiEndpoint: `/AssetReturns/${id}`,
    method: 'GET',
    completeData: true,
  });
};

/**
 * Initiates a return — takes the asset back with inspection pending. Carries
 * the ASSIGNMENT's rowVersion; 409 on active transfer, stale assignment or an
 * already-pending return.
 */
export const initiateAssetReturn = (
  data: ICreateAssetReturn
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: '/AssetReturns',
    method: 'POST',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });
};

/** Inspects the returned asset and applies the outcome (RETURN's rowVersion). */
export const completeAssetReturn = (
  id: string,
  data: ICompleteAssetReturn
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: `/AssetReturns/${id}/complete`,
    method: 'POST',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });
};

/**
 * Cancels a pending return — custody is restored to the original employee via
 * a fresh open assignment.
 */
export const cancelAssetReturn = (
  id: string,
  data: ICancelAssetReturn
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: `/AssetReturns/${id}/cancel`,
    method: 'POST',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });
};
