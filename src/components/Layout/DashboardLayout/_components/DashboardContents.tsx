'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import DashboardSidebar from '../../DashboardSidebar/DashboardSidebar';
import Header from '../../Header/Header';
import { useDashbordCtx } from '../Contexts/DashboardContext';
import { useAppSelector } from '@/store';

const DashboardContents = ({ children }: { children: ReactNode }) => {
  const { isMobileMenuOpen, setIsMobileMenuOpen } = useDashbordCtx();
  const { token } = useAppSelector((state) => state.auth);
  const pathname = usePathname();

  // Close the off-canvas drawer whenever navigation happens.
  useEffect(() => {
    setIsMobileMenuOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <div className="flex justify-between items-start p-2 sm:p-3 bg-[#F7FCDC] h-screen">
      {/* Mobile drawer backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 lg:hidden transition-opacity duration-300 ${
          isMobileMenuOpen
            ? 'opacity-100'
            : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
        aria-hidden="true"
      />
      {/* Sidebar: off-canvas drawer below lg, static column at lg+ */}
      <div
        className={`fixed inset-y-0 left-0 z-50 py-2 pl-2 transition-transform duration-300 ease-in-out lg:static lg:z-auto lg:p-0 lg:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <DashboardSidebar />
      </div>
      <div className="flex-1 min-w-0 rounded-xl overflow-hidden h-[calc(100vh-16px)] sm:h-[calc(100vh-24px)] bg-white transition-all duration-300 ease-in-out">
        {token && <Header />}
        <div className="h-[calc(100vh-75px)] sm:h-[calc(100vh-83px)] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

export default DashboardContents;
