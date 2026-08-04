'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IAssetAnalytics,
  IAssetAnalyticsBucket,
  IAssetFilter,
} from '@/interface/IAsset';
import { fetchAssetAnalytics } from '@/services/asset.service';
import { compactMoney, money } from './AssetViewShared';

/**
 * What the current selection is made of, what it is worth and when it was bought.
 *
 * Every figure describes the SAME set the table is paging through — the filters and the
 * search apply first — so this answers "what am I looking at", not "what is in the
 * register". Narrowing to one category and switching here describes that category.
 */

interface IProps {
  filters: IAssetFilter;
  /** Rendered above the tiles so the reader knows the numbers are scoped. */
  filterSummary?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const BAR_COLOURS = [
  'bg-sky-500',
  'bg-mint-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-orange-500',
];

/** Horizontal bars beat a pie for this: labels stay readable and rank is obvious. */
const BucketPanel = ({
  title,
  buckets,
  emptyText,
  limit = 6,
  currency,
  showValue = true,
}: {
  title: string;
  buckets: IAssetAnalyticsBucket[];
  emptyText: string;
  limit?: number;
  currency?: string | null;
  showValue?: boolean;
}) => {
  const shown = buckets.slice(0, limit);
  const remainder = buckets.slice(limit);
  const max = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <section className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h3 className="text-sm font-bold text-secondaryColor">{title}</h3>
        <span className="text-[11px] text-gray-400 tabular-nums">
          {buckets.length} group{buckets.length === 1 ? '' : 's'}
        </span>
      </div>

      {buckets.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">{emptyText}</p>
      ) : (
        <ul className="space-y-2.5">
          {shown.map((bucket, index) => (
            <li key={bucket.label}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-secondaryColor truncate">
                  {bucket.label}
                </span>
                <span className="text-xs text-gray-500 tabular-nums shrink-0">
                  {bucket.count}
                  {showValue && bucket.value > 0 && (
                    <span className="text-gray-400"> · {compactMoney(bucket.value, currency)}</span>
                  )}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${BAR_COLOURS[index % BAR_COLOURS.length]}`}
                  style={{ width: `${Math.max((bucket.count / max) * 100, 2)}%` }}
                />
              </div>
            </li>
          ))}
          {remainder.length > 0 && (
            <li className="text-[11px] text-gray-400 tabular-nums pt-1">
              {/* Named, not hidden: "+3 more" tells you nothing about what you cannot see. */}
              {remainder.length} more ·{' '}
              {remainder.reduce((sum, bucket) => sum + bucket.count, 0)} assets
            </li>
          )}
        </ul>
      )}
    </section>
  );
};

const AssetAnalyticsView = ({ filters, filterSummary }: IProps) => {
  const [data, setData] = useState<IAssetAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const generationRef = useRef(0);

  const load = useCallback(async () => {
    const generation = ++generationRef.current;
    setLoading(true);
    try {
      const response = await fetchAssetAnalytics(filters);
      if (generation !== generationRef.current) return;
      if (!response?.success || !response.data) {
        setData(null);
        setLoadError(response?.message || 'The analytics could not be loaded.');
        return;
      }
      setData(response.data);
      setLoadError('');
    } catch {
      if (generation !== generationRef.current) return;
      setData(null);
      setLoadError('The analytics could not be loaded.');
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const trendMax = useMemo(
    () => Math.max(1, ...(data?.acquisitionByMonth ?? []).map((p) => p.count)),
    [data]
  );

  if (loadError) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-8 text-center">
        <p className="text-sm font-semibold text-amber-800">{loadError}</p>
        <p className="text-xs text-amber-700/80 mt-1">
          These figures are unknown right now, not zero.
        </p>
        <button
          type="button"
          className="text-xs font-semibold text-amber-800 hover:underline mt-2"
          onClick={load}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data && loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="h-[86px] rounded-2xl bg-white border border-gray-100 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-[220px] rounded-2xl bg-white border border-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const currency = data.currencyCount === 1 ? data.primaryCurrency : null;
  const mixedCurrencies = data.currencyCount > 1;

  const tiles = [
    { label: 'Assets', value: String(data.totalAssets), tint: 'bg-sky-50', text: 'text-sky-700' },
    {
      label: 'Purchase cost',
      value: data.totalPurchaseCost > 0 ? compactMoney(data.totalPurchaseCost, currency) : '—',
      tint: 'bg-indigo-50',
      text: 'text-indigo-700',
    },
    {
      label: 'Depreciation',
      value:
        data.totalAccumulatedDepreciation > 0
          ? compactMoney(data.totalAccumulatedDepreciation, currency)
          : '—',
      tint: 'bg-amber-50',
      text: 'text-amber-700',
    },
    {
      label: 'Net book value',
      value: data.totalNetBookValue > 0 ? compactMoney(data.totalNetBookValue, currency) : '—',
      tint: 'bg-green-50',
      text: 'text-green-700',
    },
    {
      label: 'Capitalized',
      value: `${data.capitalizedCount} of ${data.totalAssets}`,
      tint: 'bg-violet-50',
      text: 'text-violet-700',
    },
  ];

  return (
    <div className="space-y-4">
      {filterSummary && (
        <p className="text-xs text-gray-500">
          Describing <span className="font-semibold text-secondaryColor">{filterSummary}</span>.
        </p>
      )}

      {mixedCurrencies && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="inline-flex items-center justify-center size-9 rounded-full bg-amber-100 shrink-0">
            <i className="icon icon-alert text-amber-600 text-base"></i>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-800">
              These assets are priced in {data.currencyCount} currencies.
            </p>
            <p className="text-xs text-amber-700/80">
              The register converts nothing, so the money totals below add different
              currencies together. Filter to one currency before reading them as figures.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {tiles.map((tile) => (
          <div key={tile.label} className={`rounded-2xl ${tile.tint} px-4 py-3`}>
            <p className={`text-xl font-bold leading-none tabular-nums ${tile.text}`}>
              {tile.value}
            </p>
            <p className="text-[11px] text-gray-500 mt-1.5">{tile.label}</p>
          </div>
        ))}
      </div>

      {data.totalAssets === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm py-14 text-center">
          <p className="text-sm text-gray-500">No assets match the current filters.</p>
          <p className="text-xs text-gray-400 mt-1">
            Clear a filter or widen the search to see a breakdown.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BucketPanel
              title="By category"
              buckets={data.byCategory}
              emptyText="No categories to show."
              currency={currency}
            />
            <BucketPanel
              title="By location"
              buckets={data.byLocation}
              emptyText="No locations recorded."
              currency={currency}
            />
            <BucketPanel
              title="By lifecycle"
              buckets={data.byLifecycle}
              emptyText="No lifecycle data."
              showValue={false}
            />
            <BucketPanel
              title="By custody"
              buckets={data.byCustody}
              emptyText="No custody data."
              showValue={false}
            />
            <BucketPanel
              title="By operational status"
              buckets={data.byOperational}
              emptyText="No operational data."
              showValue={false}
            />
            <BucketPanel
              title="By condition"
              buckets={data.byCondition}
              emptyText="No condition data."
              showValue={false}
            />
          </div>

          <section className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
            <div className="flex items-baseline justify-between gap-2 mb-4">
              <h3 className="text-sm font-bold text-secondaryColor">
                Acquisitions — last 24 months
              </h3>
              {data.acquisitionByMonth.length > 0 && (
                <span className="text-xs text-gray-500 tabular-nums">
                  {data.acquisitionByMonth.reduce((sum, p) => sum + p.count, 0)} assets ·{' '}
                  {money(
                    data.acquisitionByMonth.reduce((sum, p) => sum + p.cost, 0),
                    currency
                  )}
                </span>
              )}
            </div>

            {data.acquisitionByMonth.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                No purchase dates recorded in the last two years.
              </p>
            ) : (
              <div className="flex items-end gap-1.5 h-40 overflow-x-auto">
                {data.acquisitionByMonth.map((point) => (
                  <div
                    key={`${point.year}-${point.month}`}
                    className="flex-1 min-w-[26px] flex flex-col items-center justify-end h-full"
                    title={`${MONTHS[point.month - 1]} ${point.year}: ${point.count} asset(s), ${money(point.cost, currency)}`}
                  >
                    <span className="text-[10px] font-medium text-gray-500 mb-1 tabular-nums">
                      {point.count}
                    </span>
                    <div
                      className="w-full max-w-[36px] rounded-t bg-primarycolor/80 hover:bg-primarycolor transition-colors"
                      // 88%, not 100% — the count label above shares this fixed height.
                      style={{ height: `${Math.max((point.count / trendMax) * 88, 3)}%` }}
                    />
                    <span className="text-[10px] text-gray-500 mt-1.5 whitespace-nowrap">
                      {MONTHS[point.month - 1]}
                      {point.month === 1 && (
                        <span className="text-gray-300"> {String(point.year).slice(-2)}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default AssetAnalyticsView;
