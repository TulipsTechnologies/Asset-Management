export interface IAssetLocation {
  id: string;
  name: string;
  code?: string | null;
  parentAssetLocationId?: string | null;
  parentAssetLocationName?: string | null;
  address?: string | null;
  isActive: boolean;
  assetCount: number;
  /** Base64 rowversion — required on update. */
  rowVersion: string;
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

export interface IUpdateAssetLocation extends IUpsertAssetLocation {
  rowVersion: string;
}

export interface IAssetLocationFilter {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
}
