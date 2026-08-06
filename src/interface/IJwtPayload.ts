/**
 * Claims observed / expected in the VehicleManagement API JWT.
 * The token is decoded defensively — every claim is optional and the raw
 * token is stored so nothing is lost if claim names differ.
 */
export interface JwtPayload {
  userId?: string;
  /** VehicleManagement API token claim name for the user id. */
  AppUserId?: string;
  username?: string;
  email?: string;
  fullName?: string;
  userType?: number;
  companyId?: string;
  /** Comma-separated permission ids, when present. */
  permissions?: string;
  /**
   * The claim this API actually issues (triple-s spelling is the backend's, verbatim):
   * a CSV of permission ids, e.g. "1" for TotalAccess.
   */
  UserPermisssions?: string;
  /** Comma-separated module ids, when present. */
  modules?: string;
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}
