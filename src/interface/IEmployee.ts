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

export interface IEmployeeFilter {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
}
