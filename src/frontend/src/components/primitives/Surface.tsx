import { forwardRef, HTMLAttributes } from 'react';
import { clsx } from 'clsx';

export type SurfaceElevation = 'base' | 'raised' | 'overlay';

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: SurfaceElevation;
}

const elevationClass: Record<SurfaceElevation, string> = {
  base:    'bg-surface-base',
  raised:  'bg-surface-raised',
  overlay: 'bg-surface-overlay',
};

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(
  ({ elevation = 'base', className, ...rest }, ref) => (
    <div ref={ref} className={clsx(elevationClass[elevation], 'text-ink-primary', className)} {...rest} />
  ),
);

Surface.displayName = 'Surface';
