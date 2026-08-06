'use client';

import CustomMenuItem from '@/components/UI/CustomMenuItem';
import Dropdown from '@/components/UI/Dropdown';
import RowKebab from '@/components/UI/RowKebab';
import { IAssetListItem } from '@/interface/IAsset';

/**
 * The pieces every Assets view shares. Table and Card render the same rows through the
 * same rules, so an action that appears in one appears in the other, and a figure shown
 * in one is formatted identically in the other.
 */

/** Nepal standard VAT. Display-only — the register stores net prices. */
export const VAT_RATE = 0.13;

export const money = (value?: number | null, currency?: string | null) =>
  value != null
    ? `${value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}${currency ? ` ${currency}` : ''}`
    : '—';

/** Register dates carry no time of day — show the date the operator entered, nothing more. */
export const shortDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString() : '—';

/** Compact form for dense surfaces — analytics tiles and chart labels. */
export const compactMoney = (value: number, currency?: string | null) =>
  `${new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)}${currency ? ` ${currency}` : ''}`;

export const StatusBadge = ({
  value,
  labels,
  classes,
}: {
  value: number;
  labels: Record<number, string>;
  classes?: Record<number, string>;
}) => (
  <span
    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
      classes?.[value] ?? 'bg-gray-100 text-gray-700'
    }`}
  >
    {labels[value] ?? value}
  </span>
);

/**
 * One asset action, declared once and rendered by every view.
 *
 * `isAvailable` is what keeps permissions and lifecycle rules honest across views: the
 * rule lives here, not in each view's JSX, so a Delete that is hidden in the table cannot
 * reappear on a card.
 */
export interface IAssetAction {
  label: string;
  iconName: string;
  onClick: (asset: IAssetListItem) => void;
  isAvailable?: (asset: IAssetListItem) => boolean;
}

export const availableActions = (actions: IAssetAction[], asset: IAssetListItem) =>
  actions.filter((action) => action.isAvailable?.(asset) ?? true);

/** The shared overflow menu — identical markup in the table cell and on a card. */
export const AssetActionsMenu = ({
  asset,
  actions,
  className = '',
}: {
  asset: IAssetListItem;
  actions: IAssetAction[];
  className?: string;
}) => {
  const usable = availableActions(actions, asset);
  if (usable.length === 0) return null;

  return (
    <div className={`flex gap-x-2 relative ${className}`}>
      <Dropdown
        buttonChildren={<RowKebab />}
      >
        {usable.map((action, index) => (
          <CustomMenuItem
            key={action.label}
            label={action.label}
            onClick={() => action.onClick(asset)}
            border={index !== usable.length - 1}
            icon={<i className={`icon icon-${action.iconName} text-sm`} />}
            className="!py-2"
          />
        ))}
      </Dropdown>
    </div>
  );
};
