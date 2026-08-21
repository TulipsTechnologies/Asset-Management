/**
 * Static breadcrumb/title fallbacks for the shared Header/Sidebar. `usePathname()`
 * returns paths without the `/asset-management` basePath, so URLs here are
 * unprefixed to match `comparablePathname` used by the common
 * `findBestStaticMenuMatch`. (Note the inverse convention in
 * `assetFallbackMenus.ts`, whose menu URLs *are* basePath-prefixed.)
 *
 * These guarantee a page title even before the dynamic menu API resolves — a
 * route with no entry here renders a BLANK title in the shared Header.
 *
 * `:id` matches exactly ONE segment, so `/assets/:id` does not cover
 * `/assets/:id/edit`; both are listed. A `:id` entry also claims a literal
 * sibling that has no entry of its own, which is why `/assets/create` is listed
 * alongside `/assets/:id`.
 */
export interface IStaticMenu {
  label: string;
  iconName: string;
  iconSizeClass: string;
  url: string;
}

export const staticMenus: IStaticMenu[] = [
  { label: 'Dashboard', iconName: 'icon-home', iconSizeClass: 'text-lg', url: '/dashboard' },

  // Asset Register
  { label: 'Asset Register', iconName: 'icon-briefcase', iconSizeClass: 'text-lg', url: '/asset-register' },
  { label: 'Assets', iconName: 'icon-briefcase', iconSizeClass: 'text-lg', url: '/assets' },
  { label: 'Assets', iconName: 'icon-briefcase', iconSizeClass: 'text-lg', url: '/assets/create' },
  { label: 'Assets', iconName: 'icon-briefcase', iconSizeClass: 'text-lg', url: '/assets/:id' },
  { label: 'Assets', iconName: 'icon-briefcase', iconSizeClass: 'text-lg', url: '/assets/:id/edit' },
  { label: 'Asset Categories', iconName: 'icon-modules', iconSizeClass: 'text-lg', url: '/asset-categories' },
  { label: 'Custodians', iconName: 'icon-users', iconSizeClass: 'text-lg', url: '/employees' },

  // Asset Operations
  { label: 'Asset Operations', iconName: 'icon-stream', iconSizeClass: 'text-lg', url: '/asset-operations' },
  { label: 'Assignments', iconName: 'icon-clipboard', iconSizeClass: 'text-lg', url: '/assignments' },
  { label: 'Transfers', iconName: 'icon-rearrange', iconSizeClass: 'text-lg', url: '/transfers' },
  { label: 'Returns', iconName: 'icon-rearrange', iconSizeClass: 'text-lg', url: '/returns' },
  { label: 'Physical Verification', iconName: 'icon-clipboard', iconSizeClass: 'text-lg', url: '/physical-verification' },
  { label: 'Physical Verification', iconName: 'icon-clipboard', iconSizeClass: 'text-lg', url: '/physical-verification/:id' },

  // Asset Lifecycle
  { label: 'Asset Lifecycle', iconName: 'icon-hourglass', iconSizeClass: 'text-lg', url: '/asset-lifecycle' },
  { label: 'Maintenance', iconName: 'icon-setting', iconSizeClass: 'text-lg', url: '/maintenance' },
  { label: 'Depreciation', iconName: 'icon-bar-chart', iconSizeClass: 'text-lg', url: '/depreciation' },
  { label: 'Depreciation', iconName: 'icon-bar-chart', iconSizeClass: 'text-lg', url: '/depreciation/capitalize' },
  { label: 'Disposal', iconName: 'icon-alert', iconSizeClass: 'text-lg', url: '/disposal' },

  // Reports
  { label: 'Reports & Analytics', iconName: 'icon-bar-chart', iconSizeClass: 'text-lg', url: '/reports' },

  // Settings
  { label: 'Settings', iconName: 'icon-setting', iconSizeClass: 'text-lg', url: '/configuration' },
  { label: 'Depreciation Settings', iconName: 'icon-setting', iconSizeClass: 'text-lg', url: '/configuration/depreciation' },
  { label: 'Locations', iconName: 'icon-move', iconSizeClass: 'text-lg', url: '/locations' },
  { label: 'Vendors', iconName: 'icon-briefcase', iconSizeClass: 'text-lg', url: '/vendors' },
  { label: 'Asset Code Format', iconName: 'icon-documents', iconSizeClass: 'text-lg', url: '/asset-code-format' },
  { label: 'Asset Conditions', iconName: 'icon-dials', iconSizeClass: 'text-lg', url: '/asset-conditions' },
];
