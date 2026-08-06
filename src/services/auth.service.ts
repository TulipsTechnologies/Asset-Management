import Cookies from 'js-cookie';
import jwt from 'jsonwebtoken';
import { requestApi } from './httpService';
import { JwtPayload } from '@/interface/IJwtPayload';
import { IResponse } from '@/interface/IGeneric';

export interface ILoginData {
  token: string;
  userId?: string;
  fullName?: string;
  email?: string;
  userName?: string;
  [key: string]: unknown;
}

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

/**
 * POST /api/AppUsers/Login {userName, password}
 * → Result envelope {success, statusCode, message, data:{token, ...}}
 */
export const signIn = (data: {
  userName: string;
  password: string;
}): Promise<IResponse<ILoginData>> => {
  return requestApi({
    apiEndpoint: '/AppUsers/Login',
    body: JSON.stringify(data),
    method: 'POST',
    completeData: true,
    contentType: 'application/json',
  });
};

export function parseJwt(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload | null;
  } catch (error) {
    console.error('Failed to decode token:', error);
    return null;
  }
}
