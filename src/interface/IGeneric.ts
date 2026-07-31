/** Result<T> envelope returned by every VehicleManagement API endpoint. */
export interface IResponse<T> {
  success: boolean;
  statusCode: number;
  message: string | null;
  data: T;
}

/**
 * PagedResult<T> — NOTE: `data` is a FLAT array (not {items,totalCount} like
 * the HRM API used by the employee module).
 */
export interface IPagedResponse<T> {
  success: boolean;
  statusCode: number;
  message: string | null;
  data: T[];
  currentPage: number;
  pageCount: number;
  pageSize: number;
  rowCount: number;
}

/** Unwrapped paged payload used by list pages. */
export interface IPagedData<T> {
  items: T[];
  currentPage: number;
  pageCount: number;
  pageSize: number;
  rowCount: number;
}

export interface IPagination {
  pageNumber: number;
  pageSize: number;
}
