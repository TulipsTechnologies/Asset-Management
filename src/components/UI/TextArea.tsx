import { useState, useEffect, useId, forwardRef, TextareaHTMLAttributes, ChangeEvent } from 'react';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  className?: string;
  textAreaClassName?: string;
  value?: string;
  onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void;
}

const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      label,
      error,
      helperText,
      required = false,
      className: className = '',
      value,
      onChange,
      textAreaClassName,
      ...props
    },
    ref,
  ) => {
    const [height, setHeight] = useState<string>('auto');

    const adjustHeight = (textarea: HTMLTextAreaElement | null) => {
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
        setHeight(`${textarea.scrollHeight}px`);
      }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      adjustHeight(e.target);
      if (onChange) {
        onChange(e);
      }
    };

    useEffect(() => {
      const textarea = (ref as React.RefObject<HTMLTextAreaElement>)?.current;
      adjustHeight(textarea);
    }, [value, ref]);

    const generatedId = useId();
    const textAreaId = props.id ?? generatedId;

    return (
      <div className={`flex flex-col ${className}`}>
        {label && (
          <label
            // The label pointed at props.id, and not one of this component's 49 call sites
            // passes an id — so every one of them rendered a label associated with nothing:
            // no screen-reader announcement, and clicking the label did not focus the field.
            // useId supplies a stable, SSR-safe fallback, exactly as Input.tsx already does.
            htmlFor={textAreaId}
            className="block text-sm font-medium text-gray-500 mb-1"
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <textarea
          {...props}
          id={textAreaId}
          ref={ref}
          value={value}
          onChange={handleInputChange}
          style={{ height }}
          className={`w-full px-0 py-2 border-b bg-transparent overflow-hidden text-base focus:outline-none ${
            error ? 'border-red-500' : 'border-gray-300'
          } ${textAreaClassName}`}
        />

        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}

        {!error && helperText && (
          <p className="text-gray-600 text-xs mt-1">{helperText}</p>
        )}
      </div>
    );
  },
);

export default TextArea;
