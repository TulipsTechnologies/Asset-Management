'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { recordVisit } from '@/utils/navHistory';

/**
 * Records every route the operator lands on, so Back can return them to it.
 *
 * Mounted once inside the layout that wraps all 37 routes rather than per page: a recorder a
 * page has to remember to include is a recorder that is missing from the page where somebody
 * needed it. Renders nothing.
 *
 * The search params are part of what gets recorded — a list reached from a dashboard tile is
 * `/assets?lifecycleStatus=2`, and coming back to it unfiltered would be coming back to a
 * different page than the one that was left.
 */
const NavHistoryRecorder = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    const query = searchParams?.toString();
    recordVisit(query ? `${pathname}?${query}` : pathname);
  }, [pathname, searchParams]);

  return null;
};

export default NavHistoryRecorder;
