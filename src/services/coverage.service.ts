import { requestApi } from './httpService';
import type { IPagedData, IResponse } from '@/interface/IGeneric';
import type {
  IAssetCoverage,
  IClaimStatusChange,
  ICoverageExpiry,
  IUpsertClaim,
  IUpsertInsurancePolicy,
  IUpsertWarranty,
} from '@/interface/IAssetCoverage';

/** Warranty, insurance and claims (§9). */

export const fetchAssetCoverage = (
  assetId: string
): Promise<IResponse<IAssetCoverage>> =>
  requestApi({
    apiEndpoint: `/AssetCoverage/asset/${assetId}`,
    method: 'GET',
    completeData: true,
  });

/** Paginated at the database — the endpoint no longer returns an unbounded list. */
export const fetchExpiringCoverage = (
  withinDays = 60,
  pageNumber = 1,
  pageSize = 25
): Promise<IResponse<IPagedData<ICoverageExpiry>>> =>
  requestApi({
    apiEndpoint: `/AssetCoverage/expiring?withinDays=${withinDays}&pageNumber=${pageNumber}&pageSize=${pageSize}`,
    method: 'GET',
    completeData: true,
  });

// ------------------------------------------------------------------- warranty

export const createWarranty = (body: IUpsertWarranty) =>
  requestApi({
    apiEndpoint: '/AssetCoverage/warranties',
    method: 'POST',
    body: JSON.stringify(body),
    contentType: 'application/json',
    completeData: true,
  });

export const updateWarranty = (id: string, body: IUpsertWarranty) =>
  requestApi({
    apiEndpoint: `/AssetCoverage/warranties/${id}`,
    method: 'PUT',
    body: JSON.stringify(body),
    contentType: 'application/json',
    completeData: true,
  });

/** Ends cover early. The row is kept — claims filed against it reference it. */
export const cancelWarranty = (
  id: string,
  body: { reason?: string | null; rowVersion: string }
) =>
  requestApi({
    apiEndpoint: `/AssetCoverage/warranties/${id}/cancel`,
    method: 'POST',
    body: JSON.stringify(body),
    contentType: 'application/json',
    completeData: true,
  });

// ------------------------------------------------------------------ insurance

export const createPolicy = (body: IUpsertInsurancePolicy) =>
  requestApi({
    apiEndpoint: '/AssetCoverage/policies',
    method: 'POST',
    body: JSON.stringify(body),
    contentType: 'application/json',
    completeData: true,
  });

export const updatePolicy = (id: string, body: IUpsertInsurancePolicy) =>
  requestApi({
    apiEndpoint: `/AssetCoverage/policies/${id}`,
    method: 'PUT',
    body: JSON.stringify(body),
    contentType: 'application/json',
    completeData: true,
  });

export const cancelPolicy = (
  id: string,
  body: { reason?: string | null; rowVersion: string }
) =>
  requestApi({
    apiEndpoint: `/AssetCoverage/policies/${id}/cancel`,
    method: 'POST',
    body: JSON.stringify(body),
    contentType: 'application/json',
    completeData: true,
  });

// --------------------------------------------------------------------- claims

export const createClaim = (body: IUpsertClaim) =>
  requestApi({
    apiEndpoint: '/AssetCoverage/claims',
    method: 'POST',
    body: JSON.stringify(body),
    contentType: 'application/json',
    completeData: true,
  });

export const changeClaimStatus = (id: string, body: IClaimStatusChange) =>
  requestApi({
    apiEndpoint: `/AssetCoverage/claims/${id}/status`,
    method: 'POST',
    body: JSON.stringify(body),
    contentType: 'application/json',
    completeData: true,
  });
