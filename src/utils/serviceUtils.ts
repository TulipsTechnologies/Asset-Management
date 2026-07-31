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
