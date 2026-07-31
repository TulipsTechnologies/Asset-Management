import { requestApi } from './httpService';
import { buildQuery } from '@/utils/serviceUtils';
import { IPagedResponse, IResponse } from '@/interface/IGeneric';
import {
  IAppUserOption,
  IBroadcastRequest,
  IBroadcastResult,
  IRoleOption,
  INotification,
  INotificationDelivery,
  INotificationFilter,
  INotificationRule,
  INotificationRuleFilter,
  IUpsertNotificationRule,
} from '@/interface/INotification';

/* ---------- inbox ---------- */

export const fetchNotifications = (
  appUserId: string,
  filter: INotificationFilter
): Promise<IPagedResponse<INotification>> => {
  return requestApi({
    apiEndpoint:
      `/Notifications/AppUser/${appUserId}` +
      buildQuery({
        PageNumber: filter.pageNumber,
        PageSize: filter.pageSize,
        Search: filter.search,
      }),
    method: 'GET',
    completeData: true,
  });
};

export const markNotificationRead = (
  notificationId: string
): Promise<IResponse<boolean>> => {
  return requestApi({
    apiEndpoint: `/Notifications/${notificationId}/MarkRead`,
    method: 'POST',
    completeData: true,
  });
};

export const markNotificationAcknowledged = (
  notificationId: string
): Promise<IResponse<boolean>> => {
  return requestApi({
    apiEndpoint: `/Notifications/${notificationId}/MarkAcknowledge`,
    method: 'POST',
    completeData: true,
  });
};

/* ---------- rules ---------- */

export const fetchNotificationRules = (
  filter: INotificationRuleFilter
): Promise<IPagedResponse<INotificationRule>> => {
  return requestApi({
    apiEndpoint:
      '/NotificationRules' +
      buildQuery({
        PageNumber: filter.pageNumber,
        PageSize: filter.pageSize,
        Search: filter.search,
        EventCode: filter.eventCode,
        IsActive: filter.isActive,
      }),
    method: 'GET',
    completeData: true,
  });
};

export const createNotificationRule = (
  data: IUpsertNotificationRule
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: '/NotificationRules',
    method: 'POST',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });
};

export const updateNotificationRule = (
  id: string,
  data: IUpsertNotificationRule
): Promise<IResponse<string>> => {
  return requestApi({
    apiEndpoint: `/NotificationRules/${id}`,
    method: 'PUT',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });
};

/* ---------- broadcast ---------- */

export const broadcastNotification = (
  data: IBroadcastRequest
): Promise<IResponse<IBroadcastResult>> => {
  return requestApi({
    apiEndpoint: '/Notifications/broadcast',
    method: 'POST',
    body: JSON.stringify(data),
    contentType: 'application/json',
    completeData: true,
  });
};

/* ---------- broadcast audience option sources ---------- */

/** Company roles for the caller (falls back to internal roles when the token has no companyId). */
export const fetchBroadcastRoleOptions = async (
  companyId?: string | null
): Promise<IResponse<IRoleOption[]>> => {
  return requestApi({
    apiEndpoint: companyId
      ? `/Roles/Companies/${companyId}`
      : '/Roles/Internal',
    method: 'GET',
    completeData: true,
  });
};

/** Active users selectable as broadcast recipients. */
export const fetchBroadcastUserOptions = (
  companyId?: string | null
): Promise<IResponse<IAppUserOption[]>> => {
  return requestApi({
    apiEndpoint:
      '/AppUsers' +
      buildQuery({
        CompanyId: companyId ?? undefined,
        IsActive: true,
      }),
    method: 'GET',
    completeData: true,
  });
};

export const fetchBroadcastDeliveries = (
  broadcastId: string
): Promise<IResponse<INotificationDelivery[]>> => {
  return requestApi({
    apiEndpoint: `/Notifications/broadcast/${broadcastId}/delivery`,
    method: 'GET',
    completeData: true,
  });
};
