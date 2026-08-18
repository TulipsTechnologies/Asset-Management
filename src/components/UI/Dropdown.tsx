import {
  useRef,
  useEffect,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
  createContext,
  useContext,
} from "react";
import { createPortal } from "react-dom";

/**
 * Lets an item inside the menu dismiss it after acting.
 *
 * Menu items stop propagation so a click does not also trigger the row behind them, which
 * means the outside-click handler never sees it and the menu stayed open — sitting on top of
 * whatever dialog the item had just opened. Closing through context keeps the event
 * semantics and still guarantees only one surface is up at a time.
 */
const DropdownCloseContext = createContext<(() => void) | null>(null);

export const useDropdownClose = () => useContext(DropdownCloseContext);

interface DropdownProps {
  children: React.ReactNode;
  buttonChildren: React.ReactNode;
  /** Accessible name for an icon-only trigger (WCAG 4.1.2). */
  ariaLabel?: string;
  containerClassName?: string;
  onClose?: () => void;
  position?: "fixed" | "absolute";
}

export interface DropdownRef {
  close: () => void;
}

const Dropdown = forwardRef<DropdownRef, DropdownProps>(
  (
    {
      children,
      buttonChildren,
      containerClassName,
      ariaLabel = 'Actions',
      onClose = () => { },
      // Row-action kebab menus live inside the table's overflow:auto scroll
      // container. Absolute positioning traps + clips the popover there, so it
      // renders detached from the trigger. Fixed positioning anchors it to the
      // button in viewport coords and escapes the clip (mirrors the main
      // TulipsHRM Dropdown usage for overlay menus).
      position = "fixed",
    },
    ref
  ) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({
      opacity: 0,
      position: position,
      left: position === "fixed" ? "-9999px" : "0",
      top: "0",
    });

    const updatePosition = useCallback(() => {
      if (!buttonRef.current || !dropdownRef.current || !wrapperRef.current)
        return;

      const buttonRect = buttonRef.current.getBoundingClientRect();
      const dropdownRect = dropdownRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const wrapperRect = wrapperRef.current.getBoundingClientRect();

      // Get the actual dropdown height by temporarily making it visible
      const tempStyle = dropdownRef.current.style.cssText;
      dropdownRef.current.style.cssText =
        "position: fixed; top: -9999px; left: -9999px; opacity: 0; pointer-events: none;";
      const actualDropdownHeight = dropdownRef.current.offsetHeight;
      dropdownRef.current.style.cssText = tempStyle;

      // Reset any previous maxHeight/overflow styles
      setDropdownStyle((prev) => ({
        ...prev,
        maxHeight: "none",
        overflowY: "visible",
      }));

      let top: number;
      let left: number;

      if (position === "fixed") {
        top = buttonRect.bottom;
        left = buttonRect.left;
      } else {
        // For absolute positioning, position relative to wrapper
        top = buttonRect.height;
        left = 0;
      }

      // Calculate absolute position in viewport coordinates for boundary checking
      const absoluteLeft =
        position === "fixed" ? left : wrapperRect.left + left;
      const absoluteTop = position === "fixed" ? top : wrapperRect.top + top;

      // Adjust horizontal position
      if (absoluteLeft + dropdownRect.width > viewportWidth) {
        // If overflowing right, align right edges
        if (position === "fixed") {
          left = buttonRect.right - dropdownRect.width;
        } else {
          left = buttonRect.width - dropdownRect.width;
        }
      }
      // Ensure it doesn't go off the left edge
      const minLeft = position === "fixed" ? 0 : -wrapperRect.left;
      left = Math.max(left, minLeft);

      // Adjust vertical position
      const spaceBelow =
        viewportHeight -
        (position === "fixed"
          ? buttonRect.bottom
          : wrapperRect.top + buttonRect.height);

      const spaceAbove =
        position === "fixed" ? buttonRect.top : wrapperRect.top;

      // Add buffer for better UX (don't wait until dropdown is completely cut off)
      const buffer = 50; // Increased buffer to catch more edge cases
      const dropdownHeight = actualDropdownHeight || dropdownRect.height;

      // If button is in the bottom 30% of viewport, prefer positioning above
      const isInBottomPortion = buttonRect.top > viewportHeight * 0.7;

      if (spaceBelow < dropdownHeight + buffer || isInBottomPortion) {
        if (spaceAbove > Math.min(dropdownHeight + buffer, 100)) {
          // Place above button if there's enough space
          top =
            position === "fixed"
              ? buttonRect.top - dropdownHeight
              : -dropdownHeight;
        } else {
          // If neither above nor below has enough space, choose the side with more space
          if (spaceAbove > spaceBelow) {
            // Place above with limited height
            const availableHeight = spaceAbove - buffer;
            top = position === "fixed" ? buffer : -(wrapperRect.top - buffer);
            setDropdownStyle((prev) => ({
              ...prev,
              maxHeight: `${availableHeight}px`,
              overflowY: "auto",
            }));
          } else {
            // Place below with limited height
            const availableHeight = spaceBelow - buffer;
            setDropdownStyle((prev) => ({
              ...prev,
              maxHeight: `${availableHeight}px`,
              overflowY: "auto",
            }));
          }
        }
      }

      setDropdownStyle((prev) => ({
        ...prev,
        position: position,
        top: `${top}px`,
        left: `${left}px`,
        opacity: 1,
        transition: "opacity 0.1s ease-in-out",
      }));

      // Double-check positioning after a frame to handle any layout shifts
      requestAnimationFrame(() => {
        if (!dropdownRef.current) return;
        const finalRect = dropdownRef.current.getBoundingClientRect();

        // If dropdown is still cut off at the bottom, force it above
        if (finalRect.bottom > viewportHeight - 50) {
          const newTop =
            position === "fixed"
              ? buttonRect.top - finalRect.height
              : -finalRect.height;

          setDropdownStyle((prev) => ({
            ...prev,
            top: `${newTop}px`,
          }));
        }
      });
    }, [position]);

    // The actual close is deferred 100ms for the fade, so `isOpen` alone cannot tell a
    // second synchronous call that the first already happened — and some callers close both
    // through the ref and through a menu item. Latch it so onClose fires exactly once.
    const closingRef = useRef(false);

    const closeDropdown = useCallback(() => {
      if (isOpen && !closingRef.current) {
        closingRef.current = true;
        setDropdownStyle((prev) => ({ ...prev, opacity: 0 }));
        setTimeout(() => {
          setIsOpen(false);
          closingRef.current = false;
        }, 100);
        onClose();
      }
    }, [isOpen, onClose]);

    const toggleDropdown = useCallback(() => {
      if (isOpen) {
        closeDropdown();
      } else {
        setIsOpen(true);
        // Use multiple frames to ensure content is fully rendered
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (dropdownRef.current) {
              updatePosition();
            }
          });
        });
      }
    }, [isOpen, updatePosition]);

    // Expose close method via ref
    useImperativeHandle(ref, () => ({
      close: closeDropdown,
    }));

    const debouncedUpdate = useCallback(() => {
      if (!isOpen) return;
      requestAnimationFrame(updatePosition);
    }, [isOpen, updatePosition]);

    useEffect(() => {
      if (!isOpen) return;

      const handleMouseDown = (event: MouseEvent) => {
        const target = event.target as Node;

        // Allow clicks inside the wrapper (button) to pass
        if (wrapperRef.current?.contains(target)) return;

        // The menu is portaled to <body>, so it's no longer a DOM descendant
        // of the wrapper — allow clicks inside it (menu items) to pass too.
        if (dropdownRef.current?.contains(target)) return;

        // Optional: allow exceptions (e.g., date picker popover)
        const isInsideDatepickerPopup = document
          .querySelector(".zener-date-picker")
          ?.contains(target);

        if (isInsideDatepickerPopup) return;

        // Close for true outside clicks
        closeDropdown();
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          closeDropdown();
        }
      };

      // Use capture to catch early, works well with portals
      document.addEventListener("mousedown", handleMouseDown, true);
      document.addEventListener("keydown", handleKeyDown);

      return () => {
        document.removeEventListener("mousedown", handleMouseDown, true);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }, [isOpen, closeDropdown]);


    useEffect(() => {
      if (isOpen) {
        window.addEventListener("resize", debouncedUpdate);
        window.addEventListener("scroll", debouncedUpdate, true);

        return () => {
          window.removeEventListener("resize", debouncedUpdate);
          window.removeEventListener("scroll", debouncedUpdate, true);
        };
      }
    }, [isOpen, debouncedUpdate]);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Node;
        const isInsideDropdown = dropdownRef.current?.contains(target);
        const isInsideDatepickerPopup = document
          .querySelector(".zener-date-picker")
          ?.contains(target);

        if (!isInsideDropdown && !isInsideDatepickerPopup) {
          onClose();
        }
      };

      if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside);
      }

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [isOpen, onClose]);

    return (
      <div ref={wrapperRef} className="relative">
        <button
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          ref={buttonRef}
          onClick={(e) => {
            e.stopPropagation();
            toggleDropdown();
          }}
          className="flex items-center justify-center w-full"
        >
          {buttonChildren}
        </button>
        {isOpen &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={dropdownRef}
              style={dropdownStyle}
              role="menu"
              className={`bg-white shadow-lg border rounded-md z-[9999] min-w-[200px] ${containerClassName}`}
            >
              <DropdownCloseContext.Provider value={closeDropdown}>
                {children}
              </DropdownCloseContext.Provider>
            </div>,
            document.body
          )}
      </div>
    );
  }
);

export default Dropdown;
