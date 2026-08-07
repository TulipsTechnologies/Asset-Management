import type { SidebarActivePathContext } from '@tulipstechnologies/common';

import { BASE_PATH } from '@/utils/constants';

/**
 * Normalizes a pathname for sidebar active-menu matching.
 * `urlPrefix="asset-management"` already applies the module basePath upstream
 * via `applyModuleBasePath`; this remains an idempotent safety net that prepends
 * `/asset-management` only when it is still missing.
 */
export const resolveSidebarActivePath = (
  pathname: string,
  _ctx: SidebarActivePathContext
): string =>
  pathname.startsWith(BASE_PATH)
    ? pathname
    : `${BASE_PATH}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
