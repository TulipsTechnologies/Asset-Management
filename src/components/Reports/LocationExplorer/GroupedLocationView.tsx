'use client';

import { useMemo, useState } from 'react';
import { ILocationDescendantSummary } from '@/interface/IReports';

/**
 * "How are the assets spread across this building?" — answered without loading a
 * single asset row. Descendants arrive flat from one grouped query and nest here:
 *
 *   Ground Floor — 43 assets
 *     Reception — 12      Sofa 4 · Table 2 · Rack 1     [Open] [View 12 assets]
 *     Admission Office 18 Desk 6 · Chair 8 · Computer 4 [Open] [View 18 assets]
 *
 * Every level expands and collapses independently, and each row's count is its OWN
 * assets plus its descendants' — the same rollup the tree badge shows, so the two
 * never disagree.
 */

interface IProps {
  descendants: ILocationDescendantSummary[];
  /** Assets sitting directly on the selected node, shown as its own row when non-zero. */
  directCount: number;
  selectedName: string;
  onOpen: (id: string | null) => void;
  onViewAssets: (id: string | null) => void;
  loading: boolean;
}

interface INode extends ILocationDescendantSummary {
  children: INode[];
  rollup: number;
}

/** Nest the flat rows, then roll counts up so a floor reports its rooms' assets too. */
const buildForest = (rows: ILocationDescendantSummary[]): INode[] => {
  const byId = new Map<string, INode>();
  const pseudo: INode[] = [];
  rows.forEach((row) => {
    const node: INode = { ...row, children: [], rollup: row.assetCount };
    if (row.id) byId.set(row.id, node);
    else pseudo.push(node);
  });

  const roots: INode[] = [];
  byId.forEach((node) => {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });

  const roll = (node: INode): number => {
    node.rollup = node.assetCount + node.children.reduce((sum, c) => sum + roll(c), 0);
    return node.rollup;
  };
  roots.forEach(roll);

  const sort = (nodes: INode[]) => {
    nodes.sort((a, b) => b.rollup - a.rollup || a.name.localeCompare(b.name));
    nodes.forEach((n) => sort(n.children));
  };
  sort(roots);
  return [...pseudo, ...roots];
};

const GroupRow = ({
  node,
  depth,
  expanded,
  toggle,
  onOpen,
  onViewAssets,
}: {
  node: INode;
  depth: number;
  expanded: Set<string>;
  toggle: (id: string) => void;
  onOpen: IProps['onOpen'];
  onViewAssets: IProps['onViewAssets'];
}) => {
  const key = node.id ?? '__unlocated__';
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(key);

  return (
    <div>
      <div
        className="group flex items-center gap-3 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-gray-200 hover:bg-gray-50"
        style={{ paddingLeft: depth * 22 + 8 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => toggle(key)}
            aria-label={isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-200"
          >
            <i
              className={`icon icon-right text-[10px] transition-transform ${isOpen ? 'rotate-90' : ''}`}
            />
          </button>
        ) : (
          <span className="h-6 w-6 shrink-0" />
        )}

        <i
          className={`icon shrink-0 ${
            node.depth <= 1
              ? 'icon-company text-[13px] text-primarycolor'
              : node.depth === 2
                ? 'icon-home text-[12px] text-gray-500'
                : 'icon-marker text-[12px] text-gray-400'
          }`}
        />

        <button
          type="button"
          onClick={() => onOpen(node.id)}
          className="min-w-0 truncate text-left text-sm font-medium text-secondaryColor hover:text-primarycolor hover:underline"
          title={`Open ${node.name}`}
        >
          {node.name}
        </button>

        <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-blue-700">
          {node.rollup.toLocaleString()}
        </span>

        {/* Top categories: what KIND of thing is in there, without opening it. */}
        {node.topCategories.length > 0 && (
          <span className="hidden min-w-0 truncate text-xs text-gray-400 md:inline">
            {node.topCategories.map((c) => `${c.name} ${c.count}`).join(' · ')}
          </span>
        )}

        <span className="ml-auto shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {node.rollup > 0 && (
            <button
              type="button"
              onClick={() => onViewAssets(node.id)}
              className="rounded-full border border-gray-300 bg-white px-3 py-1 text-[11px] font-medium text-secondaryColor hover:border-primarycolor hover:text-primarycolor"
            >
              View {node.rollup.toLocaleString()} asset{node.rollup === 1 ? '' : 's'}
            </button>
          )}
        </span>
      </div>

      {hasChildren && isOpen && (
        <div>
          {node.children.map((child) => (
            <GroupRow
              key={child.id ?? child.name}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              onOpen={onOpen}
              onViewAssets={onViewAssets}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const GroupedLocationView = ({
  descendants,
  directCount,
  selectedName,
  onOpen,
  onViewAssets,
  loading,
}: IProps) => {
  const forest = useMemo(() => buildForest(descendants), [descendants]);
  // Top level open by default: the first thing to see is the floors, not a row of
  // closed folders.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [seeded, setSeeded] = useState(false);
  if (!seeded && forest.length > 0) {
    setExpanded(new Set(forest.map((n) => n.id ?? '__unlocated__')));
    setSeeded(true);
  }

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (loading)
    return (
      <div className="space-y-2 p-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );

  if (forest.length === 0 && directCount === 0)
    return (
      <p className="py-10 text-center text-sm text-gray-400">
        {selectedName} has no sub-locations and no assets.
      </p>
    );

  return (
    <div className="py-1">
      {directCount > 0 && (
        <div className="mb-1 flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2">
          <i className="icon icon-marker shrink-0 text-[12px] text-gray-400" />
          <span className="text-sm text-gray-600">
            Directly in {selectedName}
          </span>
          <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-gray-600">
            {directCount.toLocaleString()}
          </span>
          <button
            type="button"
            onClick={() => onViewAssets(null)}
            className="ml-auto rounded-full border border-gray-300 bg-white px-3 py-1 text-[11px] font-medium text-secondaryColor hover:border-primarycolor hover:text-primarycolor"
          >
            View these
          </button>
        </div>
      )}
      {forest.map((node) => (
        <GroupRow
          key={node.id ?? node.name}
          node={node}
          depth={0}
          expanded={expanded}
          toggle={toggle}
          onOpen={onOpen}
          onViewAssets={onViewAssets}
        />
      ))}
    </div>
  );
};

export default GroupedLocationView;
