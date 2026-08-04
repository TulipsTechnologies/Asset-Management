import { requestApi } from './httpService';
import { IResponse } from '@/interface/IGeneric';

export interface ITablePreferences {
  personalColumnsJson?: string | null;
  companyColumnsJson?: string | null;
  /** Whether the caller may save/reset the company scope. */
  canManageCompany: boolean;
}

export type TPreferenceScope = 'personal' | 'company';

/** Column-layout presets: personal → company → code defaults (main-app semantics). */
export const fetchTablePreferences = (
  tableName: string
): Promise<IResponse<ITablePreferences>> =>
  requestApi({
    apiEndpoint: `/TablePreferences?tableName=${encodeURIComponent(tableName)}`,
    method: 'GET',
    completeData: true,
  });

export const saveTablePreference = (
  tableName: string,
  scope: TPreferenceScope,
  columnsJson: string
): Promise<IResponse<string>> =>
  requestApi({
    apiEndpoint: '/TablePreferences',
    method: 'PUT',
    body: JSON.stringify({ tableName, scope, columnsJson }),
    contentType: 'application/json',
    completeData: true,
  });

export const deleteTablePreference = (
  tableName: string,
  scope: TPreferenceScope
): Promise<IResponse<string>> =>
  requestApi({
    apiEndpoint: `/TablePreferences?tableName=${encodeURIComponent(tableName)}&scope=${scope}`,
    method: 'DELETE',
    completeData: true,
  });
