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

export interface IAssetCategoryFilter {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  parentAssetCategoryId?: string;
  isActive?: boolean;
}
