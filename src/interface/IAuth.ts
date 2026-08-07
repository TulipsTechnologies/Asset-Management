/** LoginFromHrmRequest */
export interface ILoginFromHrmRequest {
  token: string | null;
}

/** ValidUserDto */
export interface IValidUser {
  isLoginValid: boolean;
  token?: string | null;
  requiredPasswordChange: boolean;
  remarks?: string | null;
  companyId?: string | null;
  /** AppUserTypeEnum — OpenAPI values: 1, 2, -1 */
  appUserType: number;
  fullName?: string | null;
  isEmailVerified: boolean;
  emailAddress?: string | null;
  isPhoneVerified: boolean;
  phoneNumber?: string | null;
}
