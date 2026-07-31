'use client';

import Link from 'next/link';

const ConfigCard = ({
  title,
  description,
  href,
  icon,
  ready,
}: {
  title: string;
  description: string;
  href?: string;
  icon: string;
  ready?: boolean;
}) => {
  const body = (
    <div
      className={`bg-white rounded-xl p-5 h-full ${
        ready ? 'hover:shadow-md transition-shadow' : 'opacity-70'
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
          <i className={`icon icon-${icon} text-[15px]`} />
        </div>
        <span className="text-sm font-semibold text-secondaryColor">
          {title}
        </span>
        {!ready && (
          <span className="ml-auto text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
            Next phase
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 leading-5">{description}</p>
    </div>
  );

  return ready && href ? <Link href={href}>{body}</Link> : body;
};

const ConfigurationPage = () => (
  <div className="px-4 mt-2 max-w-5xl">
    <h1 className="text-lg font-semibold text-secondaryColor mb-4">
      Configuration
    </h1>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <ConfigCard
        title="Asset Categories"
        description="Category tree (up to 3 levels) with per-category depreciation defaults. Categories drive asset codes and serial-number uniqueness."
        href="/asset-categories"
        icon="category"
        ready
      />
      <ConfigCard
        title="Asset Code Format"
        description="Prefix, category/year tokens and sequence padding per company (e.g. AST-IT-2026-00042). A default AST-##### format applies until configured. Codes are immutable and never reused."
        icon="barcode"
      />
      <ConfigCard
        title="Locations"
        description="Hierarchical location master (site → floor → room) with optional branch anchoring."
        icon="location"
      />
      <ConfigCard
        title="Vendors"
        description="Supplier master referenced by asset purchases, warranties and service contracts."
        icon="users"
      />
      <ConfigCard
        title="Capitalization Policy"
        description="Per-company threshold that defaults assets to capital; below-threshold assets stay non-capital tracked items."
        icon="graph"
      />
      <ConfigCard
        title="Classes & Types"
        description="Flat classifications orthogonal to the category tree (e.g. Movable / Immovable / Intangible)."
        icon="checklist"
      />
    </div>
    <p className="text-xs text-gray-400 mt-6">
      Cards marked “Next phase” have their data model live in the backend
      already; management screens arrive with the corresponding API endpoints.
    </p>
  </div>
);

export default ConfigurationPage;
