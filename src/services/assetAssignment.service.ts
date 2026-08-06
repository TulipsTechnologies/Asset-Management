import { requestApi } from './httpService';
import { buildQuery, sortQuery } from '@/utils/serviceUtils';
import { IPagedResponse, IResponse } from '@/interface/IGeneric';
import {
  IAssetAssignment,
  IAssetAssignmentFilter,
  IAssignableAsset,
  IAssignmentAnalytics,
  IAssignableAssetFilter,
  IBulkAssignAssets,
  IBulkAssignResult,
  ICreateAssetAssignment,
  IReturnAssetAssignment,
} from '@/interface/IAssetAssignment';

/**
 * The filter params every assignment feed accepts. The list, the board's columns and the
 * analytics all send this, so switching view cannot change which assignments are described.
 * Paging is excluded — only the list pages.
 */
const assignmentFilterQuery = (filter: IAssetAssignmentFilter) => ({
  ...sortQuery(filter),
  Search: filter.search,
  AssetId: filter.assetId,
  EmployeeId: filter.employeeId,
  Status: filter.status,
  IsOverdue: filter.isOverdue,
});

export const fetchAssetAssignments = (
  filter: IAssetAssignmentFilter = {}
): Promise<IPagedResponse<IAssetAssignment>> => {
  return requestApi({
    apiEndpoint:
      '/AssetAssignments' +
      buildQuery({
        PageNumber: filter.pageNumber,
        PageSize: filter.pageSize,
        ...assignmentFilterQuery(filter),
      }),
    method: 'GET',
    completeData: true,
  });
};

/** Aggregates over the same filtered assignments — status mix, custodians, trend. */
export const fetchAssignmentAnalytics = (
  filter: IAssetAssignmentFilter = {}
): Promise<IResponse<IAssignmentAnalytics>> => {
  return requestApi({
    apiEndpoint: '/AssetAssignments/analytics' + buildQuery({ ...assignmentFilterQuery(filter) }),
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

/**
 * The bulk picker feed. Eligibility is advisory — the server re-runs every guard on
 * submit. Pass includeIneligible to also receive blocked assets with their reason,
 * and assetIds to rehydrate a specific selection.
 */
export const fetchAssignableAssets = (
  filter: IAssignableAssetFilter = {}
): Promise<IPagedResponse<IAssignableAsset>> => {
  // Repeated AssetIds keys bind to the server's List<Guid>. Built by hand rather than
  // appended to buildQuery's output, which omits its leading "?" when every other
  // parameter is empty and would otherwise splice the ids on with an "&".
  const parts = [
    buildQuery({
      PageNumber: filter.pageNumber,
      PageSize: filter.pageSize,
      Search: filter.search,
      AssetCategoryId: filter.assetCategoryId,
      IncludeIneligible: filter.includeIneligible,
    }).replace(/^\?/, ''),
    ...(filter.assetIds ?? []).map((id) => `AssetIds=${encodeURIComponent(id)}`),
  ].filter(Boolean);

  return requestApi({
    apiEndpoint:
      '/AssetAssignments/assignable' + (parts.length ? `?${parts.join('&')}` : ''),
    method: 'GET',
    completeData: true,
  });
};

/**
 * Issues many assets to one employee. Always answers 200 with a per-asset report:
 * `success` is false when anything was refused, so read `data.outcomes`, not the
 * envelope, to know what actually happened.
 */
export const bulkAssignAssets = (
  data: IBulkAssignAssets
): Promise<IResponse<IBulkAssignResult>> => {
  return requestApi({
    apiEndpoint: '/AssetAssignments/bulk',
    method: 'POST',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });
};
