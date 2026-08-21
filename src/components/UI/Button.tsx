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
    // No `focus:outline-none` here: it beat the global rule and left all 7 variants with no
    // focus indicator at all. The reset now silences the ring only for pointer focus and keeps
    // it for :focus-visible, which is what a keyboard user needs.
    const baseStyles =
      'inline-flex items-center justify-center transition duration-200 gap-x-2 font-normal';

    const variantStyles = {
      primary: 'rounded-full bg-primarycolor/90 text-white hover:bg-primarycolor/100',
      /*
       * The QUIET half of a decision pair — Cancel, Close, Back.
       *
       * This was a solid dark-grey pill, which gave a dismiss the same visual weight as the
       * action beside it: two filled buttons competing, and the one that throws work away
       * shouting as loudly as the one that commits it. An outline recedes and lets the
       * primary carry the emphasis.
       *
       * Changed at the variant, not per call site, because that is what the variant already
       * meant: of its ~78 uses, Cancel, Close and Back are ~58.
       */
      secondary:
        'rounded-full border border-gray-300 bg-white text-secondaryColor hover:border-gray-400 hover:bg-gray-50',
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
