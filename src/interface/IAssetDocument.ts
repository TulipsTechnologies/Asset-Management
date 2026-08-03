import { AssetDocumentTypeEnum } from '@/enum/assetDocumentEnums';

export interface IAssetDocument {
  id: string;
  assetId: string;
  appFileId: string;
  documentType: AssetDocumentTypeEnum;
  title?: string | null;
  isPrimaryPhoto: boolean;
  fileName: string;
  contentType?: string | null;
  uploadedOn: string;
}

export interface IUploadAssetDocument {
  documentType: AssetDocumentTypeEnum;
  title?: string;
  isPrimaryPhoto: boolean;
  file: File;
}
