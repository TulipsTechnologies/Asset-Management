import { VendorTypeEnum } from '@/enum/vendorEnums';
import { ISortFilter } from '@/utils/serviceUtils';

export interface IVendor {
  id: string;
  name: string;
  vendorType: VendorTypeEnum;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  panNumber?: string | null;
  notes?: string | null;
  isActive: boolean;
  assetCount: number;
  /** Base64 rowversion — required on update. */
  rowVersion: string;
}

export interface IUpsertVendor {
  name: string;
  vendorType: VendorTypeEnum;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  panNumber?: string;
  notes?: string;
  isActive: boolean;
}

export interface IUpdateVendor extends IUpsertVendor {
  rowVersion: string;
}

export interface IVendorFilter extends ISortFilter {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  vendorType?: VendorTypeEnum;
  isActive?: boolean;
}
