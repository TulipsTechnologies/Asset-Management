import { requestApi } from './httpService';
import { buildQuery } from '@/utils/serviceUtils';
import { IPagedResponse, IResponse } from '@/interface/IGeneric';
import {
  IAsset,
  IAssetFilter,
  IAssetListItem,
  ICreateAsset,
  IUpdateAsset,
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

/**
 * Updates an asset's registry fields. The AssetCode is immutable and condition
 * / statuses are workflow-owned, so none of them are part of the payload.
 * Requires the round-tripped rowVersion; 409 = stale rowVersion or duplicate
 * tag/serial (the message says which).
 */
export const updateAsset = (
  id: string,
  data: IUpdateAsset
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: `/Assets/${id}`,
    method: 'PUT',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });
};

/**
 * Retires an Active asset. 409 when the asset is in custody or has an active
 * transfer (the message explains) — surface it verbatim. Retired assets can be
 * re-activated with activateAsset.
 */
export const retireAsset = (
  id: string,
  rowVersion: string,
  reason?: string
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: `/Assets/${id}/retire`,
    method: 'POST',
    body: JSON.stringify({ reason: reason || undefined, rowVersion }),
    contentType: 'application/json',
    completeData: true,
  });
};

/**
 * Activates a Draft (or reactivates a Retired) asset. Requires the asset's
 * round-tripped rowVersion; a stale value returns the standard 409 conflict.
 */
export const activateAsset = (
  id: string,
  rowVersion: string
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: `/Assets/${id}/activate`,
    method: 'POST',
    body: JSON.stringify({ rowVersion }),
    contentType: 'application/json',
    completeData: true,
  });
};
