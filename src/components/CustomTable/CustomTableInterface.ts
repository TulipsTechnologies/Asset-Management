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
