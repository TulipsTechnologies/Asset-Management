import { FC, ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { lockBodyScroll, unlockBodyScroll } from "@tulipstechnologies/common";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Id of the element naming this dialog — usually its <h2>. Without it the dialog has no
   *  accessible name and announces only as "dialog". */
  labelledBy?: string;
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
  labelledBy,
  showCloseBtn = true,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      // FOCUS TRAP (WCAG 2.4.3 / 2.1.2). Focus was moved into the dialog on open but nothing
      // held it there: Tab walked straight out into the page behind the overlay, where a
      // screen-reader user could operate controls they could not see and had no way back.
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      // Wrap at both ends, and pull focus back in if it has already escaped.
      if (event.shiftKey) {
        if (active === first || active === dialogRef.current || !dialogRef.current.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !dialogRef.current.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    // Bail before locking anything. `lockBodyScroll` is ref-counted, so a CLOSED modal that
    // still ran the cleanup would call unlockBodyScroll() and release the lock held by
    // whichever dialog is actually open — the page would scroll behind it.
    if (!isOpen) return;

    // Remembered so focus can go back where it came from on close — otherwise it resets to
    // the top of the document and the keyboard user loses their place in the page.
    const previouslyFocused = document.activeElement as HTMLElement | null;

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
      // Only restore if focus is still inside the dialog we are tearing down; if something
      // else has deliberately taken focus (a toast action, a follow-on modal), leave it.
      if (previouslyFocused && document.body.contains(previouslyFocused)) {
        const active = document.activeElement;
        if (!active || active === document.body || dialogRef.current?.contains(active)) {
          previouslyFocused.focus();
        }
      }
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
        aria-labelledby={labelledBy}
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
