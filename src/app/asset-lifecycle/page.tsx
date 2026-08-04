'use client';

import ModuleHub, { IHubSection } from '@/components/Layout/ModuleHub';

/** From in-service to written off: upkeep, book value, and the way out. */
const SECTIONS: IHubSection[] = [
  {
    cards: [
      {
        label: 'Maintenance',
        description: 'Breakdown reports and work orders, with the holds they place on an asset',
        iconName: 'setting',
        url: '/maintenance',
      },
      {
        label: 'Depreciation',
        description: 'Asset books, period runs and the journal outbox',
        iconName: 'trend',
        url: '/depreciation',
      },
      {
        label: 'Disposal',
        description: 'Disposal requests through approval to execution and derecognition',
        iconName: 'trash',
        url: '/disposal',
      },
    ],
  },
];

const AssetLifecycleHubPage = () => (
  <ModuleHub
    title="Asset Lifecycle"
    description="An asset's life after registration: keeping it serviceable, carrying its value, and retiring it."
    sections={SECTIONS}
  />
);

export default AssetLifecycleHubPage;
