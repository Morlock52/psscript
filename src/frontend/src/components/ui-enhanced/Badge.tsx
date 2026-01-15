import React, { HTMLAttributes, ReactNode } from 'react';

// Define badge variants
export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'neutral';

// Define badge sizes
export type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';

// Define badge props
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  withBorder?: boolean;
  withDot?: boolean;
  withPulse?: boolean;
  withShadow?: boolean;
  count?: number;
  max?: number;
  showZero?: boolean;
  invisible?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  rounded = 'full',
  withBorder = false,
  withDot = false,
  withPulse = false,
  withShadow = false,
  count,
  max = 99,
  showZero = false,
  invisible = false,
  className = '',
  ...props
}) => {
  // If count is provided and it's 0 and showZero is false, hide the badge
  if (count !== undefined && count === 0 && !showZero) {
    return null;
  }

  // If invisible is true, hide the badge
  if (invisible) {
    return null;
  }

  // Format count with max
  const formattedCount = count !== undefined
    ? count > max
      ? `${max}+`
      : count.toString()
    : undefined;

  // Get variant styles - unified colors that work well in both themes
  const getVariantStyles = (): string => {
    switch (variant) {
      case 'primary':
        return 'bg-[var(--color-primary)] text-white';
      case 'secondary':
        return 'bg-gray-500 text-white';
      case 'success':
        return 'bg-green-500 text-white';
      case 'danger':
        return 'bg-red-500 text-white';
      case 'warning':
        return 'bg-yellow-500 text-white';
      case 'info':
        return 'bg-purple-500 text-white';
      case 'neutral':
        return 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]';
      default:
        return 'bg-[var(--color-primary)] text-white';
    }
  };

  // Get size styles
  const getSizeStyles = (): string => {
    switch (size) {
      case 'xs':
        return 'text-xs px-1.5 py-0.5 min-w-[1.25rem] h-[1.25rem]';
      case 'sm':
        return 'text-xs px-2 py-0.5 min-w-[1.5rem] h-[1.5rem]';
      case 'md':
        return 'text-sm px-2.5 py-0.5 min-w-[1.75rem] h-[1.75rem]';
      case 'lg':
        return 'text-base px-3 py-1 min-w-[2rem] h-[2rem]';
      default:
        return 'text-sm px-2.5 py-0.5 min-w-[1.75rem] h-[1.75rem]';
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
      case 'full':
        return 'rounded-full';
      default:
        return 'rounded-full';
    }
  };

  // Get border styles - theme-aware via CSS variable
  const getBorderStyles = (): string => {
    if (!withBorder) return '';
    return 'border border-[var(--color-border-default)]';
  };

  // Get shadow styles - using transparent black works in both modes
  const getShadowStyles = (): string => {
    if (!withShadow) return '';
    return 'shadow-sm shadow-black/20';
  };

  // Get dot styles
  const getDotStyles = (): string => {
    if (!withDot) return '';

    // Dot colors - unified for both themes
    const dotColor = (() => {
      switch (variant) {
        case 'primary':
          return 'bg-blue-400';
        case 'secondary':
          return 'bg-gray-400';
        case 'success':
          return 'bg-green-400';
        case 'danger':
          return 'bg-red-400';
        case 'warning':
          return 'bg-yellow-400';
        case 'info':
          return 'bg-purple-400';
        case 'neutral':
          return 'bg-gray-400';
        default:
          return 'bg-blue-400';
      }
    })();

    const dotSize = (() => {
      switch (size) {
        case 'xs':
          return 'w-1 h-1';
        case 'sm':
          return 'w-1.5 h-1.5';
        case 'md':
          return 'w-2 h-2';
        case 'lg':
          return 'w-2.5 h-2.5';
        default:
          return 'w-2 h-2';
      }
    })();

    return `before:content-[''] before:block before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-1 before:${dotSize} before:rounded-full before:${dotColor} ${withPulse ? `before:animate-pulse` : ''}`;
  };

  return (
    <span
      className={`
        inline-flex items-center justify-center
        font-medium
        ${getSizeStyles()}
        ${getRoundedStyles()}
        ${getVariantStyles()}
        ${getBorderStyles()}
        ${getShadowStyles()}
        ${withDot ? 'relative pl-3' : ''}
        ${getDotStyles()}
        ${className}
      `}
      {...props}
    >
      {formattedCount !== undefined ? formattedCount : children}
    </span>
  );
};

export default Badge;
