export interface IAssetConditionType {
  id: string;
  name: string;
  description?: string | null;
  displayOrder: number;
  /** Shipped with the module and shared by every company: never renamed or deleted here. */
  isSystem: boolean;
  isActive: boolean;
  /** Assets CURRENTLY recorded at this condition. */
  assetCount: number;
  /** Referenced anywhere in history (assignments, transfers, returns, audits, work orders). */
  isReferenced: boolean;
  canEdit: boolean;
  canDelete: boolean;
  /** Null on system rows, which are never updatable. */
  rowVersion: string | null;
}

/** The dropdown shape: what every screen that records a condition binds a Select to. */
export interface IAssetConditionLookup {
  id: string;
  name: string;
  displayOrder: number;
  isSystem: boolean;
  /** False only for a row fetched via includeId — held by a record, not offered for new ones. */
  isActive: boolean;
}

export interface IUpsertAssetConditionType {
  name: string;
  description?: string;
  displayOrder: number;
  isActive: boolean;
}

export interface IUpdateAssetConditionType extends IUpsertAssetConditionType {
  rowVersion: string;
}

export interface IAssetConditionTypeFilter {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
  ownOnly?: boolean;
  /** Entity property the API orders by — the column's `sortField`. */
  sortBy?: string;
  sortDesc?: boolean;
}
