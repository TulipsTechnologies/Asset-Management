'use client';
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { LoadingSvg } from '@tulipstechnologies/common';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /**
   * `toolbar` is the page-level action look: a white, softly rounded rectangle
   * with a hairline border and a leading icon (Edit, Print, Export). It is
   * deliberately squarer than the pill variants, which stay for form footers
   * and anything that commits a change.
   */
  variant?:
    | 'primary'
    | 'secondary'
    | 'danger'
    | 'outline'
    | 'ghost'
    | 'toolbar'
    | 'toolbarDanger';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'small',
      disabled,
      loading,
      className: className = '',
      children,
      ...rest
    },
    ref,
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center transition duration-200 focus:outline-none gap-x-2 font-normal';

    const variantStyles = {
      primary: 'rounded-full bg-primarycolor/90 text-white hover:bg-primarycolor/100',
      secondary: 'rounded-full bg-gray-600 text-white hover:bg-gray-700',
      danger: 'rounded-full bg-red-600 text-white hover:bg-red-700',
      outline: 'rounded-full border border-gray-300 text-gray-600 hover:border-gray-400',
      ghost: 'rounded-full text-gray-600 bg-gray-100 hover:bg-gray-200',
      toolbar:
        'rounded-lg border border-gray-200 bg-white text-secondaryColor hover:border-gray-300 hover:bg-gray-50',
      toolbarDanger:
        'rounded-lg border border-red-200 bg-white text-red-600 hover:border-red-300 hover:bg-red-50',
    };

    const sizeStyles = {
      small: 'px-4 py-2 text-sm',
      medium: 'px-3 py-2 text-base',
      large: 'px-5 py-3 text-lg',
    };

    const disabledStyles =
      disabled || loading ? 'opacity-50 cursor-not-allowed' : '';

    return (
      <button
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${disabledStyles} ${className}`}
        disabled={disabled || loading}
        ref={ref}
        {...rest}
      >
        {loading && <LoadingSvg bgColor="white" />} {children}
      </button>
    );
  },
);

export default Button;
