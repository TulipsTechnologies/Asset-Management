import { requestApi } from './httpService';
import { buildQuery } from '@/utils/serviceUtils';
import { IPagedResponse, IResponse } from '@/interface/IGeneric';
import {
  IAssetAuditCampaign,
  IAssetAuditCampaignFilter,
  IAssetAuditDiscrepancy,
  IAssetAuditDiscrepancyFilter,
  IAssetAuditResult,
  IAssetAuditResultFilter,
  IAuditResolve,
  ICreateAssetAuditCampaign,
  IRecordAssetAuditResult,
  IReconcileAssetAuditDiscrepancy,
  IUpdateAssetAuditCampaign,
} from '@/interface/IAssetAudit';

// ---- Campaigns ----

export const getCampaigns = (
  filter: IAssetAuditCampaignFilter = {}
): Promise<IPagedResponse<IAssetAuditCampaign>> => {
  return requestApi({
    apiEndpoint:
      '/AssetAuditCampaigns' +
      buildQuery({
        PageNumber: filter.pageNumber,
        PageSize: filter.pageSize,
        Search: filter.search,
        Status: filter.status,
        FromDate: filter.fromDate,
        ToDate: filter.toDate,
      }),
    method: 'GET',
    completeData: true,
  });
};

export const getCampaign = (
  id: string
): Promise<IResponse<IAssetAuditCampaign>> => {
  return requestApi({
    apiEndpoint: `/AssetAuditCampaigns/${id}`,
    method: 'GET',
    completeData: true,
  });
};

export const createCampaign = (
  data: ICreateAssetAuditCampaign
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: '/AssetAuditCampaigns',
    method: 'POST',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });
};

/** Edit a Draft campaign (scopes replaced wholesale). 400 missing / 409 stale rowVersion. */
export const updateCampaign = (
  id: string,
  data: IUpdateAssetAuditCampaign
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: `/AssetAuditCampaigns/${id}`,
    method: 'PUT',
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
    apiEndpoint: `/AssetAuditCampaigns/${id}/${action}`,
    method: 'POST',
    body: JSON.stringify(body),
    contentType: 'application/json',
    completeData: true,
  });
};

/** Materializes the expected-asset snapshot as Pending results and locks the scopes. */
export const startCampaign = (id: string, rowVersion: string) =>
  transition(id, 'start', { rowVersion });

/** Closes scanning: still-Pending rows flip to NotFound with open discrepancies. */
export const submitCampaign = (id: string, rowVersion: string) =>
  transition(id, 'submit', { rowVersion });

/**
 * Applies the campaign's effects — the ONLY step that touches assets. 400 with
 * the open-discrepancy count, 409 listing stale asset codes; show verbatim.
 */
export const approveCampaign = (id: string, rowVersion: string) =>
  transition(id, 'approve', { rowVersion });

/** Cancel (any non-terminal state): zero asset footprint; results stay frozen. */
export const cancelCampaign = (id: string, reason: string, rowVersion: string) =>
  transition(id, 'cancel', { reason, rowVersion });

// ---- Results ----

export const getResults = (
  campaignId: string,
  filter: IAssetAuditResultFilter = {}
): Promise<IPagedResponse<IAssetAuditResult>> => {
  return requestApi({
    apiEndpoint:
      `/AssetAuditCampaigns/${campaignId}/results` +
      buildQuery({
        PageNumber: filter.pageNumber,
        PageSize: filter.pageSize,
        Search: filter.search,
        ResultType: filter.resultType,
        HasOpenDiscrepancies: filter.hasOpenDiscrepancies,
      }),
    method: 'GET',
    completeData: true,
  });
};

/**
 * Resolves a scanned code (AssetCode → AssetTag → active QR/Barcode/RFID).
 * One candidate = resolved (existing result + rowVersion rides along);
 * several = ambiguity list; no match = 400 envelope.
 */
export const resolveCode = (
  campaignId: string,
  code: string
): Promise<IResponse<IAuditResolve>> => {
  return requestApi({
    apiEndpoint:
      `/AssetAuditCampaigns/${campaignId}/resolve` + buildQuery({ Code: code }),
    method: 'GET',
    completeData: true,
  });
};

/**
 * Records an inspection (InProgress campaigns only). Updating an existing
 * result row requires its round-tripped rowVersion (400 missing / 409 stale).
 */
export const recordResult = (
  campaignId: string,
  data: IRecordAssetAuditResult
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: `/AssetAuditCampaigns/${campaignId}/results`,
    method: 'POST',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });
};

// ---- Discrepancies ----

export const getDiscrepancies = (
  campaignId: string,
  filter: IAssetAuditDiscrepancyFilter = {}
): Promise<IPagedResponse<IAssetAuditDiscrepancy>> => {
  return requestApi({
    apiEndpoint:
      `/AssetAuditCampaigns/${campaignId}/discrepancies` +
      buildQuery({
        PageNumber: filter.pageNumber,
        PageSize: filter.pageSize,
        Search: filter.search,
        Status: filter.status,
        DiscrepancyType: filter.discrepancyType,
      }),
    method: 'GET',
    completeData: true,
  });
};

/**
 * Reconciles a discrepancy — action must fit the type matrix, notes required.
 * Re-reconciling replaces the standing decision (history appends).
 */
export const reconcileDiscrepancy = (
  id: string,
  data: IReconcileAssetAuditDiscrepancy
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: `/AssetAuditDiscrepancies/${id}/reconcile`,
    method: 'POST',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });
};

// ---- Evidence ----

/**
 * Attaches an evidence photo/file as multipart/form-data. contentType is
 * deliberately NOT set — the browser must generate the multipart boundary
 * itself (see the note in httpService).
 */
export const uploadEvidence = (
  resultId: string,
  file: File,
  caption?: string
): Promise<IResponse<string>> => {
  const formData = new FormData();
  if (caption) formData.append('Caption', caption);
  formData.append('file', file);

  return requestApi({
    apiEndpoint: `/AssetAuditResults/${resultId}/evidence`,
    method: 'POST',
    body: formData,
    completeData: true,
  });
};

/**
 * Downloads the raw evidence file. Returns the fetch Response (returnBlob) so
 * callers can hand it to saveBlobResponse.
 */
export const downloadEvidence = (id: string): Promise<Response> => {
  return requestApi({
    apiEndpoint: `/AssetAuditResults/evidence/${id}/download`,
    method: 'GET',
    returnBlob: true,
  });
};

export const deleteEvidence = (id: string): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: `/AssetAuditResults/evidence/${id}`,
    method: 'DELETE',
    completeData: true,
  });
};
