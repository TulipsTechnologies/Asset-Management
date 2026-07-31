'use client';

import { ReactNode } from 'react';

/**
 * Employee-profile style "block card": white rounded card with a green
 * outline icon + bold title header, followed by field rows separated by
 * light dividers. Mirrors the TulipsHRM employee module design.
 */
const InfoCard = ({
  title,
  icon,
  action,
  className = '',
  bodyClassName = '',
  children,
}: {
  title: string;
  /** CustomIcons glyph name without the `icon-` prefix, e.g. `phone`. */
  icon: string;
  /** Optional element rendered at the right end of the header row. */
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) => (
  <section
    className={`bg-white rounded-xl border border-gray-100 shadow-sm ${className}`}
  >
    <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-gray-100">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="flex items-center justify-center size-8 shrink-0 rounded-lg border border-primarycolor/30 bg-primarycolor/5">
          <i className={`icon icon-${icon} text-sm text-primarycolor`}></i>
        </span>
        <h3 className="text-sm font-bold text-secondaryColor truncate">
          {title}
        </h3>
      </div>
      {action}
    </div>
    <div className={`px-5 py-1 ${bodyClassName}`}>{children}</div>
  </section>
);

const isEmpty = (value: ReactNode) =>
  value == null || value === '' || value === '—';

/**
 * A single field row inside an InfoCard: small gray leading icon, gray
 * label on top, bold value underneath. Empty values render italic gray
 * "Not provided".
 */
export const InfoField = ({
  label,
  value,
  icon,
  emptyText = 'Not provided',
}: {
  label: string;
  value: ReactNode;
  /** CustomIcons glyph name without the `icon-` prefix. */
  icon?: string;
  emptyText?: string;
}) => (
  <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-b-0">
    {icon && (
      <i
        className={`icon icon-${icon} text-sm text-gray-400 mt-0.5 shrink-0`}
      ></i>
    )}
    <div className="min-w-0 flex-1">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <div className="text-sm font-semibold text-secondaryColor break-words">
        {isEmpty(value) ? (
          <span className="italic font-normal text-gray-400">{emptyText}</span>
        ) : (
          value
        )}
      </div>
    </div>
  </div>
);

/** Responsive wrapper: two cards per row on desktop, stacked on mobile. */
export const InfoCardGrid = ({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={`grid grid-cols-1 lg:grid-cols-2 gap-4 items-start ${className}`}
  >
    {children}
  </div>
);

export default InfoCard;
