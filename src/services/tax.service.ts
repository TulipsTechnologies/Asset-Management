import { requestApi } from './httpService';
import { buildQuery } from '@/utils/serviceUtils';
import { ICommandEnvelope, IResponse } from '@/interface/IGeneric';
import {
  IAssetTaxProfile,
  IAssignAssetTaxClass,
  ICalculateTaxRun,
  ISeedNepalRulePack,
  IProjectTaxYears,
  ITaxDepreciationRun,
  ITaxJurisdiction,
  ITaxProjection,
} from '@/interface/ITax';

/**
 * Nepal IRD tax book (api/TaxDepreciation).
 *
 * Only the endpoints the controller actually exposes are here. The tax run's review /
 * approve / post / reverse steps exist in the backend service but have no routes, so there
 * is deliberately nothing for them in this file.
 */

/**
 * Idempotent seed of the Nepal Schedule 2 rule pack. It is also the only way to read the
 * jurisdiction id — there is no GET for jurisdictions — so it is called once from setup,
 * never on render.
 */
export const seedNepalRulePack = (
  body: ISeedNepalRulePack
): Promise<IResponse<ITaxJurisdiction>> =>
  requestApi({
    apiEndpoint: '/TaxDepreciation/jurisdictions/nepal',
    method: 'POST',
    body: JSON.stringify(body),
    contentType: 'application/json',
    completeData: true,
  });

/**
 * An asset with no tax classification answers with a refusal rather than an empty profile.
 * That is the normal "not classified" state, not an error worth a toast.
 */
export const fetchAssetTaxProfile = (
  assetId: string
): Promise<IResponse<IAssetTaxProfile>> =>
  requestApi({
    apiEndpoint: `/TaxDepreciation/assets/${assetId}/tax-profile`,
    method: 'GET',
    completeData: true,
  });

export const assignAssetTaxClass = (
  assetId: string,
  body: IAssignAssetTaxClass
): Promise<IResponse<IAssetTaxProfile>> =>
  requestApi({
    apiEndpoint: `/TaxDepreciation/assets/${assetId}/tax-profile`,
    method: 'PUT',
    body: JSON.stringify(body),
    contentType: 'application/json',
    completeData: true,
  });

/** Returns a CommandEnvelope — the run id is `data.entityId`, refusals are `data.reasons`. */
export const calculateTaxRun = (
  body: ICalculateTaxRun
): Promise<IResponse<ICommandEnvelope>> =>
  requestApi({
    apiEndpoint: '/TaxDepreciation/runs',
    method: 'POST',
    body: JSON.stringify(body),
    contentType: 'application/json',
    completeData: true,
  });

export const fetchTaxRun = (id: string): Promise<IResponse<ITaxDepreciationRun>> =>
  requestApi({
    apiEndpoint: `/TaxDepreciation/runs/${id}`,
    method: 'GET',
    completeData: true,
  });

/**
 * Tax depreciation across a range of years — the catch-up an asset in service since long
 * before the register existed needs. Writes nothing, so it can be re-run freely and does not
 * depend on any year having been posted.
 */
export const projectTaxYears = (
  query: IProjectTaxYears
): Promise<IResponse<ITaxProjection>> =>
  requestApi({
    apiEndpoint:
      '/TaxDepreciation/projections' +
      buildQuery({
        taxJurisdictionId: query.taxJurisdictionId,
        fromTaxYearStartYear: query.fromTaxYearStartYear,
        toTaxYearStartYear: query.toTaxYearStartYear,
        assetId: query.assetId,
      }),
    method: 'GET',
    completeData: true,
  });
