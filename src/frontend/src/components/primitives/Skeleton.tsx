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
    style={{ width, height, ...style }}
    {...rest}
  />
);
