'use client';

import Link from 'next/link';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { IAssetLocationTree } from '@/interface/IAssetLocation';

/**
 * The location hierarchy as an explorable tree: Building → Floor → Room, parent to
 * child, exactly as the master data nests it.
 *
 * Two modes share one component:
 * - MANAGEMENT (the /locations page): hover actions (add child / edit / delete) and
 *   count badges that LINK to the Assets-by-Location report.
 * - SELECTION (the report's Location Explorer): pass `onSelect` — rows become click
 *   targets, `selectedId` drives the highlight and auto-expands its ancestors, badges
 *   are plain counts (a navigation link inside the page that is already the report
 *   would be a dead click), and the mutation cluster is hidden unless handlers are
 *   provided.
 *
 * Visual grammar: depth carries weight (buildings are anchors, rooms are leaves),
 * elbow connectors draw containment the way a file explorer does, and every count
 * badge is the SUBTREE total — the same number the report shows for that node.
 */

interface IProps {
  tree: IAssetLocationTree[];
  loading: boolean;
  /** Filters to matching nodes plus their ancestors, so a hit keeps its path visible. */
  search: string;
  /** Depth of the node being added under (1-based); omit to hide the add action. */
  onAddChild?: (parent: IAssetLocationTree, depth: number) => void;
  onEdit?: (node: IAssetLocationTree) => void;
  onDelete?: (node: IAssetLocationTree) => void;
  /** Selection mode: rows select instead of linking. */
  onSelect?: (node: IAssetLocationTree) => void;
  /** Controlled highlight; changing it auto-expands ancestors and scrolls into view. */
  selectedId?: string | null;
  /** Explorer default: buildings visible but collapsed on first load. */
  defaultCollapsedToBuildings?: boolean;
}

const matchesSearch = (node: IAssetLocationTree, needle: string): boolean =>
  node.name.toLowerCase().includes(needle) ||
  (node.code ?? '').toLowerCase().includes(needle);

/** A node survives the filter if it matches or ANY descendant does. */
const filterTree = (
  nodes: IAssetLocationTree[],
  needle: string
): IAssetLocationTree[] =>
  nodes
    .map((node) => {
      const children = filterTree(node.children, needle);
      return matchesSearch(node, needle) || children.length > 0
        ? { ...node, children }
        : null;
    })
    .filter((node): node is IAssetLocationTree => node !== null);

/** One pass over the tree: subtree totals + each node's ancestor chain. */
const indexTree = (nodes: IAssetLocationTree[]) => {
  const subtotal = new Map<string, number>();
  const ancestors = new Map<string, string[]>();
  const walk = (node: IAssetLocationTree, chain: string[]): number => {
    ancestors.set(node.id, chain);
    const total =
      node.assetCount +
      node.children.reduce((sum, child) => sum + walk(child, [...chain, node.id]), 0);
    subtotal.set(node.id, total);
    return total;
  };
  nodes.forEach((root) => walk(root, []));
  return { subtotal, ancestors };
};

const countNodes = (nodes: IAssetLocationTree[]): number =>
  nodes.reduce((sum, node) => sum + 1 + countNodes(node.children), 0);

const collectIds = (nodes: IAssetLocationTree[], into: string[] = []): string[] => {
  for (const node of nodes) {
    if (node.children.length > 0) {
      into.push(node.id);
      collectIds(node.children, into);
    }
  }
  return into;
};

const TreeNode = memo(function TreeNode({
  node,
  depth,
  isLast,
  collapsed,
  toggle,
  searching,
  subtotal,
  compact,
  onAddChild,
  onEdit,
  onDelete,
  onSelect,
  selectedId,
}: {
  node: IAssetLocationTree;
  depth: number;
  isLast: boolean;
  collapsed: Set<string>;
  toggle: (id: string) => void;
  searching: boolean;
  subtotal: Map<string, number>;
  compact?: boolean;
  onAddChild?: IProps['onAddChild'];
  onEdit?: IProps['onEdit'];
  onDelete?: IProps['onDelete'];
  onSelect?: IProps['onSelect'];
  selectedId?: string | null;
}) {
  const hasChildren = node.children.length > 0;
  // While searching, every surviving branch stays open — collapsing away the very
  // match someone typed for would make the filter look broken.
  const isOpen = searching || !collapsed.has(node.id);
  const total = subtotal.get(node.id) ?? node.assetCount;
  const selectable = !!onSelect;
  const isSelected = selectable && selectedId === node.id;
  const hasActions = !!(onAddChild || onEdit || onDelete);

  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isSelected)
      rowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [isSelected]);

  const countBadge = (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums transition-colors ${
        isSelected
          ? 'bg-white/80 text-primarycolor'
          : depth === 1
            ? 'bg-primarycolor/10 text-primarycolor hover:bg-primarycolor/20'
            : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
      }`}
      title={
        node.assetCount === total
          ? `${total.toLocaleString()} asset${total === 1 ? '' : 's'} here`
          : `${total.toLocaleString()} asset${total === 1 ? '' : 's'} in this ${depth === 1 ? 'building' : 'area'} (${node.assetCount.toLocaleString()} directly here)`
      }
    >
      {total.toLocaleString()}
      {depth === 1 && !compact && <span className="ml-1 font-normal">assets</span>}
    </span>
  );

  return (
    <div className={`relative ${depth === 1 ? 'mt-1.5 first:mt-0' : ''}`}>
      {/* Each child draws its OWN segment of the parent's vertical guideline: full
          height when siblings follow, elbow-deep when it is the last. */}
      {depth > 1 && (
        <span
          aria-hidden
          className={`absolute -left-[11px] top-0 w-px bg-gray-200 ${isLast ? 'h-[19px]' : 'bottom-0'}`}
        />
      )}
      <div
        ref={rowRef}
        className={`group relative flex items-center gap-2 rounded-lg py-1.5 pl-1 pr-2 transition-colors ${
          isSelected
            ? 'bg-primarycolor/15 ring-1 ring-primarycolor/40'
            : depth === 1
              ? 'bg-gray-50 hover:bg-gray-100/80'
              : 'hover:bg-gray-50'
        }`}
      >
        {/* The elbow: this row's stub meeting the guideline at its centre. */}
        {depth > 1 && (
          <span
            aria-hidden
            className="absolute -left-[11px] top-1/2 h-px w-[11px] bg-gray-200"
          />
        )}

        {hasChildren ? (
          <button
            type="button"
            onClick={() => toggle(node.id)}
            aria-label={isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-200 hover:text-gray-600"
          >
            <i
              className={`icon icon-right text-[10px] transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
            />
          </button>
        ) : (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center">
            <span className="h-1 w-1 rounded-full bg-gray-300" />
          </span>
        )}

        {/* Depth speaks through the icon: buildings anchor, floors carry, rooms point. */}
        {depth === 1 ? (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primarycolor/10">
            <i className="icon icon-company text-[14px] text-primarycolor" />
          </span>
        ) : (
          <i
            className={`icon ${depth === 2 ? 'icon-home text-[13px] text-gray-500' : 'icon-marker text-[12px] text-gray-400'} shrink-0`}
          />
        )}

        {selectable ? (
          <button
            type="button"
            onClick={() => onSelect!(node)}
            className={`min-w-0 flex-[2_1_0%] truncate text-left ${
              depth === 1
                ? 'text-[15px] font-semibold text-secondaryColor'
                : depth === 2
                  ? 'text-sm font-medium text-secondaryColor'
                  : 'text-sm text-gray-600'
            }`}
            aria-current={isSelected ? 'true' : undefined}
          >
            {node.name}
          </button>
        ) : (
          <span
            className={`truncate ${
              depth === 1
                ? 'text-[15px] font-semibold text-secondaryColor'
                : depth === 2
                  ? 'text-sm font-medium text-secondaryColor'
                  : 'text-sm text-gray-600'
            }`}
          >
            {node.name}
          </span>
        )}

        {!node.isActive && (
          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
            Inactive
          </span>
        )}

        {total > 0 &&
          (selectable ? (
            // Inside the explorer the count is information, not navigation — the row
            // itself selects, and a link to the page we are already on is a dead click.
            <button type="button" onClick={() => onSelect!(node)} className="shrink-0">
              {countBadge}
            </button>
          ) : (
            // On the management page the badge answers "what is here?" when clicked:
            // the report, scoped to this node with children included — exactly what
            // the subtree total counts, so the click never contradicts the badge.
            <Link
              href={`/reports?code=assets-by-location&locationId=${node.id}`}
              className="shrink-0"
              title="Open the Assets-by-Location report for this location"
            >
              {countBadge}
            </Link>
          ))}

        {/* Reference details stay out of the way until the row is engaged — and stay
            out of the LAYOUT entirely in the narrow explorer pane, where they were
            stealing the width the location name needs. */}
        <span className={`min-w-0 shrink items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${compact ? 'hidden' : 'hidden sm:flex'}`}>
          {node.code && (
            <span className="truncate font-mono text-[10px] text-gray-400">{node.code}</span>
          )}
          {node.address && (
            <span className="truncate text-xs text-gray-400">{node.address}</span>
          )}
        </span>

        {hasActions && (
          <span className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            {onAddChild && depth < 3 && (
              <button
                type="button"
                onClick={() => onAddChild(node, depth)}
                title={`Add a location under ${node.name}`}
                className="rounded-md p-1.5 text-gray-400 hover:bg-white hover:text-primarycolor hover:shadow-sm"
              >
                <i className="icon icon-plus text-[11px]" />
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(node)}
                title="Edit"
                className="rounded-md p-1.5 text-gray-400 hover:bg-white hover:text-secondaryColor hover:shadow-sm"
              >
                <i className="icon icon-edit text-[11px]" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(node)}
                title="Delete"
                className="rounded-md p-1.5 text-gray-400 hover:bg-white hover:text-red-600 hover:shadow-sm"
              >
                <i className="icon icon-trash text-[11px]" />
              </button>
            )}
          </span>
        )}
      </div>

      {hasChildren && isOpen && (
        <div className="ml-[15px] pl-[11px]">
          {node.children.map((child, index) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              isLast={index === node.children.length - 1}
              collapsed={collapsed}
              toggle={toggle}
              searching={searching}
              subtotal={subtotal}
              compact={compact}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  );
});

const LocationTree = ({
  tree,
  loading,
  search,
  onAddChild,
  onEdit,
  onDelete,
  onSelect,
  selectedId,
  defaultCollapsedToBuildings,
}: IProps) => {
  // Collapsed ids, not expanded ones: a brand-new node is visible by default without
  // any bookkeeping, and "expand all" is simply the empty set.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const seededRef = useRef(false);

  const { subtotal, ancestors } = useMemo(() => indexTree(tree), [tree]);

  // Explorer default: buildings visible but folded, seeded ONCE when the tree first
  // arrives — after that the collapse state belongs to the user.
  useEffect(() => {
    if (!defaultCollapsedToBuildings || seededRef.current || tree.length === 0) return;
    seededRef.current = true;
    setCollapsed(new Set(collectIds(tree)));
  }, [defaultCollapsedToBuildings, tree]);

  // A controlled selection must be VISIBLE: breadcrumb clicks, Recent picks and deep
  // links land on nodes the user may have collapsed away — expand their ancestors.
  useEffect(() => {
    if (!selectedId) return;
    const chain = ancestors.get(selectedId);
    if (!chain || chain.length === 0) return;
    setCollapsed((prev) => {
      if (!chain.some((id) => prev.has(id))) return prev;
      const next = new Set(prev);
      chain.forEach((id) => next.delete(id));
      return next;
    });
  }, [selectedId, ancestors]);

  const needle = search.trim().toLowerCase();
  const visible = useMemo(
    () => (needle ? filterTree(tree, needle) : tree),
    [tree, needle]
  );

  const totals = useMemo(
    () => ({
      buildings: tree.length,
      locations: countNodes(tree),
      assets: tree.reduce((sum, root) => sum + (subtotal.get(root.id) ?? 0), 0),
    }),
    [tree, subtotal]
  );

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (loading)
    return (
      <div className="space-y-2 py-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-9 animate-pulse rounded-lg bg-gray-100"
            style={{ marginLeft: (i % 3) * 26, width: `${88 - (i % 3) * 14}%` }}
          />
        ))}
      </div>
    );

  if (visible.length === 0)
    return (
      <p className="py-10 text-center text-sm text-gray-400">
        {needle
          ? `No location matches '${search.trim()}'.`
          : 'No locations yet — add a building to start the hierarchy.'}
      </p>
    );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
        <p className="text-xs text-gray-500">
          <span className="font-semibold text-secondaryColor">{totals.buildings}</span>{' '}
          building{totals.buildings === 1 ? '' : 's'} ·{' '}
          <span className="font-semibold text-secondaryColor">{totals.locations}</span>{' '}
          location{totals.locations === 1 ? '' : 's'} ·{' '}
          <span className="font-semibold text-secondaryColor">
            {totals.assets.toLocaleString()}
          </span>{' '}
          asset{totals.assets === 1 ? '' : 's'}
        </p>
        <div className="flex gap-3 text-xs">
          <button
            type="button"
            onClick={() => setCollapsed(new Set())}
            className="text-gray-500 hover:text-secondaryColor"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(new Set(collectIds(tree)))}
            className="text-gray-500 hover:text-secondaryColor"
          >
            Collapse all
          </button>
        </div>
      </div>
      {visible.map((root, index) => (
        <TreeNode
          key={root.id}
          node={root}
          depth={1}
          isLast={index === visible.length - 1}
          collapsed={collapsed}
          toggle={toggle}
          searching={needle.length > 0}
          subtotal={subtotal}
          compact={!!onSelect}
          onAddChild={onAddChild}
          onEdit={onEdit}
          onDelete={onDelete}
          onSelect={onSelect}
          selectedId={selectedId}
        />
      ))}
    </div>
  );
};

export default LocationTree;
