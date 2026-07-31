/**
 * Base URL of the AssetManagement API. Env-driven; defaults to the local
 * backend. Unlike the employee module there is no hardcoded tulipshrm host.
 */
export const getBaseUrl = (): string => {
  return process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:5199';
};

/** All AssetManagement API endpoints live under this prefix. */
export const API_PREFIX = '/api';

export const DEFAULT_PAGE_SIZE = Number(
  process.env.NEXT_DEFAULT_ITEM_COUNT ?? 25
);
