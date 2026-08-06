'use client';

import ModuleHub, { IHubSection } from '@/components/Layout/ModuleHub';
import SystemTestGate from '@/components/SystemTest/SystemTestGate';

/**
 * System Test & Demo hub — five fixed CAPABILITY cards (§12.14). The MODULE dimension
 * lives inside each page, rendered from GET /api/SystemTest/modules; a future backend
 * module needs zero edits here.
 */
const SECTIONS: IHubSection[] = [
  {
    cards: [
      {
        label: 'Health Check',
        description: 'Read-only diagnosis of the current company, findings grouped by module and severity',
        iconName: 'clipboard',
        url: '/system-test/health',
      },
      {
        label: 'Regression',
        description: 'Deterministic scenarios in the registered test company under a fixed clock',
        iconName: 'redo',
        url: '/system-test/regression',
      },
      {
        label: 'Demo Data',
        description: 'Provision the demo environment and load a realistic demo register',
        iconName: 'modules',
        url: '/system-test/demo',
      },
      {
        label: 'Reports',
        description: 'Every past run with its items, exportable as JSON, Excel and PDF',
        iconName: 'calculator',
        url: '/system-test/reports',
      },
      {
        label: 'Settings',
        description: 'Change the system test PIN and review the registered companies',
        iconName: 'id',
        url: '/system-test/settings',
      },
    ],
  },
];

const SystemTestHubPage = () => (
  <SystemTestGate>
    <ModuleHub
      title="System Test & Demo"
      description="Health checks, deterministic regression runs, demo environments and their reports."
      sections={SECTIONS}
    />
  </SystemTestGate>
);

export default SystemTestHubPage;
