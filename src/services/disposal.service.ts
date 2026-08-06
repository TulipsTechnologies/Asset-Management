import { requestApi } from './httpService';
import { buildQuery, sortQuery } from '@/utils/serviceUtils';
import { IPagedResponse, IResponse } from '@/interface/IGeneric';
import {
  IApproveDisposalRequest,
  ICancelDisposalRequest,
  ICreateDisposalRequest,
  IDataWipeCertificate,
  IDisposalDocument,
  IDisposalRequest,
  IDisposalRequestFilter,
  IExecuteDisposalRequest,
  IRecordDataWipeCertificate,
  IRejectDisposalRequest,
  IUploadDisposalDocument,
} from '@/interface/IDisposal';

// ---- Disposal requests ----

export const getRequests = (
  filter: IDisposalRequestFilter = {}
): Promise<IPagedResponse<IDisposalRequest>> => {
  return requestApi({
    apiEndpoint:
      '/DisposalRequests' +
      buildQuery({
        PageNumber: filter.pageNumber,
        PageSize: filter.pageSize,
        ...sortQuery(filter),
        Search: filter.search,
        Status: filter.status,
        DisposalMethod: filter.disposalMethod,
        AssetId: filter.assetId,
        FromDate: filter.fromDate,
        ToDate: filter.toDate,
      }),
    method: 'GET',
    completeData: true,
  });
};

/**
 * One request. Carries the asset's current lifecycle and custody so the client
 * can pre-flight Execute rather than submitting a doomed form.
 */
export const getRequest = (
  id: string
): Promise<IResponse<IDisposalRequest>> => {
  return requestApi({
    apiEndpoint: `/DisposalRequests/${id}`,
    method: 'GET',
    completeData: true,
  });
};

/**
 * Proposes that an asset leaves the register. Allowed for Active or Retired
 * assets (a Draft asset is deleted, not disposed); 409 when the asset already
 * has an active request.
 */
export const createRequest = (
  data: ICreateDisposalRequest
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: '/DisposalRequests',
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
    apiEndpoint: `/DisposalRequests/${id}/${action}`,
    method: 'POST',
    body: JSON.stringify(body),
    contentType: 'application/json',
    completeData: true,
  });
};

/**
 * Approve a Requested disposal. The requester may not approve their own unless
 * they hold ManageAssets, and the override is recorded.
 */
export const approveRequest = (id: string, data: IApproveDisposalRequest) =>
  transition(id, 'approve', { ...data });

/** Reject a Requested disposal (reason required). */
export const rejectRequest = (id: string, data: IRejectDisposalRequest) =>
  transition(id, 'reject', { ...data });

/**
 * Call off a disposal — allowed right up until it executes, including after
 * approval. The creator may cancel their own; anyone else needs approve rights.
 */
export const cancelRequest = (id: string, data: ICancelDisposalRequest) =>
  transition(id, 'cancel', { ...data });

/**
 * The terminal apply — IRREVERSIBLE. The asset must already be Retired, and
 * custody must be Unassigned (or Missing under a Loss/Theft method, which this
 * step clears). Sale and TradeIn must record their proceeds. The remaining
 * 409s — stale RowVersion, open work, a live verification campaign — surface
 * verbatim.
 */
export const executeRequest = (id: string, data: IExecuteDisposalRequest) =>
  transition(id, 'execute', { ...data });

// ---- Data-wipe certificates ----

export const getWipeCertificates = (
  id: string
): Promise<IResponse<IDataWipeCertificate[]>> => {
  return requestApi({
    apiEndpoint: `/DisposalRequests/${id}/wipe-certificates`,
    method: 'GET',
    completeData: true,
  });
};

/**
 * Records a certificate as multipart/form-data — the scanned certificate is
 * optional. contentType is deliberately NOT set: the browser must generate the
 * multipart boundary itself (see the note in httpService). Accepted while the
 * request is active and after execution; refused once Rejected or Cancelled.
 */
export const recordWipeCertificate = (
  id: string,
  data: IRecordDataWipeCertificate
): Promise<IResponse<string>> => {
  const formData = new FormData();
  formData.append('WipeMethod', data.wipeMethod);
  if (data.wipedOn) formData.append('WipedOn', data.wipedOn);
  if (data.wipedByEmployeeId)
    formData.append('WipedByEmployeeId', data.wipedByEmployeeId);
  if (data.certificateReference)
    formData.append('CertificateReference', data.certificateReference);
  if (data.notes) formData.append('Notes', data.notes);
  if (data.file) formData.append('file', data.file);

  return requestApi({
    apiEndpoint: `/DisposalRequests/${id}/wipe-certificates`,
    method: 'POST',
    body: formData,
    completeData: true,
  });
};

// ---- Disposal documents ----

export const getDocuments = (
  id: string
): Promise<IResponse<IDisposalDocument[]>> => {
  return requestApi({
    apiEndpoint: `/DisposalRequests/${id}/documents`,
    method: 'GET',
    completeData: true,
  });
};

/**
 * Attaches disposal paperwork as multipart/form-data — sale invoice, gate
 * pass, certificate of destruction. Hung off the request rather than the asset
 * precisely so it stays possible after the asset has been disposed.
 */
export const uploadDocument = (
  id: string,
  data: IUploadDisposalDocument
): Promise<IResponse<string>> => {
  const formData = new FormData();
  formData.append('DocumentType', String(data.documentType));
  if (data.title) formData.append('Title', data.title);
  if (data.notes) formData.append('Notes', data.notes);
  formData.append('file', data.file);

  return requestApi({
    apiEndpoint: `/DisposalRequests/${id}/documents`,
    method: 'POST',
    body: formData,
    completeData: true,
  });
};

/**
 * Downloads the raw file. Returns the fetch Response (returnBlob) so callers
 * can hand it to saveBlobResponse — the auth header is applied by requestApi.
 */
export const downloadDocument = (id: string): Promise<Response> => {
  return requestApi({
    apiEndpoint: `/DisposalRequests/documents/${id}/download`,
    method: 'GET',
    returnBlob: true,
  });
};

/**
 * Downloads a scanned data-wipe certificate — the evidence that gates execution,
 * so it has to be retrievable and not just uploadable.
 */
export const downloadWipeCertificate = (id: string): Promise<Response> => {
  return requestApi({
    apiEndpoint: `/DisposalRequests/wipe-certificates/${id}/download`,
    method: 'GET',
    returnBlob: true,
  });
};
