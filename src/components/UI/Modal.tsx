import { FC, ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

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
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      document.body.style.overflow = "auto";
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
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-[9999] max-h-[100vh] overflow-y-auto px-4 sm:px-0"
      onClick={onClose}
    >
      <div
        className={`bg-white text-black rounded-lg shadow-lg relative z-[10000] max-h-[85vh] sm:max-h-[90vh] overflow-y-auto w-full sm:w-[95vw] ${getWidthClass()} min-w-0 sm:min-w-[320px]`}
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
