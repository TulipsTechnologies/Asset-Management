import { ISortFilter } from '@/utils/serviceUtils';

export interface IAssetCategory {
  id: string;
  categoryCode: string;
  name: string;
  description?: string | null;
  parentAssetCategoryId?: string | null;
  parentAssetCategoryName?: string | null;
  defaultDepreciationMethodId?: string | null;
  defaultDepreciationMethodName?: string | null;
  defaultUsefulLifeMonths?: number | null;
  defaultResidualRate?: number | null;
  displayOrder: number;
  isActive: boolean;
  hasChildren: boolean;
  /** Assets classified here — a category in use cannot be deleted. */
  assetCount: number;
  /** Base64 rowversion — REQUIRED on update (concurrency contract). */
  rowVersion: string;
}

export interface IAssetCategoryTree {
  id: string;
  categoryCode: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  children: IAssetCategoryTree[];
}

export interface IUpsertAssetCategory {
  categoryCode: string;
  name: string;
  description?: string;
  parentAssetCategoryId?: string;
  defaultDepreciationMethodId?: string;
  defaultUsefulLifeMonths?: number;
  defaultResidualRate?: number;
  displayOrder?: number;
  isActive: boolean;
}

/** Edit payload — the rowVersion round-trip is required (400 missing / 409 stale). */
export interface IUpdateAssetCategory extends IUpsertAssetCategory {
  rowVersion: string;
}

export interface IAssetCategoryFilter extends ISortFilter {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  parentAssetCategoryId?: string;
  isActive?: boolean;
}
