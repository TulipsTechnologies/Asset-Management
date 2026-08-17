'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/Providers/ToastProvider';
import Button from '@/components/UI/Button';
import CustomTable from '@/components/CustomTable/CustomTable';
import { TTableColumn } from '@/components/CustomTable/CustomTableInterface';
import Drawer from '@/components/UI/Drawer';
import Pagination from '@/components/UI/Pagination';
import SearchBox from '@/components/SearchBox';
import ViewSwitcher, { IViewOption, readStoredView } from '@/components/UI/ViewSwitcher';
import LocationTree from '@/components/Locations/LocationTree';
import { IAssetLocationTree } from '@/interface/IAssetLocation';
import {
  ILocationPathSegment,
  ILocationSummary,
  IReportFilter,
} from '@/interface/IReports';
import { fetchAssetLocationTree } from '@/services/assetLocation.service';
import {
  downloadReportXlsx,
  fetchLocationSummary,
  runReport,
} from '@/services/reports.service';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { Permission } from '@/enum/permissions';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';
import useDebounce from '@/hooks/useDebounce';
import { money } from '@/components/Assets/AssetViewShared';
import LocationSummaryHeader from './LocationSummaryHeader';
import GroupedLocationView from './GroupedLocationView';
import LocationAssetCards, {
  AVAILABILITY_TONE,
  ILocationAssetCard,
} from './LocationAssetCards';

/**
 * The Location Explorer: location first, assets second.
 *
 * Left, the hierarchy as it really is — buildings that open into floors that open into
 * rooms. Right, whatever the selected place contains: a distribution when the place has
 * sub-locations (a building's answer is "43 on the ground floor, 56 upstairs", not 99
 * rows), and the assets themselves when it does not.
 *
 * Two fetches per selection and no more: the summary (header numbers, chips, grouped
 * rollups) is keyed on location + include-children ONLY, so searching or clicking a
 * chip re-fetches rows alone. Both are guarded by a generation token — clicking three
 * rooms quickly must show the third room's assets, never the first room's answer
 * arriving last.
 */

const REPORT_CODE = 'assets-by-location';
const VIEW_VALUES = ['cards', 'table'] as const;
type TAssetView = (typeof VIEW_VALUES)[number];
const VIEW_STORAGE_KEY = 'reports.assetsByLocation.view';
const RECENT_LIMIT = 5;

const VIEW_OPTIONS: IViewOption<TAssetView>[] = [
  { value: 'cards', label: 'Cards', iconName: 'card', title: 'Recognise assets while standing in the room' },
  { value: 'table', label: 'Table', iconName: 'menu', title: 'Compare and export column by column' },
];

/** The unlocated bucket is a real scope, not an absence — it needs a stable key. */
const UNLOCATED = '__unlocated__';

interface IExplorerSelection {
  id: string | null;
  unlocated: boolean;
}

const LocationExplorer = ({
  initialLocationId,
  companyKey,
  embedded = false,
}: {
  initialLocationId?: string | null;
  /** Namespaces the recent-locations list so tenants never see each other's history. */
  companyKey: string;
  /**
   * Mounted somewhere that is NOT the reports page — the dashboard's expand modal. The
   * URL belongs to the page underneath, so the explorer neither reads its selection from
   * the query string (the dashboard's params mean other things) nor writes it back
   * (router.replace('/reports?…') from the dashboard would NAVIGATE, closing the modal
   * out from under the user). Selection lives in state alone; everything else — fetches,
   * views, Recent — behaves identically.
   */
  embedded?: boolean;
}) => {
  const { addToast } = useToast();
  const router = useRouter();
  const { can } = useUserPermissions();

  const [tree, setTree] = useState<IAssetLocationTree[]>([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [locationSearch, setLocationSearch] = useState('');

  // The URL is the single source of truth for the selection — this component WRITES to
  // it on every pick, so it reads from it too. Taking the parent's prop instead would
  // capture whatever it held at mount: the reports page resolves ?locationId in an
  // effect, so a deep link arrived one render too late and was silently ignored.
  // (Embedded, both halves of that contract are off — see the prop.)
  const [selection, setSelection] = useState<IExplorerSelection>(() => {
    if (typeof window === 'undefined' || embedded)
      return { id: initialLocationId ?? null, unlocated: false };
    const params = new URLSearchParams(window.location.search);
    return {
      id: params.get('locationId') ?? initialLocationId ?? null,
      unlocated: params.get('unlocated') === 'true',
    };
  });
  const [includeChildren, setIncludeChildren] = useState(true);

  const [summary, setSummary] = useState<ILocationSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [view, setView] = useState<TAssetView>('cards');
  /** Set when the user asks for assets on a parent — otherwise parents show the map.
   *  A deep link carrying a filter is such an ask: the caller wants the rows. */
  const [forceAssets, setForceAssets] = useState(() => {
    if (typeof window === 'undefined' || embedded) return false;
    const params = new URLSearchParams(window.location.search);
    return !!(params.get('availability') || params.get('verification'));
  });

  const [assetSearch, setAssetSearch] = useState('');
  const debouncedAssetSearch = useDebounce(assetSearch, 400);
  const [availability, setAvailability] = useState<string | undefined>(() => {
    if (typeof window === 'undefined' || embedded) return undefined;
    return new URLSearchParams(window.location.search).get('availability') ?? undefined;
  });
  const [verification, setVerification] = useState<string | undefined>(() => {
    if (typeof window === 'undefined' || embedded) return undefined;
    return new URLSearchParams(window.location.search).get('verification') ?? undefined;
  });
  const [categoryId, setCategoryId] = useState<string | undefined>();

  const [rows, setRows] = useState<ILocationAssetCard[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [rowCount, setRowCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  /** Set when a deep link or Recent entry points at a location that no longer exists. */
  const [staleSelection, setStaleSelection] = useState<string | null>(null);
  const [treeDrawerOpen, setTreeDrawerOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  // One token PER FETCH KIND, not one shared counter: the two fetches start together,
  // so a single counter would have the rows fetch invalidate the summary's own token
  // and discard its answer forever. Each guards only against ITS own stale responses.
  const summaryGeneration = useRef(0);
  const rowsGeneration = useRef(0);

  const recentKey = `reports.assetsByLocation.recent.${companyKey}`;

  useEffect(() => {
    const stored = readStoredView(VIEW_STORAGE_KEY, VIEW_VALUES);
    if (stored) setView(stored);
    try {
      const raw = window.localStorage.getItem(recentKey);
      if (raw) setRecent(JSON.parse(raw));
    } catch {
      /* a corrupt entry is not worth a message */
    }
  }, [recentKey]);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetchAssetLocationTree();
        setTree(response?.data ?? []);
      } catch {
        addToast.error('Could not load the location hierarchy.');
      } finally {
        setTreeLoading(false);
      }
    })();
  }, [addToast]);

  /** Flat index so Recent can resolve names and prune ids that no longer exist. */
  const nodeIndex = useMemo(() => {
    const map = new Map<string, IAssetLocationTree>();
    const walk = (nodes: IAssetLocationTree[]) =>
      nodes.forEach((node) => {
        map.set(node.id, node);
        walk(node.children);
      });
    walk(tree);
    return map;
  }, [tree]);

  const filterKey = [
    selection.id ?? (selection.unlocated ? UNLOCATED : 'root'),
    includeChildren,
  ].join('|');

  // Summary: location + include-children only. Search and chips never invalidate it,
  // which is what keeps the chip counts meaning "in this place" rather than "in this
  // place, given what you have typed". The "(No location)" bucket is a real scope
  // with a real summary — it goes through the same fetch, flagged unlocated.
  useEffect(() => {
    const token = ++summaryGeneration.current;
    setSummaryLoading(true);
    (async () => {
      try {
        const response = await fetchLocationSummary(
          selection.unlocated ? null : selection.id,
          includeChildren,
          !selection.unlocated,
          selection.unlocated
        );
        if (token !== summaryGeneration.current) return;
        if (response?.data) {
          setSummary(response.data);
          // Deliberately NOT clearing staleSelection here: the fallback's own root
          // fetch lands moments after the notice is set, and clearing on success
          // would wipe the explanation before anyone could read it. select() clears
          // it on the next deliberate pick.
        } else if (selection.id) {
          // A pasted link or a Recent entry can outlive the location it names (a
          // re-import replaces ids wholesale). Fall back to the whole register with an
          // inline explanation rather than leaving an empty screen behind a toast —
          // and take the dead id out of the URL, or copying the address bar would
          // share the very link that just failed.
          setStaleSelection(response?.message || 'That location no longer exists.');
          setSelection({ id: null, unlocated: false });
          if (!embedded)
            router.replace(`/reports?code=${REPORT_CODE}`, { scroll: false });
        } else {
          setSummary(null);
          addToast.error(response?.message || 'The location summary could not be loaded.');
        }
      } catch {
        if (token === summaryGeneration.current) addToast.error('Could not load the location summary.');
      } finally {
        if (token === summaryGeneration.current) setSummaryLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  // Optimistic while the summary is in flight: the tree already knows whether the
  // node has children, and guessing "no children" would flash the assets toolbar
  // AND fire a rows fetch a building-sized scope never needed. Before the tree
  // arrives, assume children — a leaf briefly shows the Breakdown skeleton, which
  // costs nothing; the wrong guess in the other direction costs a 2,500-row fetch.
  const treeHasChildren = treeLoading
    ? true
    : selection.id
      ? (nodeIndex.get(selection.id)?.children.length ?? 0) > 0
      : tree.length > 0;
  const hasChildren =
    summaryLoading || !summary ? treeHasChildren && !selection.unlocated : !!summary.hasChildren;
  const showingAssets = selection.unlocated || !hasChildren || forceAssets;

  const rowFilter = useMemo<IReportFilter>(
    () => ({
      pageNumber,
      pageSize,
      locationId: selection.unlocated ? undefined : selection.id ?? undefined,
      unlocated: selection.unlocated || undefined,
      includeChildren,
      search: debouncedAssetSearch.trim() || undefined,
      availability,
      verificationStatus: verification,
      categoryId,
      // The header already has the chips and totals; asking for them again on every
      // page turn would cost two extra scans of the scope for numbers nobody reads.
      includeAggregates: false,
    }),
    [
      pageNumber,
      pageSize,
      selection,
      includeChildren,
      debouncedAssetSearch,
      availability,
      verification,
      categoryId,
    ]
  );

  useEffect(() => {
    if (!showingAssets) return;
    const token = ++rowsGeneration.current;
    setRowsLoading(true);
    (async () => {
      try {
        const response = await runReport(REPORT_CODE, rowFilter);
        if (token !== rowsGeneration.current) return;
        const envelope = response?.data ?? {};
        setRows(envelope.data ?? envelope.results ?? []);
        setRowCount(envelope.rowCount ?? 0);
        setPageCount(envelope.pageCount ?? 0);
      } catch {
        if (token === rowsGeneration.current) addToast.error('Could not load the assets.');
      } finally {
        if (token === rowsGeneration.current) setRowsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowFilter, showingAssets]);

  const rememberRecent = useCallback(
    (id: string) => {
      setRecent((prev) => {
        const next = [id, ...prev.filter((x) => x !== id)].slice(0, RECENT_LIMIT);
        try {
          window.localStorage.setItem(recentKey, JSON.stringify(next));
        } catch {
          /* storage is a convenience, never a requirement */
        }
        return next;
      });
    },
    [recentKey]
  );

  /** The URL is the citation: what you are looking at can be pasted to a colleague.
   *  Every writer goes through here so the address bar never lags the screen.
   *  NOT appUrl(): next/navigation applies basePath itself, and prefixing twice
   *  produces /asset-management/asset-management/reports — a 404. */
  const syncUrl = useCallback(
    (state: {
      id: string | null;
      unlocated: boolean;
      availability?: string;
      verification?: string;
    }) => {
      // Embedded, there is no citation to keep: the URL is the dashboard's, and writing
      // /reports into it would navigate away mid-click.
      if (embedded) return;
      const query = new URLSearchParams({ code: REPORT_CODE });
      if (state.id) query.set('locationId', state.id);
      if (state.unlocated) query.set('unlocated', 'true');
      if (state.availability) query.set('availability', state.availability);
      if (state.verification) query.set('verification', state.verification);
      router.replace(`/reports?${query.toString()}`, { scroll: false });
    },
    [router, embedded]
  );

  /** One entry point for every way a location gets chosen — tree, breadcrumb, grouped
   *  row, Recent — so filters, paging and the URL can never drift out of step. */
  const select = useCallback(
    (id: string | null, options?: { unlocated?: boolean; showAssets?: boolean }) => {
      setSelection({ id, unlocated: !!options?.unlocated });
      setStaleSelection(null);
      setForceAssets(!!options?.showAssets);
      setPageNumber(1);
      setAvailability(undefined);
      setVerification(undefined);
      setCategoryId(undefined);
      setAssetSearch('');
      setTreeDrawerOpen(false);
      if (id) rememberRecent(id);
      syncUrl({ id, unlocated: !!options?.unlocated });
    },
    [rememberRecent, syncUrl]
  );

  const exportXlsx = async () => {
    setExporting(true);
    try {
      const response = await downloadReportXlsx(REPORT_CODE, {
        ...rowFilter,
        pageNumber: undefined,
        pageSize: undefined,
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      const match = /filename="?([^";]+)"?/.exec(
        response.headers.get('content-disposition') ?? ''
      );
      anchor.download = match?.[1] ?? 'AssetsByLocation.xlsx';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      addToast.error('Could not export the report.');
    } finally {
      setExporting(false);
    }
  };

  const activeFilters =
    (debouncedAssetSearch.trim() ? 1 : 0) +
    (availability ? 1 : 0) +
    (verification ? 1 : 0) +
    (categoryId ? 1 : 0);

  const scopeName = selection.unlocated
    ? '(No location)'
    : summary?.name ?? 'all locations';

  // The Location column earns its place only when rows can come from more than one
  // place — never 25 identical cells repeating what the header already says.
  const showLocationColumn = !selection.unlocated && (includeChildren ? hasChildren : false);

  // The §13 column set. Every column is always PRESENT — only `visible` changes — so the
  // column identity never shifts under CustomTable (which seeds its column state once and
  // does not resync from props). Optional columns ship hidden and are turned on through
  // the Columns drawer, which persists per user against the tableName below.
  const columns: TTableColumn[] = useMemo(
    () => [
      { key: 'assetCode', label: 'Asset Code', width: 130, name: 'assetCode', type: 'custom' },
      { key: 'assetName', label: 'Asset Name', width: 230, name: 'assetName', type: 'custom' },
      { key: 'categoryName', label: 'Category', width: 140, name: 'categoryName', type: 'custom' },
      { key: 'condition', label: 'Condition', width: 110, name: 'condition', type: 'custom' },
      { key: 'availability', label: 'Availability', width: 150, name: 'availability', type: 'custom' },
      { key: 'custodianName', label: 'Custodian', width: 160, name: 'custodianName', type: 'custom' },
      { key: 'verification', label: 'Verification', width: 130, name: 'verification', type: 'custom' },
      {
        key: 'locationPath',
        label: 'Location',
        width: 200,
        name: 'locationPath',
        type: 'custom',
        // Earns its place only when rows can come from more than one place; otherwise it
        // would repeat what the header already says, 25 times.
        visible: showLocationColumn,
      },
      { key: 'assetTag', label: 'Asset Tag', width: 130, name: 'assetTag', type: 'custom', visible: false },
      { key: 'serialNumber', label: 'Serial Number', width: 150, name: 'serialNumber', type: 'custom', visible: false },
      {
        key: 'purchaseCost',
        label: 'Purchase Cost',
        width: 140,
        name: 'purchaseCost',
        type: 'custom',
        contentAlign: 'right',
      },
    ],
    [showLocationColumn]
  );

  const tableRows = useMemo(
    () =>
      rows.map((row) => ({
        id: row.id,
        assetCode: {
          value: row.assetCode,
          type: 'string' as const,
          content: (
            <Link
              // Bare path: next/link applies basePath itself; appUrl() here 404'd.
              href={`/assets/${row.id}`}
              className="font-mono text-xs text-primarycolor hover:underline"
            >
              {row.assetCode}
            </Link>
          ),
        },
        assetName: { value: row.assetName, type: 'string' as const, content: row.assetName },
        categoryName: { value: row.categoryName, type: 'string' as const, content: row.categoryName },
        condition: { value: row.condition ?? '', type: 'string' as const, content: row.condition || '—' },
        availability: {
          value: row.availability,
          type: 'string' as const,
          content: (
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                AVAILABILITY_TONE[row.availability] ?? 'bg-gray-100 text-gray-600'
              }`}
            >
              {row.availability}
            </span>
          ),
        },
        custodianName: {
          value: row.custodianName ?? '',
          type: 'string' as const,
          content: row.custodianName || '—',
        },
        verification: {
          value: row.verification,
          type: 'string' as const,
          content: (
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                row.verification === 'Verified'
                  ? 'bg-green-50 text-green-700'
                  : row.verification === 'Discrepancy'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-gray-100 text-gray-600'
              }`}
            >
              {row.verification}
            </span>
          ),
        },
        locationPath: {
          value: row.locationPath,
          type: 'string' as const,
          // Relative to the selection: inside Main Building, "Ground Floor > Reception"
          // says everything the full chain does, in half the width.
          content:
            summary?.name && row.locationPath.startsWith(`${summary.name} > `)
              ? row.locationPath.slice(summary.name.length + 3)
              : row.locationPath,
        },
        assetTag: { value: row.assetTag ?? '', type: 'string' as const, content: row.assetTag || '—' },
        serialNumber: {
          value: row.serialNumber ?? '',
          type: 'string' as const,
          content: row.serialNumber || '—',
        },
        purchaseCost: {
          // The RAW number sorts; the formatted string only prints. Sorting the label
          // would compare "1,234.50" with "999.00" as words and put the larger first.
          value: row.purchaseCost ?? 0,
          type: 'number' as const,
          content: money(row.purchaseCost, row.purchaseCurrency),
        },
      })),
    [rows, summary?.name]
  );

  const treePane = (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-100 p-3">
        <SearchBox
          onSearch={setLocationSearch}
          searchVal={locationSearch}
          placeholder="Search locations…"
          ariaLabel="Search locations"
        />
      </div>

      {recent.length > 0 && (
        <div className="border-b border-gray-100 px-3 py-2">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
            Recent
          </p>
          <div className="flex flex-wrap gap-1">
            {/* Resolved against the live tree every render: renames self-heal and
                deleted locations simply stop appearing. */}
            {recent
              .map((id) => nodeIndex.get(id))
              .filter((node): node is IAssetLocationTree => !!node)
              .map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => select(node.id)}
                  className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600 hover:bg-gray-200"
                >
                  {node.name}
                </button>
              ))}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <button
          type="button"
          onClick={() => select(null)}
          className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
            !selection.id && !selection.unlocated
              ? 'bg-primarycolor/15 font-medium text-secondaryColor ring-1 ring-primarycolor/40'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <i className="icon icon-modules text-[12px] text-gray-400" />
          All locations
        </button>

        {/* The unlocated bucket is a first-class scope — assets with no room are the
            ones most worth finding. No count here: fetching one would break the
            two-fetch-per-selection discipline for a number the summary shows anyway. */}
        <button
          type="button"
          onClick={() => select(null, { unlocated: true })}
          className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
            selection.unlocated
              ? 'bg-primarycolor/15 font-medium text-secondaryColor ring-1 ring-primarycolor/40'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <i className="icon icon-marker text-[12px] text-gray-400" />
          (No location)
        </button>

        <LocationTree
          tree={tree}
          loading={treeLoading}
          search={locationSearch}
          onSelect={(node) => select(node.id)}
          selectedId={selection.id}
          defaultCollapsedToBuildings
        />
      </div>
    </div>
  );

  const emptyState = () => {
    if (rowsLoading) return null;
    if (rows.length > 0) return null;

    if (activeFilters > 0)
      return (
        <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
          <p className="text-sm text-gray-500">
            No matching assets in {scopeName}.
          </p>
          <button
            type="button"
            onClick={() => {
              setAssetSearch('');
              setAvailability(undefined);
              setVerification(undefined);
              setCategoryId(undefined);
              setPageNumber(1);
              syncUrl({ ...selection });
            }}
            className="mt-2 text-xs font-medium text-primarycolor hover:underline"
          >
            Clear filters
          </button>
        </div>
      );

    // Include-children off on a parent that only holds things in its rooms: say so,
    // and offer the toggle that answers it, rather than "no assets".
    if (!includeChildren && summary && summary.subtreeCount > 0)
      return (
        <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
          <p className="text-sm text-gray-600">
            No assets are assigned directly to {summary.name} —{' '}
            {summary.subtreeCount.toLocaleString()} are in its child locations.
          </p>
          <button
            type="button"
            onClick={() => setIncludeChildren(true)}
            className="mt-2 text-xs font-medium text-primarycolor hover:underline"
          >
            Include child locations
          </button>
        </div>
      );

    // An empty unlocated bucket is the GOOD outcome — say so, and offer nothing:
    // "add an asset here" would mean creating one without a location on purpose.
    if (selection.unlocated)
      return (
        <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
          <p className="text-sm text-gray-500">
            Every asset has a location — nothing is unfiled.
          </p>
        </div>
      );

    return (
      <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
        <p className="text-sm text-gray-500">
          No assets are currently registered at {scopeName}.
        </p>
        <div className="mt-3 flex justify-center gap-3">
          {can(Permission.ManageAssets) && (
            <Link
              href="/assets/create"
              className="rounded-full bg-primarycolor px-4 py-1.5 text-xs font-medium text-white hover:brightness-95"
            >
              Add asset
            </Link>
          )}
          {can(Permission.TransferAssets) && (
            <Link
              href="/transfers"
              className="rounded-full border border-gray-300 px-4 py-1.5 text-xs font-medium text-secondaryColor hover:bg-gray-50"
            >
              Move assets here
            </Link>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="hidden max-h-[calc(100vh-230px)] rounded-xl border border-gray-200 bg-white lg:flex lg:flex-col">
          {treePane}
        </aside>

        <section className="min-w-0 space-y-4">
          {staleSelection && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              <i className="icon icon-alert text-xs" />
              <span>{staleSelection} Showing all locations instead.</span>
              <button
                type="button"
                onClick={() => setStaleSelection(null)}
                className="ml-auto text-xs font-medium underline"
              >
                Dismiss
              </button>
            </div>
          )}

          <LocationSummaryHeader
            summary={summary}
            loading={summaryLoading}
            includeChildren={includeChildren}
            onToggleIncludeChildren={(value) => {
              setIncludeChildren(value);
              setPageNumber(1);
            }}
            availabilityFilter={availability}
            verificationFilter={verification}
            categoryFilter={categoryId}
            onNavigate={(segment: ILocationPathSegment) => select(segment.id)}
            onRoot={() => select(null)}
            onToggleAvailability={(label) => {
              const next = availability === label ? undefined : label;
              setAvailability(next);
              setForceAssets(true);
              setPageNumber(1);
              syncUrl({ ...selection, availability: next, verification });
            }}
            onToggleVerification={(status) => {
              const next = verification === status ? undefined : status;
              setVerification(next);
              setForceAssets(true);
              setPageNumber(1);
              syncUrl({ ...selection, availability, verification: next });
            }}
            onToggleCategory={(id) => {
              setCategoryId((prev) => (prev === id ? undefined : id));
              setForceAssets(true);
              setPageNumber(1);
            }}
            canStartVerification={can(Permission.AuditAssets) && !selection.unlocated}
            onStartVerification={() =>
              router.push(
                `/physical-verification?createForLocation=${selection.id}`
              )
            }
          />

          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-3">
              {/* Mobile: the tree lives in a drawer; this is its handle. */}
              <button
                type="button"
                onClick={() => setTreeDrawerOpen(true)}
                className="flex items-center gap-2 rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-secondaryColor lg:hidden"
              >
                <i className="icon icon-marker text-[11px]" />
                {selection.unlocated ? '(No location)' : summary?.name ?? 'All locations'}
              </button>

              {hasChildren && !selection.unlocated && (
                <div className="flex overflow-hidden rounded-full border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setForceAssets(false)}
                    className={`px-3 py-1 text-xs font-medium ${
                      !showingAssets ? 'bg-primarycolor text-white' : 'bg-white text-gray-600'
                    }`}
                  >
                    Breakdown
                  </button>
                  <button
                    type="button"
                    onClick={() => setForceAssets(true)}
                    className={`px-3 py-1 text-xs font-medium ${
                      showingAssets ? 'bg-primarycolor text-white' : 'bg-white text-gray-600'
                    }`}
                  >
                    Assets
                  </button>
                </div>
              )}

              {showingAssets && (
                <>
                  <ViewSwitcher
                    options={VIEW_OPTIONS}
                    value={view}
                    onChange={setView}
                    storageKey={VIEW_STORAGE_KEY}
                  />
                  <SearchBox
                    onSearch={(value) => {
                      setAssetSearch(value);
                      setPageNumber(1);
                    }}
                    searchVal={assetSearch}
                    placeholder={`Search assets in ${scopeName}…`}
                    ariaLabel="Search assets"
                  />
                  {activeFilters > 0 && (
                    <span className="text-xs text-gray-500">
                      Showing {rowCount.toLocaleString()} filtered
                    </span>
                  )}
                </>
              )}

              {/* Export lives beside what it exports; its count is the workbook's
                  row count, whichever view is on screen. */}
              <div className="ml-auto">
                <Button variant="secondary" onClick={exportXlsx} disabled={exporting}>
                  <i className="icon icon-download text-xs" />
                  <span>
                    {exporting
                      ? 'Exporting…'
                      : activeFilters > 0
                        ? `Export ${rowCount.toLocaleString()} filtered`
                        : `Export ${(showingAssets
                            ? rowCount
                            : (includeChildren
                                ? summary?.subtreeCount
                                : summary?.directCount) ?? 0
                          ).toLocaleString()} assets`}
                  </span>
                </Button>
              </div>
            </div>

            <div className="p-3">
              {!showingAssets ? (
                <GroupedLocationView
                  // Remounted per scope: the "floors open by default" seeding runs
                  // once per component life, so drilling from building to building
                  // must start a fresh life or the second building opens folded.
                  key={selection.id ?? 'root'}
                  descendants={summary?.descendants ?? []}
                  directCount={summary?.directCount ?? 0}
                  selectedName={summary?.name ?? 'All locations'}
                  loading={summaryLoading}
                  onOpen={(id) => select(id, { unlocated: id === null })}
                  onViewAssets={(id) =>
                    id === null && !summary?.id
                      ? select(null, { unlocated: true, showAssets: true })
                      : id === null
                        ? (setIncludeChildren(false), setForceAssets(true))
                        : select(id, { showAssets: true })
                  }
                />
              ) : rows.length === 0 ? (
                emptyState()
              ) : view === 'cards' ? (
                <LocationAssetCards
                  assets={rows}
                  loading={rowsLoading}
                  showLocation={showLocationColumn}
                />
              ) : (
                <CustomTable
                  key={`explorer-${showLocationColumn}`}
                  columns={columns}
                  rows={tableRows}
                  tableName="report-assets-by-location-explorer"
                  layoutVersion={1}
                  isLoading={rowsLoading}
                  selectable={false}
                  showBack={false}
                  serialOffset={(pageNumber - 1) * pageSize}
                  entityLabel="asset"
                />
              )}

              {showingAssets && rows.length > 0 && (
                <div className="mt-3">
                  <Pagination
                    pageNumber={pageNumber}
                    totalPages={pageCount}
                    pageSize={pageSize}
                    totalCount={rowCount}
                    updateFilters={(updates) => {
                      if (updates.pageSize) {
                        setPageSize(Number(updates.pageSize));
                        setPageNumber(1);
                      }
                      if (updates.pageNumber) setPageNumber(Number(updates.pageNumber));
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <Drawer isOpen={treeDrawerOpen} onClose={() => setTreeDrawerOpen(false)}>
        <div className="h-full w-[300px] bg-white">{treePane}</div>
      </Drawer>
    </div>
  );
};

export default LocationExplorer;
