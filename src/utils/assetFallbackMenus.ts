import { SIDEBAR_MENU_POSITION } from '@tulipstechnologies/common';
import type { ISidebarActiveMatchGroup } from '@tulipstechnologies/common';
import type { ISidebarMenuItem } from '@tulipstechnologies/common/dist/interface/ISidebarMenu';

import {
  IMenuItem,
  ASSET_MENU_ITEMS,
} from '@/components/Layout/DashboardSidebar/DashboardSidebarData';
import { BASE_PATH } from '@/utils/constants';

/** Prefix internal links with the module basePath to match the menu-API convention. */
const withModulePrefix = (
  url: string | undefined,
  isExternal?: boolean
): string => {
  if (!url) return '';
  if (isExternal) return url;
  return url.startsWith(BASE_PATH)
    ? url
    : `${BASE_PATH}${url.startsWith('/') ? url : `/${url}`}`;
};

/** Converts a local asset menu item into the common `ISidebarMenuItem` shape. */
const toSidebarMenuItem = (
  item: IMenuItem,
  index: number
): ISidebarMenuItem => ({
  id: item.id,
  moduleId: 0,
  parentMenuId: item.parentId ?? 0,
  name: item.label,
  displayName: item.label,
  iconName: item.iconName,
  iconSizeClass: item.iconSizeClass,
  url: withModulePrefix(item.url, item.isExternal),
  isExternal: !!item.isExternal,
  displayOrder: item.displayOrder ?? index,
  fixed: false,
  position: SIDEBAR_MENU_POSITION.TOP,
  active: true,
  permissions: '',
  subMenus: (item.subMenu ?? []).map(toSidebarMenuItem),
});

/**
 * Static fallback menus (converted from `ASSET_MENU_ITEMS`) used by the common
 * DashboardSidebar/Header when the dynamic menu API returns no data.
 */
export const ASSET_FALLBACK_MENUS: ISidebarMenuItem[] =
  ASSET_MENU_ITEMS.map(toSidebarMenuItem);

/**
 * The shared sidebar has no `matchUrls`; it collapses sub-routes onto a parent
 * via `activeMatchGroups`. This derives those groups from the same
 * `ASSET_MENU_ITEMS.matchUrls` the local sidebar used, so the module's
 * hub-navigation model keeps one source of truth: opening `/assets` leaves
 * "Asset Register" lit, `/transfers` leaves "Asset Operations" lit, and so on.
 *
 * Patterns are basePath-**prefixed**. `normalizePathnameForMenuMatch` in the
 * common package runs `applyModuleBasePath` and then `resolveActivePath` before
 * testing `path.startsWith(pattern)`, so by this point the pathname always
 * carries `/asset-management`. (Note the inverse convention in `staticMenus.ts`,
 * whose URLs are basePath-less.)
 *
 * Only the first matching group wins, and supplying this replaces the package's
 * HRM-wide `DEFAULT_MATCH_GROUPS` — which is what we want inside a module.
 */
export const ASSET_ACTIVE_MATCH_GROUPS: ISidebarActiveMatchGroup[] =
  ASSET_MENU_ITEMS.flatMap((item) =>
    item.url && item.matchUrls?.length
      ? [
          {
            patterns: item.matchUrls.map((url) => withModulePrefix(url)),
            mapTo: withModulePrefix(item.url),
          },
        ]
      : []
  );
