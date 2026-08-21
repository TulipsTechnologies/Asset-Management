import { ISortFilter } from '@/utils/serviceUtils';

export interface IEmployee {
  id: string;
  hrmEmployeeId?: number | null;
  employeeCode?: string | null;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  department?: string | null;
  designation?: string | null;
  isActive: boolean;
  openAssignmentCount: number;
  /** Base64 rowversion — required on update. */
  rowVersion: string;
}

export interface IUpsertEmployee {
  employeeCode?: string;
  fullName: string;
  email?: string;
  phone?: string;
  department?: string;
  designation?: string;
  isActive: boolean;
}

export interface IUpdateEmployee extends IUpsertEmployee {
  rowVersion: string;
}

export interface IEmployeeFilter extends ISortFilter {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
  /**
   * Narrow to people actually holding something. Set only by the custodian register; leave
   * it off wherever the list is a picker, or you cannot assign someone their first asset.
   */
  hasOpenAssignments?: boolean;
}
