'use client';

import {
  Children,
  CSSProperties,
  Fragment,
  isValidElement,
  ReactNode,
  useState,
} from 'react';
import {
  IconButton,
  TABLE_TOOLBAR_MOBILE_ICON_ROW_CLASS,
  TABLE_TOOLBAR_MOBILE_ICON_ACTIVE_CLASS,
} from '@tulipstechnologies/common';
import FilterPanel from '@/components/UI/FilterPanel';
import { useIsMobile } from '@/hooks/useIsMobile';

// Components treated as the "Filter" control on mobile (shown as a standalone icon).
const FILTER_COMPONENTS: unknown[] = [FilterPanel];

interface TableToolbarProps {
  tableHeaderLeft?: ReactNode;
  tableHeaderRight?: ReactNode;
  /**
   * The pre-built "Columns" control (kept here so each table keeps owning its
   * drawer state / ref). Pass `null`/`undefined` to hide it.
   */
  manageColumnsButton?: ReactNode;
  /** Extra classes appended to the outer toolbar row (e.g. "relative z-20"). */
  className?: string;
  /** Full class override for the left (tableHeaderLeft) group. */
  leftClassName?: string;
  /** Inline style for the left group. */
  leftStyle?: CSSProperties;
  /** Full class override for the desktop right (controls) group. */
  rightClassName?: string;
}

// This repo's original (pre-split) toolbar classes — the desktop branch must
// render them verbatim so layouts ≥ sm are pixel-identical to the old markup.
const DEFAULT_OUTER_CLASS =
  'flex flex-wrap justify-between items-center gap-x-4 gap-y-2 w-full mb-3';
const DEFAULT_LEFT_CLASS = 'flex flex-wrap items-center gap-x-3 gap-y-2';
const DEFAULT_RIGHT_CLASS =
  'flex flex-wrap items-center gap-x-4 gap-y-2 md:gap-x-8';

const WRAPPER_TAGS = new Set(['div', 'span']);

/**
 * Recursively flattens children, unwrapping `<>...</>` fragments and plain
 * layout wrappers (`div`/`span`) so controls nested inside a wrapper element
 * are still detected. Interactive hosts (button/a/etc.) are left intact.
 */
function flattenChildren(node: ReactNode): ReactNode[] {
  const out: ReactNode[] = [];
  Children.forEach(node, (child) => {
    if (isValidElement(child)) {
      const childrenProp = (child.props as { children?: ReactNode })?.children;
      if (child.type === Fragment) {
        out.push(...flattenChildren(childrenProp));
        return;
      }
      if (typeof child.type === 'string' && WRAPPER_TAGS.has(child.type)) {
        out.push(...flattenChildren(childrenProp));
        return;
      }
    }
    out.push(child);
  });
  return out;
}

/** A child is the Search control if it exposes an `onSearch` handler. */
function isSearchElement(node: ReactNode): boolean {
  return (
    isValidElement(node) &&
    typeof (node.props as { onSearch?: unknown })?.onSearch === 'function'
  );
}

function isRenderable(node: ReactNode): boolean {
  if (node === null || node === undefined || node === false || node === true) {
    return false;
  }
  if (typeof node === 'string' && node.trim() === '') return false;
  return true;
}

const TableToolbar = ({
  tableHeaderLeft,
  tableHeaderRight,
  manageColumnsButton,
  className,
  leftClassName,
  leftStyle,
  rightClassName,
}: TableToolbarProps) => {
  const isMobile = useIsMobile();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const outerClass = `${DEFAULT_OUTER_CLASS}${className ? ` ${className}` : ''}`;
  const leftClass = leftClassName ?? DEFAULT_LEFT_CLASS;

  // Desktop: render the original markup verbatim so layout/behavior is unchanged.
  if (!isMobile) {
    return (
      <div className={outerClass}>
        <div className={leftClass} style={leftStyle}>
          {tableHeaderLeft}
        </div>
        <div className={rightClassName ?? DEFAULT_RIGHT_CLASS}>
          {manageColumnsButton}
          {tableHeaderRight}
        </div>
      </div>
    );
  }

  // Mobile: split the controls into Filter (icon), Search (toggle) and the rest
  // (collapsed behind a 3-dots overflow menu).
  const children = flattenChildren(tableHeaderRight);
  let searchChild: ReactNode = null;
  let filterChild: ReactNode = null;
  const otherChildren: ReactNode[] = [];

  children.forEach((child) => {
    if (isSearchElement(child)) {
      searchChild = child;
      return;
    }
    if (isValidElement(child) && FILTER_COMPONENTS.includes(child.type)) {
      filterChild = child;
      return;
    }
    if (isRenderable(child)) otherChildren.push(child);
  });

  const showOverflow =
    isRenderable(manageColumnsButton) || otherChildren.length > 0;

  return (
    <>
      <div className={outerClass}>
        <div className={leftClass} style={leftStyle}>
          {tableHeaderLeft}
        </div>
        {/* Hide the inline text labels on the compact icon row, but keep any
            count badges (e.g. active filter count) visible. */}
        <div className={TABLE_TOOLBAR_MOBILE_ICON_ROW_CLASS}>
          {filterChild}
          {searchChild && (
            <IconButton
              iconClass="icon-search"
              label=""
              aria-label="Search"
              tooltipText="Search"
              iconSizeClass="text-base"
              containerClassName={
                searchOpen ? TABLE_TOOLBAR_MOBILE_ICON_ACTIVE_CLASS : undefined
              }
              onClick={() => {
                setSearchOpen((open) => !open);
                setMenuOpen(false);
              }}
            />
          )}
          {showOverflow && (
            <IconButton
              iconClass="icon-elipsis-v"
              label=""
              aria-label="More options"
              tooltipText="More"
              iconSizeClass="text-base"
              containerClassName={
                menuOpen ? TABLE_TOOLBAR_MOBILE_ICON_ACTIVE_CLASS : undefined
              }
              onClick={() => {
                setMenuOpen((open) => !open);
                setSearchOpen(false);
              }}
            />
          )}
        </div>
      </div>

      {showOverflow && menuOpen && (
        <div className="w-full mb-3 flex flex-col items-stretch rounded-md border border-gray-100 bg-white divide-y divide-gray-100 [&>*]:w-full [&>*]:justify-start [&_button]:w-full [&_button]:justify-start">
          {manageColumnsButton}
          {otherChildren.map((child, index) => (
            <Fragment key={index}>{child}</Fragment>
          ))}
        </div>
      )}

      {searchChild && searchOpen && (
        <div className="w-full mb-3">{searchChild}</div>
      )}
    </>
  );
};

export default TableToolbar;
