import { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

const roundedClass = {
  sm:   'rounded-sm',
  md:   'rounded-md',
  lg:   'rounded-lg',
  full: 'rounded-full',
};

export const Skeleton = ({ width = '100%', height = 14, rounded = 'sm', className, style, ...rest }: SkeletonProps) => (
  <div
    aria-hidden
    className={clsx(
      'skeleton-shimmer bg-surface-overlay',
      roundedClass[rounded],
      className,
    )}
    style={{
      width,
      height,
      backgroundImage:
        'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
      backgroundSize: '200% 100%',
      animation: 'skeleton-shimmer 1400ms linear infinite',
      ...style,
    }}
    {...rest}
  />
);
