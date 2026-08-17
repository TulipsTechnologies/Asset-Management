'use client';

import Link from 'next/link';
import { ReactNode, useMemo, useState } from 'react';
import LocationTree from '@/components/Locations/LocationTree';
import { IAssetLocationTree } from '@/interface/IAssetLocation';
import { IDashboardLocationNode } from '@/interface/IDashboard';

/**
 * Where everything physically is, as a place you can walk rather than a list you must
 * read: buildings that open into floors that open into rooms, each carrying the total
 * it actually contains — and a value bar that makes 2,592 versus 27 visible before
 * either number is read.
 *
 * This is SUMMARY AND NAVIGATION only — no asset rows are loaded here. Every number on
 * screen comes from the single dashboard payload, so expanding a building or selecting
 * a room costs nothing; the detailed investigation lives in the Location Explorer, one
 * click away with the selection carried across.
 *
 * The tree itself is the shared LocationTree — the same grammar as /locations and the
 * explorer's pane — so this band stopped being the third divergent tree in the app.
 */

/** The "(No location)" bucket needs a real id to be selectable in the shared tree. */
const UNLOCATED_ID = '__unlocated__';

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

/** The INode forest re-expressed in the shared tree's shape. Each node carries its
 *  OWN count — LocationTree rolls subtotals itself and lands on the same totals. */
const toTreeShape = (nodes: INode[]): IAssetLocationTree[] =>
  nodes.map((node) => ({
    id: node.id ?? UNLOCATED_ID,
    name: node.name,
    code: null,
    address: null,
    isActive: true,
    assetCount: node.assetCount,
    children: toTreeShape(node.children),
  }));

/** A stat tile that DOES something: it opens the explorer filtered to exactly the
 *  assets it counts. Zero stays a quiet tile — a link to an empty list helps nobody. */
const Stat = ({
  label,
  value,
  tone,
  href,
}: {
  label: string;
  value: number;
  tone?: string;
  href?: string;
}) => {
  const body = (
    <>
      <p className={`text-base font-semibold tabular-nums ${tone ?? 'text-secondaryColor'}`}>
        {value.toLocaleString()}
      </p>
      <p className="text-[11px] text-gray-500">{label}</p>
    </>
  );
  if (href && value > 0)
    return (
      <Link
        href={href}
        className="rounded-lg bg-gray-50 px-3 py-2 transition-colors hover:bg-gray-100"
        title={`Open these ${value.toLocaleString()} in the explorer`}
      >
        {body}
      </Link>
    );
  return <div className="rounded-lg bg-gray-50 px-3 py-2">{body}</div>;
};

const AssetsByLocationPanel = ({
  hierarchy,
  loading,
}: {
  hierarchy: IDashboardLocationNode[];
  loading: boolean;
}) => {
  const forest = useMemo(() => buildForest(hierarchy), [hierarchy]);
  const all = useMemo(() => flatten(forest), [forest]);
  const tree = useMemo(() => toTreeShape(forest), [forest]);

  /** Severity pill per node id, rendered on the value bar's tail. */
  const pills = useMemo(() => {
    const map = new Map<string, ReactNode>();
    all.forEach((node) => {
      const exception = exceptionOf(node);
      if (!exception) return;
      map.set(
        node.id ?? UNLOCATED_ID,
        <span
          className={`hidden rounded-full px-1.5 py-px text-[9px] font-medium ring-1 ring-white sm:inline ${exception.tone}`}
        >
          {exception.label}
        </span>
      );
    });
    return map;
  }, [all]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

  // Select the biggest building up front, so the panel opens showing something
  // rather than an instruction to click. Its expansion is seeded via the tree's
  // initialOpenIds below.
  if (!seeded && forest.length > 0) {
    const first = forest.find((n) => n.id) ?? forest[0];
    setSelectedId(first.id ?? UNLOCATED_ID);
    setSeeded(true);
  }

  const firstOpenIds = useMemo(() => {
    const first = forest.find((n) => n.id);
    return first?.id ? [first.id] : [];
  }, [forest]);

  const selected =
    all.find((n) => (n.id ?? UNLOCATED_ID) === selectedId) ?? null;

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

  const explorerHref = selected?.id
    ? `/reports?code=assets-by-location&locationId=${selected.id}`
    : '/reports?code=assets-by-location&unlocated=true';
  const statHref = (params: string) =>
    `${explorerHref}&${params}`;

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
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Top categories
          </p>
          <div className="space-y-1.5">
            {selected.rolledCategories.slice(0, 3).map((category) => (
              <div key={category.name} title={`${category.count.toLocaleString()} of ${selected.total.toLocaleString()} assets`}>
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate text-gray-600">{category.name}</span>
                  <span className="tabular-nums font-medium text-secondaryColor">
                    {category.count.toLocaleString()}
                  </span>
                </div>
                <div className="mt-0.5 h-[3px] overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-r-full bg-primarycolor/60"
                    style={{
                      width: `${Math.max((category.count / Math.max(1, selected.total)) * 100, 1)}%`,
                    }}
                  />
                </div>
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
          href={statHref('availability=Missing')}
        />
        <Stat
          label="Maintenance"
          value={selected.totalMaintenance}
          tone={selected.totalMaintenance > 0 ? 'text-amber-600' : undefined}
          href={statHref(`availability=${encodeURIComponent('Under Maintenance')}`)}
        />
        <Stat
          label="Verified"
          value={selected.totalVerified}
          href={statHref('verification=Verified')}
        />
        {/* Deliberately NOT a link: this tile counts ACTIVE assets never verified
            (the KPI rule), while the explorer's NotVerified filter is register
            state across every lifecycle — in a draft-heavy register the landing
            list would dwarf the number on the tile. */}
        <Stat label="Never verified" value={selected.totalNeverVerified} />
      </div>

      <Link
        href={explorerHref}
        className="mt-3 flex items-center justify-center gap-1 rounded-full bg-primarycolor px-4 py-2 text-xs font-medium text-white hover:brightness-95"
      >
        {selected.id ? 'Open Location' : 'Open in Explorer'}
        <i className="icon icon-right text-[9px]" />
      </Link>
    </div>
  );

  return (
    <div>
      {/* Mobile: a selector, never the whole tree — a 192-row hierarchy on a phone is
          scrolling, not navigation. NBSP indentation: plain spaces collapse in <option>. */}
      <div className="mb-3 md:hidden">
        <select
          value={selectedId ?? ''}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-secondaryColor"
          aria-label="Select location"
        >
          {all.map((node) => (
            <option key={node.id ?? UNLOCATED_ID} value={node.id ?? UNLOCATED_ID}>
              {' '.repeat(Math.max(0, node.depth - 1) * 3)}
              {node.depth > 1 ? '└ ' : ''}
              {node.name} · {node.total.toLocaleString()}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        {/* Tablet keeps the tree and stacks the summary beneath it; only mobile drops it. */}
        <div className="hidden max-h-[340px] overflow-y-auto pr-1 md:block">
          <LocationTree
            tree={tree}
            loading={false}
            search=""
            onSelect={(node) => setSelectedId(node.id)}
            selectedId={selectedId}
            initialOpenIds={firstOpenIds}
            density="compact-rows"
            trailing={(id) => pills.get(id) ?? null}
          />
        </div>
        {summaryPanel}
      </div>
    </div>
  );
};

export default AssetsByLocationPanel;
