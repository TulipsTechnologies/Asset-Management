'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDashbordCtx } from '../DashboardLayout/Contexts/DashboardContext';
import { useAuth } from '@/contexts/AuthContext';
import { getInitials } from '@/utils/helpers';
import { fetchNotifications } from '@/services/notification.service';

/**
 * Local header for the Asset Management module. The employee module uses the
 * Header from @tulipstechnologies/common, but that component is wired to
 * HRM-monolith endpoints (notices, quick actions, company switcher); this
 * module keeps a lean header until those concerns are ported.
 */
const Header = () => {
  const { isMenuExtended, toggleMenu, setIsMobileMenuOpen } = useDashbordCtx();
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  // One-shot unread count from the notification inbox (no polling).
  const appUserId = user?.userId ? String(user.userId) : '';
  useEffect(() => {
    if (!appUserId) return;
    let cancelled = false;
    fetchNotifications(appUserId, { pageNumber: 1, pageSize: 50 })
      .then((res) => {
        if (cancelled) return;
        const items = res?.data ?? [];
        setUnreadCount(items.filter((item) => !item.readDate).length);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [appUserId]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <header className="flex items-center justify-between gap-2 h-[59px] px-3 sm:px-4 border-b border-gray-100 bg-white">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* < lg: opens the off-canvas sidebar drawer */}
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex lg:hidden items-center justify-center w-10 h-10 shrink-0 rounded-lg hover:bg-hoverColor transition-colors"
        >
          <i className="icon icon-menu text-[14px] text-secondaryColor"></i>
        </button>
        {/* lg+: collapses/expands the static sidebar */}
        <button
          type="button"
          aria-label={isMenuExtended ? 'Collapse menu' : 'Expand menu'}
          onClick={() => toggleMenu()}
          className="hidden lg:flex items-center justify-center w-9 h-9 shrink-0 rounded-lg hover:bg-hoverColor transition-colors"
        >
          <i className="icon icon-menu text-[14px] text-secondaryColor"></i>
        </button>
        <span className="text-sm sm:text-base font-semibold text-secondaryColor truncate">
          Asset Management
        </span>

      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <button
          type="button"
          aria-label="Alerts"
          onClick={() => router.push('/alerts')}
          className="relative flex items-center justify-center w-9 h-9 shrink-0 rounded-lg hover:bg-hoverColor transition-colors"
        >
          <i className="icon icon-bell text-[16px] text-secondaryColor"></i>
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-primarycolor text-white text-[10px] font-medium leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

      <div className="relative" ref={profileRef}>
        <button
          type="button"
          onClick={() => setProfileOpen((open) => !open)}
          className="flex items-center gap-2"
        >
          <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primarycolor text-white text-sm font-medium">
            {getInitials(user?.fullName) || <i className="icon icon-user"></i>}
          </span>
          {user?.fullName && (
            <span className="text-sm text-secondaryColor hidden md:inline">
              {user.fullName}
            </span>
          )}
          <i className="icon icon-down text-[6px] text-gray-400"></i>
        </button>

        {profileOpen && (
          <div className="absolute right-0 top-11 w-48 bg-white border border-gray-100 rounded-lg shadow-lg py-1 z-50">
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-sm font-medium text-secondaryColor truncate">
                {user?.fullName || user?.userName}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-hoverColor"
            >
              <i className="icon icon-signout text-[13px] text-primarycolor"></i>
              <span>Sign out</span>
            </button>
          </div>
        )}
      </div>
      </div>
    </header>
  );
};

export default Header;
