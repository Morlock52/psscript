import { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface GradientFieldProps extends HTMLAttributes<HTMLDivElement> {
  intensity?: 'subtle' | 'full';
}

/**
 * Aurora-glow gradient. Used by BrandShell as a fixed background.
 * Full intensity = brand routes; subtle = optional decorative use elsewhere.
 * Animation freezes under prefers-reduced-motion.
 */
export const GradientField = ({ intensity = 'full', className, style, ...rest }: GradientFieldProps) => (
  <div
    aria-hidden
    className={clsx('aurora-glow pointer-events-none fixed inset-[-20%] -z-10', className)}
    style={{
      backgroundImage: [
        'radial-gradient(60vmax 60vmax at 30% 20%, var(--warm)   0%, transparent 60%)',
        'radial-gradient(50vmax 50vmax at 70% 80%, var(--cool)   0%, transparent 60%)',
        'radial-gradient(40vmax 40vmax at 50% 50%, var(--violet) 0%, transparent 70%)',
      ].join(', '),
      filter: 'blur(60px) saturate(1.2)',
      opacity: intensity === 'full' ? 0.18 : 0.04,
      animation: intensity === 'full' ? 'aurora-drift 60s linear infinite' : 'none',
      ...style,
    }}
    {...rest}
  />
);
