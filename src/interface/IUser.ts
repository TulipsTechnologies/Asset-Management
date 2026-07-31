export interface IUser {
  userId: string | number;
  fullName: string;
  email: string;
  userName?: string;
  /** Tenant the session is scoped to. Null for internal users. */
  companyId?: string | null;
}
