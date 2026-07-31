import { requestApi } from './httpService';
import { buildQuery } from '@/utils/serviceUtils';
import { IPagedResponse, IResponse } from '@/interface/IGeneric';
import {
  IAssetLocation,
  IAssetLocationFilter,
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
        Search: filter.search,
        IsActive: filter.isActive,
      }),
    method: 'GET',
    completeData: true,
  });
};

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
