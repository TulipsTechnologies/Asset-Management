'use client';
import Image from 'next/image';
import Logo from '../../../../public/logo.svg';
import LogoFlower from '../../../../public/logo-flower.svg';
import Link from 'next/link';
import { Fragment, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import C from './DashboardSidebar.module.scss';

import SidebarItem from './SidebarItem';
import { IMenuItem, ASSET_MENU_ITEMS } from './DashboardSidebarData';
import { useDashbordCtx } from '../DashboardLayout/Contexts/DashboardContext';

const DashboardSidebar = () => {
  const { isMenuExtended, isMobileMenuOpen } = useDashbordCtx();
  // Inside the mobile off-canvas drawer the sidebar is always fully extended.
  const extended = isMenuExtended || isMobileMenuOpen;
  const pathname = usePathname();
  const router = useRouter();
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  // Every submenu URL (e.g. /vehicles/types, /maintenance/types) — used so a
  // top-level item never claims a Settings child route as its own.
  const submenuUrls = ASSET_MENU_ITEMS.flatMap(
    (item) => item.subMenu ?? []
  ).flatMap((sub) => (sub.url ? [sub.url] : []));

  const matchesPath = (url: string): boolean =>
    pathname === url || pathname.startsWith(url + '/');

  const isItemActive = (item: IMenuItem): boolean => {
    if (item.url) {
      if (!matchesPath(item.url)) return false;
      const claimedBySubmenu = submenuUrls.some(
        (url) => url !== item.url && url.startsWith(item.url!) && matchesPath(url)
      );
      return !claimedBySubmenu;
    }
    return (item.subMenu ?? []).some((sub) => isItemActive(sub));
  };

  // -1 = user explicitly collapsed everything; null = default (active group auto-expands)
  const handleItemClick = (item: IMenuItem, isOpen: boolean) => {
    if (item.subMenu && item.subMenu.length > 0) {
      setOpenMenuId(isOpen ? -1 : item.id);
    } else if (item.url) {
      router.push(item.url);
    }
  };

  return (
    <div
      className={`flex-none ${
        extended ? 'w-[290px]' : 'w-[62px]'
      } lg:mr-3 rounded-xl bg-white h-[calc(100vh-16px)] lg:h-[calc(100vh-24px)] overflow-x-hidden overflow-y-auto transition-all duration-300 ease-in-out`}
    >
      <div
        className={`flex items-center ${
          extended ? 'px-5' : 'justify-center px-2'
        } h-[59px] border-b border-gray-100`}
      >
        <Link href="/dashboard" className="flex items-center">
          <Image
            alt="TulipsHRM"
            src={extended ? Logo : LogoFlower}
            className={extended ? 'max-h-[38px] w-auto' : 'h-8 w-8'}
            priority
          />
        </Link>
      </div>

      <nav className="py-2">
        {ASSET_MENU_ITEMS.map((item) => {
          const active = isItemActive(item);
          const open = openMenuId === item.id || (openMenuId === null && active);
          return (
            <Fragment key={item.id}>
              <div
                className={`${C.hoverItem} ${
                  active && !item.subMenu ? C.active : ''
                } flex justify-between items-center cursor-pointer ${
                  extended ? 'px-5' : 'justify-center px-0'
                } py-2.5`}
                onClick={() => handleItemClick(item, open)}
              >
                <SidebarItem
                  item={item}
                  menuExtended={extended}
                  isActive={open}
                />
              </div>
              {extended &&
                open &&
                item.subMenu &&
                item.subMenu.map((sub) => (
                  <div
                    key={sub.id}
                    className={`${C.subItem} ${
                      isItemActive(sub) ? C.submenuActive : ''
                    } cursor-pointer`}
                    onClick={() => sub.url && router.push(sub.url)}
                  >
                    <SidebarItem
                      item={sub}
                      menuExtended={extended}
                      isChild
                    />
                  </div>
                ))}
            </Fragment>
          );
        })}
      </nav>
    </div>
  );
};

export default DashboardSidebar;
