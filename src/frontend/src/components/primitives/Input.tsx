import { forwardRef, InputHTMLAttributes, useId } from 'react';
import { clsx } from 'clsx';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, className, id, ...rest }, ref) => {
    const reactId = useId();
    const inputId = id ?? reactId;
    return (
      <div className="flex flex-col gap-1 text-sm">
        <label htmlFor={inputId} className="text-ink-secondary">{label}</label>
        <input
          id={inputId}
          ref={ref}
          aria-invalid={!!error || undefined}
          aria-describedby={(error || hint) ? `${inputId}-help` : undefined}
          className={clsx(
            'h-10 px-3 rounded-md bg-surface-base text-ink-primary placeholder:text-ink-muted',
            'border border-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus',
            error && 'border-signal-danger',
            className,
          )}
          {...rest}
        />
        {(error || hint) && (
          <span id={`${inputId}-help`} className={clsx('text-xs', error ? 'text-signal-danger' : 'text-ink-tertiary')}>
            {error ?? hint}
          </span>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
