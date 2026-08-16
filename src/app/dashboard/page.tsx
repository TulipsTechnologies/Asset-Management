'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/Providers/ToastProvider';
import SummaryCard, { TSummaryTint } from '@/components/Dashboard/SummaryCard';
import AssetsByLocationPanel from '@/components/Dashboard/AssetsByLocationPanel';
import {
  IAssetDashboard,
  IDashboardCounts,
  IDashboardItem,
  IMonthlyAmount,
} from '@/interface/IDashboard';
import { fetchDashboard } from '@/services/dashboard.service';

/* --------------------------------------------------------------------- */
/* Top pastel KPI cards — same grid, tints and card style as the Vehicle  */
/* Management dashboard.                                                  */
/* --------------------------------------------------------------------- */

interface IKpiCard {
  key: keyof IDashboardCounts;
  label: string;
  iconName: string;
  tint: TSummaryTint;
  href?: string;
}

/**
 * The five numbers worth a headline, each answering a different question: how big is
 * the register, how much of it is in service, how much is out of action, what has gone
 * missing, and what nobody has laid eyes on.
 *
 * The workflow counts that used to sit in a second row are not gone — they were the
 * same stories told twice. In Transfer and Held are in the Custody Status strip below,
 * open work orders and breakdown reports in Maintenance & Safety, and discrepancies on
 * the verification page a click away. Ten cards competing for attention meant none of
 * them held it.
 */
const KPI_CARDS: IKpiCard[] = [
  { key: 'assetsTotal', label: 'Total Assets', iconName: 'briefcase', tint: 'sky', href: '/assets' },
  { key: 'assetsActive', label: 'Active', iconName: 'checked', tint: 'mint', href: '/assets' },
  { key: 'assetsUnderMaintenance', label: 'Under Maintenance', iconName: 'setting', tint: 'amber', href: '/maintenance' },
  { key: 'assetsMissing', label: 'Missing Assets', iconName: 'alert', tint: 'pink', href: '/assets' },
  { key: 'assetsNotVerified', label: 'Never Verified', iconName: 'documents', tint: 'peach', href: '/physical-verification' },
];

/* --------------------------------------------------------------------- */
/* Shared bits                                                            */
/* --------------------------------------------------------------------- */

/**
 * The body is a single column of full-width bands rather than a wide column beside a
 * narrow one. The old split gave its largest, most prominent area to the three things a
 * newly-imported tenant has none of — pending returns, recovery cases and posted
 * depreciation — so the screen a client sees on day one was mostly whitespace, while all
 * the substance was crammed into the narrow side column. Full-width bands let emptiness
 * collapse vertically instead of leaving a hole beside a tall neighbour.
 */
const Panel = ({
  iconName,
  title,
  action,
  inset,
  children,
}: {
  /** Icon-font glyph, not an emoji — a glyph obeys the type system's color and
   *  optical size; an emoji brings its own palette to every heading. */
  iconName?: string;
  title?: string;
  action?: React.ReactNode;
  /** Thin strips (Band 2) trade the p-5 frame for a slim one; px-3 + the strip's
   *  own px-3 lands its first icon at ~24px like every p-5 band's content. */
  inset?: boolean;
  children: React.ReactNode;
}) => (
  <section
    className={`bg-white rounded-2xl border border-gray-100 shadow-sm ${
      inset ? 'px-3 py-2' : 'p-5'
    }`}
  >
    {title && (
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-sm font-bold text-secondaryColor flex items-center gap-2">
          {iconName && <i className={`icon icon-${iconName} text-sm text-gray-400`} />}
          {title}
        </h2>
        {action}
      </div>
    )}
    {children}
  </section>
);

const formatDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* --------------------------------------------------------------------- */
/* Band 1 — the merged attention queue                                    */
/* --------------------------------------------------------------------- */

/**
 * Five separate lists became one queue sorted by age. Split across five panels, the
 * oldest item in the tenant could sit third in a short list while a fresh one led a long
 * one — you had to read every panel to find what had been waiting longest. Merged and
 * sorted, the most-stalled thing is simply row one.
 *
 * Every row still carries its origin four ways — tinted icon, kind chip, badge wording and
 * where it navigates — so merging costs no legibility. Note the badge verbs differ because
 * the clocks differ: a work order counts days past its due date, a disposal days since
 * approval. They sort as peers, which is the honest best we can do with one date field.
 */
interface IQueueKind {
  key: string;
  label: string;
  short: string;
  /** Which collection on the payload this kind draws from. */
  select: (dashboard: IAssetDashboard) => IDashboardItem[];
  /**
   * The true open count, where the payload carries one. The lists themselves are capped
   * at ten rows server-side, so a chip counting rows would read "10" for a tenant with
   * thirty-one. Overdue work orders and breakdowns have no uncapped counterpart —
   * workOrdersOpen counts every open order, not the overdue ones — so they fall back to
   * the row count and the queue never claims an exhaustive total.
   */
  total?: (counts: IDashboardCounts) => number;
  href: string;
  iconName: string;
  circle: string;
  iconColor: string;
  chip: string;
  badgeClass: string;
  badge: (item: IDashboardItem) => string;
}

const QUEUE_KINDS: IQueueKind[] = [
  {
    key: 'overdueWorkOrders',
    label: 'Overdue Work Orders',
    short: 'Work order',
    select: (d) => d.overdueWorkOrders ?? [],
    href: '/maintenance',
    iconName: 'setting',
    circle: 'bg-red-50',
    iconColor: 'text-red-600',
    chip: 'bg-red-100 text-red-700',
    badgeClass: 'bg-red-100 text-red-700',
    badge: (item) => `${item.daysOpen}d overdue`,
  },
  {
    key: 'breakdownAssets',
    label: 'Breakdowns',
    short: 'Breakdown',
    select: (d) => d.breakdownAssets ?? [],
    href: '/maintenance',
    iconName: 'alert',
    circle: 'bg-orange-50',
    iconColor: 'text-orange-600',
    chip: 'bg-orange-100 text-orange-700',
    badgeClass: 'bg-orange-100 text-orange-700',
    badge: (item) => (item.daysOpen > 0 ? `${item.daysOpen}d down` : 'down'),
  },
  {
    key: 'openRecoveryCases',
    label: 'Recovery Cases',
    short: 'Recovery',
    select: (d) => d.openRecoveryCases ?? [],
    total: (c) => c.recoveryCasesOpen,
    href: '/returns',
    iconName: 'briefcase',
    circle: 'bg-rose-50',
    iconColor: 'text-rose-600',
    chip: 'bg-rose-100 text-rose-700',
    badgeClass: 'bg-rose-100 text-rose-700',
    badge: (item) => `${item.daysOpen}d open`,
  },
  {
    key: 'pendingReturns',
    label: 'Returns to Inspect',
    short: 'Return',
    select: (d) => d.pendingReturns ?? [],
    total: (c) => c.returnsPending,
    href: '/returns',
    iconName: 'return',
    circle: 'bg-amber-50',
    iconColor: 'text-amber-600',
    chip: 'bg-amber-100 text-amber-700',
    badgeClass: 'bg-amber-100 text-amber-700',
    badge: (item) => `${item.daysOpen}d waiting`,
  },
  {
    key: 'approvedDisposals',
    label: 'Disposals to Execute',
    short: 'Disposal',
    select: (d) => d.approvedDisposals ?? [],
    total: (c) => c.disposalsApprovedPending,
    href: '/disposal',
    iconName: 'trash',
    circle: 'bg-violet-50',
    iconColor: 'text-violet-600',
    chip: 'bg-violet-100 text-violet-700',
    badgeClass: 'bg-violet-100 text-violet-700',
    badge: (item) => `${item.daysOpen}d waiting`,
  },
];

interface IQueueRow {
  kind: IQueueKind;
  item: IDashboardItem;
}

const QUEUE_LIMIT = 8;

const AttentionQueue = ({
  rows,
  liveKinds,
  onNavigate,
}: {
  rows: IQueueRow[];
  liveKinds: { kind: IQueueKind; count: number }[];
  onNavigate: (href: string) => void;
}) => {
  const shown = rows.slice(0, QUEUE_LIMIT);
  return (
    <>
      <div className="flex flex-wrap gap-2 mb-4">
        {liveKinds.map(({ kind, count }) => (
          <button
            key={kind.key}
            type="button"
            onClick={() => onNavigate(kind.href)}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-shadow hover:shadow-sm ${kind.chip}`}
          >
            <span className="font-bold tabular-nums">{count}</span>
            {kind.label}
          </button>
        ))}
      </div>

      <ul className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
        {shown.map(({ kind, item }, index) => (
          <li
            key={`${kind.key}-${item.entityId}-${index}`}
            className="flex items-center gap-3 py-2.5 border-b border-gray-50 cursor-pointer hover:bg-hoverColor px-2 -mx-2 rounded-lg"
            onClick={() => onNavigate(kind.href)}
          >
            <span
              className={`flex items-center justify-center size-9 shrink-0 rounded-full ${kind.circle}`}
            >
              <i className={`icon icon-${kind.iconName} text-base ${kind.iconColor}`}></i>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-secondaryColor truncate">{item.name}</p>
              <p className="flex items-center gap-1.5 mt-0.5 min-w-0">
                {/* The kind label is metadata, not signal — the tinted icon circle and
                    the age badge carry the color; five chip palettes per row was a
                    rainbow where a word suffices. */}
                <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0 bg-gray-100 text-gray-500">
                  {kind.short}
                </span>
                <span className="text-xs text-gray-500 truncate">
                  {item.owner || '—'}
                  {item.date ? ` · ${formatDate(item.date)}` : ''}
                </span>
              </p>
            </div>
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 ${kind.badgeClass}`}
            >
              {kind.badge(item)}
            </span>
          </li>
        ))}
      </ul>

      {rows.length > QUEUE_LIMIT && (
        /*
         * No "of N" here. The lists arrive capped at ten rows each, so any total derived
         * from them would be a floor dressed up as a count — the chips above carry the
         * real figures where the payload has them, and each one opens its module.
         */
        <p className="text-xs text-gray-400 mt-3">
          Showing the {QUEUE_LIMIT} longest-waiting — open a category above for the rest.
        </p>
      )}
    </>
  );
};

/**
 * When nothing is stalled this replaces the panel entirely rather than drawing an empty
 * one. A quiet register should read as good news in one line, not as a large box
 * apologising for having no rows.
 */
const AllClearStrip = ({ everythingQuiet }: { everythingQuiet: boolean }) => (
  <div className="flex items-center gap-3 rounded-2xl border border-green-100 bg-green-50 px-4 py-3">
    <span className="inline-flex items-center justify-center size-9 rounded-full bg-green-100 shrink-0">
      <i className="icon icon-checked text-green-600 text-base"></i>
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-green-800">
        {everythingQuiet
          ? 'Nothing open — the register is quiet.'
          : 'Nothing overdue or stalled.'}
      </p>
      <p className="text-xs text-green-700/80">
        {everythingQuiet
          ? 'No work orders, transfers, returns, recovery cases or discrepancies.'
          : 'Everything currently open is still inside its window.'}
      </p>
    </div>
  </div>
);

/* --------------------------------------------------------------------- */
/* Band 2 — what is moving right now                                      */
/* --------------------------------------------------------------------- */

interface IFlightItem {
  label: string;
  value: number;
  iconName: string;
  circle: string;
  iconColor: string;
  href: string;
}

/** A thin strip cannot look empty, only calm — which is why these four live here. */
const InFlightStrip = ({
  items,
  onNavigate,
}: {
  items: IFlightItem[];
  onNavigate: (href: string) => void;
}) => (
  /*
   * Gaps below lg, dividers only once the four cells are a single row. `divide-y` walks
   * DOM order, not grid rows, so on the two-column layout it drew a rule above the second
   * cell of the first row — a stray line between two side-by-side tiles.
   */
  <div className="grid grid-cols-2 gap-1 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-gray-100">
    {items.map((item) => (
      <button
        key={item.label}
        type="button"
        onClick={() => onNavigate(item.href)}
        className="flex items-center gap-3 px-3 py-2.5 text-left rounded-lg hover:bg-hoverColor transition-colors"
      >
        <span
          className={`flex items-center justify-center size-9 shrink-0 rounded-full ${item.circle}`}
        >
          <i className={`icon icon-${item.iconName} text-base ${item.iconColor}`}></i>
        </span>
        <div className="min-w-0">
          <p
            className={`text-lg font-bold leading-none tabular-nums ${
              item.value > 0 ? 'text-secondaryColor' : 'text-gray-300'
            }`}
          >
            {item.value}
          </p>
          <p className="text-[11px] text-gray-500 mt-1 truncate">{item.label}</p>
        </div>
      </button>
    ))}
  </div>
);

/* --------------------------------------------------------------------- */
/* Band 3 — where everything is                                           */
/* --------------------------------------------------------------------- */

interface ICustodySegment {
  label: string;
  sub: string;
  value: number;
  bar: string;
  dot: string;
  tintBg: string;
  tintText: string;
  href: string;
}

const CustodyBand = ({
  segments,
  assetsTotal,
  onNavigate,
}: {
  segments: ICustodySegment[];
  assetsTotal: number;
  onNavigate: (href: string) => void;
}) => {
  /**
   * The denominator is the sum of these five buckets, never assetsTotal. They do not
   * partition the register in either direction: drafts and retired assets fall outside
   * all five, while Held is read off the operational status rather than the custody one,
   * so an asset that is both assigned and quarantined lands in two buckets at once.
   * Dividing by assetsTotal would leave the bar silently short of full; the footnote
   * states whichever way the two figures disagree.
   */
  const tracked = segments.reduce((sum, segment) => sum + segment.value, 0);
  const pct = (value: number) => (tracked ? Math.round((value / tracked) * 100) : 0);

  /*
   * Only an empty register earns the import prompt. Assets are created and imported as
   * drafts, and no bucket counts a draft — so gating this on `tracked` alone told the
   * freshly-imported tenant to import the assets it had just imported, directly beneath
   * a card reading Total Assets 500.
   */
  if (assetsTotal === 0) {
    return (
      <>
        <div className="h-3 w-full rounded-full bg-gray-100"></div>
        <div className="text-center py-6">
          <p className="text-sm text-gray-400">No assets in the register yet.</p>
          <button
            type="button"
            className="mx-auto mt-2 flex items-center gap-1 text-xs font-medium text-primarycolor hover:underline"
            onClick={() => onNavigate('/assets')}
          >
            Add or import assets
            <i className="icon icon-right text-[9px]" />
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex h-3 w-full rounded-full overflow-hidden bg-gray-100">
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <div
              key={segment.label}
              className={segment.bar}
              // A single missing asset out of thousands still has to be visible.
              style={{ width: `${(segment.value / tracked) * 100}%`, minWidth: 4 }}
              title={`${segment.label}: ${segment.value} (${pct(segment.value)}%)`}
            ></div>
          ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
        {segments.map((segment) => (
          <CountTile
            key={segment.label}
            label={segment.label}
            sub={`${pct(segment.value)}% · ${segment.sub}`}
            value={segment.value}
            tintBg={segment.tintBg}
            tintText={segment.tintText}
            dot={segment.dot}
            onClick={() => onNavigate(segment.href)}
          />
        ))}
      </div>

      {tracked === 0 ? (
        <p className="text-[11px] text-gray-400 mt-3 tabular-nums">
          None of the {assetsTotal} assets carry a custody state yet — new and imported
          assets stay drafts until they are activated.
        </p>
      ) : tracked < assetsTotal ? (
        <p className="text-[11px] text-gray-400 mt-3 tabular-nums">
          {tracked} of {assetsTotal} assets are custody-tracked — the rest are drafts,
          retired or disposed.
        </p>
      ) : tracked > assetsTotal ? (
        <p className="text-[11px] text-gray-400 mt-3 tabular-nums">
          These states total more than the {assetsTotal} assets in the register because one
          asset can sit in two of them — an assigned asset can also be on hold.
        </p>
      ) : null}
    </>
  );
};

/* --------------------------------------------------------------------- */
/* Band 4 — depreciation, chart and counters in one place                 */
/* --------------------------------------------------------------------- */

interface ICountTile {
  label: string;
  value: number;
  tintBg: string;
  tintText: string;
}

/**
 * ONE tile spec for every tinted counter on the page — custody, depreciation,
 * anything later. Two bands drawing the "colored tile with a number" idea two
 * different ways read as two apps sharing a screen.
 */
const CountTile = ({
  label,
  sub,
  value,
  tintBg,
  tintText,
  dot,
  onClick,
}: {
  label: string;
  sub?: string;
  value: number;
  tintBg: string;
  tintText: string;
  dot?: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-xl px-3 py-2.5 text-left transition-shadow hover:shadow-md ${tintBg}`}
  >
    <span className="flex items-center gap-1.5">
      {dot && <span className={`size-2 rounded-full shrink-0 ${dot}`}></span>}
      <span className="text-[11px] font-bold text-gray-600 truncate">{label}</span>
    </span>
    <p
      className={`text-xl font-bold leading-none mt-1.5 tabular-nums ${
        value > 0 ? tintText : 'text-gray-300'
      }`}
    >
      {value}
    </p>
    {sub && <p className="text-[11px] text-gray-500 mt-1 truncate">{sub}</p>}
  </button>
);

/**
 * The axis always draws twelve months, even with nothing posted. An empty ledger with
 * labelled months reads as "no entries yet"; a blank rectangle reads as broken.
 */
const MonthlyChart = ({ series }: { series: IMonthlyAmount[] }) => {
  const anchor = series.length
    ? series.reduce((latest, point) =>
        point.year * 12 + point.month > latest.year * 12 + latest.month ? point : latest
      )
    : { year: new Date().getFullYear(), month: new Date().getMonth() + 1, total: 0 };

  const slots = Array.from({ length: 12 }, (_, index) => {
    const offset = anchor.year * 12 + (anchor.month - 1) - (11 - index);
    return { year: Math.floor(offset / 12), month: (offset % 12) + 1 };
  });

  const byKey = new Map(series.map((point) => [`${point.year}-${point.month}`, point.total]));

  /*
   * Scale and total from what the axis actually draws, not from the raw series. Folding
   * over the series let a month outside the twelve slots set the bar scale — every drawn
   * bar shrinks against a column that isn't there — and inflate a total sitting above
   * twelve bars that don't add up to it.
   */
  const drawn = slots.map((slot) => byKey.get(`${slot.year}-${slot.month}`) ?? 0);
  const max = Math.max(0, ...drawn);
  const seriesTotal = drawn.reduce((sum, value) => sum + value, 0);

  /*
   * A run posted for zero still happened, so the "nothing posted yet" overlay keys off
   * whether any month came back at all rather than off the amount.
   */
  const hasData = series.length > 0;

  const now = new Date();
  const anchorIsCurrent =
    anchor.year === now.getFullYear() && anchor.month === now.getMonth() + 1;

  const compact = (value: number) =>
    new Intl.NumberFormat(undefined, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);

  return (
    <div className="mt-5 pt-5 border-t border-gray-100">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          {/* The window ends at the newest posting, which may be months behind today. */}
          {hasData && !anchorIsCurrent
            ? `Posted — 12 months to ${MONTHS[anchor.month - 1]} ${anchor.year}`
            : 'Posted — last 12 months'}
        </p>
        {hasData && (
          <p className="text-sm font-semibold text-secondaryColor tabular-nums">
            {seriesTotal.toLocaleString()}
          </p>
        )}
      </div>

      <div className="relative">
        <div className="flex items-end gap-1.5 h-40">
          {slots.map((slot) => {
            const total = byKey.get(`${slot.year}-${slot.month}`) ?? 0;
            return (
              <div
                key={`${slot.year}-${slot.month}`}
                className="flex-1 flex flex-col items-center justify-end h-full min-w-0"
                title={`${MONTHS[slot.month - 1]} ${slot.year}: ${total.toLocaleString()}`}
              >
                {total > 0 && (
                  <span className="text-[10px] font-medium text-gray-500 mb-1 truncate max-w-full">
                    {compact(total)}
                  </span>
                )}
                {total > 0 ? (
                  <div
                    className="w-full max-w-[44px] bg-primarycolor/80 hover:bg-primarycolor rounded-t transition-colors"
                    /*
                     * 88%, not 100% — the value label sits inside this fixed-height column,
                     * so a full-height bar pushes its own label out and the tallest bar ends
                     * up shorter than the scale says it is.
                     */
                    style={{ height: `${Math.max((total / max) * 88, 3)}%` }}
                  ></div>
                ) : (
                  <div className="w-full max-w-[44px] h-[2px] rounded-full bg-gray-200"></div>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-gray-100"></div>

        <div className="flex gap-1.5 mt-1.5">
          {slots.map((slot, index) => (
            <div
              key={`${slot.year}-${slot.month}-label`}
              className="flex-1 min-w-0 text-center text-[11px] text-gray-500"
            >
              {MONTHS[slot.month - 1]}
              {(index === 0 || slot.month === 1) && (
                <span className="text-[10px] text-gray-300 ml-0.5">
                  {String(slot.year).slice(-2)}
                </span>
              )}
            </div>
          ))}
        </div>

        {!hasData && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-sm text-gray-400">No depreciation posted yet</p>
            <p className="text-xs text-gray-400 mt-1">Bars fill in after your first posted run.</p>
          </div>
        )}
      </div>
    </div>
  );
};

/* --------------------------------------------------------------------- */
/* Page                                                                   */
/* --------------------------------------------------------------------- */

const DashboardPage = () => {
  const router = useRouter();
  const { addToast } = useToast();

  const [dashboard, setDashboard] = useState<IAssetDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  /**
   * Why the load failed, kept for the panel below. A toast is gone in seconds and
   * never reaches whoever is looking at the screen afterwards, which is how a
   * deployment ends up reporting only "could not be loaded" with the actual cause
   * — a refused request, an unreachable API, a named server error — nowhere.
   */
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetchDashboard();
      if (response?.success) {
        setDashboard(response.data);
      } else {
        const message = response?.message || 'Failed to fetch the dashboard';
        setLoadError(message);
        addToast.error(message);
      }
    } catch {
      const message = 'An error occurred while fetching the dashboard';
      setLoadError(message);
      addToast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = dashboard?.counts;
  const go = (href: string) => router.push(href);

  const listFor = (kind: IQueueKind): IDashboardItem[] =>
    dashboard ? kind.select(dashboard) : [];

  /*
   * A kind is "live" when it actually has rows in the queue; its chip then shows the true
   * open count where the payload carries one, never below the rows we are already showing.
   */
  const liveKinds = QUEUE_KINDS.map((kind) => {
    const rowCount = listFor(kind).length;
    const trueCount = kind.total && counts ? kind.total(counts) : rowCount;
    return { kind, count: Math.max(rowCount, trueCount) };
  }).filter((entry) => entry.count > 0);

  const queueRows: IQueueRow[] = QUEUE_KINDS.flatMap((kind) =>
    listFor(kind).map((item) => ({ kind, item }))
  ).sort((a, b) => b.item.daysOpen - a.item.daysOpen);

  const oldest = queueRows.length ? queueRows[0].item.daysOpen : 0;

  const inFlight: IFlightItem[] = [
    {
      label: 'Open Work Orders',
      value: counts?.workOrdersOpen ?? 0,
      iconName: 'setting',
      circle: 'bg-sky-50',
      iconColor: 'text-sky-600',
      href: '/maintenance',
    },
    {
      label: 'Maintenance Requests',
      value: counts?.maintenanceRequestsOpen ?? 0,
      iconName: 'documents',
      circle: 'bg-amber-50',
      iconColor: 'text-amber-600',
      href: '/maintenance',
    },
    {
      label: 'Active Transfers',
      value: counts?.transfersActive ?? 0,
      iconName: 'move',
      circle: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      href: '/transfers',
    },
    {
      label: 'Open Discrepancies',
      value: counts?.discrepanciesOpen ?? 0,
      iconName: 'clipboard',
      circle: 'bg-rose-50',
      iconColor: 'text-rose-600',
      href: '/physical-verification',
    },
  ];

  const custodySegments: ICustodySegment[] = [
    {
      label: 'Assigned',
      sub: 'has a custodian',
      value: counts?.assetsAssigned ?? 0,
      bar: 'bg-green-500',
      dot: 'bg-green-500',
      tintBg: 'bg-green-50',
      tintText: 'text-green-700',
      href: '/assignments',
    },
    {
      label: 'Available',
      sub: 'active, unassigned',
      value: counts?.assetsUnassigned ?? 0,
      bar: 'bg-indigo-400',
      dot: 'bg-indigo-400',
      tintBg: 'bg-indigo-50',
      tintText: 'text-indigo-700',
      href: '/assets',
    },
    {
      label: 'In Transfer',
      sub: 'between custodians',
      value: counts?.assetsInTransfer ?? 0,
      bar: 'bg-sky-400',
      dot: 'bg-sky-400',
      tintBg: 'bg-sky-50',
      tintText: 'text-sky-700',
      href: '/transfers',
    },
    {
      label: 'Held',
      sub: 'quarantined or out of service',
      value: counts?.assetsHeld ?? 0,
      bar: 'bg-amber-400',
      dot: 'bg-amber-400',
      tintBg: 'bg-amber-50',
      tintText: 'text-amber-700',
      href: '/maintenance',
    },
    {
      label: 'Missing',
      sub: 'custody unresolved',
      value: counts?.assetsMissing ?? 0,
      bar: 'bg-rose-500',
      dot: 'bg-rose-500',
      tintBg: 'bg-rose-50',
      tintText: 'text-rose-700',
      href: '/physical-verification',
    },
  ];

  const depreciationTiles: ICountTile[] = [
    {
      label: 'Capitalized Assets',
      value: counts?.assetsCapitalized ?? 0,
      tintBg: 'bg-sky-50',
      tintText: 'text-sky-700',
    },
    {
      label: 'Fully Depreciated',
      value: counts?.assetsFullyDepreciated ?? 0,
      tintBg: 'bg-green-50',
      tintText: 'text-green-700',
    },
    {
      label: 'Runs In Flight',
      value: counts?.runsUnfinished ?? 0,
      tintBg: 'bg-amber-50',
      tintText: 'text-amber-700',
    },
    {
      label: 'Pending Proposals',
      value: counts?.journalProposalsPending ?? 0,
      tintBg: 'bg-violet-50',
      tintText: 'text-violet-700',
    },
  ];

  const everythingQuiet = inFlight.every((item) => item.value === 0);

  return (
    <div className="px-4 sm:px-6 py-6">
      <div>
        <h1 className="text-lg font-semibold text-secondaryColor">
          Asset Management Dashboard
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Register health, custody and accounting at a glance.
        </p>
      </div>

      {loading && !dashboard ? (
        /* The skeleton draws the page's real bones — five KPI cells and three bands —
           so the load settles into place instead of popping from a sentence. */
        <div className="mt-5 space-y-5" aria-hidden>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[104px] animate-pulse rounded-2xl bg-gray-100" />
            ))}
          </div>
          <div className="h-16 animate-pulse rounded-2xl bg-gray-100" />
          <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
          <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />
        </div>
      ) : !dashboard ? (
        /*
         * Without this branch a failed fetch falls through to the body, where every count
         * reads 0 and the all-clear strip announces that the register is quiet — the one
         * claim we are in no position to make when we could not reach the server.
         */
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="inline-flex items-center justify-center size-9 rounded-full bg-amber-100 shrink-0">
            <i className="icon icon-alert text-amber-600 text-base"></i>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-800">
              The dashboard could not be loaded.
            </p>
            <p className="text-xs text-amber-700/80">
              These figures are unknown right now, not zero.
            </p>
            {loadError && (
              <p className="mt-1 break-words text-xs text-amber-800">
                {loadError}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={loadDashboard}
            disabled={loading}
            className="text-xs font-semibold text-amber-800 hover:underline shrink-0 disabled:opacity-50"
          >
            {loading ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {/* Top pastel KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {KPI_CARDS.map((card) => (
              <SummaryCard
                key={card.key}
                title={card.label}
                value={counts ? counts[card.key] : '—'}
                tint={card.tint}
                iconName={card.iconName}
                onClick={card.href ? () => router.push(card.href!) : undefined}
              />
            ))}
          </div>

          {/* Approved-disposal callout — each one locks its asset until executed */}
          {counts && counts.disposalsApprovedPending > 0 && (
            <div className="flex items-center gap-3 border border-red-200 bg-red-50 rounded-2xl px-4 py-3">
              <span className="inline-flex items-center justify-center size-9 rounded-full bg-red-100 shrink-0">
                <i className="icon icon-alert text-red-600 text-base"></i>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-red-700">
                  {counts.disposalsApprovedPending} approved disposal
                  {counts.disposalsApprovedPending === 1 ? '' : 's'} awaiting execution
                </p>
                <p className="text-xs text-red-600/80">
                  Each one locks its asset — no assignment, activation or new work until
                  executed or cancelled.
                </p>
              </div>
            </div>
          )}

          {/* Band 1 — what has been waiting longest */}
          {queueRows.length === 0 ? (
            <AllClearStrip everythingQuiet={everythingQuiet} />
          ) : (
            <Panel
              iconName="alert"
              title="Needs You Today"
              action={
                /*
                 * The count sums the chips (true totals where the payload has them), not
                 * the rows, which are capped at ten per kind. "Oldest" is safe either way:
                 * each list is ordered oldest-first server-side before it is capped, so the
                 * genuinely longest-waiting item is always among the rows we received.
                 */
                <span className="text-xs text-gray-400 tabular-nums">
                  {liveKinds.reduce((sum, entry) => sum + entry.count, 0)} open · oldest{' '}
                  {oldest}d
                </span>
              }
            >
              <AttentionQueue rows={queueRows} liveKinds={liveKinds} onNavigate={go} />
            </Panel>
          )}

          {/* Band 2 — what is moving right now */}
          <Panel inset>
            <InFlightStrip items={inFlight} onNavigate={go} />
          </Panel>

          {/* Band 3 — WHERE things physically are. Deliberately separate from custody
              below: a room is a place, "Assigned" is a state, and mixing the two is how
              an operator ends up looking for a chair in a status. */}
          <Panel
            iconName="company"
            title="Assets by Location"
            action={
              // Bare path: next/link applies basePath itself — appUrl() here
              // double-prefixed to /asset-management/asset-management and 404'd.
              <Link
                href="/reports?code=assets-by-location"
                className="flex items-center gap-1 text-xs font-medium text-primarycolor hover:underline"
              >
                View Explorer
                <i className="icon icon-right text-[9px]" />
              </Link>
            }
          >
            <AssetsByLocationPanel
              hierarchy={dashboard?.locationHierarchy ?? []}
              loading={loading}
            />
          </Panel>

          {/* Band 4 — who HOLDS things, which is a different question from where they are. */}
          <Panel
            iconName="move"
            title="Asset Custody & Movement"
            action={
              <span className="text-xs text-gray-400 tabular-nums">
                {custodySegments.reduce((sum, segment) => sum + segment.value, 0)} custody-tracked
              </span>
            }
          >
            <CustodyBand
              segments={custodySegments}
              assetsTotal={counts?.assetsTotal ?? 0}
              onNavigate={go}
            />
          </Panel>

          {/* Band 4 — the two depreciation blocks, merged */}
          <Panel
            iconName="documents"
            title="Depreciation & Accounting"
            action={
              <button
                type="button"
                className="flex items-center gap-1 text-xs font-medium text-primarycolor hover:underline"
                onClick={() => router.push('/depreciation')}
              >
                View all
                <i className="icon icon-right text-[9px]" />
              </button>
            }
          >
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {depreciationTiles.map((tile) => (
                <CountTile
                  key={tile.label}
                  label={tile.label}
                  value={tile.value}
                  tintBg={tile.tintBg}
                  tintText={tile.tintText}
                  onClick={() => router.push('/depreciation')}
                />
              ))}
            </div>
            <MonthlyChart series={dashboard?.monthlyDepreciation ?? []} />
          </Panel>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
