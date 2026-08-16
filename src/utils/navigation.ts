/**
 * Where "back" goes from any page in the module.
 *
 * The sidebar's entries are hubs — card grids that lead to the real pages — so arriving
 * anywhere useful takes two steps, and returning needs to retrace them. This resolves that
 * one step at a time: a detail page goes back to its list, and a list goes back to the hub
 * that offered it.
 *
 * Categories sit under BOTH Asset Register and Settings, so the hub cannot be derived from
 * the path alone. The last hub actually visited is remembered and preferred; the static
 * mapping is only the fallback for someone who arrived by deep link or reload.
 */

export interface INavTarget {
  url: string;
  label: string;
}

interface IHub extends INavTarget {
  /** Leaf routes this hub offers, as path prefixes. */
  children: INavTarget[];
}

/** Mirrors the cards on the four hub pages. */
const HUBS: IHub[] = [
  {
    url: '/asset-register',
    label: 'Asset Register',
    children: [
      { url: '/assets', label: 'Assets' },
      { url: '/asset-categories', label: 'Categories' },
      { url: '/employees', label: 'Employees' },
    ],
  },
  {
    url: '/asset-operations',
    label: 'Asset Operations',
    children: [
      { url: '/assignments', label: 'Assignments' },
      { url: '/transfers', label: 'Transfers' },
      { url: '/returns', label: 'Returns' },
      { url: '/physical-verification', label: 'Physical Verification' },
    ],
  },
  {
    url: '/asset-lifecycle',
    label: 'Asset Lifecycle',
    children: [
      { url: '/maintenance', label: 'Maintenance' },
      { url: '/depreciation', label: 'Depreciation' },
      { url: '/disposal', label: 'Disposal' },
    ],
  },
  {
    url: '/configuration',
    label: 'Settings',
    children: [
      { url: '/asset-categories', label: 'Categories' },
      { url: '/asset-code-format', label: 'Asset Code Format' },
      { url: '/asset-conditions', label: 'Asset Conditions' },
      { url: '/locations', label: 'Locations' },
      { url: '/vendors', label: 'Vendors' },
      { url: '/configuration/depreciation', label: 'Depreciation Setup' },
      { url: '/master-data-reset', label: 'Master Data Reset' },
      { url: '/system-test', label: 'System Test & Demo' },
    ],
  },
];

/** Top-level destinations: the sidebar reaches them directly, so they have no "back". */
const ROOTS = new Set([
  '/dashboard',
  '/reports',
  ...HUBS.map((hub) => hub.url),
]);

export const HUB_URLS = HUBS.map((hub) => hub.url);

const isWithin = (pathname: string, route: string) =>
  pathname === route || pathname.startsWith(`${route}/`);

/**
 * One step back from `pathname`, or null at the top.
 *
 * `lastHubUrl` is the hub the operator most recently passed through; it decides the answer
 * only where a leaf genuinely belongs to more than one.
 */
export const resolveBackTarget = (
  pathname: string,
  lastHubUrl?: string | null
): INavTarget | null => {
  if (!pathname || ROOTS.has(pathname)) return null;

  // Deepest matching leaf wins, so /configuration/depreciation is not mistaken for the
  // Settings hub it sits under.
  let leaf: INavTarget | null = null;
  let owners: IHub[] = [];

  for (const hub of HUBS) {
    for (const child of hub.children) {
      if (!isWithin(pathname, child.url)) continue;
      if (!leaf || child.url.length > leaf.url.length) {
        leaf = child;
        owners = [hub];
      } else if (child.url === leaf.url) {
        owners.push(hub);
      }
    }
  }

  if (!leaf) return null;

  // Below the leaf (an asset's page, a campaign's page): step up to the list first.
  if (pathname !== leaf.url) return leaf;

  // At the leaf itself: back to the hub that led here.
  const owner =
    owners.find((hub) => hub.url === lastHubUrl) ?? owners[0] ?? null;
  return owner ? { url: owner.url, label: owner.label } : null;
};

/** Remembered across a session so a reload does not lose which hub was used. */
export const LAST_HUB_STORAGE_KEY = 'assetManagement.lastHub';
