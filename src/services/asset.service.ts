import { requestApi } from './httpService';
import { buildQuery } from '@/utils/serviceUtils';
import { IPagedResponse, IResponse } from '@/interface/IGeneric';
import {
  IAsset,
  IAssetAnalytics,
  IAssetCalendarEvent,
  IAssetFilter,
  IAssetListItem,
  ICreateAsset,
  IUpdateAsset,
} from '@/interface/IAsset';

/**
 * The filter params every asset feed accepts. The list, the calendar and the analytics
 * all send exactly this, so switching view can never silently change which assets are
 * being described — the server starts all three from the same filtered set.
 *
 * Paging is excluded: only the list pages, and sending a stale page number to the
 * calendar or the analytics would quietly narrow them.
 */
const assetFilterQuery = (filter: IAssetFilter) => ({
  Search: filter.search,
  AssetCategoryId: filter.assetCategoryId,
  LifecycleStatus: filter.lifecycleStatus,
  CustodyStatus: filter.custodyStatus,
  OperationalStatus: filter.operationalStatus,
  FinancialStatus: filter.financialStatus,
  VerificationStatus: filter.verificationStatus,
  OwnershipType: filter.ownershipType,
});

export const fetchAssets = (
  filter: IAssetFilter = {}
): Promise<IPagedResponse<IAssetListItem>> => {
  return requestApi({
    apiEndpoint:
      '/Assets' +
      buildQuery({
        PageNumber: filter.pageNumber,
        PageSize: filter.pageSize,
        ...assetFilterQuery(filter),
      }),
    method: 'GET',
    completeData: true,
  });
};

/**
 * Dated obligations for the filtered register inside a window — maintenance, warranty,
 * insurance and verification. Not paged: a window is bounded by its dates.
 */
export const fetchAssetCalendar = (
  filter: IAssetFilter = {},
  from?: string,
  to?: string
): Promise<IResponse<IAssetCalendarEvent[]>> => {
  return requestApi({
    apiEndpoint:
      '/Assets/calendar' +
      buildQuery({
        ...assetFilterQuery(filter),
        From: from,
        To: to,
      }),
    method: 'GET',
    completeData: true,
  });
};

/** Aggregates over the filtered register — composition, value and acquisition trend. */
export const fetchAssetAnalytics = (
  filter: IAssetFilter = {}
): Promise<IResponse<IAssetAnalytics>> => {
  return requestApi({
    apiEndpoint: '/Assets/analytics' + buildQuery({ ...assetFilterQuery(filter) }),
    method: 'GET',
    completeData: true,
  });
};

export const fetchAssetById = (id: string): Promise<IResponse<IAsset>> => {
  return requestApi({
    apiEndpoint: `/Assets/${id}`,
    method: 'GET',
    completeData: true,
  });
};

/**
 * Creates an asset. The AssetCode is generated server-side per the company's
 * code configuration and is immutable afterwards.
 */
export const createAsset = (
  data: ICreateAsset
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: '/Assets',
    method: 'POST',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });
};

/**
 * Updates an asset's registry fields. The AssetCode is immutable and condition
 * / statuses are workflow-owned, so none of them are part of the payload.
 * Requires the round-tripped rowVersion; 409 = stale rowVersion or duplicate
 * tag/serial (the message says which).
 */
export const updateAsset = (
  id: string,
  data: IUpdateAsset
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: `/Assets/${id}`,
    method: 'PUT',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });
};

/**
 * Retires an Active asset. 409 when the asset is in custody or has an active
 * transfer (the message explains) — surface it verbatim. Retired assets can be
 * re-activated with activateAsset.
 */
export const retireAsset = (
  id: string,
  rowVersion: string,
  reason?: string
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: `/Assets/${id}/retire`,
    method: 'POST',
    body: JSON.stringify({ reason: reason || undefined, rowVersion }),
    contentType: 'application/json',
    completeData: true,
  });
};

/**
 * Activates a Draft (or reactivates a Retired) asset. Requires the asset's
 * round-tripped rowVersion; a stale value returns the standard 409 conflict.
 */
export const activateAsset = (
  id: string,
  rowVersion: string
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: `/Assets/${id}/activate`,
    method: 'POST',
    body: JSON.stringify({ rowVersion }),
    contentType: 'application/json',
    completeData: true,
  });
};

/** Draft-only deletion (soft). The RowVersion round-trip is required. */
export const deleteAsset = (
  id: string,
  rowVersion: string
): Promise<IResponse<string>> =>
  requestApi({
    apiEndpoint: `/Assets/${id}`,
    method: 'DELETE',
    body: JSON.stringify({ rowVersion }),
    contentType: 'application/json',
    completeData: true,
  });

/** Mirrors BulkActivateOutcomeEnum on the server. */
export enum BulkActivateOutcomeEnum {
  Activated = 1,
  AlreadyActive = 2,
  Blocked = 3,
  NotFound = 4,
  Conflict = 5,
}

export interface IBulkActivateOutcome {
  assetId: string;
  assetCode?: string | null;
  outcome: BulkActivateOutcomeEnum;
  message: string;
}

export interface IBulkActivateResult {
  requested: number;
  activated: number;
  alreadyActive: number;
  failed: number;
  outcomes: IBulkActivateOutcome[];
}

/**
 * Activate many at once. Always 200 with a per-asset report — `success` is false when
 * anything was refused, so read `data.outcomes`, not the envelope.
 */
export const bulkActivateAssets = (
  items: { assetId: string; rowVersion: string | null }[]
): Promise<IResponse<IBulkActivateResult>> =>
  requestApi({
    apiEndpoint: '/Assets/bulk-activate',
    method: 'POST',
    body: JSON.stringify({ items }),
    contentType: 'application/json',
    completeData: true,
  });
