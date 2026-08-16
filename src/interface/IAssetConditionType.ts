export interface IAssetConditionType {
  id: string;
  name: string;
  description?: string | null;
  displayOrder: number;
  /**
   * Shipped with the module and shared by every company. Editing or deleting one does not
   * change the shared row — the server forks or hides it for this company instead, so the id
   * that comes back from a save is a NEW one.
   */
  isSystem: boolean;
  /** This company's private replacement for a built-in. Deleting it hides the built-in. */
  isOverride: boolean;
  /** A built-in this company removed from its own list. An absence, not a condition. */
  isHidden: boolean;
  isActive: boolean;
  /** Assets CURRENTLY recorded at this condition, within this company. */
  assetCount: number;
  /** Referenced anywhere in this company's history (assignments, transfers, returns, audits,
   *  work orders). */
  isReferenced: boolean;
  /**
   * Whether the server will accept the action. Gate the row's menu on THESE, never on
   * `!isSystem` — a built-in is now editable, and only the server knows what its own history
   * allows.
   */
  canEdit: boolean;
  canDelete: boolean;
  canRestore: boolean;
  /** Served on every row, built-ins included: forking one validates the base's token. */
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
