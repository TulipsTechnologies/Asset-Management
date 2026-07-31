import { requestApi } from './httpService';
import { buildQuery } from '@/utils/serviceUtils';
import { IPagedResponse, IResponse } from '@/interface/IGeneric';
import {
  IAssetAssignment,
  IAssetAssignmentFilter,
  ICreateAssetAssignment,
  IReturnAssetAssignment,
} from '@/interface/IAssetAssignment';

export const fetchAssetAssignments = (
  filter: IAssetAssignmentFilter = {}
): Promise<IPagedResponse<IAssetAssignment>> => {
  return requestApi({
    apiEndpoint:
      '/AssetAssignments' +
      buildQuery({
        PageNumber: filter.pageNumber,
        PageSize: filter.pageSize,
        Search: filter.search,
        AssetId: filter.assetId,
        EmployeeId: filter.employeeId,
        Status: filter.status,
      }),
    method: 'GET',
    completeData: true,
  });
};

export const fetchAssetAssignmentById = (
  id: string
): Promise<IResponse<IAssetAssignment>> => {
  return requestApi({
    apiEndpoint: `/AssetAssignments/${id}`,
    method: 'GET',
    completeData: true,
  });
};

/**
 * Assigns an Active, unassigned asset to an employee. The backend enforces
 * one open assignment per asset (409 on conflict).
 */
export const assignAsset = (
  data: ICreateAssetAssignment
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: '/AssetAssignments',
    method: 'POST',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });
};

/**
 * Closes an open assignment (records condition at return, resets custody).
 * Pass the assignment's rowVersion — a stale value returns 409.
 */
export const returnAsset = (
  id: string,
  data: IReturnAssetAssignment
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: `/AssetAssignments/${id}/return`,
    method: 'POST',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });
};
