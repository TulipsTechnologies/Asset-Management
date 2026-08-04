'use client';

import { ReactNode } from 'react';

/**
 * Pastel KPI summary card in the TulipsHRM dashboard style: a soft, tinted,
 * borderless rounded card with a small bold title, an oversized value and an
 * oversized faded icon bleeding out of the top-right corner. One tint per card.
 * Mirrors the main HRM app's `HRCard`.
 */
export type TSummaryTint =
  | 'mint'
  | 'sky'
  | 'peach'
  | 'lavender'
  | 'pink'
  | 'amber'
  | 'indigo';

interface ITintStyle {
  /** Card background pastel. */
  card: string;
  /** Big number colour. */
  value: string;
  /** Faded corner-icon colour. */
  icon: string;
}

const TINTS: Record<TSummaryTint, ITintStyle> = {
  mint: { card: 'bg-green-50', value: 'text-green-700', icon: 'text-green-500' },
  sky: { card: 'bg-sky-50', value: 'text-sky-700', icon: 'text-sky-500' },
  peach: {
    card: 'bg-orange-50',
    value: 'text-orange-700',
    icon: 'text-orange-400',
  },
  lavender: {
    card: 'bg-violet-50',
    value: 'text-violet-700',
    icon: 'text-violet-400',
  },
  pink: { card: 'bg-rose-50', value: 'text-rose-700', icon: 'text-rose-400' },
  amber: { card: 'bg-amber-50', value: 'text-amber-700', icon: 'text-amber-500' },
  indigo: {
    card: 'bg-indigo-50',
    value: 'text-indigo-700',
    icon: 'text-indigo-400',
  },
};

const SummaryCard = ({
  title,
  value,
  tint,
  iconName,
  onClick,
}: {
  title: string;
  value: ReactNode;
  tint: TSummaryTint;
  /** CustomIcons glyph name without the `icon-` prefix, e.g. `move`. */
  iconName: string;
  onClick?: () => void;
}) => {
  const t = TINTS[tint];
  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-4 min-h-[104px] flex flex-col justify-between select-none ${
        t.card
      } ${
        onClick
          ? 'cursor-pointer transition-shadow duration-200 hover:shadow-md'
          : ''
      }`}
      onClick={onClick}
    >
      <h3 className="text-xs font-bold text-gray-600 pr-9 leading-snug">
        {title}
      </h3>
      <p className={`text-3xl font-bold leading-none mt-2 ${t.value}`}>
        {value}
      </p>
      <i
        className={`icon icon-${iconName} absolute right-3 top-1/2 -translate-y-1/2 text-[56px] leading-none opacity-25 pointer-events-none ${t.icon}`}
      ></i>
    </div>
  );
};

export default SummaryCard;
