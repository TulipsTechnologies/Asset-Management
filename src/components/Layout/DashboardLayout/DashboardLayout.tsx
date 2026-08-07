'use client';
import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { DashboardCtxProvider } from '@tulipstechnologies/common/dist/contexts/DashboardContext';
import { MaintenanceModeProvider } from '@tulipstechnologies/common';
import DashboardContents from './_components/DashboardContents';

const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();

  if (pathname === '/404') {
    return <>{children}</>;
  }
  // Both providers are required by the shared chrome: DashboardSidebar throws
  // without DashboardCtxProvider and calls useMaintenanceMode() on every route
  // change.
  return (
    <DashboardCtxProvider>
      <MaintenanceModeProvider>
        <DashboardContents>{children}</DashboardContents>
      </MaintenanceModeProvider>
    </DashboardCtxProvider>
  );
};

export default DashboardLayout;
