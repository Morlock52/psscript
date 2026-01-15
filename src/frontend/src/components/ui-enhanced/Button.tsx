import React, { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';

// Define variant types
export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'ghost' | 'outline';

// Define size types
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

// Define button props extending HTML button attributes
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  withRipple?: boolean;
}

// Button component with forwardRef for accessibility
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      isLoading = false,
      leftIcon,
      rightIcon,
      rounded = 'lg',
      withRipple = true,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const [ripples, setRipples] = React.useState<{ x: number; y: number; id: number }[]>([]);

    // Handle ripple effect
    const handleRipple = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!withRipple || disabled || isLoading) return;

      const button = e.currentTarget;
      const rect = button.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const id = Date.now();
      setRipples([...ripples, { x, y, id }]);

      // Remove ripple after animation completes
      setTimeout(() => {
        setRipples(ripples => ripples.filter(ripple => ripple.id !== id));
      }, 600);
    };

    // Get variant styles using CSS variables
    const getVariantStyles = (): string => {
      switch (variant) {
        case 'primary':
          return `
            bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)]
            hover:from-[var(--color-primary-light)] hover:to-[var(--color-primary)]
            active:from-[var(--color-primary-dark)] active:to-[var(--color-primary-dark)]
            text-white shadow-sm hover:shadow-md
          `;
        case 'secondary':
          return `
            bg-[var(--color-bg-tertiary)]
            hover:bg-[var(--color-bg-tertiary)]/80
            text-[var(--color-text-primary)]
            border border-[var(--color-border-default)]
          `;
        case 'success':
          return `
            bg-gradient-to-r from-emerald-500 to-emerald-600
            hover:from-emerald-400 hover:to-emerald-500
            text-white shadow-sm hover:shadow-md
          `;
        case 'danger':
          return `
            bg-gradient-to-r from-red-500 to-red-600
            hover:from-red-400 hover:to-red-500
            text-white shadow-sm hover:shadow-md
          `;
        case 'warning':
          return `
            bg-gradient-to-r from-amber-500 to-amber-600
            hover:from-amber-400 hover:to-amber-500
            text-white shadow-sm hover:shadow-md
          `;
        case 'info':
          return `
            bg-gradient-to-r from-violet-500 to-violet-600
            hover:from-violet-400 hover:to-violet-500
            text-white shadow-sm hover:shadow-md
          `;
        case 'ghost':
          return `
            bg-transparent
            hover:bg-[var(--color-bg-tertiary)]
            text-[var(--color-text-secondary)]
            hover:text-[var(--color-text-primary)]
          `;
        case 'outline':
          return `
            bg-transparent
            border-2 border-[var(--color-primary)]
            text-[var(--color-primary)]
            hover:bg-[var(--color-primary)]/10
          `;
        default:
          return `
            bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)]
            hover:from-[var(--color-primary-light)] hover:to-[var(--color-primary)]
            text-white shadow-sm hover:shadow-md
          `;
      }
    };

    // Get size styles
    const getSizeStyles = (): string => {
      switch (size) {
        case 'xs':
          return 'text-xs py-1.5 px-2.5 gap-1';
        case 'sm':
          return 'text-sm py-2 px-3 gap-1.5';
        case 'md':
          return 'text-sm py-2.5 px-4 gap-2';
        case 'lg':
          return 'text-base py-3 px-5 gap-2';
        case 'xl':
          return 'text-lg py-3.5 px-6 gap-2.5';
        default:
          return 'text-sm py-2.5 px-4 gap-2';
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
        case 'full':
          return 'rounded-full';
        default:
          return 'rounded-lg';
      }
    };

    // Get disabled styles
    const getDisabledStyles = (): string => {
      return `
        opacity-50 cursor-not-allowed
        bg-[var(--color-bg-tertiary)]
        text-[var(--color-text-tertiary)]
      `;
    };

    return (
      <button
        ref={ref}
        className={`
          relative inline-flex items-center justify-center
          transition-all duration-200 ease-out
          font-medium
          ${getSizeStyles()}
          ${getRoundedStyles()}
          ${disabled || isLoading ? getDisabledStyles() : getVariantStyles()}
          ${fullWidth ? 'w-full' : ''}
          ${className}
          focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:ring-offset-2 focus:ring-offset-[var(--color-bg-primary)]
          active:scale-[0.98]
          overflow-hidden
        `}
        disabled={disabled || isLoading}
        onClick={handleRipple}
        {...props}
      >
        {/* Ripple effect */}
        {withRipple &&
          ripples.map(ripple => (
            <span
              key={ripple.id}
              className="absolute rounded-full transform -translate-x-1/2 -translate-y-1/2 animate-ripple bg-white/30"
              style={{
                left: ripple.x,
                top: ripple.y,
                width: '200%',
                paddingBottom: '200%',
              }}
            />
          ))}

        {/* Loading spinner */}
        {isLoading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <svg
              className="animate-spin h-5 w-5 text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </span>
        )}

        {/* Button content */}
        <span className={`flex items-center ${isLoading ? 'invisible' : 'visible'}`}>
          {leftIcon && <span className="shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </span>
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
