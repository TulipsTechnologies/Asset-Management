'use client';

import LocationBreadcrumb from '@/components/Locations/LocationBreadcrumb';
import { money } from '@/components/Assets/AssetViewShared';
import {
  ILocationPathSegment,
  ILocationSummary,
} from '@/interface/IReports';

/**
 * What is in the selected place, above the assets rather than inside them: name,
 * navigable path, how many are here, what state they are in, what kinds they are, and
 * when anyone last verified them.
 *
 * The chips are the availability and category CONTROLS, not decoration — clicking one
 * filters the list below, clicking it again clears. Their counts describe the selected
 * scope and deliberately do NOT react to the search box, so "In Use 9" always means
 * nine and clicking it always yields nine rows.
 */

const AVAILABILITY_TONE: Record<string, string> = {
  Available: 'bg-green-50 text-green-700 ring-green-200',
  'In Use': 'bg-blue-50 text-blue-700 ring-blue-200',
  'In Transfer': 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  Missing: 'bg-red-50 text-red-700 ring-red-200',
  'Under Maintenance': 'bg-amber-50 text-amber-700 ring-amber-200',
  Breakdown: 'bg-amber-50 text-amber-700 ring-amber-200',
  Quarantined: 'bg-amber-50 text-amber-700 ring-amber-200',
  'Out Of Service': 'bg-gray-100 text-gray-600 ring-gray-200',
  Draft: 'bg-gray-100 text-gray-600 ring-gray-200',
  Retired: 'bg-gray-100 text-gray-600 ring-gray-200',
  Disposed: 'bg-gray-100 text-gray-600 ring-gray-200',
};

const Chip = ({
  label,
  count,
  tone,
  active,
  onClick,
}: {
  label: string;
  count: number;
  tone: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition-all ${tone} ${
      active ? 'ring-2 ring-offset-1 ring-primarycolor' : 'hover:brightness-95'
    }`}
  >
    <span className="tabular-nums font-semibold">{count.toLocaleString()}</span>
    <span>{label}</span>
  </button>
);

const LocationSummaryHeader = ({
  summary,
  loading,
  includeChildren,
  availabilityFilter,
  categoryFilter,
  onNavigate,
  onRoot,
  onToggleAvailability,
  onToggleCategory,
  canStartVerification,
  onStartVerification,
}: {
  summary: ILocationSummary | null;
  loading: boolean;
  includeChildren: boolean;
  availabilityFilter?: string;
  categoryFilter?: string;
  onNavigate: (segment: ILocationPathSegment) => void;
  onRoot: () => void;
  onToggleAvailability: (label: string) => void;
  onToggleCategory: (id: string) => void;
  canStartVerification: boolean;
  onStartVerification: () => void;
}) => {
  if (loading && !summary)
    return (
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
        <div className="h-5 w-48 animate-pulse rounded bg-gray-100" />
        <div className="h-4 w-72 animate-pulse rounded bg-gray-100" />
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-6 w-24 animate-pulse rounded-full bg-gray-100" />
          ))}
        </div>
      </div>
    );

  if (!summary) return null;

  const isRoot = !summary.id;
  const scopeCount = includeChildren ? summary.subtreeCount : summary.directCount;
  const verification = summary.verification;
  const verifiedTotal =
    verification.verified + verification.notVerified + verification.discrepancy;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-secondaryColor">
            {isRoot ? 'All locations' : summary.name}
          </h2>
          <div className="mt-1">
            <LocationBreadcrumb path={summary.path} onNavigate={onNavigate} onRoot={onRoot} />
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums text-secondaryColor">
            {scopeCount.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">
            asset{scopeCount === 1 ? '' : 's'}
            {/* Both numbers whenever they differ, so the toggle's effect is never a
                mystery and an empty direct scope is explainable at a glance. */}
            {summary.hasChildren && summary.subtreeCount !== summary.directCount && (
              <>
                {' · '}
                {includeChildren
                  ? `${summary.directCount.toLocaleString()} directly here`
                  : `${summary.subtreeCount.toLocaleString()} incl. children`}
              </>
            )}
          </p>
        </div>
      </div>

      {summary.availability.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {summary.availability.map((chip) => (
            <Chip
              key={chip.label}
              label={chip.label}
              count={chip.count}
              tone={AVAILABILITY_TONE[chip.label] ?? 'bg-gray-100 text-gray-600 ring-gray-200'}
              active={availabilityFilter === chip.label}
              onClick={() => onToggleAvailability(chip.label)}
            />
          ))}
        </div>
      )}

      {summary.categories.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-400">Categories</span>
          {summary.categories.slice(0, 8).map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => onToggleCategory(category.id)}
              aria-pressed={categoryFilter === category.id}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-all ${
                categoryFilter === category.id
                  ? 'bg-primarycolor/15 font-medium text-primarycolor ring-2 ring-primarycolor'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span className="font-semibold tabular-nums">{category.count}</span>
              <span>{category.name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
        <p className="text-xs text-gray-500">
          {verifiedTotal === 0 ? (
            'No verification recorded here.'
          ) : (
            <>
              <span className="font-medium text-secondaryColor">Verification:</span>{' '}
              {verification.verified.toLocaleString()} verified ·{' '}
              {verification.notVerified.toLocaleString()} not verified
              {verification.discrepancy > 0 &&
                ` · ${verification.discrepancy.toLocaleString()} discrepancy`}
              {verification.lastVerifiedOn && (
                <>
                  {' · last '}
                  {new Date(verification.lastVerifiedOn).toLocaleDateString()}
                </>
              )}
              {/* Said plainly: these are the register's current flags, not a campaign
                  reconciliation — an asset moved after verification keeps its flag. */}
              <span className="text-gray-400"> (register state)</span>
            </>
          )}
        </p>
        <div className="flex items-center gap-3">
          {summary.totals.length > 0 && (
            <p className="text-xs text-gray-500">
              {summary.totals.map((total) => (
                <span key={total.currencyId} className="ml-2">
                  {/* "?" is the backend's bucket for assets with no currency recorded —
                      say that, rather than printing a question mark at the operator. */}
                  {money(total.total, total.currencyId === '?' ? null : total.currencyId)}
                  {total.currencyId === '?' && (
                    <span className="text-gray-400"> (no currency)</span>
                  )}
                </span>
              ))}
            </p>
          )}
          {canStartVerification && !isRoot && (
            <button
              type="button"
              onClick={onStartVerification}
              className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-secondaryColor hover:bg-gray-50"
            >
              Start verification
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LocationSummaryHeader;
