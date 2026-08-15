'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { IDashboardLocationNode } from '@/interface/IDashboard';
import { appUrl } from '@/utils/constants';

/**
 * Where everything physically is, as a place you can walk rather than a list you must
 * read: buildings that open into floors that open into rooms, each carrying the total
 * it actually contains.
 *
 * This is SUMMARY AND NAVIGATION only — no asset rows are loaded here. Every number on
 * screen comes from the single dashboard payload, so expanding a building or selecting
 * a room costs nothing; the detailed investigation lives in the Location Explorer, one
 * click away with the selection carried across.
 */

interface INode extends IDashboardLocationNode {
  children: INode[];
  /** This node's own assets plus every descendant's — what the operator means by "in". */
  total: number;
  totalMissing: number;
  totalDiscrepancy: number;
  totalMaintenance: number;
  totalNeverVerified: number;
  totalVerified: number;
  /** Own categories plus every descendant's, summed then ranked — a building's answer. */
  rolledCategories: { name: string; count: number }[];
  path: string[];
}

/** Nest the flat rows and roll every tally up the tree in one pass. */
const buildForest = (rows: IDashboardLocationNode[]): INode[] => {
  const byId = new Map<string, INode>();
  const loose: INode[] = [];
  const make = (row: IDashboardLocationNode): INode => ({
    ...row,
    children: [],
    total: row.assetCount,
    totalMissing: row.missingCount,
    totalDiscrepancy: row.discrepancyCount,
    totalMaintenance: row.underMaintenanceCount,
    totalNeverVerified: row.neverVerifiedCount,
    totalVerified: row.verifiedCount,
    rolledCategories: [],
    path: [row.name],
  });

  rows.forEach((row) => {
    const node = make(row);
    if (row.id) byId.set(row.id, node);
    else loose.push(node);
  });

  const roots: INode[] = [];
  byId.forEach((node) => {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });

  const roll = (node: INode, ancestry: string[]): void => {
    node.path = [...ancestry, node.name];
    node.children.forEach((child) => roll(child, node.path));
    node.total += node.children.reduce((s, c) => s + c.total, 0);
    node.totalMissing += node.children.reduce((s, c) => s + c.totalMissing, 0);
    node.totalDiscrepancy += node.children.reduce((s, c) => s + c.totalDiscrepancy, 0);
    node.totalMaintenance += node.children.reduce((s, c) => s + c.totalMaintenance, 0);
    node.totalNeverVerified += node.children.reduce((s, c) => s + c.totalNeverVerified, 0);
    node.totalVerified += node.children.reduce((s, c) => s + c.totalVerified, 0);
    node.children.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    // Sum the FULL per-node lists before ranking: a category that is fourth in every
    // room can still be the building's largest, and truncating first would hide it.
    const tally = new Map<string, number>();
    const add = (list: { name: string; count: number }[]) =>
      list.forEach((c) => tally.set(c.name, (tally.get(c.name) ?? 0) + c.count));
    add(node.topCategories);
    node.children.forEach((c) => add(c.rolledCategories));
    node.rolledCategories = [...tally.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  };
  roots.forEach((root) => roll(root, []));
  roots.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  return [...loose, ...roots];
};

/**
 * ONE exception per row, by severity — a room that has lost something does not need to
 * also be told it is unverified. Ranked: missing, discrepancy, maintenance, unverified.
 */
const exceptionOf = (node: INode): { label: string; tone: string } | null => {
  if (node.totalMissing > 0)
    return { label: `${node.totalMissing} missing`, tone: 'text-red-600 bg-red-50' };
  if (node.totalDiscrepancy > 0)
    return { label: `${node.totalDiscrepancy} discrepancy`, tone: 'text-orange-600 bg-orange-50' };
  if (node.totalMaintenance > 0)
    return { label: `${node.totalMaintenance} maintenance`, tone: 'text-amber-600 bg-amber-50' };
  if (node.totalNeverVerified > 0)
    return { label: `${node.totalNeverVerified} unverified`, tone: 'text-gray-500 bg-gray-100' };
  return null;
};

const flatten = (nodes: INode[], out: INode[] = []): INode[] => {
  nodes.forEach((n) => {
    out.push(n);
    flatten(n.children, out);
  });
  return out;
};

const TreeRow = ({
  node,
  depth,
  expanded,
  toggle,
  selectedId,
  onSelect,
}: {
  node: INode;
  depth: number;
  expanded: Set<string>;
  toggle: (key: string) => void;
  selectedId: string | null;
  onSelect: (node: INode) => void;
}) => {
  const key = node.id ?? '__none__';
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(key);
  const isSelected = selectedId === key;
  const exception = exceptionOf(node);

  return (
    <div>
      <div
        className={`group flex items-center gap-2 rounded-lg py-1.5 pr-2 transition-colors ${
          isSelected ? 'bg-primarycolor/10 ring-1 ring-primarycolor/30' : 'hover:bg-gray-50'
        }`}
        style={{ paddingLeft: depth * 18 + 4 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => toggle(key)}
            aria-label={isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-200"
          >
            <i
              className={`icon icon-right text-[9px] transition-transform ${isOpen ? 'rotate-90' : ''}`}
            />
          </button>
        ) : (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
            <span className="h-1 w-1 rounded-full bg-gray-300" />
          </span>
        )}

        <button
          type="button"
          onClick={() => onSelect(node)}
          className={`min-w-0 flex-1 truncate text-left ${
            depth === 0
              ? 'text-sm font-semibold text-secondaryColor'
              : 'text-[13px] text-gray-600'
          }`}
        >
          {node.name}
        </button>

        {exception && (
          <span
            className={`hidden shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium sm:inline ${exception.tone}`}
          >
            {exception.label}
          </span>
        )}

        <span
          className={`shrink-0 tabular-nums ${
            depth === 0
              ? 'text-sm font-semibold text-secondaryColor'
              : 'text-xs font-medium text-gray-500'
          }`}
        >
          {node.total.toLocaleString()}
        </span>
      </div>

      {hasChildren && isOpen && (
        <div>
          {node.children.map((child) => (
            <TreeRow
              key={child.id ?? child.name}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const Stat = ({ label, value, tone }: { label: string; value: number; tone?: string }) => (
  <div className="rounded-lg bg-gray-50 px-3 py-2">
    <p className={`text-base font-semibold tabular-nums ${tone ?? 'text-secondaryColor'}`}>
      {value.toLocaleString()}
    </p>
    <p className="text-[11px] text-gray-500">{label}</p>
  </div>
);

const AssetsByLocationPanel = ({
  hierarchy,
  loading,
}: {
  hierarchy: IDashboardLocationNode[];
  loading: boolean;
}) => {
  const forest = useMemo(() => buildForest(hierarchy), [hierarchy]);
  const all = useMemo(() => flatten(forest), [forest]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

  // Open the biggest building and select it, so the panel opens showing something
  // rather than an instruction to click.
  if (!seeded && forest.length > 0) {
    const first = forest.find((n) => n.id) ?? forest[0];
    setExpanded(new Set([first.id ?? '__none__']));
    setSelectedId(first.id ?? '__none__');
    setSeeded(true);
  }

  const selected = all.find((n) => (n.id ?? '__none__') === selectedId) ?? null;

  const totals = useMemo(
    () => ({
      assets: forest.reduce((s, n) => s + n.total, 0),
      buildings: forest.filter((n) => n.id && n.depth === 1).length,
      locations: all.filter((n) => n.id).length,
    }),
    [forest, all]
  );

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (loading)
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );

  if (forest.length === 0)
    return (
      <p className="py-8 text-center text-sm text-gray-400">
        No locations yet — add a building under Settings to map the register.
      </p>
    );

  const summaryPanel = selected && (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <p className="text-sm font-semibold text-secondaryColor">{selected.name}</p>
      {selected.path.length > 1 && (
        <p className="mt-0.5 truncate text-[11px] text-gray-400" title={selected.path.join(' > ')}>
          {selected.path.join(' › ')}
        </p>
      )}

      <p className="mt-3 text-2xl font-semibold tabular-nums text-secondaryColor">
        {selected.total.toLocaleString()}
        <span className="ml-1 text-xs font-normal text-gray-500">assets</span>
      </p>
      {selected.children.length > 0 && (
        <p className="text-[11px] text-gray-500">
          {selected.assetCount.toLocaleString()} directly here ·{' '}
          {(selected.total - selected.assetCount).toLocaleString()} in sub-locations
        </p>
      )}

      {selected.rolledCategories.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
            Top categories
          </p>
          <div className="space-y-1">
            {selected.rolledCategories.slice(0, 3).map((category) => (
              <div key={category.name} className="flex items-center justify-between text-xs">
                <span className="truncate text-gray-600">{category.name}</span>
                <span className="tabular-nums font-medium text-secondaryColor">
                  {category.count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat
          label="Missing"
          value={selected.totalMissing}
          tone={selected.totalMissing > 0 ? 'text-red-600' : undefined}
        />
        <Stat
          label="Maintenance"
          value={selected.totalMaintenance}
          tone={selected.totalMaintenance > 0 ? 'text-amber-600' : undefined}
        />
        <Stat label="Verified" value={selected.totalVerified} />
        <Stat label="Never verified" value={selected.totalNeverVerified} />
      </div>

      {selected.id && (
        <Link
          href={appUrl(`/reports?code=assets-by-location&locationId=${selected.id}`)}
          className="mt-3 flex items-center justify-center gap-1 rounded-full bg-primarycolor px-4 py-2 text-xs font-medium text-white hover:brightness-95"
        >
          Open Location
          <i className="icon icon-right text-[9px]" />
        </Link>
      )}
    </div>
  );

  return (
    <div>
      <p className="mb-3 text-xs text-gray-500">
        <span className="font-semibold text-secondaryColor">
          {totals.assets.toLocaleString()}
        </span>{' '}
        assets ·{' '}
        <span className="font-semibold text-secondaryColor">{totals.buildings}</span>{' '}
        building{totals.buildings === 1 ? '' : 's'} ·{' '}
        <span className="font-semibold text-secondaryColor">{totals.locations}</span>{' '}
        location{totals.locations === 1 ? '' : 's'}
      </p>

      {/* Mobile: a selector, never the whole tree — a 192-row hierarchy on a phone is
          scrolling, not navigation. */}
      <div className="mb-3 lg:hidden">
        <select
          value={selectedId ?? ''}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-secondaryColor"
          aria-label="Select location"
        >
          {all.map((node) => (
            <option key={node.id ?? '__none__'} value={node.id ?? '__none__'}>
              {' '.repeat(Math.max(0, node.depth - 1) * 3)}
              {node.depth > 1 ? '└ ' : ''}
              {node.name} · {node.total.toLocaleString()}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        {/* Tablet keeps the tree and stacks the summary beneath it; only mobile drops it. */}
        <div className="hidden max-h-[320px] overflow-y-auto pr-1 lg:block">
          {forest.map((node) => (
            <TreeRow
              key={node.id ?? node.name}
              node={node}
              depth={0}
              expanded={expanded}
              toggle={toggle}
              selectedId={selectedId}
              onSelect={(n) => setSelectedId(n.id ?? '__none__')}
            />
          ))}
        </div>
        <div className="hidden md:block lg:hidden">
          <div className="max-h-[260px] overflow-y-auto pr-1">
            {forest.map((node) => (
              <TreeRow
                key={node.id ?? node.name}
                node={node}
                depth={0}
                expanded={expanded}
                toggle={toggle}
                selectedId={selectedId}
                onSelect={(n) => setSelectedId(n.id ?? '__none__')}
              />
            ))}
          </div>
        </div>
        {summaryPanel}
      </div>
    </div>
  );
};

export default AssetsByLocationPanel;
