import { requestApi } from './httpService';
import { buildQuery, sortQuery } from '@/utils/serviceUtils';
import { IPagedResponse, IResponse } from '@/interface/IGeneric';
import {
  IAssetConditionLookup,
  IAssetConditionType,
  IAssetConditionTypeFilter,
  IUpdateAssetConditionType,
  IUpsertAssetConditionType,
} from '@/interface/IAssetConditionType';

export const fetchAssetConditionTypes = (
  filter: IAssetConditionTypeFilter = {}
): Promise<IPagedResponse<IAssetConditionType>> =>
  requestApi({
    apiEndpoint:
      '/AssetConditionTypes' +
      buildQuery({
        PageNumber: filter.pageNumber,
        PageSize: filter.pageSize,
        ...sortQuery(filter),
        Search: filter.search,
        IsActive: filter.isActive,
        OwnOnly: filter.ownOnly,
      }),
    method: 'GET',
    completeData: true,
  });

/**
 * The dropdown feed: system defaults plus this company's own, active only, ordered.
 * `includeId` adds back a single row the caller's record already holds even though it has
 * been deactivated — without it, an edit form would silently blank its own value.
 */
export const fetchAssetConditionLookup = (
  includeId?: string
): Promise<IResponse<IAssetConditionLookup[]>> =>
  requestApi({
    apiEndpoint:
      '/AssetConditionTypes/lookup' + buildQuery({ IncludeId: includeId }),
    method: 'GET',
    completeData: true,
  });

export const createAssetConditionType = (
  data: IUpsertAssetConditionType
): Promise<IResponse<string>> =>
  requestApi({
    apiEndpoint: '/AssetConditionTypes',
    method: 'POST',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });

export const updateAssetConditionType = (
  id: string,
  data: IUpdateAssetConditionType
): Promise<IResponse<string>> =>
  requestApi({
    apiEndpoint: `/AssetConditionTypes/${id}`,
    method: 'PUT',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });

export const deleteAssetConditionType = (
  id: string
): Promise<IResponse<string>> =>
  requestApi({
    apiEndpoint: `/AssetConditionTypes/${id}`,
    method: 'DELETE',
    completeData: true,
  });

/** Undo a hide: puts a built-in back in this company's list. `id` is the hidden row's own id. */
export const restoreAssetConditionType = (
  id: string
): Promise<IResponse<string>> =>
  requestApi({
    apiEndpoint: `/AssetConditionTypes/${id}/restore`,
    method: 'POST',
    completeData: true,
  });
