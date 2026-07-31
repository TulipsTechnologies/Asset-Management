import { requestApi } from './httpService';
import { buildQuery } from '@/utils/serviceUtils';
import { IPagedResponse, IResponse } from '@/interface/IGeneric';
import {
  IAsset,
  IAssetFilter,
  IAssetListItem,
  ICreateAsset,
} from '@/interface/IAsset';

export const fetchAssets = (
  filter: IAssetFilter = {}
): Promise<IPagedResponse<IAssetListItem>> => {
  return requestApi({
    apiEndpoint:
      '/Assets' +
      buildQuery({
        PageNumber: filter.pageNumber,
        PageSize: filter.pageSize,
        Search: filter.search,
        AssetCategoryId: filter.assetCategoryId,
        LifecycleStatus: filter.lifecycleStatus,
        CustodyStatus: filter.custodyStatus,
        OperationalStatus: filter.operationalStatus,
        FinancialStatus: filter.financialStatus,
        VerificationStatus: filter.verificationStatus,
        OwnershipType: filter.ownershipType,
      }),
    method: 'GET',
    completeData: true,
  });
};

export const fetchAssetById = (id: string): Promise<IResponse<IAsset>> => {
  return requestApi({
    apiEndpoint: `/Assets/${id}`,
    method: 'GET',
    completeData: true,
  });
};

/**
 * Creates an asset. The AssetCode is generated server-side per the company's
 * code configuration and is immutable afterwards.
 */
export const createAsset = (
  data: ICreateAsset
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: '/Assets',
    method: 'POST',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });
};
