'use client';

import { useMemo, useState } from 'react';
import {
  INDENT_MARGIN,
  INDENT_PAD,
  LeafDot,
  LocationTypeIcon,
  MeterBar,
  TreeChevron,
} from '@/components/Locations/treeGrammar';
import { ILocationDescendantSummary } from '@/interface/IReports';

/**
 * "How are the assets spread across this building?" — answered without loading a
 * single asset row. Descendants arrive flat from one grouped query and nest here:
 *
 *   Ground Floor ▮▮▮▮▮▮▮▮▮░ 43
 *     Reception ▮▮▮░ 12        Sofa 4 · Table 2      [Open] [View 12 assets]
 *
 * Every level expands and collapses independently, and each row's count is its OWN
 * assets plus its descendants' — the same rollup the tree badge shows, so the two
 * never disagree. The bar draws each row against the whole selected scope at the
 * top level and against its parent below, in the same grammar as every location
 * tree in the app.
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
  isLast,
  scaleBasis,
  expanded,
  toggle,
  onOpen,
  onViewAssets,
}: {
  node: INode;
  depth: number;
  isLast: boolean;
  /** Whole scope for top-level rows, the parent's rollup below. */
  scaleBasis: number;
  expanded: Set<string>;
  toggle: (id: string) => void;
  onOpen: IProps['onOpen'];
  onViewAssets: IProps['onViewAssets'];
}) => {
  const key = node.id ?? '__unlocated__';
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(key);
  const tier = depth === 0 ? 1 : depth === 1 ? 2 : 3;
  const share = scaleBasis > 0 ? node.rollup / scaleBasis : 0;
  const pct = scaleBasis > 0 ? Math.round(share * 100) : 0;
  const nameBasis = 220 - depth * (INDENT_MARGIN + INDENT_PAD);

  return (
    <div className="relative">
      {depth > 0 &&
        (isLast ? (
          <span
            aria-hidden
            className="absolute -left-[10px] top-0 h-[22px] w-[10px] rounded-bl-[7px] border-b border-l border-gray-200"
          />
        ) : (
          <span aria-hidden className="absolute -left-[10px] bottom-0 top-0 w-px bg-gray-200" />
        ))}
      <div
        className="group relative flex items-center gap-2 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-gray-200 hover:bg-gray-50"
        title={`${node.rollup.toLocaleString()} asset${node.rollup === 1 ? '' : 's'} · ${pct}% of ${depth === 0 ? 'this scope' : 'parent'}`}
      >
        {depth > 0 && !isLast && (
          <span aria-hidden className="absolute -left-[10px] top-1/2 h-px w-[10px] bg-gray-200" />
        )}

        {hasChildren ? (
          <TreeChevron isOpen={isOpen} name={node.name} onToggle={() => toggle(key)} />
        ) : (
          <LeafDot />
        )}

        {/* The pseudo "(No location)" row is a bucket, not a building — it gets the
            room marker whatever its depth. */}
        <LocationTypeIcon tier={tier} compact pseudo={!node.id} />

        <button
          type="button"
          onClick={() => onOpen(node.id)}
          className="min-w-0 shrink truncate text-left text-sm font-medium text-secondaryColor hover:text-primarycolor"
          style={{ flexBasis: nameBasis, flexGrow: 0 }}
          title={`Open ${node.name}`}
        >
          {node.name}
        </button>

        <MeterBar share={share} tier={tier} />

        <span className="w-14 shrink-0 text-right text-sm font-semibold tabular-nums text-secondaryColor">
          {node.rollup.toLocaleString()}
        </span>

        {/* Top categories: what KIND of thing is in there, without opening it. */}
        <span
          className="hidden max-w-[260px] min-w-0 truncate text-xs text-gray-400 xl:inline"
          title={node.topCategories.map((c) => `${c.name} ${c.count}`).join(' · ')}
        >
          {node.topCategories.map((c) => `${c.name} ${c.count}`).join(' · ')}
        </span>

        <span className="ml-auto flex w-28 shrink-0 justify-end opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {node.rollup > 0 && (
            <button
              type="button"
              onClick={() => onViewAssets(node.id)}
              className="whitespace-nowrap rounded-full border border-gray-300 bg-white px-3 py-1 text-[11px] font-medium text-secondaryColor hover:border-primarycolor hover:text-primarycolor"
            >
              View {node.rollup.toLocaleString()} asset{node.rollup === 1 ? '' : 's'}
            </button>
          )}
        </span>
      </div>

      {hasChildren && isOpen && (
        <div style={{ marginLeft: INDENT_MARGIN, paddingLeft: INDENT_PAD }}>
          {node.children.map((child, index) => (
            <GroupRow
              key={child.id ?? child.name}
              node={child}
              depth={depth + 1}
              isLast={index === node.children.length - 1}
              scaleBasis={node.rollup}
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

  /** The whole visible scope: what "100%" means for a top-level bar. */
  const viewTotal = useMemo(
    () => directCount + forest.reduce((sum, node) => sum + node.rollup, 0),
    [directCount, forest]
  );

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
        <div className="group mb-1 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
          <i className="icon icon-marker shrink-0 text-[12px] text-gray-400" />
          <span
            className="min-w-0 shrink truncate text-sm text-gray-600"
            style={{ flexBasis: 220, flexGrow: 0 }}
          >
            Directly in {selectedName}
          </span>
          <MeterBar share={viewTotal > 0 ? directCount / viewTotal : 0} tier={3} />
          <span className="w-14 shrink-0 text-right text-sm font-semibold tabular-nums text-secondaryColor">
            {directCount.toLocaleString()}
          </span>
          <span className="ml-auto flex w-28 shrink-0 justify-end">
            <button
              type="button"
              onClick={() => onViewAssets(null)}
              className="whitespace-nowrap rounded-full border border-gray-300 bg-white px-3 py-1 text-[11px] font-medium text-secondaryColor hover:border-primarycolor hover:text-primarycolor"
            >
              View these
            </button>
          </span>
        </div>
      )}
      {forest.map((node, index) => (
        <GroupRow
          key={node.id ?? node.name}
          node={node}
          depth={0}
          isLast={index === forest.length - 1}
          scaleBasis={viewTotal}
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
