import { requestApi } from './httpService';
import { buildQuery } from '@/utils/serviceUtils';
import { IPagedResponse, IResponse } from '@/interface/IGeneric';
import { IUpsertVendor, IVendor, IVendorFilter } from '@/interface/IVendor';

export const fetchVendors = (
  filter: IVendorFilter = {}
): Promise<IPagedResponse<IVendor>> => {
  return requestApi({
    apiEndpoint:
      '/Vendors' +
      buildQuery({
        PageNumber: filter.pageNumber,
        PageSize: filter.pageSize,
        Search: filter.search,
        VendorType: filter.vendorType,
        IsActive: filter.isActive,
      }),
    method: 'GET',
    completeData: true,
  });
};

/** Creates a vendor. 409 on duplicate name — surface the message verbatim. */
export const createVendor = (
  data: IUpsertVendor
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: '/Vendors',
    method: 'POST',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });
};
