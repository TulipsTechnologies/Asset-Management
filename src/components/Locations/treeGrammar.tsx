'use client';

import { ReactNode } from 'react';

/**
 * The one visual grammar every location tree draws with.
 *
 * Three surfaces render the Building → Floor → Room hierarchy — the /locations
 * management page, the Location Explorer's left pane and the dashboard's
 * Assets-by-Location band — and they used to do it three different ways: three
 * chevron sizes, two badge palettes, two connector systems and no shared notion
 * of what "selected" looks like. These primitives exist so a location row reads
 * identically wherever it appears, and so the value bar — the encoding that turns
 * the dead air between a name and its count into information — is implemented
 * exactly once.
 */

/* ------------------------------------------------------------------ layout */

/** Indent step: children shift right by margin + pad = 26px per level. */
export const INDENT_MARGIN = 15;
export const INDENT_PAD = 11;
/** How far a last-child's guideline drops before its elbow turns. */
export const ELBOW_DROP: Record<'default' | 'compact', number> = {
  default: 19,
  compact: 15,
};

export const SELECTED_ROW = 'bg-primarycolor/15 ring-1 ring-primarycolor/40';
export const HOVER_ROW = 'hover:bg-gray-50';
export const ANCHOR_ROW = 'bg-gray-50 hover:bg-gray-100/80';

/** Name typography by tier (1 = building, 2 = floor, 3 = room). */
export const nameClass = (tier: 1 | 2 | 3, compact?: boolean): string => {
  if (tier === 1)
    return compact
      ? 'text-sm font-semibold text-secondaryColor'
      : 'text-[15px] font-semibold text-secondaryColor';
  if (tier === 2)
    return compact
      ? 'text-[13px] font-medium text-secondaryColor'
      : 'text-sm font-medium text-secondaryColor';
  return compact ? 'text-[13px] text-gray-600' : 'text-sm text-gray-600';
};

/* ------------------------------------------------------------------ pieces */

/** The expand/collapse control. `inert` renders a non-interactive stand-in for
 *  search mode, where every surviving branch is forced open and a click that
 *  silently mutated the collapse set would look like a no-op. */
export const TreeChevron = ({
  isOpen,
  name,
  onToggle,
  inert,
}: {
  isOpen: boolean;
  name: string;
  onToggle: () => void;
  inert?: boolean;
}) => {
  const glyph = (
    <i
      className={`icon icon-right text-[10px] transition-transform duration-150 ${
        isOpen ? 'rotate-90' : ''
      }`}
    />
  );
  if (inert)
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-300">
        {glyph}
      </span>
    );
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-label={isOpen ? `Collapse ${name}` : `Expand ${name}`}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-200 hover:text-gray-600"
    >
      {glyph}
    </button>
  );
};

/** A leaf's stand-in for the chevron slot, so names align down the column. */
export const LeafDot = () => (
  <span className="flex h-6 w-6 shrink-0 items-center justify-center">
    <span className="h-1 w-1 rounded-full bg-gray-300" />
  </span>
);

/**
 * A small, deterministic accent palette so the building icons are not all one colour.
 * Each location maps to a stable tone by its id, giving the tree visual variety at a
 * glance with no per-record configuration. Floors and rooms stay neutral so depth reads.
 */
export const LOCATION_TONES = [
  { soft: 'bg-blue-50', icon: 'text-blue-600' },
  { soft: 'bg-indigo-50', icon: 'text-indigo-600' },
  { soft: 'bg-teal-50', icon: 'text-teal-600' },
  { soft: 'bg-amber-50', icon: 'text-amber-600' },
  { soft: 'bg-rose-50', icon: 'text-rose-600' },
  { soft: 'bg-violet-50', icon: 'text-violet-600' },
  { soft: 'bg-cyan-50', icon: 'text-cyan-600' },
] as const;

export const locationTone = (key?: string) => {
  if (!key) return LOCATION_TONES[0];
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return LOCATION_TONES[h % LOCATION_TONES.length];
};

/** Depth speaks through the icon: buildings anchor (each in its own tone), floors carry,
 *  rooms point. `pseudo` forces the room marker — "(No location)" is a bucket, not a building. */
export const LocationTypeIcon = ({
  tier,
  compact,
  pseudo,
  hueKey,
}: {
  tier: 1 | 2 | 3;
  compact?: boolean;
  pseudo?: boolean;
  /** Stable key (usually the location id) that picks this building's accent tone. */
  hueKey?: string;
}) => {
  if (pseudo || tier === 3)
    return <i className="icon icon-marker shrink-0 text-[12px] text-gray-400" />;
  if (tier === 1) {
    const tone = locationTone(hueKey);
    return (
      <span
        className={`flex shrink-0 items-center justify-center rounded-lg ${tone.soft} ${
          compact ? 'h-6 w-6' : 'h-7 w-7'
        }`}
      >
        <i
          className={`icon icon-company ${tone.icon} ${
            compact ? 'text-[12px]' : 'text-[14px]'
          }`}
        />
      </span>
    );
  }
  return <i className="icon icon-home shrink-0 text-[13px] text-gray-500" />;
};

/** The count, a neutral slate hierarchy so it stays readable data beside the coloured
 *  icons and blue meters rather than competing with them: a touch stronger for building
 *  anchors, a crisp chip on a selected row, quiet grey for the rest. */
export const CountBadge = ({
  total,
  anchor,
  selected,
  title,
}: {
  total: number;
  anchor?: boolean;
  selected?: boolean;
  title?: string;
}) => (
  <span
    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums transition-colors ${
      selected
        ? 'bg-white/90 text-secondaryColor ring-1 ring-gray-200'
        : anchor
          ? 'bg-gray-100 text-secondaryColor'
          : 'bg-gray-50 text-gray-500'
    }`}
    title={title}
  >
    {total.toLocaleString()}
  </span>
);

/**
 * The value bar — the gap between a name and its count, spent on meaning.
 *
 * `share` is the node's fraction of its comparison basis: roots compare against
 * the LARGEST root (the biggest building spans the full track and every other
 * building reads against it), children against their PARENT's total (the track
 * answers "how much of this building is in this room"). One hue at three
 * strengths — depth fades, magnitude stays length; never red, never a rainbow.
 * `children` render on the track's tail: exception pills, Inactive tags.
 */
export const MeterBar = ({
  share,
  tier,
  selected,
  title,
  children,
}: {
  share: number;
  tier: 1 | 2 | 3;
  selected?: boolean;
  /** Read by pointer users; the count badge remains the accessible number. */
  title?: string;
  children?: ReactNode;
}) => {
  // Fill meters read as capacity/occupancy — a cool blue is the modern, informational
  // choice and keeps the brand green for actions and positive states, not every bar.
  const fill = selected
    ? 'bg-blue-500'
    : tier === 1
      ? 'bg-blue-500/90'
      : tier === 2
        ? 'bg-blue-500/60'
        : 'bg-blue-500/40';
  const width = Math.min(Math.max(share, 0), 1) * 100;
  return (
    <span
      className="relative min-w-[40px] flex-1 self-stretch"
      title={title}
      aria-hidden
    >
      <span className="absolute inset-x-0 top-1/2 h-[4px] -translate-y-1/2 overflow-hidden rounded-full bg-gray-200/60">
        {share > 0 && (
          <span
            className={`absolute inset-y-0 left-0 rounded-r-full ${fill}`}
            /* A single asset in a 2,592-asset building must still be visible. */
            style={{ width: `${width}%`, minWidth: 3 }}
          />
        )}
      </span>
      {children && (
        <span className="absolute right-0.5 top-1/2 z-[1] flex -translate-y-1/2 items-center gap-1">
          {children}
        </span>
      )}
    </span>
  );
};
