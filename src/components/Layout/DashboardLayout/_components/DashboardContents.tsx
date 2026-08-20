'use client';

import { ReactNode, useRef } from 'react';
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
import { getMenusApiBaseUrl } from '@/utils/constants';
import { resolveSidebarActivePath } from '@/utils/sidebarActivePath';
import {
  ASSET_ACTIVE_MATCH_GROUPS,
  ASSET_FALLBACK_MENUS,
} from '@/utils/assetFallbackMenus';
import { staticMenus } from '@/utils/staticMenus';
import { headerStaticMenus } from '@/utils/headerStaticMenus';
import ActiveCompanyBadge from '../../ActiveCompanyBadge';
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
  const headerHostRef = useRef<HTMLDivElement>(null);

  const { currentUser, adminView, profileImage, companyLogo } = useAppSelector(
    (state) => state.auth
  );

  /**
   * Where the shared chrome's menu links point.
   *
   * This is the ORIGIN SERVING THESE PAGES, not the hub. The sidebar composes
   * `baseUrl + item.url`, and its items are this module's own routes, so the
   * hub base sent every click to the hub — on a developer machine that meant
   * leaving localhost for the WebDev sign-in on the first menu click.
   *
   * Deployed, the module and the hub share an origin, so this is the same
   * string the hub base would have produced; only localhost, where they
   * genuinely differ, changes behaviour. The hub base keeps its own jobs
   * (sign-in, sign-out, the menus API) — mixing the two is what broke this.
   */
  const baseUrl = typeof window === 'undefined' ? '' : window.location.origin;

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
    <div className="flex justify-between items-start md:p-3 bg-[#F7FCDC] h-dvh">
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
        } rounded-none md:rounded-xl overflow-hidden h-dvh md:h-[calc(100dvh-24px)] bg-white transition-all duration-300 ease-in-out`}
      >
        {/* Anchor for the tenant badge, which portals into the shared Header's own row: that row
            is this element's next sibling. Holding a handle this way rather than matching the
            shared component's class names keeps the badge working when its styling changes. */}
        <div ref={headerHostRef} className="hidden" aria-hidden />
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
        {token && <ActiveCompanyBadge headerHost={headerHostRef} />}
        <div
          className={`h-[calc(100dvh-60px)] md:h-[calc(100dvh-83px)] ${
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
