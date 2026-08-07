'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import DashboardLayout from './DashboardLayout/DashboardLayout';

const SiteLayout = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();

  // The localhost token-paste screen renders standalone — there is no session
  // yet, so the dashboard chrome (header, sidebar) has nothing to show.
  if (pathname.includes('/dev-auth')) {
    return <>{children}</>;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
};

export default SiteLayout;
