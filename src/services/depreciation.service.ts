import { requestApi } from './httpService';
import { buildQuery } from '@/utils/serviceUtils';
import { IPagedResponse, IResponse } from '@/interface/IGeneric';
import {
  IAssetBook,
  IAssetBookFilter,
  ICapitalizationPolicy,
  ICapitalizeAsset,
  IDepreciationAccountMapping,
  IDepreciationMethod,
  IDepreciationRun,
  IDepreciationRunDetail,
  IDepreciationRunFilter,
  IDepreciationSchedule,
  IFiscalPeriod,
  IFiscalYear,
  IJournalProposal,
  IJournalProposalFilter,
  IReviseEstimate,
  IUpdateAssetBook,
  IUpsertCapitalizationPolicy,
  IUpsertDepreciationAccountMapping,
  IUpsertFiscalYear,
} from '@/interface/IDepreciation';

// ---------------------------------------------------------------- asset books

export const fetchAssetBooks = (
  filter: IAssetBookFilter = {}
): Promise<IPagedResponse<IAssetBook>> =>
  requestApi({
    apiEndpoint:
      '/AssetBooks' +
      buildQuery({
        PageNumber: filter.pageNumber,
        PageSize: filter.pageSize,
        Search: filter.search,
        AssetId: filter.assetId,
        AssetCategoryId: filter.assetCategoryId,
        Status: filter.status,
        DepreciationMethodId: filter.depreciationMethodId,
      }),
    method: 'GET',
    completeData: true,
  });

export const fetchAssetBookById = (id: string): Promise<IResponse<IAssetBook>> =>
  requestApi({ apiEndpoint: `/AssetBooks/${id}`, method: 'GET', completeData: true });

/** The projected charge per period. Posting reads these rows; it never recomputes. */
export const fetchBookSchedule = (
  id: string
): Promise<IResponse<IDepreciationSchedule[]>> =>
  requestApi({ apiEndpoint: `/AssetBooks/${id}/schedule`, method: 'GET', completeData: true });

/** Seeded global lookup, filtered to what the engine implements. */
export const fetchDepreciationMethods = (): Promise<
  IResponse<IDepreciationMethod[]>
> =>
  requestApi({
    apiEndpoint: '/AssetBooks/depreciation-methods',
    method: 'GET',
    completeData: true,
  });

export const capitalizeAsset = (
  data: ICapitalizeAsset
): Promise<IResponse<string>> =>
  requestApi({
    apiEndpoint: '/AssetBooks',
    method: 'POST',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });

/** Refused once anything has posted — use revise for a prospective change. */
export const updateAssetBook = (
  id: string,
  data: IUpdateAssetBook
): Promise<IResponse<string>> =>
  requestApi({
    apiEndpoint: `/AssetBooks/${id}`,
    method: 'PUT',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });

/** Prospective re-spread. Posted periods are never touched (IAS 8). */
export const reviseEstimate = (
  id: string,
  data: IReviseEstimate
): Promise<IResponse<string>> =>
  requestApi({
    apiEndpoint: `/AssetBooks/${id}/revise`,
    method: 'POST',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });

export const deleteAssetBook = (
  id: string,
  rowVersion: string
): Promise<IResponse<string>> =>
  requestApi({
    apiEndpoint: `/AssetBooks/${id}`,
    method: 'DELETE',
    body: JSON.stringify({ rowVersion }),
    contentType: 'application/json',
    completeData: true,
  });

// ---------------------------------------------------------------- runs

export const fetchDepreciationRuns = (
  filter: IDepreciationRunFilter = {}
): Promise<IPagedResponse<IDepreciationRun>> =>
  requestApi({
    apiEndpoint:
      '/DepreciationRuns' +
      buildQuery({
        PageNumber: filter.pageNumber,
        PageSize: filter.pageSize,
        FiscalYearCode: filter.fiscalYearCode,
        Status: filter.status,
        FiscalPeriodId: filter.fiscalPeriodId,
      }),
    method: 'GET',
    completeData: true,
  });

export const fetchRunDetails = (
  id: string
): Promise<IResponse<IDepreciationRunDetail[]>> =>
  requestApi({ apiEndpoint: `/DepreciationRuns/${id}/details`, method: 'GET', completeData: true });

export const calculateRun = (
  fiscalPeriodId: string,
  notes?: string
): Promise<IResponse<string>> =>
  requestApi({
    apiEndpoint: '/DepreciationRuns',
    method: 'POST',
    body: JSON.stringify({ fiscalPeriodId, notes }),
    contentType: 'application/json',
    completeData: true,
  });

const runAction = (id: string, action: string, rowVersion: string) =>
  requestApi({
    apiEndpoint: `/DepreciationRuns/${id}/${action}`,
    method: 'POST',
    body: JSON.stringify({ rowVersion }),
    contentType: 'application/json',
    completeData: true,
  });

export const discardRun = (id: string, rowVersion: string): Promise<IResponse<string>> =>
  runAction(id, 'discard', rowVersion);

export const approveRun = (id: string, rowVersion: string): Promise<IResponse<string>> =>
  runAction(id, 'approve', rowVersion);

export const postRun = (id: string, rowVersion: string): Promise<IResponse<string>> =>
  runAction(id, 'post', rowVersion);

/** Only the latest posted run, and only into an open period. */
export const reverseRun = (
  id: string,
  rowVersion: string,
  reason: string
): Promise<IResponse<string>> =>
  requestApi({
    apiEndpoint: `/DepreciationRuns/${id}/reverse`,
    method: 'POST',
    body: JSON.stringify({ rowVersion, reason }),
    contentType: 'application/json',
    completeData: true,
  });

// ---------------------------------------------------------------- fiscal periods

export const fetchFiscalYears = (): Promise<IResponse<IFiscalYear[]>> =>
  requestApi({ apiEndpoint: '/FiscalPeriods/years', method: 'GET', completeData: true });

export const fetchFiscalPeriods = (filter: {
  pageNumber?: number;
  pageSize?: number;
  fiscalYearId?: string;
  status?: number;
} = {}): Promise<IPagedResponse<IFiscalPeriod>> =>
  requestApi({
    apiEndpoint:
      '/FiscalPeriods' +
      buildQuery({
        PageNumber: filter.pageNumber,
        PageSize: filter.pageSize,
        FiscalYearId: filter.fiscalYearId,
        Status: filter.status,
      }),
    method: 'GET',
    completeData: true,
  });

export const createFiscalYear = (
  data: IUpsertFiscalYear
): Promise<IResponse<string>> =>
  requestApi({
    apiEndpoint: '/FiscalPeriods/years',
    method: 'POST',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });

export const closePeriod = (id: string, rowVersion: string): Promise<IResponse<string>> =>
  requestApi({
    apiEndpoint: `/FiscalPeriods/${id}/close`,
    method: 'POST',
    body: JSON.stringify({ rowVersion }),
    contentType: 'application/json',
    completeData: true,
  });

export const reopenPeriod = (
  id: string,
  rowVersion: string,
  reason: string
): Promise<IResponse<string>> =>
  requestApi({
    apiEndpoint: `/FiscalPeriods/${id}/reopen`,
    method: 'POST',
    body: JSON.stringify({ rowVersion, reason }),
    contentType: 'application/json',
    completeData: true,
  });

// ---------------------------------------------------------------- configuration

export const fetchCapitalizationPolicies = (): Promise<
  IResponse<ICapitalizationPolicy[]>
> =>
  requestApi({ apiEndpoint: '/CapitalizationPolicies', method: 'GET', completeData: true });

export const fetchEffectivePolicy = (): Promise<IResponse<ICapitalizationPolicy>> =>
  requestApi({ apiEndpoint: '/CapitalizationPolicies/effective', method: 'GET', completeData: true });

export const createCapitalizationPolicy = (
  data: IUpsertCapitalizationPolicy
): Promise<IResponse<string>> =>
  requestApi({
    apiEndpoint: '/CapitalizationPolicies',
    method: 'POST',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });

export const fetchAccountMappings = (): Promise<
  IResponse<IDepreciationAccountMapping[]>
> =>
  requestApi({ apiEndpoint: '/DepreciationAccountMappings', method: 'GET', completeData: true });

export const createAccountMapping = (
  data: IUpsertDepreciationAccountMapping
): Promise<IResponse<string>> =>
  requestApi({
    apiEndpoint: '/DepreciationAccountMappings',
    method: 'POST',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });

export const updateAccountMapping = (
  id: string,
  data: IUpsertDepreciationAccountMapping & { rowVersion: string }
): Promise<IResponse<string>> =>
  requestApi({
    apiEndpoint: `/DepreciationAccountMappings/${id}`,
    method: 'PUT',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });

export const deleteAccountMapping = (id: string): Promise<IResponse<string>> =>
  requestApi({
    apiEndpoint: `/DepreciationAccountMappings/${id}`,
    method: 'DELETE',
    completeData: true,
  });

// ---------------------------------------------------------------- journal outbox

export const fetchJournalProposals = (
  filter: IJournalProposalFilter = {}
): Promise<IPagedResponse<IJournalProposal>> =>
  requestApi({
    apiEndpoint:
      '/JournalProposals' +
      buildQuery({
        PageNumber: filter.pageNumber,
        PageSize: filter.pageSize,
        SourceType: filter.sourceType,
        Status: filter.status,
        FiscalYearCode: filter.fiscalYearCode,
      }),
    method: 'GET',
    completeData: true,
  });

export const fetchJournalProposal = (
  id: string
): Promise<IResponse<IJournalProposal>> =>
  requestApi({ apiEndpoint: `/JournalProposals/${id}`, method: 'GET', completeData: true });
