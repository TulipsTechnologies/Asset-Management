/**
 * Mirrors TulipsHRM.AssetManagement.Domain VendorTypeEnum — keep in sync with
 * the backend. All values are persisted ints; never renumber.
 */

export enum VendorTypeEnum {
  GeneralSupplier = 1,
  ServiceCentre = 2,
  InsuranceProvider = 3,
  PartsSupplier = 4,
  Leasing = 5,
}

export const VENDOR_TYPE_LABELS: Record<number, string> = {
  [VendorTypeEnum.GeneralSupplier]: 'General Supplier',
  [VendorTypeEnum.ServiceCentre]: 'Service Centre',
  [VendorTypeEnum.InsuranceProvider]: 'Insurance Provider',
  [VendorTypeEnum.PartsSupplier]: 'Parts Supplier',
  [VendorTypeEnum.Leasing]: 'Leasing',
};
