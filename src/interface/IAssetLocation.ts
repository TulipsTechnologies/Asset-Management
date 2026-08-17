import { ISortFilter } from '@/utils/serviceUtils';

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

/** One node of the hierarchy (Building → Floor → Room), children nested. */
export interface IAssetLocationTree {
  id: string;
  name: string;
  code?: string | null;
  address?: string | null;
  isActive: boolean;
  /** Assets filed AT this node itself — children report their own. */
  assetCount: number;
  children: IAssetLocationTree[];
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

export interface IAssetLocationFilter extends ISortFilter {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
}
