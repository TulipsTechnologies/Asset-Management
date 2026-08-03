/**
 * Mirrors TulipsHRM.AssetManagement.Domain AssetDocumentTypeEnum — keep in
 * sync with the backend. All values are persisted ints; never renumber.
 */

export enum AssetDocumentTypeEnum {
  Invoice = 1,
  Warranty = 2,
  Photo = 3,
  Manual = 4,
  Certificate = 5,
  Other = 6,
}

export const DOCUMENT_TYPE_LABELS: Record<number, string> = {
  [AssetDocumentTypeEnum.Invoice]: 'Invoice',
  [AssetDocumentTypeEnum.Warranty]: 'Warranty',
  [AssetDocumentTypeEnum.Photo]: 'Photo',
  [AssetDocumentTypeEnum.Manual]: 'Manual',
  [AssetDocumentTypeEnum.Certificate]: 'Certificate',
  [AssetDocumentTypeEnum.Other]: 'Other',
};
