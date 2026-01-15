import React, { HTMLAttributes, forwardRef, ReactNode } from 'react';

// Define card variants
export type CardVariant = 'default' | 'elevated' | 'outlined' | 'filled' | 'glass';

// Define card props
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: CardVariant;
  hoverable?: boolean;
  clickable?: boolean;
  withBorder?: boolean;
  withShadow?: boolean;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  header?: ReactNode;
  footer?: ReactNode;
  headerClassName?: string;
  footerClassName?: string;
  bodyClassName?: string;
}

// Card component with forwardRef for accessibility
export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      variant = 'default',
      hoverable = false,
      clickable = false,
      withBorder = true,
      withShadow = true,
      rounded = 'xl',
      padding = 'md',
      header,
      footer,
      headerClassName = '',
      footerClassName = '',
      bodyClassName = '',
      className = '',
      ...props
    },
    ref
  ) => {
    // Get variant styles using CSS variables
    const getVariantStyles = (): string => {
      switch (variant) {
        case 'default':
          return 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]';
        case 'elevated':
          return 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] shadow-[var(--shadow-lg)]';
        case 'outlined':
          return 'bg-transparent text-[var(--color-text-primary)] border border-[var(--color-border-default)]';
        case 'filled':
          return 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]';
        case 'glass':
          return 'bg-[var(--color-bg-elevated)]/80 backdrop-blur-lg text-[var(--color-text-primary)]';
        default:
          return 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]';
      }
    };

    // Get rounded styles
    const getRoundedStyles = (): string => {
      switch (rounded) {
        case 'none':
          return 'rounded-none';
        case 'sm':
          return 'rounded-sm';
        case 'md':
          return 'rounded-md';
        case 'lg':
          return 'rounded-lg';
        case 'xl':
          return 'rounded-xl';
        case '2xl':
          return 'rounded-2xl';
        default:
          return 'rounded-xl';
      }
    };

    // Get padding styles
    const getPaddingStyles = (): string => {
      switch (padding) {
        case 'none':
          return 'p-0';
        case 'sm':
          return 'p-3';
        case 'md':
          return 'p-4';
        case 'lg':
          return 'p-6';
        case 'xl':
          return 'p-8';
        default:
          return 'p-4';
      }
    };

    // Get header padding styles
    const getHeaderPaddingStyles = (): string => {
      switch (padding) {
        case 'none':
          return 'px-0 py-0';
        case 'sm':
          return 'px-3 py-2';
        case 'md':
          return 'px-4 py-3';
        case 'lg':
          return 'px-6 py-4';
        case 'xl':
          return 'px-8 py-5';
        default:
          return 'px-4 py-3';
      }
    };

    // Get footer padding styles
    const getFooterPaddingStyles = (): string => {
      switch (padding) {
        case 'none':
          return 'px-0 py-0';
        case 'sm':
          return 'px-3 py-2';
        case 'md':
          return 'px-4 py-3';
        case 'lg':
          return 'px-6 py-4';
        case 'xl':
          return 'px-8 py-5';
        default:
          return 'px-4 py-3';
      }
    };

    // Get body padding styles
    const getBodyPaddingStyles = (): string => {
      if (padding === 'none') return 'p-0';

      // If there's a header or footer, adjust padding
      if (header || footer) {
        switch (padding) {
          case 'sm':
            return 'px-3 py-2';
          case 'md':
            return 'px-4 py-3';
          case 'lg':
            return 'px-6 py-4';
          case 'xl':
            return 'px-8 py-5';
          default:
            return 'px-4 py-3';
        }
      }

      // Default padding if no header or footer
      return getPaddingStyles();
    };

    // Get border styles
    const getBorderStyles = (): string => {
      if (!withBorder) return '';
      if (variant === 'outlined') return '';

      return 'border border-[var(--color-border-default)]';
    };

    // Get shadow styles
    const getShadowStyles = (): string => {
      if (!withShadow) return '';
      if (variant === 'elevated') return '';

      return 'shadow-[var(--shadow-md)]';
    };

    // Get hover styles
    const getHoverStyles = (): string => {
      if (!hoverable) return '';

      return 'transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lg)]';
    };

    // Get clickable styles
    const getClickableStyles = (): string => {
      if (!clickable) return '';

      return 'cursor-pointer active:scale-[0.98] transition-transform duration-200';
    };

    return (
      <div
        ref={ref}
        className={`
          overflow-hidden
          transition-colors duration-300
          ${getVariantStyles()}
          ${getRoundedStyles()}
          ${getBorderStyles()}
          ${getShadowStyles()}
          ${getHoverStyles()}
          ${getClickableStyles()}
          ${className}
        `}
        {...props}
      >
        {/* Card Header */}
        {header && (
          <div
            className={`
              ${getHeaderPaddingStyles()}
              border-b border-[var(--color-border-default)]
              ${headerClassName}
            `}
          >
            {header}
          </div>
        )}

        {/* Card Body */}
        <div
          className={`
            ${getBodyPaddingStyles()}
            ${bodyClassName}
          `}
        >
          {children}
        </div>

        {/* Card Footer */}
        {footer && (
          <div
            className={`
              ${getFooterPaddingStyles()}
              border-t border-[var(--color-border-default)]
              bg-[var(--color-bg-tertiary)]/50
              ${footerClassName}
            `}
          >
            {footer}
          </div>
        )}
      </div>
    );
  }
);

Card.displayName = 'Card';

export default Card;
