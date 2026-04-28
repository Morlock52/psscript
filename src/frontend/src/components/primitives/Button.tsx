import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-md font-[520] ' +
  'transition-[transform,background-color,box-shadow] duration-[80ms] ease-out ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus ' +
  'active:scale-[0.98] motion-transform select-none';

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-8  px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};

const variantClass: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-ink-inverse hover:brightness-110 ' +
    'shadow-near hover:shadow-far',
  secondary:
    'bg-surface-raised text-ink-primary border border-surface-overlay hover:bg-surface-overlay',
  ghost:
    'bg-transparent text-ink-primary hover:bg-surface-raised',
  danger:
    'bg-signal-danger text-ink-inverse hover:brightness-110 shadow-near',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, leadingIcon, trailingIcon, className, children, ...rest }, ref) => {
    const isInert = disabled || loading;
    return (
      <button
        ref={ref}
        type={rest.type ?? 'button'}
        aria-disabled={isInert || undefined}
        aria-busy={loading || undefined}
        disabled={isInert}
        className={clsx(base, sizeClass[size], variantClass[variant], isInert && 'opacity-50 pointer-events-none', className)}
        {...rest}
      >
        {leadingIcon && <span aria-hidden>{leadingIcon}</span>}
        <span>{children}</span>
        {trailingIcon && <span aria-hidden>{trailingIcon}</span>}
      </button>
    );
  },
);

Button.displayName = 'Button';
