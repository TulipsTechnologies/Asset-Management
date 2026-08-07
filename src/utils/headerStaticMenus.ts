import { IStaticMenu, staticMenus } from './staticMenus';

/**
 * Header-only page-title fallbacks.
 *
 * `Header` in `@tulipstechnologies/common` resolves the title by matching the
 * pathname against the array it is handed; a route with no entry renders BLANK.
 *
 * These live here rather than in `staticMenus.ts` because that array is ALSO
 * consumed by `DashboardSidebar`, whose admin-view effect does
 * `matchedStaticMenu.adminView ?? true` — registering a route there force-promotes
 * admin view for `AdminMode` users. None of the routes below belong to a sidebar
 * entry (they are utility screens, or reachable only as cards on the Settings
 * hub), so keeping them header-only leaves sidebar highlighting exactly as it
 * was before the shared chrome landed.
 */
export const headerOnlyStaticMenus: IStaticMenu[] = [
  // Utility / unguarded screens
  { label: 'Access Denied', iconName: 'icon-alert', iconSizeClass: 'text-lg', url: '/403' },
  { label: 'Coming Soon', iconName: 'icon-hourglass', iconSizeClass: 'text-lg', url: '/coming-soon' },
  { label: 'Developer Sign In', iconName: 'icon-users', iconSizeClass: 'text-lg', url: '/dev-auth' },

  // Settings-hub cards with no sidebar entry of their own
  { label: 'Master Data Reset', iconName: 'icon-setting', iconSizeClass: 'text-lg', url: '/master-data-reset' },
  { label: 'System Test & Demo', iconName: 'icon-clipboard', iconSizeClass: 'text-lg', url: '/system-test' },
  { label: 'System Test — Demo', iconName: 'icon-clipboard', iconSizeClass: 'text-lg', url: '/system-test/demo' },
  { label: 'System Test — Health', iconName: 'icon-clipboard', iconSizeClass: 'text-lg', url: '/system-test/health' },
  { label: 'System Test — Regression', iconName: 'icon-clipboard', iconSizeClass: 'text-lg', url: '/system-test/regression' },
  { label: 'System Test — Reports', iconName: 'icon-clipboard', iconSizeClass: 'text-lg', url: '/system-test/reports' },
  { label: 'System Test — Settings', iconName: 'icon-clipboard', iconSizeClass: 'text-lg', url: '/system-test/settings' },
  { label: 'System Test — Visual', iconName: 'icon-clipboard', iconSizeClass: 'text-lg', url: '/system-test/visual' },
];

/**
 * The array to pass to `Header`. `DashboardSidebar` must keep receiving the plain
 * `staticMenus` export so its admin-view behaviour stays as described above.
 */
export const headerStaticMenus: IStaticMenu[] = [
  ...staticMenus,
  ...headerOnlyStaticMenus,
];
