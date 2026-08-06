import { requestApi } from './httpService';
import { buildQuery, sortQuery } from '@/utils/serviceUtils';
import { IPagedResponse, IResponse } from '@/interface/IGeneric';
import {
  ICancelMaintenanceRequest,
  ICancelWorkOrder,
  ICompleteWorkOrder,
  IConvertMaintenanceRequest,
  ICreateMaintenanceRequest,
  ICreateWorkOrder,
  IMaintenanceRequest,
  IMaintenanceRequestFilter,
  IRejectMaintenanceRequest,
  IReleaseAssetHold,
  IStartWorkOrder,
  IWorkOrder,
  IWorkOrderFilter,
} from '@/interface/IMaintenance';

// ---- Maintenance requests ----

export const getMaintenanceRequests = (
  filter: IMaintenanceRequestFilter = {}
): Promise<IPagedResponse<IMaintenanceRequest>> => {
  return requestApi({
    apiEndpoint:
      '/MaintenanceRequests' +
      buildQuery({
        PageNumber: filter.pageNumber,
        PageSize: filter.pageSize,
        ...sortQuery(filter),
        Search: filter.search,
        Status: filter.status,
        RequestType: filter.requestType,
        Priority: filter.priority,
        AssetId: filter.assetId,
        FromDate: filter.fromDate,
        ToDate: filter.toDate,
      }),
    method: 'GET',
    completeData: true,
  });
};

export const getMaintenanceRequest = (
  id: string
): Promise<IResponse<IMaintenanceRequest>> => {
  return requestApi({
    apiEndpoint: `/MaintenanceRequests/${id}`,
    method: 'GET',
    completeData: true,
  });
};

/**
 * Raises a request. A Breakdown-type report also flips the asset to Breakdown,
 * but only from Operational and only for its custodian or a manager.
 */
export const createMaintenanceRequest = (
  data: ICreateMaintenanceRequest
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: '/MaintenanceRequests',
    method: 'POST',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });
};

const requestTransition = (
  id: string,
  action: string,
  body: Record<string, unknown>
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: `/MaintenanceRequests/${id}/${action}`,
    method: 'POST',
    body: JSON.stringify(body),
    contentType: 'application/json',
    completeData: true,
  });
};

/**
 * Turns an Open request into a work order (fields default from the request).
 * 409s when the asset already has an active work order or is held — the
 * message says which; show it verbatim.
 */
export const convertMaintenanceRequest = (
  id: string,
  data: IConvertMaintenanceRequest
) => requestTransition(id, 'convert', { ...data });

/** Reject an Open request; restores a withdrawn Breakdown flip when nothing else holds the asset. */
export const rejectMaintenanceRequest = (
  id: string,
  data: IRejectMaintenanceRequest
) => requestTransition(id, 'reject', { ...data });

/** Withdraw an Open request — the creator may cancel their own; anyone else needs a manage permission. */
export const cancelMaintenanceRequest = (
  id: string,
  data: ICancelMaintenanceRequest
) => requestTransition(id, 'cancel', { ...data });

// ---- Work orders ----

export const getWorkOrders = (
  filter: IWorkOrderFilter = {}
): Promise<IPagedResponse<IWorkOrder>> => {
  return requestApi({
    apiEndpoint:
      '/WorkOrders' +
      buildQuery({
        PageNumber: filter.pageNumber,
        PageSize: filter.pageSize,
        ...sortQuery(filter),
        Search: filter.search,
        Status: filter.status,
        WorkOrderType: filter.workOrderType,
        Priority: filter.priority,
        AssetId: filter.assetId,
        AssignedToEmployeeId: filter.assignedToEmployeeId,
        VendorId: filter.vendorId,
        FromDate: filter.fromDate,
        ToDate: filter.toDate,
      }),
    method: 'GET',
    completeData: true,
  });
};

export const getWorkOrder = (id: string): Promise<IResponse<IWorkOrder>> => {
  return requestApi({
    apiEndpoint: `/WorkOrders/${id}`,
    method: 'GET',
    completeData: true,
  });
};

/**
 * Raises a work order directly (without a request). 409 when the asset already
 * has an active work order, or when it is Quarantined/OutOfService — a hold is
 * lifted only by release/recommission.
 */
export const createWorkOrder = (
  data: ICreateWorkOrder
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: '/WorkOrders',
    method: 'POST',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });
};

const workOrderTransition = (
  id: string,
  action: string,
  body: Record<string, unknown>
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: `/WorkOrders/${id}/${action}`,
    method: 'POST',
    body: JSON.stringify(body),
    contentType: 'application/json',
    completeData: true,
  });
};

/** Snapshots the asset's operational status and sets Under Maintenance. Refused for a held asset. */
export const startWorkOrder = (id: string, data: IStartWorkOrder) =>
  workOrderTransition(id, 'start', { ...data });

/**
 * Finishes the work and applies the outcome to the Operational dimension. The
 * two park outcomes are refused while the asset is in a custodian's hands or
 * has a return pending; completion is refused while the asset is Missing.
 */
export const completeWorkOrder = (id: string, data: ICompleteWorkOrder) =>
  workOrderTransition(id, 'complete', { ...data });

/** Restores the operational status captured at start and reopens the source request. */
export const cancelWorkOrder = (id: string, data: ICancelWorkOrder) =>
  workOrderTransition(id, 'cancel', { ...data });

// ---- Asset holds (the only audited exits) ----

/** Lifts a Quarantined hold (Quarantined → Operational). Custody is untouched. */
export const releaseAsset = (
  id: string,
  data: IReleaseAssetHold
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: `/Assets/${id}/release`,
    method: 'POST',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });
};

/** Returns an OutOfService asset to service (OutOfService → Operational). */
export const recommissionAsset = (
  id: string,
  data: IReleaseAssetHold
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: `/Assets/${id}/recommission`,
    method: 'POST',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });
};
