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
import USER_TYPES from '@tulipstechnologies/common/dist/enums/userTypes';

import { parseJwt } from '@/services/auth.service';
import {
  clearActiveCompanyId,
  clearAssetToken,
  ensureAssetToken,
  getAssetToken,
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
import { getHubBaseUrl, isDevAuthEnabled } from '@/utils/constants';

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
  /**
   * Why bootstrap stopped.
   *
   * `kind` decides how it is presented. A token that failed to exchange is a developer problem
   * and its detail is hidden in production; NOT HAVING CHOSEN A TENANT is neither — it is a
   * decision only the operator can make, the message names the companies they already have
   * access to, and hiding it behind "please try again" leaves them pressing Retry forever on
   * something Retry cannot fix.
   */
  const [bootstrapError, setBootstrapError] = useState<{
    kind: 'auth' | 'tenant';
    message: string;
  } | null>(null);

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

  /**
   * A minimal hub user assembled from the cookies this module already holds,
   * for when the HRM hub cannot be reached.
   *
   * The shared chrome only reads a handful of fields — the sidebar checks
   * `userType`, `userRoles` and `isAttendanceFromWeb`, the header adds
   * `userId` and `company` — but it treats a NULL user as "not signed in" and
   * renders no menu items at all. Publishing this keeps the navigation alive on
   * a developer machine and during a hub outage; the moment the hub answers,
   * the real user replaces it.
   *
   * `userType` is deliberately the hub's COMPANY value, taken from the shared
   * package rather than written as a number: the sidebar reads userType in the
   * HUB's id space (a different space from this module's AppUserType), and its
   * INTERNAL branch renders `internalSidebarMenus`, which this module never
   * passes — an internal fallback would show an empty sidebar all over again.
   */
  const fallbackHubUser = (): IAdminUserData => {
    // "This module's own token" means exactly that: in the dev-auth flow the AuthToken cookie
    // is a placeholder carrying no claims, and the identity lives in the module token. Reading
    // AuthToken first and stopping there is why the header showed a generic "User" for a
    // perfectly well-identified session. Hub token first when there IS one, module token
    // otherwise — the fallback is only ever reached when the hub could not answer.
    const claims =
      parseJwt(Cookies.get('AuthToken') ?? '') ?? parseJwt(getAssetToken() ?? '');
    // parseJwt returns an untyped claim bag, so coerce before using it as text.
    const name = String(
      claims?.fullName ?? claims?.username ?? claims?.unique_name ?? 'User'
    );

    return {
      userId: Number(claims?.userId ?? claims?.UserId ?? 0),
      username: String(claims?.username ?? claims?.unique_name ?? ''),
      fullName: name,
      firstName: name,
      middleName: '',
      lastName: '',
      email: String(claims?.email ?? ''),
      phoneNumber: '',
      employeeId: 0,
      userType: USER_TYPES.COMPANY,
      profileColor: '',
      profileInitial: (name.trim()[0] ?? 'U').toUpperCase(),
      hasAccessToAllBranches: false,
      hasAccessToAllDepartments: false,
      hasPersonalizedPermissions: false,
      userRoles: [],
      isAttendanceFromWeb: false,
    } as unknown as IAdminUserData;
  };

  // Central hub sign-in/logout target shared by all modules
  // (getHubBaseUrl() + NEXT_PUBLIC_LOGOUT_URL).
  const redirectToHubSignin = () => {
    router.replace(
      `${getHubBaseUrl()}${
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
   *
   * When the hub does not answer, a user is still published from this module's
   * own token — see `fallbackHubUser`. The shared sidebar returns ZERO items
   * while `currentUser` is null (it checks `hasCurrentUser` before it even looks
   * at menus), so without that the fallback menu list can never render and the
   * module is left with no navigation at all.
   */
  const loadCurrentUser = async () => {
    // Dev-auth writes a PLACEHOLDER AuthToken — the middleware only checks that the cookie
    // exists, and the real credential is the module token in AssetAuthToken. The hub cannot
    // authenticate a placeholder, so calling it is a guaranteed failure: a 401 with an EMPTY
    // body that the shared client calls res.json() on, or — when the hub host is simply not
    // reachable from a dev machine — a raw "TypeError: Failed to fetch". Either way Next
    // surfaces it as a red overlay error on every page load. The fallback below is the right
    // answer for that state anyway, so ask for it directly instead of provoking the failure.
    //
    // Tested by SHAPE, not against the sentinel. A hub credential is a JWT; anything that is
    // not one cannot possibly authenticate. Matching the exact placeholder string missed every
    // browser still holding the value an earlier build wrote ("devauth"), and those cookies do
    // not expire — the note on DEV_AUTH_PLACEHOLDER_TOKEN warned that two copies of a sentinel
    // are one rename away from never matching, and this is that rename, seen from the reader.
    if (!parseJwt(Cookies.get('AuthToken') ?? '')) {
      dispatch(setCurrentUser(fallbackHubUser()));
      return;
    }

    try {
      const res = await getCurrentUser();
      if (!res?.success || !res?.data) {
        dispatch(setCurrentUser(fallbackHubUser()));
        return;
      }

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
      dispatch(setCurrentUser(fallbackHubUser()));
    }
  };

  /**
   * Resolves the tenant every request is scoped to and stores it in the
   * `ActiveCompanyId` cookie (read by requestApi as the `x-company-id` header).
   * Company users carry their own company on the exchange payload and never reach this;
   * internal users (superadmin) carry none.
   *
   * ONE candidate is chosen automatically. MORE THAN ONE IS NEVER GUESSED.
   *
   * It used to take `companies.find(c => !c.isDeleted) ?? companies[0]` — the first row of an
   * unordered list — and that is how an operator ends up in the wrong company's data without
   * ever choosing it or being told. It is not hypothetical here: the tenants on this database
   * are two test companies and one real one, and the module's Master Data Reset wiped the real
   * one twice. Combined with the tenant cookie having been session-scoped, "I did not change
   * anything" and "I am now looking at production" were the same sentence.
   *
   * Failing closed costs an internal operator one explicit choice. Guessing costs somebody
   * else's data, silently, and the guess looks exactly like a correct answer.
   */
  const resolveActiveCompanyIfAbsent = async () => {
    if (Cookies.get('ActiveCompanyId')) return;

    try {
      const res = await requestApi({
        apiEndpoint: '/Companies',
        method: 'GET',
        completeData: true,
      });
      const companies = (Array.isArray(res?.data) ? res.data : []).filter(
        (c: { id?: string; isDeleted?: boolean }) => c?.id && !c.isDeleted
      );

      if (companies.length === 1) {
        persistActiveCompanyIdIfAbsent(companies[0].id);
        return;
      }

      if (companies.length === 0) {
        setBootstrapError({
          kind: 'tenant',
          message:
            'Your account is not attached to a company, and no company was returned to choose ' +
            'from. Ask an administrator to grant access.',
        });
        return;
      }

      const names = companies
        .map((c: { name?: string }) => c?.name)
        .filter(Boolean)
        .join(', ');
      setBootstrapError({
        kind: 'tenant',
        message:
          `Your account can see ${companies.length} companies (${names}), so this module cannot ` +
          'tell which one you mean. Choose one before continuing — picking for you risks showing, ' +
          "and changing, another company's data." +
          (isDevAuthEnabled() ? ' In development, set it on the /dev-auth screen.' : ''),
      });
    } catch (err) {
      // Leave the cookie unset; writes will surface the API's tenant error.
      console.warn('[tenant] company resolution failed', err);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      // The dev-auth screen must never be gated by the bootstrap it exists to repair.
      // A stale or unexchangeable token otherwise renders the failure card OVER the one
      // page that can clear it — you cannot get in, and you cannot reach the screen that
      // lets you in. Recovery UI has to sit outside the thing it recovers from.
      if (
        typeof window !== 'undefined' &&
        window.location.pathname.endsWith('/dev-auth')
      ) {
        setBootstrapping(false);
        return;
      }

      const cookieToken = Cookies.get('AuthToken');
      const cookieUser = Cookies.get('user');

      // No hub session — bounce to the central sign-in. Middleware handles this
      // server-side too; this is the client-side fallback. On localhost in
      // development the middleware sends to /dev-auth instead, so skip here.
      if (!cookieToken) {
        if (!isDevAuthEnabled()) {
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
      //
      // ALWAYS re-exchange when there is a real hub token: it is the source of
      // truth, and a carried-over AssetAuthToken could hold stale permissions.
      // Every genuine session — deployed or local — takes this branch.
      //
      // The condition is on the token's SHAPE, not on an environment flag, and it
      // is not the same thing as forcing unconditionally. The dev-auth screen has a
      // second route in that writes the non-JWT DEV_AUTH_PLACEHOLDER_TOKEN into
      // AuthToken and puts a directly-obtained module token in AssetAuthToken; the
      // middleware only checks that the cookie EXISTS. Forcing there would clear
      // that module token, POST the placeholder to an endpoint that cannot
      // authenticate it, and leave the failure card up permanently. A placeholder
      // is not a credential, so there is nothing to re-exchange for.
      const { token: assetToken, companyId, error } = await ensureAssetToken(
        Boolean(parseJwt(cookieToken))
      );
      if (!assetToken) {
        const message =
          error ||
          'Could not exchange AuthToken for an AssetAuthToken. Sign in again.';
        if (isDevAuthEnabled()) {
          // Surface the real failure instead of silently rendering with no
          // Authorization header (httpService only reads AssetAuthToken).
          setBootstrapError({ kind: 'auth', message });
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
    window.location.href = `${getHubBaseUrl()}${
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
              {bootstrapError.kind === 'tenant'
                ? 'Choose a company'
                : 'Authentication failed'}
            </h1>
            {bootstrapError.kind === 'tenant' ? (
              // Always shown, production included: this is the operator's decision to make and
              // the message names companies they already have access to. "Please try again"
              // would be a lie — Retry cannot choose for them, and choosing for them is the
              // defect this replaced.
              <p className="text-sm text-gray-600">{bootstrapError.message}</p>
            ) : process.env.NODE_ENV === 'development' ? (
              <>
                <p className="text-sm text-gray-600">{bootstrapError.message}</p>
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
