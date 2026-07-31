import { forwardRef, InputHTMLAttributes } from 'react';

interface ToggleSwitchProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  toggleSize?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary' | 'success' | 'danger';
  disabled?: boolean;
  onLabel?: string;
  offLabel?: string;
  required?: boolean;
}

const ToggleSwitch = forwardRef<HTMLInputElement, ToggleSwitchProps>(
  (
    {
      label,
      error,
      toggleSize = 'md',
      color = 'primary',
      disabled = false,
      required = false,
      onLabel = 'On',
      offLabel = 'Off',
      className,
      onChange,
      ...rest
    },
    ref,
  ) => {
    const sizeStyles = {
      sm: 'w-8 h-4',
      md: 'w-10 h-5',
      lg: 'w-12 h-6',
    };

    const knobSizeStyles = {
      sm: 'w-3 h-3',
      md: 'w-4 h-4',
      lg: 'w-5 h-5',
    };

    const colorStyles = {
      primary: 'bg-green-700',
      secondary: 'bg-gray-500',
      success: 'bg-green-600',
      danger: 'bg-red-600',
    };

    const switchClasses = [
      'relative inline-flex items-center transition-all duration-200 rounded-full',
      // Invisible extended hit area so the switch meets the ~44px mobile
      // touch-target guideline without changing its visual size.
      "before:content-[''] before:absolute before:-inset-2",
      sizeStyles[toggleSize],
      disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
      className || '',
    ]
      .join(' ')
      .trim();

    const sliderClasses = [
      'bg-gray-300 rounded-full transition-all duration-200',
      'peer-checked:bg-primarycolor',
      sizeStyles[toggleSize],
    ]
      .join(' ')
      .trim();

    const knobClasses = [
      'absolute bg-white rounded-full transition-all duration-200',
      knobSizeStyles[toggleSize],
      'left-[2px] top-[2px]',
      'peer-checked:translate-x-full peer-checked:left-[5px]',
    ]
      .join(' ')
      .trim();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      if (onChange && !disabled) {
        onChange(e);
      }
    };

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label className="block text-sm font-medium text-gray-500 mb-1">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <label
          className={switchClasses}
          style={{ color: colorStyles[color].split(' ')[0] }}
        >
          <input
            type="checkbox"
            className="peer sr-only"
            disabled={disabled}
            ref={ref}
            onChange={handleChange}
            {...rest}
          />
          <span className={sliderClasses}>
            <span
              className={`relative text-white text-xs font-medium text-center w-full transition-all duration-200 ${
                rest.checked ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {/* {rest.checked ? onLabel : offLabel} */}
            </span>
          </span>
          <span className={knobClasses} />
        </label>
        {error && <span className="text-xs text-red-600 mt-1">{error}</span>}
      </div>
    );
  },
);

ToggleSwitch.displayName = 'ToggleSwitch';

export default ToggleSwitch;
