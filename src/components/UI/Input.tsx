"use client";
import { forwardRef, InputHTMLAttributes, ReactNode, useState } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  className?: string;
  inputClass?: string;
  icon?: ReactNode;
  disabled?: boolean;
  allowSubmitOnEnter?: boolean;
  tabIndex?: number;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      required = false,
      className = "",
      inputClass = "",
      icon,
      type = "text",
      disabled = false,
      allowSubmitOnEnter = true,
      tabIndex,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPasswordType = type === "password";

    const togglePasswordVisibility = () => {
      setShowPassword((prev) => !prev);
    };

    return (
      <div className={`flex flex-col ${className}`}>
        {label && (
          <label
            htmlFor={props.id}
            className="block text-sm font-medium text-gray-500"
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          {icon && (
            <span className="absolute left-0 top-1/2 transform -translate-y-1/2 text-gray-400">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            {...props}
            type={isPasswordType && showPassword ? "text" : type}
            className={`w-full px-0 py-2 pr-10 border-b text-base bg-transparent ${inputClass} ${
              error ? "border-red-500" : "border-gray-300"
            } ${icon ? "pl-9" : ""} ${
              disabled ? "opacity-50 cursor-not-allowed" : ""
            } ${type === "number" ? "no-spinner" : ""}`}
            disabled={disabled}
            tabIndex={tabIndex}
            onKeyDown={(e) => {
              // Prevent form submission on Enter key if allowSubmitOnEnter is false
              if (e.key === "Enter" && !allowSubmitOnEnter) {
                e.preventDefault();
              }
              // Call original onKeyDown if provided
              if (props.onKeyDown && allowSubmitOnEnter) {
                props.onKeyDown(e);
              }
            }}
          />

          {isPasswordType && (
            <button
              type="button"
              onClick={togglePasswordVisibility}
              className="absolute right-0 top-1/2 transform -translate-y-1/2 text-gray-400"
              tabIndex={-1}
            >
              {showPassword ? (
                <i className="icon icon-eye"></i>
              ) : (
                <i className="icon icon-eye-close"></i>
              )}
            </button>
          )}
        </div>

        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}

        {!error && helperText && (
          <p className="text-gray-400 text-xs mt-1 italic">{helperText}</p>
        )}
      </div>
    );
  }
);

export default Input;
