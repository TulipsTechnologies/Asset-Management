/** Result<T> envelope returned by every VehicleManagement API endpoint. */
export interface IResponse<T> {
  success: boolean;
  statusCode: number;
  message: string | null;
  data: T;
  /**
   * Stable machine-readable refusal code. Optional because httpService synthesises
   * envelopes for a 401 and for a network failure, and neither carries one — branch on
   * this, never on the wording of `message`.
   */
  reasonCode?: string | null;
}

/**
 * One structured refusal. Returned inside a CommandEnvelope (`data.reasons`) by the tax
 * endpoints, and as `data.blockers` by the convention-change preview.
 */
export interface IReasonDetail {
  code: string;
  message: string;
  subject?: string | null;
  subjectId?: string | null;
  rowNumber?: number | null;
  field?: string | null;
  currencyId?: string | null;
  values?: Record<string, unknown> | null;
}

/** The envelope every tax command returns. `entityId` is what was created or changed. */
export interface ICommandEnvelope {
  commandId?: string | null;
  correlationId?: string | null;
  wasReplayed: boolean;
  entityId?: string | null;
  ruleSetId?: string | null;
  engineVersion?: string | null;
  reasons: IReasonDetail[];
}

/**
 * PagedResult<T> — NOTE: `data` is a FLAT array (not {items,totalCount} like
 * the HRM API used by the employee module).
 */
export interface IPagedResponse<T> {
  success: boolean;
  statusCode: number;
  message: string | null;
  reasonCode?: string | null;
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
