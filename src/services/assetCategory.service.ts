import { requestApi } from './httpService';
import { buildQuery } from '@/utils/serviceUtils';
import { IPagedResponse, IResponse } from '@/interface/IGeneric';
import {
  IAssetCategory,
  IAssetCategoryFilter,
  IAssetCategoryTree,
  IUpdateAssetCategory,
  IUpsertAssetCategory,
} from '@/interface/IAssetCategory';

export const fetchAssetCategories = (
  filter: IAssetCategoryFilter = {}
): Promise<IPagedResponse<IAssetCategory>> => {
  return requestApi({
    apiEndpoint:
      '/AssetCategories' +
      buildQuery({
        PageNumber: filter.pageNumber,
        PageSize: filter.pageSize,
        Search: filter.search,
        ParentAssetCategoryId: filter.parentAssetCategoryId,
        IsActive: filter.isActive,
      }),
    method: 'GET',
    completeData: true,
  });
};

export const fetchAssetCategoryTree = (): Promise<
  IResponse<IAssetCategoryTree[]>
> => {
  return requestApi({
    apiEndpoint: '/AssetCategories/tree',
    method: 'GET',
    completeData: true,
  });
};

export const fetchAssetCategoryById = (
  id: string
): Promise<IResponse<IAssetCategory>> => {
  return requestApi({
    apiEndpoint: `/AssetCategories/${id}`,
    method: 'GET',
    completeData: true,
  });
};

export const createAssetCategory = (
  data: IUpsertAssetCategory
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: '/AssetCategories',
    method: 'POST',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });
};

export const updateAssetCategory = (
  id: string,
  data: IUpdateAssetCategory
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: `/AssetCategories/${id}`,
    method: 'PUT',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });
};

/**
 * Soft delete. The API refuses with a 409 while the category still has child
 * categories or classified assets — surface its message verbatim.
 */
export const deleteAssetCategory = (id: string): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: `/AssetCategories/${id}`,
    method: 'DELETE',
    completeData: true,
  });
};
