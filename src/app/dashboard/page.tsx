'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchAssets } from '@/services/asset.service';
import { fetchAssetCategories } from '@/services/assetCategory.service';
import { LifecycleStatusEnum } from '@/enum/assetEnums';

type TStats = {
  totalAssets: number | null;
  draftAssets: number | null;
  activeAssets: number | null;
  categories: number | null;
};

const StatCard = ({
  label,
  value,
  href,
  icon,
  tint,
}: {
  label: string;
  value: number | null;
  href: string;
  icon: string;
  tint: string;
}) => (
  <Link
    href={href}
    className="bg-white rounded-xl p-5 flex items-center gap-4 hover:shadow-md transition-shadow"
  >
    <div
      className={`w-11 h-11 rounded-lg flex items-center justify-center ${tint}`}
    >
      <i className={`icon icon-${icon} text-[18px]`} />
    </div>
    <div>
      <div className="text-2xl font-semibold text-secondaryColor leading-7">
        {value === null ? '—' : value}
      </div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  </Link>
);

const QuickAction = ({
  label,
  href,
  icon,
}: {
  label: string;
  href: string;
  icon: string;
}) => (
  <Link
    href={href}
    className="flex items-center gap-3 bg-white rounded-lg px-4 py-3 hover:bg-primarycolor hover:text-white transition-colors"
  >
    <i className={`icon icon-${icon} text-[15px]`} />
    <span className="text-sm font-medium">{label}</span>
  </Link>
);

const DashboardPage = () => {
  const [stats, setStats] = useState<TStats>({
    totalAssets: null,
    draftAssets: null,
    activeAssets: null,
    categories: null,
  });

  useEffect(() => {
    // Count-only queries: rowCount from single-row pages.
    const load = async () => {
      const [all, draft, active, categories] = await Promise.allSettled([
        fetchAssets({ pageNumber: 1, pageSize: 1 }),
        fetchAssets({
          pageNumber: 1,
          pageSize: 1,
          lifecycleStatus: LifecycleStatusEnum.Draft,
        }),
        fetchAssets({
          pageNumber: 1,
          pageSize: 1,
          lifecycleStatus: LifecycleStatusEnum.Active,
        }),
        fetchAssetCategories({ pageNumber: 1, pageSize: 1 }),
      ]);

      const count = (
        r: PromiseSettledResult<{ rowCount?: number; success?: boolean }>
      ) =>
        r.status === 'fulfilled' && r.value?.success
          ? (r.value.rowCount ?? 0)
          : null;

      setStats({
        totalAssets: count(all),
        draftAssets: count(draft),
        activeAssets: count(active),
        categories: count(categories),
      });
    };
    load();
  }, []);

  return (
    <div className="px-4 mt-2">
      <h1 className="text-lg font-semibold text-secondaryColor mb-4">
        Asset Management
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Assets"
          value={stats.totalAssets}
          href="/assets"
          icon="box"
          tint="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Draft"
          value={stats.draftAssets}
          href={`/assets?lifecycleStatus=${LifecycleStatusEnum.Draft}`}
          icon="edit"
          tint="bg-gray-100 text-gray-600"
        />
        <StatCard
          label="Active"
          value={stats.activeAssets}
          href={`/assets?lifecycleStatus=${LifecycleStatusEnum.Active}`}
          icon="check"
          tint="bg-green-50 text-green-600"
        />
        <StatCard
          label="Categories"
          value={stats.categories}
          href="/asset-categories"
          icon="category"
          tint="bg-amber-50 text-amber-600"
        />
      </div>

      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mt-8 mb-3">
        Quick actions
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickAction label="Register Asset" href="/assets/create" icon="plus" />
        <QuickAction label="Browse Assets" href="/assets" icon="box" />
        <QuickAction
          label="Manage Categories"
          href="/asset-categories"
          icon="category"
        />
        <QuickAction
          label="Configuration"
          href="/configuration"
          icon="setting"
        />
      </div>

      <div className="mt-8 bg-white rounded-xl p-5 text-sm text-gray-500">
        Assignments, transfers, physical verification, maintenance, depreciation
        and disposal arrive in the next phases — see the sidebar for the full
        module map.
      </div>
    </div>
  );
};

export default DashboardPage;
