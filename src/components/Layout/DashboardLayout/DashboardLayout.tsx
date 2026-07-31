'use client';
import { ReactNode } from 'react';
import { DashboardCtxProvider } from './Contexts/DashboardContext';
import DashboardContents from './_components/DashboardContents';
import { usePathname } from 'next/navigation';

const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();

  // Driver GPS pages are public (link-token auth) and render without the
  // admin shell — a driver on a phone has no login or sidebar permissions.
  if (pathname === '/404' || pathname.startsWith('/transport/tracking')) {
    return <>{children}</>;
  }
  return (
    <DashboardCtxProvider>
      <DashboardContents>{children}</DashboardContents>
    </DashboardCtxProvider>
  );
};

export default DashboardLayout;
