import { forwardRef, HTMLAttributes } from 'react';
import { clsx } from 'clsx';

export type CardDensity = 'dense' | 'comfortable' | 'roomy';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  density?: CardDensity;
}

const densityClass: Record<CardDensity, string> = {
  dense:        'p-3',
  comfortable:  'p-5',
  roomy:        'p-7',
};

const base =
  'rounded-lg bg-surface-raised text-ink-primary border border-surface-overlay/40 ' +
  'shadow-near transition-[transform,box-shadow] duration-200 ease-out';

const hoverClass =
  'hover:-translate-y-px hover:shadow-far motion-transform';

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ hoverable, density = 'comfortable', className, ...rest }, ref) => (
    <div ref={ref} className={clsx(base, densityClass[density], hoverable && hoverClass, className)} {...rest} />
  ),
);

Card.displayName = 'Card';
