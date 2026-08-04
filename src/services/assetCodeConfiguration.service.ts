import { requestApi } from './httpService';
import { IResponse } from '@/interface/IGeneric';
import {
  IAssetCodeConfiguration,
  ISaveAssetCodeConfiguration,
} from '@/interface/IAssetCodeConfiguration';

/** The active format, or the built-in default when none was saved yet. */
export const fetchAssetCodeConfiguration = (): Promise<
  IResponse<IAssetCodeConfiguration>
> =>
  requestApi({
    apiEndpoint: '/AssetCodeConfigurations',
    method: 'GET',
    completeData: true,
  });

/** A 409 always means: reload, review, save again — never retry a stale payload. */
export const saveAssetCodeConfiguration = (
  data: ISaveAssetCodeConfiguration
): Promise<IResponse<string>> =>
  requestApi({
    apiEndpoint: '/AssetCodeConfigurations',
    method: 'PUT',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });
