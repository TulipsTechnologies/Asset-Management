'use client';
import { useRef } from 'react';
import Dropdown, { DropdownRef } from '../UI/Dropdown';
import CustomMenuItem from '../UI/CustomMenuItem';
import { TBulkAction } from './CustomTableInterface';

interface SelectionBarProps {
  count: number;
  /** Entity noun for the count text, e.g. "vehicle" -> "2 vehicle(s) selected". */
  entityLabel?: string;
  bulkActions?: TBulkAction[];
  selectedIds: (string | number)[];
  onClear: () => void;
}

/**
 * Green-tinted bulk-selection banner shown above the table toolbar whenever
 * one or more rows are checked — mirrors the TulipsHRM employee module's
 * bulk-actions bar (Bulk Actions dropdown + Clear Selection link).
 */
const SelectionBar = ({
  count,
  entityLabel = 'item',
  bulkActions,
  selectedIds,
  onClear,
}: SelectionBarProps) => {
  const dropdownRef = useRef<DropdownRef>(null);

  if (count === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 w-full mb-3 px-4 py-2 rounded-lg bg-primarycolor/10 border border-primarycolor/20">
      <span className="text-sm font-medium text-secondaryColor">
        {count} {entityLabel}(s) selected
      </span>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {bulkActions && bulkActions.length > 0 && (
          <Dropdown
            ref={dropdownRef}
            buttonChildren={
              <div className="text-sm font-medium bg-white text-primarycolor border border-primarycolor inline-flex items-center gap-x-1 py-1.5 px-3 rounded-full whitespace-nowrap">
                <i className="icon icon-bulk text-primarycolor mr-1" />{' '}
                Bulk Actions{' '}
                <i className="icon icon-down text-[6px] ml-2"></i>
              </div>
            }
          >
            {bulkActions.map((action, index, arr) => (
              <CustomMenuItem
                key={index}
                label={action.label}
                danger={action.danger}
                icon={<i className="icon icon-right text-[10px]" />}
                border={index !== arr.length - 1}
                onClick={() => {
                  dropdownRef.current?.close();
                  action.onClick(selectedIds);
                }}
              />
            ))}
          </Dropdown>
        )}
        <button
          type="button"
          onClick={onClear}
          className="text-sm font-medium text-primarycolor hover:underline whitespace-nowrap"
        >
          Clear Selection
        </button>
      </div>
    </div>
  );
};

export default SelectionBar;
