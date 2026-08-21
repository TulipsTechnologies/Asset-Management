'use client';

import ModuleHub, { IHubSection } from '@/components/Layout/ModuleHub';
import { Permission } from '@/enum/permissions';
import { useUserPermissions } from '@/hooks/useUserPermissions';

/**
 * Settings hub — the same card-grid design every parent menu uses (ModuleHub).
 * Cards for future areas carry the amber Phase 2 badge and route to /coming-soon.
 */
const SECTIONS: IHubSection[] = [
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
        hidden: true,
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
      {
        label: 'Asset Conditions',
        description:
          'The condition scale recorded at registration, issue, return, transfer and audit',
        iconName: 'dials',
        url: '/asset-conditions',
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

/** Shown only to holders of ManageSystemTest — mirrors the backend section fence. */
const SYSTEM_TEST_SECTION: IHubSection = {
  heading: 'System Test & Demo',
  cards: [
    {
      label: 'System Test & Demo',
      description: 'Health checks, deterministic regression runs, demo environments and run reports',
      iconName: 'clipboard',
      url: '/system-test',
    },
  ],
};

const SettingsHubPage = () => {
  const { can } = useUserPermissions();
  const sections = can(Permission.ManageSystemTest)
    ? [...SECTIONS, SYSTEM_TEST_SECTION]
    : SECTIONS;

  return (
    <ModuleHub
      title="Settings"
      description="Manage the configuration used across the register, custody and accounting."
      sections={sections}
    />
  );
};

export default SettingsHubPage;
