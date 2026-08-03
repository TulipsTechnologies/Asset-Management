import { requestApi } from './httpService';
import { buildQuery } from '@/utils/serviceUtils';
import { IPagedResponse, IResponse } from '@/interface/IGeneric';
import {
  IAssetRecoveryCase,
  IAssetRecoveryCaseFilter,
  ICloseAssetRecoveryCase,
} from '@/interface/IAssetReturn';

export const fetchAssetRecoveryCases = (
  filter: IAssetRecoveryCaseFilter = {}
): Promise<IPagedResponse<IAssetRecoveryCase>> => {
  return requestApi({
    apiEndpoint:
      '/AssetRecoveryCases' +
      buildQuery({
        PageNumber: filter.pageNumber,
        PageSize: filter.pageSize,
        Search: filter.search,
        Status: filter.status,
        EmployeeId: filter.employeeId,
        AssetId: filter.assetId,
      }),
    method: 'GET',
    completeData: true,
  });
};

/** Closes an open recovery case as Settled (2) or Waived (3). */
export const closeAssetRecoveryCase = (
  id: string,
  data: ICloseAssetRecoveryCase
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: `/AssetRecoveryCases/${id}/close`,
    method: 'POST',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });
};
