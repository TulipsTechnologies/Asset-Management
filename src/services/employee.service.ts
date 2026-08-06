import { requestApi } from './httpService';
import { buildQuery, sortQuery } from '@/utils/serviceUtils';
import { IPagedResponse, IResponse } from '@/interface/IGeneric';
import {
  IEmployee,
  IEmployeeFilter,
  IUpdateEmployee,
  IUpsertEmployee,
} from '@/interface/IEmployee';

export const fetchEmployees = (
  filter: IEmployeeFilter = {}
): Promise<IPagedResponse<IEmployee>> => {
  return requestApi({
    apiEndpoint:
      '/Employees' +
      buildQuery({
        PageNumber: filter.pageNumber,
        PageSize: filter.pageSize,
        ...sortQuery(filter),
        Search: filter.search,
        IsActive: filter.isActive,
      }),
    method: 'GET',
    completeData: true,
  });
};

export const fetchEmployeeById = (
  id: string
): Promise<IResponse<IEmployee>> => {
  return requestApi({
    apiEndpoint: `/Employees/${id}`,
    method: 'GET',
    completeData: true,
  });
};

export const createEmployee = (
  data: IUpsertEmployee
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: '/Employees',
    method: 'POST',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });
};

export const updateEmployee = (
  id: string,
  data: IUpdateEmployee
): Promise<IResponse<string>> =>
  requestApi({
    apiEndpoint: `/Employees/${id}`,
    method: 'PUT',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });

/** Soft delete — refused with a named blocker while live obligations exist. */
export const deleteEmployee = (id: string): Promise<IResponse<string>> =>
  requestApi({ apiEndpoint: `/Employees/${id}`, method: 'DELETE', completeData: true });
