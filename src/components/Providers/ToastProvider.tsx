"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import { createPortal } from "react-dom";

type TToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-right";
type TToastType = "success" | "error" | "warning" | "info";
interface Toast {
  id: number;
  message: ReactNode;
  type: TToastType;
  duration?: number;
  position?: TToastPosition;
}

interface ToastContextType {
  addToast: {
    success: (
      message: ReactNode,
      duration?: number,
      position?: TToastPosition
    ) => void;
    error: (
      message: ReactNode,
      duration?: number,
      position?: TToastPosition
    ) => void;
    /**
     * Something the user should know that did NOT block the operation — a capitalization
     * that went through without a tax movement, say. Visually distinct from `error` on
     * purpose: a warning that looks like a failure gets treated as one.
     */
    warning: (
      message: ReactNode,
      duration?: number,
      position?: TToastPosition
    ) => void;
    info: (
      message: ReactNode,
      duration?: number,
      position?: TToastPosition
    ) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
};

export const ToastProvider = ({
  position = "top-center",
  children,
}: {
  position?: TToastPosition;
  children: ReactNode;
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    (type: TToastType, message: ReactNode, duration = 3000) => {
      const id = ++nextId.current; // unique even for toasts fired in the same ms
      setToasts((prev) => [...prev, { id, message, type, duration, position }]);
      setTimeout(() => removeToast(id), duration);
    },
    [position, removeToast]
  );

  // Stable context value — recreating this each render made every consumer's
  // `addToast` reference change, re-running effects that depend on it (infinite
  // re-render loops on pages like Data Management / Reports).
  const contextValue = useMemo(
    () => ({
      addToast: {
        success: (message: ReactNode, duration?: number) =>
          addToast("success", message, duration),
        error: (message: ReactNode, duration?: number) =>
          addToast("error", message, duration),
        warning: (message: ReactNode, duration?: number) =>
          addToast("warning", message, duration),
        info: (message: ReactNode, duration?: number) =>
          addToast("info", message, duration),
      },
    }),
    [addToast]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div
            className={`fixed ${position} z-[10001] space-y-4`}
            aria-live="polite"
            aria-relevant="additions"
          >
            {toasts.map((toast) => (
              <div
                key={toast.id}
                role={toast.type === "error" ? "alert" : "status"}
                className={`min-w-[280px] max-w-[350px] px-4 py-3 text-sm opacity-1 
                
                flex items-start justify-between p-4 
                bg-white rounded-lg shadow-lg
                  ${toast.type === "success" ? "" : ""}
                  ${toast.type === "error" ? "" : ""}
                  ${toast.type === "warning" ? "" : ""}
                  ${toast.type === "info" ? "" : ""}`}
              >
                <div className="flex items-start">
                  {toast.type === "success" && (
                    <i className="icon icon-check-circle text-lg leading-none mr-2 text-green-600" />
                  )}
                  {toast.type === "error" && (
                    <i className="icon icon-alert text-lg leading-none mr-2 text-red-600" />
                  )}
                  {toast.type === "warning" && (
                    <i className="icon icon-alert text-lg leading-none mr-2 text-amber-600" />
                  )}
                  {toast.type === "info" && (
                    <i className="icon icon-info text-lg leading-none mr-2 text-blue-600" />
                  )}
                  <div className="text-sm">{toast.message}</div>
                </div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="ml-4 hover:text-gray-400"
                >
                  <i className="icon icon-close text-sm" />
                </button>
              </div>
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
};
