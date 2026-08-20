/**
 * Mirrors of TulipsHRM.VehicleManagement.Domain notification rule enums.
 * Source of truth: Domain/Entities/Notifications/Rules/NotificationRuleEnums.cs
 */

export enum NotificationPriorityEnum {
  Low = 1,
  Normal = 2,
  High = 3,
  Critical = 4,
}

/** [Flags] enum — a rule's channels value is a bitwise OR of these. */
export enum NotificationChannelEnum {
  None = 0,
  InApp = 1,
  Email = 2,
  Sms = 4,
  Push = 8,
  Digest = 16,
}

export enum DeliveryStatusEnum {
  Pending = 1,
  Sent = 2,
  Failed = 3,
  Bounced = 4,
}

export const NOTIFICATION_PRIORITY_LABELS: Record<
  NotificationPriorityEnum,
  string
> = {
  [NotificationPriorityEnum.Low]: 'Low',
  [NotificationPriorityEnum.Normal]: 'Normal',
  [NotificationPriorityEnum.High]: 'High',
  [NotificationPriorityEnum.Critical]: 'Critical',
};

export const NOTIFICATION_PRIORITY_BADGE_CLASSES: Record<
  NotificationPriorityEnum,
  string
> = {
  [NotificationPriorityEnum.Low]: 'bg-gray-100 text-gray-800',
  [NotificationPriorityEnum.Normal]: 'bg-blue-100 text-blue-800',
  [NotificationPriorityEnum.High]: 'bg-amber-100 text-yellow-800',
  [NotificationPriorityEnum.Critical]: 'bg-red-100 text-red-800',
};

/** Individual channel flags (excludes None) for checkbox lists. */
export const NOTIFICATION_CHANNEL_FLAGS: {
  value: NotificationChannelEnum;
  label: string;
}[] = [
  { value: NotificationChannelEnum.InApp, label: 'In-App' },
  { value: NotificationChannelEnum.Email, label: 'Email' },
  { value: NotificationChannelEnum.Sms, label: 'SMS' },
  { value: NotificationChannelEnum.Push, label: 'Push' },
  { value: NotificationChannelEnum.Digest, label: 'Digest' },
];

export const channelNames = (channels: number): string => {
  const names = NOTIFICATION_CHANNEL_FLAGS.filter(
    (flag) => (channels & flag.value) === flag.value
  ).map((flag) => flag.label);
  return names.length > 0 ? names.join(', ') : 'None';
};

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatusEnum, string> = {
  [DeliveryStatusEnum.Pending]: 'Pending',
  [DeliveryStatusEnum.Sent]: 'Sent',
  [DeliveryStatusEnum.Failed]: 'Failed',
  [DeliveryStatusEnum.Bounced]: 'Bounced',
};

export const DELIVERY_STATUS_BADGE_CLASSES: Record<DeliveryStatusEnum, string> =
  {
    [DeliveryStatusEnum.Pending]: 'bg-amber-100 text-yellow-800',
    [DeliveryStatusEnum.Sent]: 'bg-green-100 text-green-800',
    [DeliveryStatusEnum.Failed]: 'bg-red-100 text-red-800',
    [DeliveryStatusEnum.Bounced]: 'bg-red-100 text-red-800',
  };
