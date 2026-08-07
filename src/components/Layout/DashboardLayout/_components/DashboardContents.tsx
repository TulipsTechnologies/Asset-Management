'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useDashbordCtx } from '@tulipstechnologies/common/dist/contexts/DashboardContext';
import {
  DashboardSidebar,
  Header,
  LoadingSvg,
  MaintenanceMode,
  useMaintenanceMode,
  useSidebarMenus,
} from '@tulipstechnologies/common';

import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Providers/ToastProvider';
import { useAppDispatch, useAppSelector } from '@/store';
import { setAdminView } from '@/store/slice/AuthSlice';
import { getBaseUrl, getMenusApiBaseUrl } from '@/utils/constants';
import { resolveSidebarActivePath } from '@/utils/sidebarActivePath';
import {
  ASSET_ACTIVE_MATCH_GROUPS,
  ASSET_FALLBACK_MENUS,
} from '@/utils/assetFallbackMenus';
import { staticMenus } from '@/utils/staticMenus';
import { headerStaticMenus } from '@/utils/headerStaticMenus';
import Logo from '../../../../../public/logo.svg';

const DashboardContents = ({ children }: { children: ReactNode }) => {
  const { isMenuExtended, setIsMenuExtended } = useDashbordCtx();
  const { checkMainenanceLoading, isMaintenanceMode } = useMaintenanceMode();
  // `hubPermissions` — not `userPermissions`. The shared chrome speaks the HRM
  // hub's permission id space (AdminMode = 67); this module's own ids mean
  // something entirely different. See AuthContext for the full note.
  const { token, hubPermissions, logout } = useAuth();
  const { addToast } = useToast();
  const pathname = usePathname();
  const dispatch = useAppDispatch();

  const { currentUser, adminView, profileImage, companyLogo } = useAppSelector(
    (state) => state.auth
  );

  const baseUrl = getBaseUrl();

  const { userMenuList, adminMenuList } = useSidebarMenus({
    token,
    userPermissions: hubPermissions,
    adminView,
    menusApiBaseUrl: getMenusApiBaseUrl(),
  });

  // Prefer the dynamic list for the active view; fall back to the static asset
  // menus whenever the API returns nothing. The module has no separate admin
  // menu set, so both views resolve to the same list.
  const dynamicMenus = adminView ? adminMenuList : userMenuList;
  const menus = dynamicMenus?.length ? dynamicMenus : ASSET_FALLBACK_MENUS;

  return (
    <div className="flex justify-between items-start md:p-3 bg-[#F7FCDC] h-screen">
      <DashboardSidebar
        logo={Logo}
        companyLogo={companyLogo}
        currentUser={currentUser}
        adminView={adminView}
        onAdminViewChange={(next) => dispatch(setAdminView(next))}
        userPermissions={hubPermissions}
        userMenuList={menus}
        adminMenuList={menus}
        baseUrl={baseUrl}
        urlPrefix="asset-management"
        resolveActivePath={resolveSidebarActivePath}
        activeMatchGroups={ASSET_ACTIVE_MATCH_GROUPS}
        staticMenus={staticMenus}
      />
      <div
        className={`w-full md:flex-none ${
          isMenuExtended
            ? 'md:w-[calc(100vw-322px)]'
            : 'md:w-[calc(100vw-86px)]'
        } rounded-none md:rounded-xl overflow-hidden h-screen md:h-[calc(100vh-24px)] bg-white transition-all duration-300 ease-in-out`}
      >
        {token && (
          <Header
            addToast={addToast}
            staticMenus={headerStaticMenus}
            token={token}
            languages={[]}
            imageFiles={{ EnFlag: '', NpFlag: '', Logo: '', LogoFlower: '' }}
            logout={logout}
            userPermissions={hubPermissions}
            isMenuExtended={isMenuExtended}
            setIsMenuExtended={setIsMenuExtended}
            adminView={adminView}
            setAdminView={() => dispatch(setAdminView(!adminView))}
            currentUser={currentUser}
            profileImage={profileImage}
            urlPrefix="asset-management"
            baseUrl={baseUrl}
            refetchNotification={false}
            onNotificationMarkAsRead={() => {}}
            onNotificationMarkAllAsRead={() => {}}
            onNotificationDelete={() => {}}
            userMenuList={menus}
            adminMenuList={menus}
            resolveActivePath={resolveSidebarActivePath}
            activeMatchGroups={ASSET_ACTIVE_MATCH_GROUPS}
          />
        )}
        <div
          className={`h-[calc(100vh-60px)] md:h-[calc(100vh-83px)] ${
            pathname === '/404' ? '' : 'overflow-y-auto overflow-x-hidden'
          }`}
        >
          {checkMainenanceLoading ? (
            <div className="flex justify-center items-center h-full">
              <LoadingSvg />
            </div>
          ) : isMaintenanceMode ? (
            <MaintenanceMode />
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardContents;
