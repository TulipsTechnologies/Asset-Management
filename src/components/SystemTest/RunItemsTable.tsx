'use client';

import {
  RUN_ITEM_STATUS_BADGE,
  RUN_ITEM_STATUS_LABELS,
} from '@/enum/systemTestEnums';
import { ISystemTestRunItem } from '@/interface/ISystemTest';

const durationText = (ms?: number | null) =>
  ms == null ? '—' : ms >= 10_000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;

/**
 * The uniform item view: one row per scenario/finding/step with Expected and Actual side
 * by side, exactly as the runner recorded them — invariant strings, shown verbatim.
 */
export default function RunItemsTable({
  items,
  showModule = true,
}: {
  items: ISystemTestRunItem[];
  showModule?: boolean;
}) {
  if (items.length === 0)
    return (
      <p className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
        This run recorded no items.
      </p>
    );

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-100">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-3 py-2 w-10 font-medium text-gray-600">#</th>
            {showModule && (
              <th className="px-3 py-2 font-medium text-gray-600">Module</th>
            )}
            <th className="px-3 py-2 font-medium text-gray-600">Item</th>
            <th className="px-3 py-2 w-24 font-medium text-gray-600">Status</th>
            <th className="px-3 py-2 font-medium text-gray-600">Expected</th>
            <th className="px-3 py-2 font-medium text-gray-600">Actual</th>
            <th className="px-3 py-2 w-24 text-right font-medium text-gray-600">
              Duration
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-gray-50 align-top">
              <td className="px-3 py-2 text-gray-400">{item.sequence}</td>
              {showModule && (
                <td className="px-3 py-2 text-gray-500">{item.moduleKey}</td>
              )}
              <td className="px-3 py-2">
                <p className="font-medium text-secondaryColor">{item.name}</p>
                {item.message && (
                  <p className="mt-0.5 text-xs text-gray-500">{item.message}</p>
                )}
                {item.recordReference && (
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    {item.recordReference}
                  </p>
                )}
                {item.reasonCode && (
                  <code className="mt-0.5 inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                    {item.reasonCode}
                  </code>
                )}
              </td>
              <td className="px-3 py-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${RUN_ITEM_STATUS_BADGE[item.status]}`}
                >
                  {RUN_ITEM_STATUS_LABELS[item.status] ?? item.status}
                </span>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-gray-700 whitespace-pre-wrap break-words max-w-56">
                {item.expected || '—'}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-gray-700 whitespace-pre-wrap break-words max-w-56">
                {item.actual || '—'}
              </td>
              <td className="px-3 py-2 text-right text-gray-500">
                {durationText(item.durationMs)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
