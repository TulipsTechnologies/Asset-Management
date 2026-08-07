'use client';

import {
  createContext,
  useContext,
  useState,
  FC,
  ReactNode,
  useEffect,
} from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { useCompanyLogo } from '@tulipstechnologies/common';
import {
  getCurrentUser,
  fetchEmployeeProfileImage,
} from '@tulipstechnologies/common/dist/services/auth.service';
import { resolveAdminView } from '@tulipstechnologies/common/dist/utils/adminViewStorage';
import type { IAdminUserData } from '@tulipstechnologies/common/dist/interface/IAdminUser';

import { parseJwt } from '@/services/auth.service';
import {
  clearActiveCompanyId,
  clearAssetToken,
  ensureAssetToken,
  persistActiveCompanyIdIfAbsent,
} from '@/services/assetToken';
import { requestApi } from '@/services/httpService';
import { IUser } from '@/interface/IUser';
import { HubPermission } from '@/enum/hubPermissions';
import { fetchUserPermissionsList } from '@/utils/helpers';
import { useAppDispatch } from '@/store';
import {
  setAuthToken,
  setCurrentUser,
  setAdminView,
  setProfileImage,
  setCompanyLogo,
} from '@/store/slice/AuthSlice';
import { getBaseUrl, isDevAuthBypass } from '@/utils/constants';

interface AuthContextProps {
  user: IUser | null;
  token: string | null;
  logout: () => void;
  /**
   * This module's permission ids, decoded from the `AssetAuthToken`. Everything
   * that gates an asset screen or action reads these.
   */
  userPermissions: number[];
  /**
   * HRM hub permission ids, decoded from the `AuthToken` cookie. Consumed only
   * by the shared `@tulipstechnologies/common` chrome (admin-view toggle, menu
   * fetch, settings menu, billing banner), which speaks the hub's id space —
   * where `AdminMode = 67` collides with nothing this module defines today but
   * means something entirely different from asset id 67. Never mix the two.
   */
  hubPermissions: number[];
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { fetchCompanyLogo, companyLogo } = useCompanyLogo();

  const [user, setUser] = useState<IUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<number[]>([]);
  const [hubPermissions, setHubPermissions] = useState<number[]>([]);
  const [bootstrapping, setBootstrapping] = useState<boolean>(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  /**
   * Build the display user from the `user` cookie when it is usable, otherwise
   * from the JWT claims. The AssetManagement JWT carries the user id as
   * "AppUserId"; the HRM hub token uses "userId".
   */
  const buildUserFromToken = (authToken: string, cookieUser?: string): IUser => {
    if (cookieUser) {
      try {
        const parsedUser = JSON.parse(cookieUser) as IUser;
        // Older cookies may carry userId 0 (claim name mismatch) — in that
        // case fall through and rebuild the user from the token claims.
        if (parsedUser.userId) {
          return parsedUser;
        }
      } catch {
        // fall through to token claims
      }
    }

    const claims = parseJwt(authToken);
    return {
      userId: claims?.userId ?? claims?.AppUserId ?? 0,
      fullName: claims?.fullName ?? claims?.username ?? '',
      email: claims?.email ?? claims?.username ?? '',
      userName: claims?.username,
    };
  };

  // Central hub sign-in/logout target shared by all modules
  // (getBaseUrl() + NEXT_PUBLIC_LOGOUT_URL).
  const redirectToHubSignin = () => {
    router.replace(
      `${getBaseUrl()}${
        process.env.NEXT_PUBLIC_LOGOUT_URL
      }?redirect=${encodeURIComponent(window.location.href)}`
    );
  };

  /**
   * Loads the full HRM hub user (name, roles, company, employee id) plus the
   * profile image and company logo, so the shared Header/Sidebar renders the
   * same way it does in the other modules. The common services resolve the hub
   * API URL and bearer token from the shared `AuthToken` cookie themselves.
   *
   * Fire-and-forget: nothing here gates the module, so a hub hiccup must not
   * delay bootstrap or block asset pages from rendering.
   */
  const loadCurrentUser = async () => {
    try {
      const res = await getCurrentUser();
      if (!res?.success || !res?.data) return;

      const adminUser = res.data as IAdminUserData;
      dispatch(setCurrentUser(adminUser));

      if (adminUser.employeeId) {
        try {
          const imgRes = await fetchEmployeeProfileImage(adminUser.employeeId);
          dispatch(setProfileImage(imgRes?.success ? imgRes.data : null));
        } catch {
          dispatch(setProfileImage(null));
        }
      }

      if (adminUser.company?.id) {
        void fetchCompanyLogo(adminUser.company.id);
      }
    } catch (error) {
      console.error('Failed to load current user', error);
    }
  };

  /**
   * Resolves the tenant every request is scoped to and stores it in the
   * `ActiveCompanyId` cookie (read by requestApi as the `x-company-id` header).
   * Company users carry their own company on the exchange payload; internal
   * users (superadmin) carry none, so we fall back to the first active company.
   */
  const resolveActiveCompanyIfAbsent = async () => {
    if (Cookies.get('ActiveCompanyId')) return;

    try {
      const res = await requestApi({
        apiEndpoint: '/Companies',
        method: 'GET',
        completeData: true,
      });
      const companies = Array.isArray(res?.data) ? res.data : [];
      const active =
        companies.find((c: { isDeleted?: boolean }) => !c?.isDeleted) ??
        companies[0];
      if (active?.id) {
        persistActiveCompanyIdIfAbsent(active.id);
      } else {
        console.warn('[tenant] no company returned', res);
      }
    } catch (err) {
      // Leave the cookie unset; writes will surface the API's tenant error.
      console.warn('[tenant] company resolution failed', err);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      const cookieToken = Cookies.get('AuthToken');
      const cookieUser = Cookies.get('user');

      // No hub session — bounce to the central sign-in. Middleware handles this
      // server-side too; this is the client-side fallback. On localhost in
      // development the middleware sends to /dev-auth instead, so skip here.
      if (!cookieToken) {
        if (!isDevAuthBypass(window.location.hostname)) {
          redirectToHubSignin();
        }
        setBootstrapping(false);
        return;
      }

      setToken(cookieToken);
      dispatch(setAuthToken(cookieToken));

      // Hub-scoped permissions, for the shared chrome only. Resolved before the
      // token exchange so the sidebar knows which view to open in.
      const resolvedHubPermissions = fetchUserPermissionsList(cookieToken);
      setHubPermissions(resolvedHubPermissions);
      dispatch(
        setAdminView(
          resolveAdminView(
            resolvedHubPermissions.includes(HubPermission.AdminMode)
          )
        )
      );

      const resolvedUser = buildUserFromToken(cookieToken, cookieUser);
      setUser(resolvedUser);

      // Exchange the HRM AuthToken for the asset-module token before any page
      // mounts and fires asset API calls.
      const { token: assetToken, companyId, error } = await ensureAssetToken(
        true
      );
      if (!assetToken) {
        const message =
          error ||
          'Could not exchange AuthToken for an AssetAuthToken. Sign in again.';
        if (isDevAuthBypass(window.location.hostname)) {
          // Surface the real failure instead of silently rendering with no
          // Authorization header (httpService only reads AssetAuthToken).
          setBootstrapError(message);
          setBootstrapping(false);
          return;
        }
        redirectToHubSignin();
        setBootstrapping(false);
        return;
      }

      // Module permissions live in the AssetAuthToken, not the hub token.
      setUserPermissions(fetchUserPermissionsList(assetToken));

      // Internal users carry no company claim, so the exchange returns none.
      if (!companyId) {
        await resolveActiveCompanyIfAbsent();
      }

      void loadCurrentUser();
      setBootstrapping(false);
    };

    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (companyLogo) {
      dispatch(setCompanyLogo(companyLogo));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyLogo]);

  const logout = () => {
    setUser(null);
    setToken(null);
    setUserPermissions([]);
    setHubPermissions([]);
    dispatch(setAuthToken(null));
    dispatch(setCurrentUser(null));
    dispatch(setProfileImage(null));
    dispatch(setCompanyLogo(null));
    Cookies.remove('AuthToken');
    Cookies.remove('user');
    clearAssetToken();
    clearActiveCompanyId();
    localStorage.clear();
    window.location.href = `${getBaseUrl()}${
      process.env.NEXT_PUBLIC_LOGOUT_URL
    }`;
  };

  const retryBootstrap = () => {
    setBootstrapError(null);
    setBootstrapping(true);
    window.location.reload();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        logout,
        userPermissions,
        hubPermissions,
      }}
    >
      {bootstrapping ? (
        <div className="flex h-screen w-full items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-primarycolor" />
        </div>
      ) : bootstrapError ? (
        <div className="flex h-screen w-full items-center justify-center bg-gray-50 p-6">
          <div className="w-full max-w-lg space-y-4 rounded-lg border border-red-200 bg-white p-6 shadow-sm">
            <h1 className="text-lg font-semibold text-gray-900">
              Authentication failed
            </h1>
            {process.env.NODE_ENV === 'development' ? (
              <>
                <p className="text-sm text-gray-600">{bootstrapError}</p>
                <p className="text-xs text-gray-500">
                  The module needs an AssetAuthToken exchanged from your HRM
                  AuthToken before any API call can succeed. Fix the cause
                  above, then retry.
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-600">
                We couldn&apos;t complete authentication. Please try again.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={retryBootstrap}
                className="rounded-md bg-primarycolor px-4 py-2 text-sm font-medium text-white"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextProps => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
