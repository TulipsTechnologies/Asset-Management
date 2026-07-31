import { Dropdown } from "@tulipstechnologies/common";
import React, { ReactNode, useEffect, useRef, useState } from "react";
interface FilterButtonProps {
  children: ReactNode;
  openFilter?: boolean;
  setOpenFilter?: (openFilter: boolean) => void;
  rearrangeLogsOpen?: boolean;
  setRearrangeLogsOpen?: (rearrangeLogsOpen: boolean) => void;
}

const FilterButton: React.FC<FilterButtonProps> = ({
  children,
  openFilter = false,
  setOpenFilter,
  rearrangeLogsOpen = false,
  setRearrangeLogsOpen,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(openFilter);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const handleToggleFilter = () => {
    if (setOpenFilter) {
      setOpenFilter(!openFilter);
      setRearrangeLogsOpen?.(true);
    } else {
      setRearrangeLogsOpen?.(false);
      setIsOpen((open) => !open);
    }
  };

  useEffect(() => {
    setIsOpen(rearrangeLogsOpen);
  }, [rearrangeLogsOpen]);

  useEffect(() => {
    setIsOpen(openFilter);
  }, [openFilter]);

  return (
    <div className="filter-button">
      <button
        ref={btnRef}
        onClick={handleToggleFilter}
        className="text-sm flex items-center justify-start gap-x-2 font-medium whitespace-nowrap"
      >
        <i className="icon icon-filter text-primarycolor text-base" /> Filters
      </button>

      {btnRef && isOpen && (
        <Dropdown
          anchorRef={btnRef as any}
          isOpen={isOpen}
          onClose={() => {
            setIsOpen(false);
          }}
        >
          {children}
        </Dropdown>
      )}
    </div>
  );
};

export default FilterButton;
