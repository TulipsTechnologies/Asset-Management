import { FC, ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { lockBodyScroll, unlockBodyScroll } from "@tulipstechnologies/common";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  size?:
    | "sm"
    | "md"
    | "lg"
    | "xl"
    | "2xl"
    | "3xl"
    | "4xl"
    | "5xl"
    | "6xl"
    | "7xl";
  showCloseBtn?: boolean;
}

const Modal: FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  size,
  showCloseBtn = true,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (!isOpen) return;

    lockBodyScroll();
    window.addEventListener("keydown", handleKeyDown);
    // Move focus into the dialog (WCAG 2.4.3): otherwise keyboard users are left
    // behind the overlay, tabbing through the page underneath. A short timeout rather
    // than one animation frame — the portal's children mount a beat after isOpen flips,
    // and focusing a node that is not yet in the tree silently does nothing.
    const focusTimer = setTimeout(() => {
      if (!dialogRef.current) return;
      if (!dialogRef.current.contains(document.activeElement))
        dialogRef.current.focus();
    }, 50);

    return () => {
      clearTimeout(focusTimer);
      unlockBodyScroll();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Define width classes based on size prop
  const getWidthClass = () => {
    switch (size) {
      case "sm":
        return "max-w-sm";
      case "md":
        return "max-w-md";
      case "lg":
        return "max-w-lg";
      case "xl":
        return "max-w-xl";
      case "2xl":
        return "max-w-2xl";
      case "3xl":
        return "max-w-3xl";
      case "4xl":
        return "max-w-4xl";
      case "5xl":
        return "max-w-5xl";
      case "6xl":
        return "max-w-6xl";
      case "7xl":
        return "max-w-7xl";
      default:
        return "max-w-4xl"; // Default to 4xl for most modals
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-[9999] max-h-[100dvh] overflow-y-auto px-4 sm:px-0"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        ref={dialogRef}
        className={`bg-white text-black rounded-lg shadow-lg relative z-[10000] max-h-[85dvh] sm:max-h-[90dvh] overflow-y-auto w-full sm:w-[95vw] ${getWidthClass()} min-w-0 sm:min-w-[320px]`}
        onClick={(e) => e.stopPropagation()}
      >
        {showCloseBtn && (
          <button
            className="absolute top-4 right-3 w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-200 cursor-pointer z-10"
            onClick={onClose}
            type="button"
            aria-label="Close modal"
          >
            <i className="icon icon-close text-lg"></i>
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
