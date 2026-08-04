'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Providers/ToastProvider';
import SummaryCard, { TSummaryTint } from '@/components/Dashboard/SummaryCard';
import {
  IAssetDashboard,
  IDashboardCounts,
  IDashboardItem,
  IMonthlyAmount,
} from '@/interface/IDashboard';
import { fetchDashboard } from '@/services/dashboard.service';
import { getInitials } from '@/utils/helpers';

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

/** The five numbers leadership scans first. */
const KPI_CARDS: IKpiCard[] = [
  { key: 'assetsTotal', label: 'Total Assets', iconName: 'briefcase', tint: 'sky', href: '/assets' },
  { key: 'assetsActive', label: 'Active', iconName: 'checked', tint: 'mint', href: '/assets' },
  { key: 'assetsUnderMaintenance', label: 'Under Maintenance', iconName: 'setting', tint: 'amber', href: '/maintenance' },
  { key: 'assetsNotVerified', label: 'Never Verified', iconName: 'documents', tint: 'peach', href: '/physical-verification' },
  { key: 'assetsMissing', label: 'Missing Assets', iconName: 'alert', tint: 'pink', href: '/assets' },
];

/** Workflow at a glance. */
const WORKFLOW_CARDS: IKpiCard[] = [
  { key: 'workOrdersOpen', label: 'Open Work Orders', iconName: 'setting', tint: 'indigo', href: '/maintenance' },
  { key: 'maintenanceRequestsOpen', label: 'Pending Requests', iconName: 'hourglass', tint: 'amber', href: '/maintenance' },
  { key: 'transfersActive', label: 'Active Transfers', iconName: 'move', tint: 'sky', href: '/transfers' },
  { key: 'discrepanciesOpen', label: 'Open Discrepancies', iconName: 'alert', tint: 'pink', href: '/physical-verification' },
  { key: 'assetsHeld', label: 'Service Holds', iconName: 'close-circle', tint: 'lavender', href: '/assets' },
];

/* --------------------------------------------------------------------- */
/* Shared bits (HRM dashboard style)                                      */
/* --------------------------------------------------------------------- */

const AVATAR_COLORS = [
  '#3ac47d',
  '#1A73E8',
  '#F28C38',
  '#5E35B1',
  '#0891b2',
  '#db2777',
  '#65a30d',
  '#d97706',
];

const Avatar = ({ label, index }: { label: string; index: number }) => (
  <span
    className="flex items-center justify-center size-9 shrink-0 rounded-full text-white text-xs font-semibold"
    style={{ backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }}
  >
    {getInitials(label) || <i className="icon icon-briefcase text-sm"></i>}
  </span>
);

const Panel = ({
  emoji,
  title,
  action,
  className = '',
  children,
}: {
  emoji: string;
  title: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) => (
  <section className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 ${className}`}>
    <div className="flex items-center justify-between gap-2 mb-4">
      <h2 className="text-sm font-bold text-secondaryColor flex items-center gap-2">
        <span className="text-base leading-none">{emoji}</span>
        {title}
      </h2>
      {action}
    </div>
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

/** Avatar list rows — pending returns / recovery cases. */
const AvatarRows = ({
  items,
  emptyText,
  badge,
  badgeClass,
  onItemClick,
}: {
  items: IDashboardItem[];
  emptyText: string;
  badge: (item: IDashboardItem) => string;
  badgeClass: string;
  onItemClick?: (item: IDashboardItem) => void;
}) =>
  items.length === 0 ? (
    <p className="text-sm text-gray-400 text-center py-6">{emptyText}</p>
  ) : (
    <ul className="divide-y divide-gray-100 -my-1">
      {items.map((item, index) => (
        <li
          key={`${item.entityId}-${index}`}
          className={`flex items-center gap-3 py-2.5 ${
            onItemClick ? 'cursor-pointer hover:bg-hoverColor px-2 -mx-2 rounded-lg' : ''
          }`}
          onClick={() => onItemClick?.(item)}
        >
          <Avatar label={item.owner || item.name} index={index} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-secondaryColor truncate">
              {item.owner || item.name}
            </p>
            <p className="text-xs text-gray-500 truncate">{item.name}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${badgeClass}`}
            >
              {badge(item)}
            </span>
            <span className="text-[11px] text-gray-400">{formatDate(item.date)}</span>
          </div>
        </li>
      ))}
    </ul>
  );

/* --------------------------------------------------------------------- */
/* Maintenance & Safety grouped rows                                      */
/* --------------------------------------------------------------------- */

interface IAttentionGroup {
  title: string;
  items: IDashboardItem[];
  href: string;
  badge: (item: IDashboardItem) => string;
  badgeClass: string;
}

const AttentionRows = ({
  groups,
  onItemClick,
}: {
  groups: IAttentionGroup[];
  onItemClick: (href: string) => void;
}) => {
  const allEmpty = groups.every((group) => group.items.length === 0);
  if (allEmpty) {
    return (
      <p className="text-sm text-gray-400 text-center py-6">
        Nothing needs attention — the register is in good shape. ✨
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {groups.map((group) =>
        group.items.length === 0 ? null : (
          <div key={group.title}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
              {group.title}
            </p>
            <ul className="divide-y divide-gray-50">
              {group.items.map((item, index) => (
                <li
                  key={`${item.entityId}-${index}`}
                  className="flex items-center gap-3 py-2 cursor-pointer hover:bg-hoverColor px-2 -mx-2 rounded-lg"
                  onClick={() => onItemClick(group.href)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-secondaryColor truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {item.owner || '—'}
                      {item.date ? ` · ${formatDate(item.date)}` : ''}
                    </p>
                  </div>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 ${group.badgeClass}`}
                  >
                    {group.badge(item)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )
      )}
    </div>
  );
};

/* --------------------------------------------------------------------- */
/* Custody stat strip + depreciation tiles                                */
/* --------------------------------------------------------------------- */

interface IStatItem {
  label: string;
  sublabel: string;
  value: number;
  iconName: string;
  circle: string;
  icon: string;
  href?: string;
}

const StatStrip = ({
  items,
  onItemClick,
}: {
  items: IStatItem[];
  onItemClick?: (href: string) => void;
}) => (
  <ul className="divide-y divide-gray-50">
    {items.map((item) => (
      <li
        key={item.label}
        className={`flex items-center gap-3 py-2.5 ${
          item.href ? 'cursor-pointer hover:bg-hoverColor px-2 -mx-2 rounded-lg' : ''
        }`}
        onClick={() => item.href && onItemClick?.(item.href)}
      >
        <span
          className={`flex items-center justify-center size-10 shrink-0 rounded-full ${item.circle}`}
        >
          <i className={`icon icon-${item.iconName} text-base ${item.icon}`}></i>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <p className="text-xl font-bold text-secondaryColor leading-none">{item.value}</p>
            <p className="text-sm font-medium text-gray-700">{item.label}</p>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{item.sublabel}</p>
        </div>
      </li>
    ))}
  </ul>
);

interface ICountTile {
  label: string;
  value: number;
  color: string;
  href?: string;
}

const CountTiles = ({
  tiles,
  emptyText,
  onTileClick,
}: {
  tiles: ICountTile[];
  emptyText: string;
  onTileClick?: (href: string) => void;
}) => {
  const allZero = tiles.every((tile) => tile.value === 0);
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className={`rounded-xl bg-gray-50 py-3 px-2 text-center ${
              tile.href ? 'cursor-pointer transition-colors hover:bg-hoverColor' : ''
            }`}
            onClick={() => tile.href && onTileClick?.(tile.href)}
          >
            <p className={`text-2xl font-bold leading-none ${tile.color}`}>{tile.value}</p>
            <p className="text-[11px] text-gray-500 mt-1.5 leading-tight">{tile.label}</p>
          </div>
        ))}
      </div>
      {allZero && <p className="text-sm text-gray-400 text-center mt-4">{emptyText}</p>}
    </>
  );
};

/* --------------------------------------------------------------------- */
/* Depreciation posted — 12-month bar chart                               */
/* --------------------------------------------------------------------- */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MonthlyChart = ({ series }: { series: IMonthlyAmount[] }) => {
  const max = Math.max(...series.map((point) => point.total), 0);
  return series.length === 0 || max === 0 ? (
    <p className="text-sm text-gray-400 text-center py-6">No depreciation posted yet.</p>
  ) : (
    <div className="flex items-end gap-2 h-48">
      {series.map((point) => {
        const heightPct = max > 0 ? (point.total / max) * 100 : 0;
        const monthLabel = MONTHS[point.month - 1];
        return (
          <div
            key={`${point.year}-${point.month}`}
            className="flex-1 flex flex-col items-center justify-end h-full min-w-0"
            title={`${monthLabel} ${point.year}: ${point.total.toLocaleString()}`}
          >
            <span className="text-[10px] font-medium text-gray-500 mb-1 truncate max-w-full">
              {point.total > 0 ? point.total.toLocaleString() : ''}
            </span>
            <div
              className="w-full max-w-[38px] bg-primarycolor/80 hover:bg-primarycolor rounded-t transition-colors"
              style={{ height: `${Math.max(heightPct, point.total > 0 ? 3 : 0)}%` }}
            ></div>
            <span className="text-[11px] text-gray-500 mt-1.5">{monthLabel}</span>
          </div>
        );
      })}
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

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      try {
        const response = await fetchDashboard();
        if (response?.success) setDashboard(response.data);
        else addToast.error(response?.message || 'Failed to fetch the dashboard');
      } catch {
        addToast.error('An error occurred while fetching the dashboard');
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = dashboard?.counts;

  const custodyStrip: IStatItem[] = [
    {
      label: 'Assigned',
      sublabel: 'In a custodian’s hands',
      value: counts?.assetsAssigned ?? 0,
      iconName: 'user-check',
      circle: 'bg-green-50',
      icon: 'text-green-600',
      href: '/assignments',
    },
    {
      label: 'Available',
      sublabel: 'Active and unassigned',
      value: counts?.assetsUnassigned ?? 0,
      iconName: 'checked',
      circle: 'bg-indigo-50',
      icon: 'text-indigo-600',
      href: '/assets',
    },
    {
      label: 'In Transfer',
      sublabel: 'Between custodians',
      value: counts?.assetsInTransfer ?? 0,
      iconName: 'move',
      circle: 'bg-sky-50',
      icon: 'text-sky-600',
      href: '/transfers',
    },
    {
      label: 'Held',
      sublabel: 'Quarantined or out of service',
      value: counts?.assetsHeld ?? 0,
      iconName: 'close-circle',
      circle: 'bg-amber-50',
      icon: 'text-amber-600',
      href: '/maintenance',
    },
    {
      label: 'Missing',
      sublabel: 'Custody unresolved',
      value: counts?.assetsMissing ?? 0,
      iconName: 'alert',
      circle: 'bg-rose-50',
      icon: 'text-rose-600',
      href: '/physical-verification',
    },
  ];

  const attentionGroups: IAttentionGroup[] = [
    {
      title: 'Overdue Work Orders',
      items: dashboard?.overdueWorkOrders ?? [],
      href: '/maintenance',
      badge: (item) => `${item.daysOpen}d overdue`,
      badgeClass: 'bg-red-100 text-red-700',
    },
    {
      title: 'Breakdown Reports',
      items: dashboard?.breakdownAssets ?? [],
      href: '/maintenance',
      badge: (item) => (item.daysOpen > 0 ? `${item.daysOpen}d down` : 'down'),
      badgeClass: 'bg-orange-100 text-orange-700',
    },
    {
      title: 'Approved Disposals',
      items: dashboard?.approvedDisposals ?? [],
      href: '/disposal',
      badge: (item) => `${item.daysOpen}d waiting`,
      badgeClass: 'bg-violet-100 text-violet-700',
    },
  ];

  const depreciationTiles: ICountTile[] = [
    {
      label: 'Capitalized Assets',
      value: counts?.assetsCapitalized ?? 0,
      color: 'text-sky-600',
      href: '/depreciation',
    },
    {
      label: 'Fully Depreciated',
      value: counts?.assetsFullyDepreciated ?? 0,
      color: 'text-green-600',
      href: '/depreciation',
    },
    {
      label: 'Runs In Flight',
      value: counts?.runsUnfinished ?? 0,
      color: 'text-amber-600',
      href: '/depreciation',
    },
    {
      label: 'Pending Proposals',
      value: counts?.journalProposalsPending ?? 0,
      color: 'text-violet-600',
      href: '/depreciation',
    },
  ];

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-secondaryColor">
            Asset Management Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Register health, custody and accounting at a glance.
          </p>
        </div>
      </div>

      {loading && !dashboard ? (
        <p className="text-sm text-gray-500 mt-6">Loading dashboard…</p>
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

          {/* Workflow cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {WORKFLOW_CARDS.map((card) => (
              <SummaryCard
                key={card.key}
                title={card.label}
                value={counts ? counts[card.key] ?? 0 : '—'}
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

          {/* Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            {/* Left: attention panels + chart */}
            <div className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Panel emoji="↩️" title="Pending Returns">
                  <AvatarRows
                    items={dashboard?.pendingReturns ?? []}
                    emptyText="No returns pending inspection."
                    badge={(item) => `${item.daysOpen}d open`}
                    badgeClass="bg-amber-100 text-amber-700"
                    onItemClick={() => router.push('/returns')}
                  />
                </Panel>
                <Panel emoji="💼" title="Open Recovery Cases">
                  <AvatarRows
                    items={dashboard?.openRecoveryCases ?? []}
                    emptyText="No recovery cases open."
                    badge={(item) => `${item.daysOpen}d open`}
                    badgeClass="bg-rose-100 text-rose-700"
                    onItemClick={() => router.push('/returns')}
                  />
                </Panel>
              </div>
              <Panel emoji="🧮" title="Depreciation Posted — Last 12 Months">
                <MonthlyChart series={dashboard?.monthlyDepreciation ?? []} />
              </Panel>
            </div>

            {/* Right: maintenance & safety + custody strip + depreciation tiles */}
            <div className="space-y-4">
              <Panel emoji="🛡️" title="Maintenance & Safety">
                <AttentionRows
                  groups={attentionGroups}
                  onItemClick={(href) => router.push(href)}
                />
              </Panel>
              <Panel emoji="📦" title="Custody Status">
                <StatStrip items={custodyStrip} onItemClick={(href) => router.push(href)} />
              </Panel>
              <Panel
                emoji="🧾"
                title="Depreciation"
                action={
                  <button
                    type="button"
                    className="text-xs font-medium text-primarycolor hover:underline"
                    onClick={() => router.push('/depreciation')}
                  >
                    View all →
                  </button>
                }
              >
                <CountTiles
                  tiles={depreciationTiles}
                  emptyText="No depreciation activity yet."
                  onTileClick={(href) => router.push(href)}
                />
              </Panel>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
