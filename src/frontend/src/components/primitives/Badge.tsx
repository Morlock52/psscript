import { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

export type BadgeSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  severity?: BadgeSeverity;
}

const severityClass: Record<BadgeSeverity, string> = {
  critical: 'bg-signal-danger/15  text-signal-danger  border-signal-danger/30',
  high:     'bg-warm/15           text-warm           border-warm/30',
  medium:   'bg-signal-warning/15 text-signal-warning border-signal-warning/30',
  low:      'bg-ink-muted/20      text-ink-tertiary   border-ink-muted/30',
};

const base =
  'inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 ' +
  'text-xs font-[520] uppercase tracking-wide';

export const Badge = ({ severity, className, ...rest }: BadgeProps) => (
  <span
    className={clsx(
      base,
      severity ? severityClass[severity] : 'bg-surface-raised text-ink-secondary border-surface-overlay',
      className,
    )}
    {...rest}
  />
);
