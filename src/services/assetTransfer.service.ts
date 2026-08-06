import { requestApi } from './httpService';
import { buildQuery, sortQuery } from '@/utils/serviceUtils';
import { IPagedResponse, IResponse } from '@/interface/IGeneric';
import {
  IAssetTransfer,
  IAssetTransferFilter,
  ICreateAssetTransfer,
} from '@/interface/IAssetTransfer';

export const fetchAssetTransfers = (
  filter: IAssetTransferFilter = {}
): Promise<IPagedResponse<IAssetTransfer>> => {
  return requestApi({
    apiEndpoint:
      '/AssetTransfers' +
      buildQuery({
        PageNumber: filter.pageNumber,
        PageSize: filter.pageSize,
        ...sortQuery(filter),
        Search: filter.search,
        AssetId: filter.assetId,
        ToEmployeeId: filter.toEmployeeId,
        Status: filter.status,
      }),
    method: 'GET',
    completeData: true,
  });
};

export const requestAssetTransfer = (
  data: ICreateAssetTransfer
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: '/AssetTransfers',
    method: 'POST',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });
};

const transition = (
  id: string,
  action: string,
  body: Record<string, unknown>
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: `/AssetTransfers/${id}/${action}`,
    method: 'POST',
    body: JSON.stringify(body),
    contentType: 'application/json',
    completeData: true,
  });
};

export const approveAssetTransfer = (id: string, rowVersion: string) =>
  transition(id, 'approve', { rowVersion });

export const dispatchAssetTransfer = (
  id: string,
  conditionAtDispatchId: string,
  rowVersion: string
) => transition(id, 'dispatch', { conditionAtDispatchId, rowVersion });

export const receiveAssetTransfer = (
  id: string,
  conditionAtReceiptId: string,
  rowVersion: string,
  notes?: string
) => transition(id, 'receive', { conditionAtReceiptId, rowVersion, notes });

export const cancelAssetTransfer = (
  id: string,
  reason: string,
  rowVersion: string
) => transition(id, 'cancel', { reason, rowVersion });
