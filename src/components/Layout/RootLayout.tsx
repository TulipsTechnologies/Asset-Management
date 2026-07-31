'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import DashboardLayout from './DashboardLayout/DashboardLayout';

const SiteLayout = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();

  if (pathname.includes('/signin')) {
    return <>{children}</>;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
};

export default SiteLayout;
