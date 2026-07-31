import { requestApi } from './httpService';
import { buildQuery } from '@/utils/serviceUtils';
import { IPagedResponse, IResponse } from '@/interface/IGeneric';
import {
  IEmployee,
  IEmployeeFilter,
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
