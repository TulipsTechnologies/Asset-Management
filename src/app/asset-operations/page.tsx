'use client';

import ModuleHub, { IHubSection } from '@/components/Layout/ModuleHub';

/** Custody in motion: issuing, moving, taking back and counting what is out there. */
const SECTIONS: IHubSection[] = [
  {
    cards: [
      {
        label: 'Assignments',
        description: 'Issue assets to custodians and see who currently holds what',
        iconName: 'clipboard',
        url: '/assignments',
      },
      {
        label: 'Transfers',
        description: 'Move assets between custodians and locations, with approval and receipt',
        iconName: 'move',
        url: '/transfers',
      },
      {
        label: 'Returns',
        description: 'Take assets back, record their condition and open recovery cases',
        iconName: 'redo',
        url: '/returns',
      },
      {
        label: 'Physical Verification',
        description: 'Audit campaigns that reconcile the register against what is actually there',
        iconName: 'checked',
        url: '/physical-verification',
      },
    ],
  },
];

const AssetOperationsHubPage = () => (
  <ModuleHub
    title="Asset Operations"
    description="Day-to-day custody: who receives an asset, where it moves, and when it comes back."
    sections={SECTIONS}
  />
);

export default AssetOperationsHubPage;
