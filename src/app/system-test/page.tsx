'use client';

import ModuleHub, { IHubCard, IHubSection } from '@/components/Layout/ModuleHub';
import SystemTestGate from '@/components/SystemTest/SystemTestGate';
import { Permission } from '@/enum/permissions';
import { useUserPermissions } from '@/hooks/useUserPermissions';

/**
 * System Test & Demo hub — fixed CAPABILITY cards (§12.14). The MODULE dimension
 * lives inside each page, rendered from GET /api/SystemTest/modules; a future backend
 * module needs zero edits here.
 *
 * Visual Regression is the one card with its own permission (visual design §5):
 * everyone here holds ManageSystemTest, but that does NOT imply ViewVisualRegression —
 * the card hides rather than lead to a page whose every call would be refused.
 */
const HubContent = () => {
  const { can } = useUserPermissions();

  const cards: IHubCard[] = [
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
    ...(can(Permission.ViewVisualRegression)
      ? [
          {
            label: 'Visual Regression',
            description:
              'Screenshot diffs against approved baselines — review differences, approve baselines, manage exceptions',
            iconName: 'eye',
            url: '/system-test/visual',
          },
        ]
      : []),
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
  ];

  const sections: IHubSection[] = [{ cards }];

  return (
    <ModuleHub
      title="System Test & Demo"
      description="Health checks, deterministic regression runs, demo environments, visual regression and their reports."
      sections={sections}
    />
  );
};

const SystemTestHubPage = () => (
  <SystemTestGate>
    <HubContent />
  </SystemTestGate>
);

export default SystemTestHubPage;
