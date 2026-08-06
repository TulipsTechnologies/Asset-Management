import { ReactNode } from 'react';

/** Filter updates emitted by the table (server paging etc.). */
export interface ITableFilters {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  [key: string]: unknown;
}

export type TColumnTypes =
  | 'string'
  | 'number'
  | 'date'
  | 'datetime'
  | 'input'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'custom'
  | 'toggle';

export type TTableColumn = {
  name?: string;
  key: string;
  label: string | ReactNode;
  width: number;
  visible?: boolean;
  invisible?: boolean;
  hidden?: boolean;
  type?: TColumnTypes;
  /**
   * The name the SERVER sorts by: a property of the entity behind this list, in the
   * entity's own casing (`AssetCode`, not `assetCode` — though the API matches
   * case-insensitively). Setting it is what makes the column sortable: the whole
   * result set is ordered by the database and page 1 is re-fetched.
   *
   * Leave it unset for a column the server cannot order by — anything computed in
   * the projection or joined in from another table. Such a column shows no sort
   * control at all, because a control that reorders only the rows already on screen
   * is worse than none: it looks like it sorted the table and it did not.
   *
   * Ignored on a `clientSort` table, where every row is already in the browser.
   */
  sortField?: string;
  isSortable?: boolean;
  locked?: boolean;
  canReposition?: boolean;
  canToggle?: boolean;
  contentAlign?: 'center' | 'left' | 'right';
  sticky?: 'left' | 'right';
  custom?: ICustomContent;
  fieldProps?: {
    type?: 'string' | 'number' | 'date' | 'datetime' | 'custom';
    options?: string[];
    changeHandler: (...args: any[]) => void;
    isChecked?: (rows: any[], selected: any[]) => boolean;
    toggableVisibility?: boolean;
  };
};
export interface ICustomContent {
  value: any;
  content?: ReactNode;
  type: 'string' | 'number' | 'date' | 'datetime' | 'custom';
  rowColor?: string;
}

export type RowWithFieldProps = Record<string, any>;

/** A single entry in the selection bar's "Bulk Actions" dropdown. */
export type TBulkAction = {
  label: string;
  /** Receives the ids of the currently selected rows. */
  onClick: (selectedIds: (string | number)[]) => void;
  /** Render the item in a destructive (red) style. */
  danger?: boolean;
};

export type CustomTableProps = {
  tableName: string;
  columns: TTableColumn[];
  rows: RowWithFieldProps[];
  tableHeaderLeft?: ReactNode;
  tableHeaderRight?: ReactNode;
  isLoading?: boolean;
  onRowClick?: (row: RowWithFieldProps) => void;
  selectAll?: boolean;
  handleSelectAll?: () => void;
  updateFilters?: (updates: Partial<ITableFilters>) => void;
  containerClassName?: string;
  striped?: boolean;
  onRowOrderChange?: (reorderedRows: any[]) => void;
  /** Show the leading selection checkbox column (default true). */
  selectable?: boolean;
  /** Show the leading SN serial-number column (default true). */
  showSerial?: boolean;
  /**
   * Show the Back control at the head of the toolbar (default true). Set false
   * for a table embedded in a page that already carries its own Back, so the
   * two do not stack.
   */
  showBack?: boolean;
  /**
   * This table holds its whole dataset in the browser (no server paging), so a
   * column may be sorted here without asking the server. Server-paged tables must
   * leave this off and declare `sortField` per column instead — sorting one page
   * of many in the browser reorders a slice and calls it the table.
   */
  clientSort?: boolean;
  /**
   * The sort the page is currently requesting (its `filters.sortBy`/`sortDesc`). Pass
   * them so the header indicator survives a remount — tab and view switches destroy this
   * component while the page's filter state, and therefore the server's order, live on.
   */
  sortBy?: string;
  sortDesc?: boolean;
  /** Serial offset so SN respects server paging: (pageNumber - 1) * pageSize. */
  serialOffset?: number;
  /** Resolve a stable id for a row (defaults to row.id, then row index). */
  getRowId?: (row: RowWithFieldProps, index: number) => string | number;
  /** Notified whenever the selected rows change. */
  onSelectionChange?: (selectedRows: RowWithFieldProps[]) => void;
  /**
   * Entity noun used by the selection bar ("N vehicle(s) selected").
   * Defaults to "item".
   */
  entityLabel?: string;
  /**
   * Entries for the selection bar's "Bulk Actions" dropdown. When omitted or
   * empty, the bar still appears on selection but only offers Clear Selection.
   */
  bulkActions?: TBulkAction[];
  /**
   * Bump this whenever the page changes the ORDER its columns ship in. Saved layouts
   * written at a lower version keep their widths and visibility but follow the new
   * code order, so a default change actually reaches operators who already have a
   * saved layout. Leave unset for tables whose default order has never changed.
   */
  layoutVersion?: number;
};
export interface ICacheData {
  key: string;
  locked: boolean;
  width: number;
  visible: boolean;
}
