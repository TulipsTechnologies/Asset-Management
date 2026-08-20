'use client';

import { ReactNode, useRef } from 'react';
import { FilterModal, FilterPanelDropdown } from '@tulipstechnologies/common';

interface FilterPanelProps {
  /** Whether the anchored panel is open. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Resets filters to defaults. Renders the red "Clear All" link in the header. */
  onClearAll?: () => void;
  /** Number of active filters — shown as a badge on the Filters button. */
  activeCount?: number;
  /** Filter fields, laid out in the panel's grid. */
  children: ReactNode;
  /** Grid class for the panel body. Default (from FilterModal): grid-cols-2. */
  contentGridClassName?: string;
  /** Tailwind width class for the panel. */
  width?: string;
}

/**
 * Toolbar "Filters" button + anchored dropdown panel, matching the TulipsHRM
 * main-system filter UX (FilterButton + FilterPanelDropdown + FilterModal from
 * @tulipstechnologies/common): white card anchored below the button, "Filters"
 * heading with a red "Clear All" link, two-column field grid, scrollable when
 * tall, closes on outside click. Full-screen shell on mobile.
 */
const FilterPanel = ({
  open,
  onOpenChange,
  onClearAll,
  activeCount = 0,
  children,
  contentGridClassName,
  width,
}: FilterPanelProps) => {
  const btnRef = useRef<HTMLButtonElement | null>(null);

  return (
    <div className="filter-button relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => onOpenChange(!open)}
        className="flex items-center gap-x-2 text-sm font-medium whitespace-nowrap"
      >
        <i className="icon icon-filter text-gray-500 text-base"></i>
        {/* Badge nested INSIDE the label span: the table toolbar's mobile icon
            row hides `button > span` labels and corner-pins `span span` badges,
            so the count survives the collapse. The label span reproduces the
            button's old gap-x-2 so desktop spacing is unchanged. */}
        <span className="inline-flex items-center gap-x-2">
          Filters
          {activeCount > 0 && (
            <span className="ml-1 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full bg-primarycolor text-white text-[11px] leading-none">
              {activeCount}
            </span>
          )}
        </span>
      </button>

      <FilterPanelDropdown
        isOpen={open}
        onClose={() => onOpenChange(false)}
        anchorRef={btnRef}
      >
        <FilterModal
          onClearAll={onClearAll}
          contentGridClassName={contentGridClassName}
          width={width}
        >
          {children}
        </FilterModal>
      </FilterPanelDropdown>
    </div>
  );
};

export default FilterPanel;
