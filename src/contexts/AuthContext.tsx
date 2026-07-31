'use client';

import {
  createContext,
  useContext,
  useState,
  FC,
  ReactNode,
  useEffect,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Cookies from 'js-cookie';

import { parseJwt, signIn } from '@/services/auth.service';
import { requestApi } from '@/services/httpService';
import { IUser } from '@/interface/IUser';
import { fetchUserPermissionsList } from '@/utils/helpers';
import { useAppDispatch } from '@/store';
import { setAuthToken, setCurrentUser } from '@/store/slice/AuthSlice';
import { useErrorHandler } from '@/hooks/useErrorHandler';

interface AuthContextProps {
  user: IUser | null;
  token: string | null;
  login: (userName: string, password: string) => Promise<void>;
  setSessionData: (token: string, user: IUser) => Promise<void>;
  logout: () => void;
  userPermissions: number[];
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

const AUTH_PAGES = ['/signin'];

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const handleError = useErrorHandler();

  const [user, setUser] = useState<IUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<number[]>([]);

  useEffect(() => {
    const cookieToken = Cookies.get('AuthToken');
    const cookieUser = Cookies.get('user');

    if (!cookieToken) {
      if (!AUTH_PAGES.some((page) => pathname.includes(page))) {
        router.push('/signin?redirect=' + window.location.href);
      }
      return;
    }

    setToken(cookieToken);
    dispatch(setAuthToken(cookieToken));
    setUserPermissions(fetchUserPermissionsList(cookieToken));

    // Sessions created before tenant headers existed have no company cookie.
    if (!Cookies.get('ActiveCompanyId')) {
      void resolveActiveCompany(cookieToken);
    }

    if (cookieUser) {
      try {
        const parsedUser = JSON.parse(cookieUser) as IUser;
        // Older cookies may carry userId 0 (claim name mismatch) — in that
        // case fall through and rebuild the user from the token claims.
        if (parsedUser.userId) {
          setUser(parsedUser);
          dispatch(setCurrentUser(parsedUser));
          return;
        }
      } catch {
        // fall through to token claims
      }
    }

    const claims = parseJwt(cookieToken);
    const fallbackUser: IUser = {
      // The VehicleManagement JWT carries the user id as "AppUserId".
      userId: claims?.userId ?? claims?.AppUserId ?? 0,
      fullName: claims?.fullName ?? claims?.username ?? '',
      email: claims?.email ?? claims?.username ?? '',
      userName: claims?.username,
    };
    setUser(fallbackUser);
    dispatch(setCurrentUser(fallbackUser));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Resolves the tenant every request is scoped to and stores it in the
   * `ActiveCompanyId` cookie (read by requestApi as the `x-company-id` header).
   * Company users carry their own company on the login payload; internal users
   * (superadmin) carry none, so we fall back to the first active company.
   */
  const resolveActiveCompany = async (
    authToken: string,
    companyIdFromLogin?: string | null
  ) => {
    if (companyIdFromLogin) {
      setCookie('ActiveCompanyId', companyIdFromLogin, 30);
      return;
    }

    try {
      const res = await requestApi({
        apiEndpoint: '/Companies',
        method: 'GET',
        token: `Bearer ${authToken}`,
        completeData: true,
      });
      const companies = Array.isArray(res?.data) ? res.data : [];
      const active =
        companies.find((c: { isDeleted?: boolean }) => !c?.isDeleted) ??
        companies[0];
      if (active?.id) {
        setCookie('ActiveCompanyId', active.id, 30);
      } else {
        console.warn('[tenant] no company returned', res);
      }
    } catch (err) {
      // Leave the cookie unset; writes will surface the API's tenant error.
      console.warn('[tenant] company resolution failed', err);
    }
  };

  const setCookie = (name: string, value: string, days: number) => {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${encodeURIComponent(
      value
    )}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
  };

  const setSessionData = async (newToken: string, newUser: IUser) => {
    setUserPermissions(fetchUserPermissionsList(newToken));
    setUser(newUser);
    setToken(newToken);
    dispatch(setAuthToken(newToken));
    dispatch(setCurrentUser(newUser));

    Cookies.remove('AuthToken');
    Cookies.remove('user');
    setCookie('AuthToken', newToken, 30);
    setCookie('user', JSON.stringify(newUser), 30);

    // Every sign-in path funnels through here (AuthContext.login and the
    // sign-in page both call it), so resolve the tenant once, centrally.
    await resolveActiveCompany(newToken, newUser.companyId ?? null);
  };

  const login = async (userName: string, password: string) => {
    const res = await signIn({ userName, password });
    if (res.success && res.statusCode === 200 && res.data?.token) {
      const newToken = res.data.token;
      const claims = parseJwt(newToken);

      const newUser: IUser = {
        userId: res.data.userId ?? claims?.userId ?? claims?.AppUserId ?? 0,
        fullName: res.data.fullName ?? claims?.fullName ?? userName,
        email: res.data.email ?? claims?.email ?? userName,
        userName,
        companyId:
          typeof res.data.companyId === 'string' ? res.data.companyId : null,
      };

      await setSessionData(newToken, newUser);

      const redirect = searchParams.get('redirect');
      router.replace(redirect || '/dashboard');
    } else {
      handleError(res);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setUserPermissions([]);
    dispatch(setAuthToken(null));
    dispatch(setCurrentUser(null));
    Cookies.remove('AuthToken');
    Cookies.remove('user');
    localStorage.clear();
    window.location.href = '/signin';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        setSessionData,
        logout,
        userPermissions,
      }}
    >
      {children}
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
