import { requestApi } from './httpService';
import { buildQuery } from '@/utils/serviceUtils';
import { IResponse } from '@/interface/IGeneric';
import {
  ILocationSummary,
  IReportDescriptor,
  IReportFilter,
} from '@/interface/IReports';

/** Permission-aware — lists only the reports the caller can actually run. */
export const fetchReportCatalogue = (): Promise<IResponse<IReportDescriptor[]>> =>
  requestApi({ apiEndpoint: '/AssetReports', method: 'GET', completeData: true });

const query = (filter: IReportFilter) =>
  buildQuery({
    PageNumber: filter.pageNumber,
    PageSize: filter.pageSize,
    From: filter.from,
    To: filter.to,
    FiscalYearCode: filter.fiscalYearCode,
    Dimension: filter.dimension,
    LocationId: filter.locationId,
    // Sent ONLY when explicitly false — absent binds true server-side, and the value
    // must never pass through truthiness-stripping (review-pinned contract).
    IncludeChildren: filter.includeChildren === false ? false : undefined,
    Search: filter.search,
    CategoryId: filter.categoryId,
    Availability: filter.availability,
    Unlocated: filter.unlocated === true ? true : undefined,
    IncludeAggregates: filter.includeAggregates === false ? false : undefined,
  });

/**
 * The Location Explorer's one-call header + grouped-view feed, keyed on
 * (locationId, includeChildren) — never refetched for search/chip/page changes.
 */
export const fetchLocationSummary = (
  locationId: string | null,
  includeChildren: boolean,
  withDescendants: boolean
): Promise<IResponse<ILocationSummary>> =>
  requestApi({
    apiEndpoint:
      '/AssetReports/assets-by-location/summary' +
      buildQuery({
        LocationId: locationId ?? undefined,
        IncludeChildren: includeChildren === false ? false : undefined,
        WithDescendants: withDescendants,
      }),
    method: 'GET',
    completeData: true,
  });

/**
 * Register-style codes return a PagedResult envelope; summary codes return a plain list
 * in `data`. The caller switches on the catalogue's isPaginated flag.
 */
export const runReport = (
  code: string,
  filter: IReportFilter = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> =>
  requestApi({
    apiEndpoint: `/AssetReports/${code}` + query(filter),
    method: 'GET',
    completeData: true,
  });

/** Returns the raw fetch Response (returnBlob) — caller turns it into a download. */
export const downloadReportXlsx = (
  code: string,
  filter: IReportFilter = {}
): Promise<Response> =>
  requestApi({
    apiEndpoint: `/AssetReports/${code}/xlsx` + query(filter),
    method: 'GET',
    returnBlob: true,
  }) as Promise<Response>;
