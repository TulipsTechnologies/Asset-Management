'use client';

import ModuleHub, { IHubSection } from '@/components/Layout/ModuleHub';

/** What the register is made of: the items, how they are classified, who holds them. */
const SECTIONS: IHubSection[] = [
  {
    cards: [
      {
        label: 'Assets',
        description: 'The item-level register — register, edit, retire and track every asset',
        iconName: 'briefcase',
        url: '/assets',
      },
      {
        label: 'Categories',
        description: 'Category tree (up to 3 levels) with per-category depreciation defaults',
        iconName: 'modules',
        url: '/asset-categories',
      },
      {
        label: 'Custodians',
        description: 'Who currently holds company assets — synced from TulipsHRM',
        iconName: 'users',
        url: '/employees',
      },
    ],
  },
];

const AssetRegisterHubPage = () => (
  <ModuleHub
    title="Asset Register"
    description="The record of what the company owns, how it is classified and who can hold it."
    sections={SECTIONS}
  />
);

export default AssetRegisterHubPage;
