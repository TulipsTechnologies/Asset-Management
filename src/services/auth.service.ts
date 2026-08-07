import Cookies from 'js-cookie';
import jwt from 'jsonwebtoken';
import { requestApi } from './httpService';
import { ensureAssetToken } from './assetToken';
import { ILoginFromHrmRequest, IValidUser } from '@/interface/IAuth';
import { JwtPayload } from '@/interface/IJwtPayload';
import { IResponse } from '@/interface/IGeneric';

export async function getAuthToken() {
  return Cookies.get('AuthToken');
}

/** The signed-in user with their company. The JWT carries the company ID but not its NAME,
 *  which printed and exported documents have to show. */
export interface ICurrentUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  companyId?: string | null;
  companyName?: string | null;
}

/** GET /api/AppUsers/me — authenticated, no permission gate. */
export const fetchCurrentUser = (): Promise<IResponse<ICurrentUser>> =>
  requestApi({ apiEndpoint: '/AppUsers/me', method: 'GET', completeData: true });

export function parseJwt(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload | null;
  } catch (error) {
    console.error('Failed to decode token:', error);
    return null;
  }
}

/**
 * POST /api/AppUsers/TulipsHrm/Login {token}
 * → Result envelope {success, statusCode, message, data: ValidUserDto}
 */
export const loginUsingToken = (
  token: string
): Promise<IResponse<IValidUser>> => {
  const body: ILoginFromHrmRequest = {
    token,
  };

  return requestApi({
    apiEndpoint: '/AppUsers/TulipsHrm/Login',
    method: 'POST',
    body: JSON.stringify(body),
    contentType: 'application/json',
    completeData: true,
    // The default bearer now resolves to `AssetAuthToken`, which does not
    // exist yet at login time. Pass the HRM `AuthToken` explicitly so the
    // login request still authenticates against the hub.
    token: `Bearer ${token}`,
  });
};

/**
 * Exchange the HRM `AuthToken` for the asset-module token and persist it as
 * the `AssetAuthToken` cookie. Returns the asset token on success, or `null`
 * if the login is invalid or no token is returned.
 *
 * Prefer `ensureAssetToken` when you also need the failure reason.
 */
export async function exchangeAndStoreAssetToken(
  authToken: string
): Promise<string | null> {
  // authToken is already in the AuthToken cookie that ensureAssetToken reads;
  // keep the parameter for call-site clarity / backwards compatibility.
  void authToken;
  const { token } = await ensureAssetToken(true);
  return token;
}
