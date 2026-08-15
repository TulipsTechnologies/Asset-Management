import { requestApi } from './httpService';
import { buildQuery, sortQuery } from '@/utils/serviceUtils';
import { IPagedResponse, IResponse } from '@/interface/IGeneric';
import {
  IAssetLocation,
  IAssetLocationFilter,
  IAssetLocationTree,
  IUpdateAssetLocation,
  IUpsertAssetLocation,
} from '@/interface/IAssetLocation';

export const fetchAssetLocations = (
  filter: IAssetLocationFilter = {}
): Promise<IPagedResponse<IAssetLocation>> => {
  return requestApi({
    apiEndpoint:
      '/AssetLocations' +
      buildQuery({
        PageNumber: filter.pageNumber,
        PageSize: filter.pageSize,
        ...sortQuery(filter),
        Search: filter.search,
        IsActive: filter.isActive,
      }),
    method: 'GET',
    completeData: true,
  });
};

/** The full hierarchy (max depth 3) with per-node asset counts — the tree view's shape. */
export const fetchAssetLocationTree = (): Promise<
  IResponse<IAssetLocationTree[]>
> =>
  requestApi({
    apiEndpoint: '/AssetLocations/tree',
    method: 'GET',
    completeData: true,
  });

export const createAssetLocation = (
  data: IUpsertAssetLocation
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: '/AssetLocations',
    method: 'POST',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });
};

export const updateAssetLocation = (
  id: string,
  data: IUpdateAssetLocation
): Promise<IResponse<string>> =>
  requestApi({
    apiEndpoint: `/AssetLocations/${id}`,
    method: 'PUT',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });

/** Soft delete — refused with a named blocker while children or assets reference it. */
export const deleteAssetLocation = (id: string): Promise<IResponse<string>> =>
  requestApi({ apiEndpoint: `/AssetLocations/${id}`, method: 'DELETE', completeData: true });
