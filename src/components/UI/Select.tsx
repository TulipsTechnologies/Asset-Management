'use client';
import { forwardRef, SelectHTMLAttributes } from 'react';

export interface ISelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  required?: boolean;
  className?: string;
  options: ISelectOption[];
  placeholder?: string;
}

/**
 * Native select styled to match the underline Input primitive. Used instead
 * of the common package's SelectDropdown because that component's option
 * values are numbers while this API uses GUID string ids.
 */
const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      required = false,
      className = '',
      options,
      placeholder,
      disabled,
      ...props
    },
    ref
  ) => {
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
        <select
          ref={ref}
          {...props}
          disabled={disabled}
          className={`w-full px-0 py-2 border-b text-base bg-transparent ${
            error ? 'border-red-500' : 'border-gray-300'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {placeholder !== undefined && (
            <option value="">{placeholder}</option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;
