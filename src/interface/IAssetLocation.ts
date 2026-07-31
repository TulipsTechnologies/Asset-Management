export interface IAssetLocation {
  id: string;
  name: string;
  code?: string | null;
  parentAssetLocationId?: string | null;
  parentAssetLocationName?: string | null;
  address?: string | null;
  isActive: boolean;
  assetCount: number;
  /** 1 = root … 3; level-3 locations cannot be parents. */
  level: number;
}

export interface IUpsertAssetLocation {
  name: string;
  code?: string;
  parentAssetLocationId?: string;
  address?: string;
  isActive: boolean;
}

export interface IAssetLocationFilter {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
}
