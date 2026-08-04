'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IAssetAssignment,
  IAssetAssignmentFilter,
  IAssignableAsset,
} from '@/interface/IAssetAssignment';
import {
  fetchAssetAssignments,
  fetchAssignableAssets,
} from '@/services/assetAssignment.service';
import { unwrapPaged } from '@/utils/serviceUtils';
import { AssignmentStatusEnum } from '@/enum/assignmentEnums';

/**
 * The custody pipeline, left to right: what is free to issue, what is out, what is late
 * back, what has come home.
 *
 * The board is READ-ONLY and there is no dragging. A card cannot be moved between these
 * columns by moving it — issuing runs eight guards and returning records a condition and
 * writes a return row. A drag that silently skipped either would be a lie about what
 * happened, so the cards route to the workflows that do it properly instead.
 *
 * Available is the odd column out: it counts ASSETS with no open assignment, not assignment
 * records, and it reuses the picker feed the bulk assign screen already relies on.
 */

const COLUMN_LIMIT = 25;

interface IProps {
  filters: IAssetAssignmentFilter;
  onOpenAssignment: (assignment: IAssetAssignment) => void;
  onReturn: (assignment: IAssetAssignment) => void;
  onOpenAsset: (assetId: string) => void;
  onAssign: () => void;
  /** Bumped by the page after any mutation, so the board reloads with the list. */
  refreshToken: number;
}

interface IColumnState {
  items: IAssetAssignment[];
  total: number;
}

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString() : '—';

const daysBetween = (from: string, to: Date) =>
  Math.floor((to.getTime() - new Date(from).getTime()) / 86_400_000);

const AssignmentKanbanView = ({
  filters,
  onOpenAssignment,
  onReturn,
  onOpenAsset,
  onAssign,
  refreshToken,
}: IProps) => {
  const [available, setAvailable] = useState<{ items: IAssignableAsset[]; total: number }>({
    items: [],
    total: 0,
  });
  const [assigned, setAssigned] = useState<IColumnState>({ items: [], total: 0 });
  const [overdue, setOverdue] = useState<IColumnState>({ items: [], total: 0 });
  const [returned, setReturned] = useState<IColumnState>({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const generationRef = useRef(0);

  const load = useCallback(async () => {
    const generation = ++generationRef.current;
    setLoading(true);
    try {
      // Each column is its own query so its count is the real total, not the share of one
      // page that happened to land in it.
      const [availableRes, assignedRes, overdueRes, returnedRes] = await Promise.all([
        fetchAssignableAssets({ pageNumber: 1, pageSize: COLUMN_LIMIT, search: filters.search }),
        fetchAssetAssignments({
          ...filters,
          pageNumber: 1,
          pageSize: COLUMN_LIMIT,
          status: AssignmentStatusEnum.Open,
          isOverdue: false,
        }),
        fetchAssetAssignments({
          ...filters,
          pageNumber: 1,
          pageSize: COLUMN_LIMIT,
          status: AssignmentStatusEnum.Open,
          isOverdue: true,
        }),
        fetchAssetAssignments({
          ...filters,
          pageNumber: 1,
          pageSize: COLUMN_LIMIT,
          status: AssignmentStatusEnum.Returned,
          isOverdue: undefined,
        }),
      ]);

      if (generation !== generationRef.current) return;

      if (![availableRes, assignedRes, overdueRes, returnedRes].every((r) => r?.success)) {
        setLoadError('The board could not be loaded.');
        return;
      }

      const a = unwrapPaged(availableRes);
      setAvailable({ items: a.items, total: a.rowCount });
      const open = unwrapPaged(assignedRes);
      setAssigned({ items: open.items, total: open.rowCount });
      const late = unwrapPaged(overdueRes);
      setOverdue({ items: late.items, total: late.rowCount });
      const back = unwrapPaged(returnedRes);
      setReturned({ items: back.items, total: back.rowCount });
      setLoadError('');
    } catch {
      if (generation !== generationRef.current) return;
      setLoadError('The board could not be loaded.');
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load, refreshToken]);

  const today = new Date();

  if (loadError) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-8 text-center">
        <p className="text-sm font-semibold text-amber-800">{loadError}</p>
        <p className="text-xs text-amber-700/80 mt-1">
          These columns are unknown right now, not empty.
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

  const Column = ({
    title,
    tone,
    count,
    shown,
    hint,
    children,
  }: {
    title: string;
    tone: string;
    count: number;
    shown: number;
    hint: string;
    children: React.ReactNode;
  }) => (
    <section className="flex flex-col min-w-0 rounded-2xl bg-gray-50 border border-gray-100">
      <header className={`flex items-center gap-2 px-3 py-2.5 border-b ${tone}`}>
        <h3 className="text-xs font-bold uppercase tracking-wide">{title}</h3>
        <span className="ml-auto rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold tabular-nums">
          {loading ? '…' : count}
        </span>
      </header>
      {/*
        * Columns only scroll internally once they sit side by side. Stacked on a phone
        * they grow naturally — four nested scroll areas on a touch screen means every
        * flick is a guess about which one will move.
        */}
      <div className="flex-1 p-2 space-y-2 sm:overflow-y-auto sm:max-h-[min(64vh,620px)]">
        {loading && shown === 0 ? (
          Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-[74px] rounded-xl bg-white animate-pulse" />
          ))
        ) : count === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8 px-2">{hint}</p>
        ) : (
          <>
            {children}
            {count > shown && (
              <p className="text-[11px] text-gray-400 text-center pt-1 tabular-nums">
                {/* Says what is missing rather than implying the column is complete. */}
                Showing {shown} of {count}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );

  const Card = ({
    onClick,
    children,
  }: {
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="w-full rounded-xl bg-white border border-gray-100 p-2.5 text-left shadow-sm transition-shadow hover:shadow-md cursor-pointer"
    >
      {children}
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 items-start">
      <Column
        title="Available"
        tone="bg-indigo-50 border-indigo-100 text-indigo-800"
        count={available.total}
        shown={available.items.length}
        hint="Nothing is free to issue right now."
      >
        {available.items.map((asset) => (
          <Card key={asset.id} onClick={() => onOpenAsset(asset.id)}>
            <p className="text-xs font-bold text-primarycolor truncate">{asset.assetCode}</p>
            <p className="text-sm font-semibold text-secondaryColor truncate">
              {asset.assetName}
            </p>
            <p className="text-[11px] text-gray-500 truncate mt-0.5">
              {asset.assetCategoryName}
              {asset.assetLocationName ? ` · ${asset.assetLocationName}` : ''}
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAssign();
              }}
              className="mt-2 text-[11px] font-semibold text-primarycolor hover:underline"
            >
              Assign →
            </button>
          </Card>
        ))}
      </Column>

      <Column
        title="Assigned"
        tone="bg-green-50 border-green-100 text-green-800"
        count={assigned.total}
        shown={assigned.items.length}
        hint="Nothing is currently out."
      >
        {assigned.items.map((assignment) => (
          <Card key={assignment.id} onClick={() => onOpenAssignment(assignment)}>
            <p className="text-xs font-bold text-primarycolor truncate">
              {assignment.assetCode}
            </p>
            <p className="text-sm font-semibold text-secondaryColor truncate">
              {assignment.assetName}
            </p>
            <p className="text-[11px] text-gray-500 truncate mt-0.5">
              {assignment.employeeName}
            </p>
            <div className="flex items-center justify-between gap-2 mt-2">
              <span className="text-[11px] text-gray-400">
                {assignment.expectedReturnDate
                  ? `Due ${formatDate(assignment.expectedReturnDate)}`
                  : 'Open-ended'}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onReturn(assignment);
                }}
                className="text-[11px] font-semibold text-primarycolor hover:underline"
              >
                Return
              </button>
            </div>
          </Card>
        ))}
      </Column>

      <Column
        title="Overdue"
        tone="bg-rose-50 border-rose-100 text-rose-800"
        count={overdue.total}
        shown={overdue.items.length}
        hint="Nothing is late back."
      >
        {overdue.items.map((assignment) => {
          const late = assignment.expectedReturnDate
            ? daysBetween(assignment.expectedReturnDate, today)
            : 0;
          return (
            <Card key={assignment.id} onClick={() => onOpenAssignment(assignment)}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold text-primarycolor truncate">
                  {assignment.assetCode}
                </p>
                <span className="shrink-0 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 tabular-nums">
                  {late}d late
                </span>
              </div>
              <p className="text-sm font-semibold text-secondaryColor truncate">
                {assignment.assetName}
              </p>
              <p className="text-[11px] text-gray-500 truncate mt-0.5">
                {assignment.employeeName}
              </p>
              <div className="flex items-center justify-between gap-2 mt-2">
                <span className="text-[11px] text-gray-400">
                  Due {formatDate(assignment.expectedReturnDate)}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReturn(assignment);
                  }}
                  className="text-[11px] font-semibold text-primarycolor hover:underline"
                >
                  Return
                </button>
              </div>
            </Card>
          );
        })}
      </Column>

      <Column
        title="Returned"
        tone="bg-gray-100 border-gray-200 text-gray-700"
        count={returned.total}
        shown={returned.items.length}
        hint="Nothing has been returned yet."
      >
        {returned.items.map((assignment) => (
          <Card key={assignment.id} onClick={() => onOpenAssignment(assignment)}>
            <p className="text-xs font-bold text-primarycolor truncate">
              {assignment.assetCode}
            </p>
            <p className="text-sm font-semibold text-secondaryColor truncate">
              {assignment.assetName}
            </p>
            <p className="text-[11px] text-gray-500 truncate mt-0.5">
              {assignment.employeeName}
            </p>
            <p className="text-[11px] text-gray-400 mt-2">
              Returned {formatDate(assignment.returnedDate)}
              {assignment.conditionAtReturnName ? ` · ${assignment.conditionAtReturnName}` : ''}
            </p>
          </Card>
        ))}
      </Column>
    </div>
  );
};

export default AssignmentKanbanView;
