'use client';

import Link from 'next/link';
import { money } from '@/components/Assets/AssetViewShared';
import AssetPhotoThumb from '@/components/Assets/AssetPhotoThumb';

/**
 * The walk-through view: one card per asset, sized to be recognised at arm's length
 * while standing in the room. Code first (that is what is printed on the label being
 * matched), then the name, then the facts a physical check needs — kind, condition,
 * who holds it, and its state.
 *
 * The photo shows when the asset has one, falling back to the tinted glyph when it does
 * not, and clicking it opens the full-size image.
 *
 * Uploads are still stored at original camera size with no thumbnail pipeline, so the cost
 * is managed rather than removed: AssetPhotoThumb defers each fetch until the card scrolls
 * into view and caches the result per asset, so a page of 25 pulls only what is actually
 * looked at. A bounded, authenticated thumbnail endpoint remains the real fix — it would
 * turn these into kilobytes.
 */

export interface ILocationAssetCard {
  id: string;
  assetCode: string;
  assetName: string;
  categoryName: string;
  availability: string;
  custodianName?: string | null;
  condition?: string | null;
  /** Register state: Not Verified / Verified / Discrepancy. */
  verification: string;
  assetTag?: string | null;
  serialNumber?: string | null;
  purchaseCost?: number | null;
  purchaseCurrency?: string | null;
  locationPath: string;
}

/** One tone per availability meaning — shared by the cards and the table badge so the
 *  two surfaces can never disagree about what "In Use" looks like. */
export const AVAILABILITY_TONE: Record<string, string> = {
  Available: 'bg-green-50 text-green-700',
  'In Use': 'bg-blue-50 text-blue-700',
  'In Transfer': 'bg-indigo-50 text-indigo-700',
  Missing: 'bg-red-50 text-red-700',
  'Under Maintenance': 'bg-amber-50 text-amber-700',
  Breakdown: 'bg-amber-50 text-amber-700',
  Quarantined: 'bg-amber-50 text-amber-700',
};

const LocationAssetCards = ({
  assets,
  loading,
  showLocation,
}: {
  assets: ILocationAssetCard[];
  loading: boolean;
  /** True when the list spans child locations — then each card must say where it is. */
  showLocation: boolean;
}) => {
  if (loading)
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-[150px] animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {assets.map((asset) => (
        <div
          key={asset.id}
          className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm"
        >
          <div className="flex items-start gap-3">
            <AssetPhotoThumb
              assetId={asset.id}
              assetCode={asset.assetCode}
              assetName={asset.assetName}
              size="md"
            />
            <div className="min-w-0 flex-1">
              {/* Name first, code beneath — same order as the register's card view, so an
                  asset reads the same way wherever it is shown. */}
              <p
                className="line-clamp-2 break-words text-sm font-medium text-secondaryColor"
                title={asset.assetName}
              >
                {asset.assetName}
              </p>
              <p className="mt-0.5 truncate font-mono text-xs text-gray-400">
                {asset.assetCode}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                AVAILABILITY_TONE[asset.availability] ?? 'bg-gray-100 text-gray-600'
              }`}
            >
              {asset.availability}
            </span>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            <div className="min-w-0">
              <dt className="text-gray-400">Category</dt>
              <dd className="truncate text-gray-700">{asset.categoryName}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-gray-400">Condition</dt>
              <dd className="truncate text-gray-700">{asset.condition || '—'}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-gray-400">Custodian</dt>
              <dd className="truncate text-gray-700">{asset.custodianName || '—'}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-gray-400">Cost</dt>
              <dd className="truncate text-gray-700">
                {money(asset.purchaseCost, asset.purchaseCurrency)}
              </dd>
            </div>
          </dl>

          {showLocation && (
            <p
              className="mt-2 truncate text-[11px] text-gray-400"
              title={asset.locationPath}
            >
              <i className="icon icon-marker mr-1 text-[10px]" />
              {asset.locationPath}
            </p>
          )}

          <Link
            // Bare path: next/link applies basePath itself; appUrl() here 404'd.
            href={`/assets/${asset.id}`}
            className="mt-3 inline-flex items-center gap-1 self-start text-xs font-medium text-primarycolor hover:underline"
          >
            View asset
            <i className="icon icon-right text-[9px]" />
          </Link>
        </div>
      ))}
    </div>
  );
};

export default LocationAssetCards;
