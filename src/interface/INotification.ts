import {
  DeliveryStatusEnum,
  NotificationChannelEnum,
  NotificationPriorityEnum,
} from '@/enum/notificationEnums';
import { IPagination } from '@/interface/IGeneric';

/** NotificationListDto — user inbox rows. */
export interface INotification {
  id: string;
  activityTypeId: string;
  title?: string | null;
  message?: string | null;
  senderId?: string | null;
  recipientId?: string | null;
  sourceEntityId?: string | null;
  sentDate: string;
  deliveredDate?: string | null;
  readDate?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  isSent: boolean;
}

export interface INotificationFilter extends Partial<IPagination> {
  search?: string;
}

/** NotificationRuleDto */
export interface INotificationRule {
  id: string;
  moduleCode: string;
  eventCode: string;
  entityType?: string | null;
  triggerDateField?: string | null;
  /** JSON int array as string, e.g. "[90,60,30,7,0]". */
  reminderOffsetsDays: string;
  postExpiryRepeatDays?: number | null;
  priority: NotificationPriorityEnum;
  recipientRules?: string | null;
  channels: NotificationChannelEnum;
  requiresAcknowledgement: boolean;
  escalationSteps?: string | null;
  isActive: boolean;
  createdOn: string;
  modifiedOn?: string | null;
}

/** UpsertNotificationRule request body. */
export interface IUpsertNotificationRule {
  eventCode: string;
  entityType?: string | null;
  triggerDateField?: string | null;
  reminderOffsetsDays: string;
  postExpiryRepeatDays?: number | null;
  priority: NotificationPriorityEnum;
  recipientRules?: string | null;
  channels: NotificationChannelEnum;
  requiresAcknowledgement: boolean;
  escalationSteps?: string | null;
  isActive: boolean;
}

export interface INotificationRuleFilter extends Partial<IPagination> {
  search?: string;
  eventCode?: string;
  isActive?: boolean;
}

/** BroadcastAudienceEnum */
export enum BroadcastAudienceEnum {
  AllUsers = 1,
  AllDrivers = 2,
  Roles = 3,
  Users = 4,
}

export interface IBroadcastRequest {
  title?: string;
  message: string;
  audience?: BroadcastAudienceEnum;
  recipientAppUserIds?: string[];
  roleNames?: string[];
}

/** BroadcastResultDto */
export interface IBroadcastResult {
  broadcastId: string;
  recipientCount: number;
  /** AllDrivers audience only: drivers skipped because they have no user account. */
  skippedDriverCount?: number | null;
}

/** RoleDto (GET /Roles/Companies/{companyId} or /Roles/Internal) */
export interface IRoleOption {
  id: string;
  name?: string | null;
  description?: string | null;
}

/** AppUserListDto subset used for recipient selection */
export interface IAppUserOption {
  id: string;
  username?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

/** NotificationDeliveryDto */
export interface INotificationDelivery {
  id: string;
  recipientAppUserId: string;
  recipientName?: string | null;
  channel: NotificationChannelEnum;
  scheduledAt: string;
  sentAt?: string | null;
  deliveryStatus: DeliveryStatusEnum;
  readAt?: string | null;
  acknowledgedAt?: string | null;
  failureReason?: string | null;
  retryCount: number;
  messageBody?: string | null;
}
