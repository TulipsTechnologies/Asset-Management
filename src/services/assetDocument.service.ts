import { requestApi } from './httpService';
import { IResponse } from '@/interface/IGeneric';
import {
  IAssetDocument,
  IUploadAssetDocument,
} from '@/interface/IAssetDocument';

export const fetchAssetDocuments = (
  assetId: string
): Promise<IResponse<IAssetDocument[]>> => {
  return requestApi({
    apiEndpoint: `/AssetDocuments/asset/${assetId}`,
    method: 'GET',
    completeData: true,
  });
};

/**
 * Uploads a document as multipart/form-data. contentType is deliberately NOT
 * set — the browser must generate the multipart boundary itself (see the note
 * in httpService).
 */
export const uploadAssetDocument = (
  assetId: string,
  data: IUploadAssetDocument
): Promise<IResponse<string>> => {
  const formData = new FormData();
  formData.append('DocumentType', String(data.documentType));
  if (data.title) formData.append('Title', data.title);
  formData.append('IsPrimaryPhoto', String(data.isPrimaryPhoto));
  formData.append('file', data.file);

  return requestApi({
    apiEndpoint: `/AssetDocuments/asset/${assetId}`,
    method: 'POST',
    body: formData,
    completeData: true,
  });
};

/**
 * Downloads the raw file. Returns the fetch Response (returnBlob) so callers
 * can hand it to saveBlobResponse — the auth header is applied by requestApi.
 */
export const downloadAssetDocument = (id: string): Promise<Response> => {
  return requestApi({
    apiEndpoint: `/AssetDocuments/${id}/download`,
    method: 'GET',
    returnBlob: true,
  });
};

export const deleteAssetDocument = (
  id: string
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: `/AssetDocuments/${id}`,
    method: 'DELETE',
    completeData: true,
  });
};
