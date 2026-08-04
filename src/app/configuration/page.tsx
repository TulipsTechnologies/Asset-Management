'use client';

import Link from 'next/link';

/**
 * Settings hub — card-grid landing page in the Vehicle Management Settings style:
 * grouped sections with uppercase headers, and cards with an icon in a green-tinted
 * square, a bold title and a one-line description. Cards for future areas carry the
 * amber Phase 2 badge and route to /coming-soon.
 */

interface ISettingsCard {
  label: string;
  description: string;
  iconName: string;
  url: string;
  phase2?: boolean;
}

interface ISettingsSection {
  heading: string;
  cards: ISettingsCard[];
}

const SECTIONS: ISettingsSection[] = [
  {
    heading: 'Register',
    cards: [
      {
        label: 'Asset Categories',
        description: 'Category tree (up to 3 levels) with per-category depreciation defaults',
        iconName: 'modules',
        url: '/asset-categories',
      },
      {
        label: 'Asset Code Format',
        description: 'Prefix, category/year tokens and sequence padding per company',
        iconName: 'id',
        url: '/asset-code-format',
      },
      {
        label: 'Classes & Types',
        description: 'Flat classifications orthogonal to the category tree',
        iconName: 'clipboard',
        url: '/coming-soon',
        phase2: true,
      },
    ],
  },
  {
    heading: 'Master Data',
    cards: [
      {
        label: 'Locations',
        description: 'Hierarchical location master (site → floor → room) for transfers and registration',
        iconName: 'marker',
        url: '/locations',
      },
      {
        label: 'Vendors',
        description: 'Supplier master referenced by purchases, maintenance and disposals',
        iconName: 'handshake',
        url: '/vendors',
      },
    ],
  },
  {
    heading: 'Accounting',
    cards: [
      {
        label: 'Depreciation Settings',
        description: 'Fiscal calendar, capitalization policy and GL account mappings',
        iconName: 'calculator',
        url: '/configuration/depreciation',
      },
    ],
  },
];

const SettingsHubPage = () => (
  <div className="px-4 sm:px-6 py-6">
    <h1 className="text-xl font-semibold text-secondaryColor">Settings</h1>
    <p className="text-sm text-gray-500 mt-1">
      Manage the configuration used across the register, custody and accounting.
    </p>

    {SECTIONS.map((section) => (
      <section key={section.heading} className="mt-7">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          {section.heading}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
          {section.cards.map((card) => (
            <Link
              key={card.label}
              href={card.url}
              className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 transition-colors hover:bg-hoverColor hover:border-primarycolor/40"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primarycolor/10">
                <i className={`icon icon-${card.iconName} text-[18px] text-primarycolor`} />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-semibold text-secondaryColor">
                  {card.label}
                  {card.phase2 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      Phase 2
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-xs text-gray-500">{card.description}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    ))}
  </div>
);

export default SettingsHubPage;
