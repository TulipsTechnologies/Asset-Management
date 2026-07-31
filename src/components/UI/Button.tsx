'use client';
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { LoadingSvg } from '@tulipstechnologies/common';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
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
      'inline-flex items-center justify-center rounded-full transition duration-200 focus:outline-none gap-x-2 font-normal';

    const variantStyles = {
      primary: 'bg-primarycolor/90 text-white hover:bg-primarycolor/100',
      secondary: 'bg-gray-600 text-white hover:bg-gray-700',
      danger: 'bg-red-600 text-white hover:bg-red-700',
      outline: 'border border-gray-300 text-gray-600 hover:border-gray-400',
      ghost: 'text-gray-600 bg-gray-100 hover:bg-gray-200',
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
