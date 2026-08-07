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

import { parseJwt } from '@/services/auth.service';
import {
  clearActiveCompanyId,
  clearAssetToken,
  ensureAssetToken,
  persistActiveCompanyIdIfAbsent,
} from '@/services/assetToken';
import { requestApi } from '@/services/httpService';
import { IUser } from '@/interface/IUser';
import { fetchUserPermissionsList } from '@/utils/helpers';
import { useAppDispatch } from '@/store';
import { setAuthToken, setCurrentUser } from '@/store/slice/AuthSlice';
import { getBaseUrl, isDevAuthBypass } from '@/utils/constants';

interface AuthContextProps {
  user: IUser | null;
  token: string | null;
  logout: () => void;
  userPermissions: number[];
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [user, setUser] = useState<IUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<number[]>([]);
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

      const resolvedUser = buildUserFromToken(cookieToken, cookieUser);
      setUser(resolvedUser);
      dispatch(setCurrentUser(resolvedUser));

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

      setBootstrapping(false);
    };

    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = () => {
    setUser(null);
    setToken(null);
    setUserPermissions([]);
    dispatch(setAuthToken(null));
    dispatch(setCurrentUser(null));
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
