import { IPagedData, IPagedResponse } from '@/interface/IGeneric';

/**
 * Unwraps the VehicleManagement PagedResult<T> envelope (flat array in `data`)
 * into a shape list pages can consume directly.
 */
export const unwrapPaged = <T>(res: IPagedResponse<T>): IPagedData<T> => {
  return {
    items: Array.isArray(res?.data) ? res.data : [],
    currentPage: res?.currentPage ?? 1,
    pageCount: res?.pageCount ?? 0,
    pageSize: res?.pageSize ?? 0,
    rowCount: res?.rowCount ?? 0,
  };
};

/** The sort a list page carries, as CustomTable emits it. */
export interface ISortFilter {
  /** Entity property the API orders by — the column's `sortField`. */
  sortBy?: string;
  sortDesc?: boolean;
}

/**
 * The sort, in the shape the API binds.
 *
 * `PaginationFilter.SortBy` is a `List<SortModel>` of `{Name, Desc}`, so it only binds
 * from indexed keys. A flat `sortBy=assetCode` binds to nothing at all and the server
 * quietly returns its default order — which is exactly what every list here used to do.
 *
 * Spread it into buildQuery alongside the page's own filters.
 */
export const sortQuery = (filter: ISortFilter) =>
  filter.sortBy
    ? {
        'SortBy[0].Name': filter.sortBy,
        'SortBy[0].Desc': filter.sortDesc ? 'true' : 'false',
      }
    : {};

/**
 * Merges what CustomTable emits — paging and sort — into a page's filter state.
 *
 * Each list page used to hand-roll this and forward only pageNumber/pageSize, so the
 * sort was thrown away one layer before the service's own whitelist would have thrown
 * it away anyway. One helper so a new page cannot quietly omit it again.
 */
export const mergeTableFilters = <
  T extends ISortFilter & { pageNumber?: number; pageSize?: number },
>(
  prev: T,
  updates: {
    pageNumber?: unknown;
    pageSize?: unknown;
    sortBy?: unknown;
    sortDesc?: unknown;
  }
): T => ({
  ...prev,
  ...(updates.pageNumber !== undefined && {
    pageNumber: Number(updates.pageNumber),
  }),
  ...(updates.pageSize !== undefined && {
    pageSize: Number(updates.pageSize),
    pageNumber: 1,
  }),
  ...(updates.sortBy !== undefined && {
    sortBy: String(updates.sortBy),
    sortDesc: !!updates.sortDesc,
  }),
});

/** Builds a query string, skipping null/undefined/empty values. */
export const buildQuery = (
  params: Record<string, string | number | boolean | null | undefined>
): string => {
  const query = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(
      ([k, v]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`
    )
    .join('&');
  return query ? `?${query}` : '';
};

/** Saves a blob API response as a browser download. */
export const saveBlobResponse = async (
  res: Response,
  fallbackName: string
): Promise<void> => {
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') ?? '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const fileName = match?.[1] ?? fallbackName;
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};
