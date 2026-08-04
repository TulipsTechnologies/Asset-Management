import { requestApi } from './httpService';
import { IResponse } from '@/interface/IGeneric';
import { IAssetDashboard } from '@/interface/IDashboard';

/** One-shot dashboard payload: counts, attention panels and the 12-month chart. */
export const fetchDashboard = (): Promise<IResponse<IAssetDashboard>> =>
  requestApi({ apiEndpoint: '/AssetDashboard', method: 'GET', completeData: true });
