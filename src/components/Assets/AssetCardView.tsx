'use client';

import { IAssetListItem } from '@/interface/IAsset';
import {
  CUSTODY_BADGE_CLASSES,
  CUSTODY_LABELS,
  LIFECYCLE_BADGE_CLASSES,
  LIFECYCLE_LABELS,
} from '@/enum/assetEnums';
import {
  AssetActionsMenu,
  IAssetAction,
  StatusBadge,
  money,
} from './AssetViewShared';
import AssetPhotoThumb from './AssetPhotoThumb';

/**
 * The same page of assets the table renders, laid out as cards. It reads the identical
 * data, honours the identical filters and offers the identical actions — the difference
 * is only that a card gives each asset room for its identity (code, name, where it is,
 * who has it) instead of a row of columns.
 */

interface IProps {
  assets: IAssetListItem[];
  loading: boolean;
  actions: IAssetAction[];
  onOpen: (asset: IAssetListItem) => void;
}

const AssetCardView = ({ assets, loading, actions, onOpen }: IProps) => {
  if (loading && assets.length === 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div
            key={index}
            className="h-[168px] rounded-2xl border border-gray-100 bg-white shadow-sm animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm py-14 text-center">
        <p className="text-sm text-gray-500">No assets match the current filters.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
      {assets.map((asset) => (
        <div
          key={asset.id}
          className="group relative flex flex-col rounded-2xl border border-gray-100 bg-white shadow-sm p-4 transition-shadow hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-2">
            <AssetPhotoThumb
              assetId={asset.id}
              assetCode={asset.assetCode}
              assetName={asset.assetName}
              size="md"
            />
            <button
              type="button"
              onClick={() => onOpen(asset)}
              className="min-w-0 flex-1 text-left"
            >
              <p className="text-sm font-bold text-primarycolor truncate">
                {asset.assetCode}
              </p>
              <p className="text-sm font-semibold text-secondaryColor truncate mt-0.5">
                {asset.assetName}
              </p>
            </button>
            {/* Sits above the card's own click target so opening the menu never navigates. */}
            <div className="shrink-0 -mt-1 -mr-2">
              <AssetActionsMenu asset={asset} actions={actions} />
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpen(asset)}
            className="mt-2 text-left flex-1"
          >
            <p className="text-xs text-gray-500 truncate">
              {asset.assetCategoryName}
              {asset.serialNumber ? ` · ${asset.serialNumber}` : ''}
            </p>
            <p className="text-xs text-gray-500 truncate mt-0.5">
              <i className="icon icon-marker text-[10px] mr-1"></i>
              {asset.assetLocationName || 'No location recorded'}
            </p>
            {/* The table names the custodian; the card says the same thing rather than
                leaving "who has it" to the custody badge alone. */}
            <p className="text-xs text-gray-500 truncate mt-0.5">
              <i className="icon icon-user-check text-[10px] mr-1"></i>
              {asset.currentCustodianEmployeeName || 'No custodian'}
            </p>

            <div className="flex flex-wrap gap-1.5 mt-3">
              <StatusBadge
                value={asset.lifecycleStatus}
                labels={LIFECYCLE_LABELS}
                classes={LIFECYCLE_BADGE_CLASSES}
              />
              <StatusBadge
                value={asset.custodyStatus}
                labels={CUSTODY_LABELS}
                classes={CUSTODY_BADGE_CLASSES}
              />
            </div>
          </button>

          <div className="flex items-end justify-between gap-2 mt-3 pt-3 border-t border-gray-50">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-gray-400">Net price</p>
              <p className="text-sm font-semibold text-secondaryColor truncate">
                {money(asset.purchaseCost, asset.currencyId)}
              </p>
            </div>
            <div className="min-w-0 text-right">
              <p className="text-[10px] uppercase tracking-wide text-gray-400">Net value</p>
              <p className="text-sm font-semibold text-secondaryColor truncate">
                {/* Null until the asset is capitalized — an em dash, never a misleading 0. */}
                {money(asset.netBookValue, asset.currencyId)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AssetCardView;
