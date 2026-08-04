'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IAssetAssignmentFilter,
  IAssignmentAnalytics,
  IAssignmentBucket,
} from '@/interface/IAssetAssignment';
import { fetchAssignmentAnalytics } from '@/services/assetAssignment.service';

/**
 * How custody is behaving: how much is out, how much is late, who is holding it, and how
 * issuing and returning have tracked each other over the year.
 *
 * Every figure describes the SAME assignments the table is paging through — the filters and
 * the search apply first. Counts are of assignment RECORDS: an asset issued, returned and
 * issued again is three rows here and one asset in the register.
 */

interface IProps {
  filters: IAssetAssignmentFilter;
  filterSummary?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const BAR_COLOURS = [
  'bg-sky-500',
  'bg-green-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-indigo-500',
];

const BucketPanel = ({
  title,
  buckets,
  emptyText,
  limit = 6,
}: {
  title: string;
  buckets: IAssignmentBucket[];
  emptyText: string;
  limit?: number;
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
                <span className="text-xs text-gray-500 tabular-nums shrink-0">{bucket.count}</span>
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
              {remainder.length} more ·{' '}
              {remainder.reduce((sum, bucket) => sum + bucket.count, 0)} assignments
            </li>
          )}
        </ul>
      )}
    </section>
  );
};

const AssignmentAnalyticsView = ({ filters, filterSummary }: IProps) => {
  const [data, setData] = useState<IAssignmentAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const generationRef = useRef(0);

  const load = useCallback(async () => {
    const generation = ++generationRef.current;
    setLoading(true);
    try {
      const response = await fetchAssignmentAnalytics(filters);
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
    () => Math.max(1, ...(data?.byMonth ?? []).map((p) => Math.max(p.issued, p.returned))),
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
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-[86px] rounded-2xl bg-white border border-gray-100 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="h-[220px] rounded-2xl bg-white border border-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const tiles = [
    {
      label: 'Available to issue',
      value: String(data.availableAssetCount),
      tint: 'bg-indigo-50',
      text: 'text-indigo-700',
      note: 'assets, not assignments',
    },
    { label: 'Currently out', value: String(data.openCount), tint: 'bg-green-50', text: 'text-green-700' },
    {
      label: 'Overdue',
      value: String(data.overdueCount),
      tint: data.overdueCount > 0 ? 'bg-rose-50' : 'bg-gray-50',
      text: data.overdueCount > 0 ? 'text-rose-700' : 'text-gray-300',
    },
    { label: 'Returned', value: String(data.returnedCount), tint: 'bg-sky-50', text: 'text-sky-700' },
    {
      label: 'Average days held',
      // Null, not zero, when nothing has come back — there is no average to report yet.
      value: data.averageDaysHeld != null ? Math.round(data.averageDaysHeld).toString() : '—',
      tint: 'bg-violet-50',
      text: 'text-violet-700',
      note: data.averageDaysHeld != null ? 'closed assignments' : 'nothing returned yet',
    },
  ];

  return (
    <div className="space-y-4">
      {filterSummary && (
        <p className="text-xs text-gray-500">
          Describing <span className="font-semibold text-secondaryColor">{filterSummary}</span>.
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {tiles.map((tile) => (
          <div key={tile.label} className={`rounded-2xl ${tile.tint} px-4 py-3`}>
            <p className={`text-xl font-bold leading-none tabular-nums ${tile.text}`}>
              {tile.value}
            </p>
            <p className="text-[11px] text-gray-500 mt-1.5">{tile.label}</p>
            {tile.note && <p className="text-[10px] text-gray-400 mt-0.5">{tile.note}</p>}
          </div>
        ))}
      </div>

      {data.longestOpenDays != null && data.longestOpenDays > 0 && (
        <p className="text-xs text-gray-500">
          The longest-running open assignment has been out for{' '}
          <span className="font-semibold text-secondaryColor tabular-nums">
            {data.longestOpenDays} days
          </span>
          .
        </p>
      )}

      {data.totalAssignments === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm py-14 text-center">
          <p className="text-sm text-gray-500">No assignments match the current filters.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <BucketPanel
              title="By custodian"
              buckets={data.byCustodian}
              emptyText="No custodians to show."
            />
            <BucketPanel
              title="By category"
              buckets={data.byCategory}
              emptyText="No categories to show."
            />
            <BucketPanel
              title="Condition at issue"
              buckets={data.byConditionAtIssue}
              emptyText="No conditions recorded."
            />
          </div>

          <section className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
              <h3 className="text-sm font-bold text-secondaryColor">
                Issued and returned — last 12 months
              </h3>
              <span className="flex items-center gap-3 text-[11px] text-gray-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-primarycolor"></span> Issued
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-sky-400"></span> Returned
                </span>
              </span>
            </div>

            {data.byMonth.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                No assignments in the last twelve months.
              </p>
            ) : (
              <div className="flex items-end gap-2 h-40 overflow-x-auto">
                {data.byMonth.map((point) => (
                  <div
                    key={`${point.year}-${point.month}`}
                    className="flex-1 min-w-[38px] flex flex-col items-center justify-end h-full"
                    title={`${MONTHS[point.month - 1]} ${point.year}: ${point.issued} issued, ${point.returned} returned`}
                  >
                    {/* Paired bars, one axis — the two series must be comparable at a glance. */}
                    <span className="flex items-end justify-center gap-0.5 w-full h-full">
                      <span
                        className="w-1/2 max-w-[16px] rounded-t bg-primarycolor/80"
                        style={{ height: `${Math.max((point.issued / trendMax) * 88, point.issued > 0 ? 3 : 0)}%` }}
                      />
                      <span
                        className="w-1/2 max-w-[16px] rounded-t bg-sky-400/80"
                        style={{ height: `${Math.max((point.returned / trendMax) * 88, point.returned > 0 ? 3 : 0)}%` }}
                      />
                    </span>
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

export default AssignmentAnalyticsView;
