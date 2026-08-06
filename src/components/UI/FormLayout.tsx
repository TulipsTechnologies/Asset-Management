'use client';

/**
 * Layout primitives for the module's large add/edit screens, extracted from the
 * Add Depreciation form so every big form shares one visual language: a
 * two-column page (form + sticky side rail), collapsible panels with a circular
 * icon, boxed label/value rows, and uppercase group labels.
 */

/** Full-width label that groups the fields beneath it inside a single form card. */
export const GroupLabel = ({
  children,
  hint,
}: {
  children: string;
  hint?: string;
}) => (
  <div className="md:col-span-2 mt-2 first:mt-0">
    <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
      {children}
    </h2>
    {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    <div className="mt-3 border-b border-gray-100" />
  </div>
);

/** Small label-over-value pair, for the summary strip inside a modal. */
export const DetailField = ({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) => (
  <div>
    <p className="text-xs text-gray-500">{label}</p>
    <p className="text-sm font-medium text-gray-800">{value ?? '—'}</p>
  </div>
);

/** A collapsible panel: circular icon, bold title, chevron, optional badge. */
export const Panel = ({
  title,
  icon,
  iconClass = 'text-primarycolor border-primarycolor/30 bg-primarycolor/5',
  badge,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: string;
  iconClass?: string;
  /** Small grey chip after the title — e.g. how many of its fields are filled. */
  badge?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) => (
  <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-3 px-5 py-4"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-full border ${iconClass}`}
        >
          <i className={`icon icon-${icon} text-sm`} />
        </span>
        <span className="truncate text-base font-bold text-secondaryColor">
          {title}
        </span>
        {badge && (
          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
            {badge}
          </span>
        )}
      </span>
      <i
        className={`icon icon-arrow-down shrink-0 text-xs text-gray-400 transition-transform ${
          open ? 'rotate-180' : ''
        }`}
      />
    </button>
    {open && <div className="px-5 pb-5">{children}</div>}
  </div>
);

/** The boxed area inside a panel, matching the sample's inset card. */
export const PanelBox = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-lg border border-gray-200 px-4 py-3">{children}</div>
);

/** A label/value row. `divider` draws the rule above it that precedes a result. */
export const Row = ({
  label,
  value,
  op,
  divider,
  highlight,
  muted,
}: {
  label: string;
  value?: string | null;
  op?: '−' | '÷' | '=';
  divider?: boolean;
  highlight?: boolean;
  muted?: boolean;
}) => (
  <div
    className={`flex items-baseline justify-between gap-3 py-2 ${
      divider ? 'border-t border-gray-200' : ''
    }`}
  >
    <span className="flex items-baseline gap-1.5 text-sm text-gray-600">
      <span className="w-2 shrink-0 text-gray-300">{op ?? ''}</span>
      {label}
    </span>
    <span
      className={
        highlight
          ? 'whitespace-nowrap text-lg font-bold tabular-nums text-primarycolor'
          : `text-sm tabular-nums ${muted ? 'text-gray-400' : 'font-medium text-gray-800'}`
      }
    >
      {value ?? '—'}
    </span>
  </div>
);
