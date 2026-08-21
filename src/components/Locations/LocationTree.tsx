'use client';

import Link from 'next/link';
import { memo, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { IAssetLocationTree } from '@/interface/IAssetLocation';
import {
  ANCHOR_ROW,
  CountBadge,
  ELBOW_DROP,
  HOVER_ROW,
  INDENT_MARGIN,
  INDENT_PAD,
  LeafDot,
  LocationTypeIcon,
  MeterBar,
  nameClass,
  SELECTED_ROW,
  TreeChevron,
} from './treeGrammar';

/**
 * The location hierarchy as an explorable tree: Building → Floor → Room, parent to
 * child, exactly as the master data nests it.
 *
 * Modes share one component:
 * - MANAGEMENT (the /locations page): hover actions (add child / edit / delete) and
 *   count badges that LINK to the Assets-by-Location report.
 * - SELECTION (the report's Location Explorer, the dashboard band): pass `onSelect` —
 *   rows become click targets, `selectedId` drives the highlight and auto-expands its
 *   ancestors, badges are plain counts (a navigation link inside the page that is
 *   already the report would be a dead click), and the mutation cluster is hidden
 *   unless handlers are provided.
 *
 * Visual grammar comes from ./treeGrammar — shared with the explorer's grouped view
 * so a location row reads identically on every surface. The star of each row is the
 * VALUE BAR between name and count: buildings are drawn against the largest building,
 * children against their parent, so the register's physical distribution is visible
 * before a single number is read. Every count badge is the SUBTREE total — the same
 * number the report shows for that node.
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
  /** Dashboard default: every building collapsed EXCEPT these ids, seeded once. */
  initialOpenIds?: string[];
  /** Tighter rows + smaller type for panes that host the tree inside a band. */
  density?: 'default' | 'compact-rows';
  /** Per-node slot rendered on the value bar's tail — exception pills and the like. */
  trailing?: (nodeId: string) => ReactNode;
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
  /** The bar's comparison basis: largest root for depth 1, parent total below. */
  scaleBasis,
  compact,
  dense,
  trailing,
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
  scaleBasis: number;
  compact?: boolean;
  dense?: boolean;
  trailing?: (nodeId: string) => ReactNode;
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
  const tier = depth === 1 ? 1 : depth === 2 ? 2 : 3;
  const share = scaleBasis > 0 ? total / scaleBasis : 0;
  const pct = scaleBasis > 0 ? Math.round((total / scaleBasis) * 100) : 0;

  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isSelected)
      rowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    // `collapsed` is a dep so a deep link still scrolls once collapse seeding has
    // revealed the row; block:'nearest' makes the extra runs free.
  }, [isSelected, collapsed]);

  // Names get a FIXED basis (shrinking by the indent step) so every bar track
  // starts at the same x per level — bars are comparable only when their origins
  // align. The reference details (code/address) live in the title, never inline:
  // a hover-revealed span would steal track width and turn the bar into a lie.
  const nameBasis = (compact ? 150 : 240) - (depth - 1) * (INDENT_MARGIN + INDENT_PAD);
  const rowTitle = [
    `${total.toLocaleString()} asset${total === 1 ? '' : 's'}`,
    scaleBasis > 0 && depth === 1 ? `${pct}% of largest building` : null,
    scaleBasis > 0 && depth > 1 ? `${pct}% of parent` : null,
    node.assetCount !== total ? `${node.assetCount.toLocaleString()} directly here` : null,
    node.code ?? null,
    node.address ?? null,
  ]
    .filter(Boolean)
    .join(' · ');

  const countCell = (
    <span className="flex w-16 shrink-0 justify-end">
      {total > 0 &&
        (selectable ? (
          // Inside a selecting surface the count is information, not navigation —
          // the row itself selects, and a link to the page we are already on is a
          // dead click.
          <button type="button" onClick={() => onSelect!(node)} className="shrink-0" tabIndex={-1}>
            <CountBadge total={total} anchor={tier === 1} selected={isSelected} />
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
            <CountBadge total={total} anchor={tier === 1} />
          </Link>
        ))}
    </span>
  );

  const elbowDrop = ELBOW_DROP[dense ? 'compact' : 'default'];

  return (
    <div
      className={`relative ${depth === 1 ? 'mt-1.5 first:mt-0' : ''}`}
      role="treeitem"
      aria-level={depth}
      aria-expanded={hasChildren ? isOpen : undefined}
      aria-selected={selectable ? isSelected : undefined}
    >
      {/* Each child draws its OWN segment of the parent's vertical guideline: a
          full-height straight run when siblings follow, a rounded terminal elbow
          when it is the last — a container-wide line can't stop at the last elbow
          once that child expands. */}
      {depth > 1 &&
        (isLast ? (
          <span
            aria-hidden
            className="absolute -left-[10px] top-0 w-[10px] rounded-bl-[7px] border-b border-l border-gray-200"
            style={{ height: elbowDrop }}
          />
        ) : (
          <span aria-hidden className="absolute -left-[10px] bottom-0 top-0 w-px bg-gray-200" />
        ))}
      <div
        ref={rowRef}
        title={rowTitle}
        className={`group relative flex items-center gap-2 rounded-lg pl-1 pr-2 transition-colors ${
          dense ? 'py-1' : 'py-1.5'
        } ${isSelected ? SELECTED_ROW : tier === 1 ? ANCHOR_ROW : HOVER_ROW}`}
      >
        {/* The elbow stub for rows that are NOT last: their guideline runs straight
            through, so the stub meets it at the row's centre. */}
        {depth > 1 && !isLast && (
          <span
            aria-hidden
            className="absolute -left-[10px] top-1/2 h-px w-[10px] bg-gray-200"
          />
        )}

        {hasChildren ? (
          <TreeChevron
            isOpen={isOpen}
            name={node.name}
            onToggle={() => toggle(node.id)}
            inert={searching}
          />
        ) : (
          <LeafDot />
        )}

        <LocationTypeIcon tier={tier} compact={compact || dense} hueKey={node.id ?? node.name} />

        {selectable ? (
          <button
            type="button"
            onClick={() => onSelect!(node)}
            className={`min-w-0 shrink truncate text-left ${nameClass(tier, compact || dense)}`}
            style={{ flexBasis: nameBasis, flexGrow: 1 }}
            title={node.name}
            aria-current={isSelected ? 'true' : undefined}
          >
            {node.name}
          </button>
        ) : (
          <span
            className={`min-w-0 shrink truncate ${nameClass(tier, compact || dense)}`}
            style={{ flexBasis: nameBasis, flexGrow: 1 }}
            title={node.name}
          >
            {node.name}
          </span>
        )}

        <MeterBar share={share} tier={tier} selected={isSelected}>
          {!node.isActive && (
            <span className="rounded-full bg-gray-100 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-gray-500 ring-1 ring-white">
              Inactive
            </span>
          )}
          {trailing?.(node.id)}
        </MeterBar>

        {countCell}

        {hasActions && (
          <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
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
        <div role="group" style={{ marginLeft: INDENT_MARGIN, paddingLeft: INDENT_PAD }}>
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
              scaleBasis={total}
              compact={compact}
              dense={dense}
              trailing={trailing}
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
  initialOpenIds,
  density = 'default',
  trailing,
}: IProps) => {
  // Collapsed ids, not expanded ones: a brand-new node is visible by default without
  // any bookkeeping, and "expand all" is simply the empty set.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const seededRef = useRef(false);

  const { subtotal, ancestors } = useMemo(() => indexTree(tree), [tree]);

  // Roots are drawn against the LARGEST building: the biggest spans the full
  // track and every other building reads as a fraction of it at a glance.
  const maxRoot = useMemo(
    () => Math.max(1, ...tree.map((root) => subtotal.get(root.id) ?? 0)),
    [tree, subtotal]
  );

  // Collapse seeding, ONCE when the tree first arrives — after that the collapse
  // state belongs to the user. Explorer: buildings visible but folded. Dashboard:
  // everything folded except the named ids (its biggest building).
  useEffect(() => {
    if ((!defaultCollapsedToBuildings && !initialOpenIds) || seededRef.current || tree.length === 0)
      return;
    seededRef.current = true;
    const all = collectIds(tree);
    setCollapsed(
      new Set(initialOpenIds ? all.filter((id) => !initialOpenIds.includes(id)) : all)
    );
  }, [defaultCollapsedToBuildings, initialOpenIds, tree]);

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
      <div role="tree" aria-label="Locations">
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
            scaleBasis={maxRoot}
            compact={!!onSelect && density === 'default'}
            dense={density === 'compact-rows'}
            trailing={trailing}
            onAddChild={onAddChild}
            onEdit={onEdit}
            onDelete={onDelete}
            onSelect={onSelect}
            selectedId={selectedId}
          />
        ))}
      </div>
    </div>
  );
};

export default LocationTree;
