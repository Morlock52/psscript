import { ReactNode, useEffect } from 'react';
import { GradientField } from '../primitives/GradientField';

let dmSerifLoaded = false;

async function loadDMSerifOnce(): Promise<void> {
  if (dmSerifLoaded) return;
  dmSerifLoaded = true;
  // Lazy import — only mounted on brand routes.
  await import('@fontsource/dm-serif-display/400.css');
}

export const BrandShell = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    document.body.setAttribute('data-surface', 'brand');
    void loadDMSerifOnce();
    return () => {
      document.body.removeAttribute('data-surface');
    };
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <GradientField intensity="full" />
      <main className="relative z-10 w-full max-w-[520px]">{children}</main>
      <p className="relative z-10 mt-8 text-center text-xs font-medium text-[var(--ink-tertiary)]">
        Designed and Built by David Keanna
      </p>
    </div>
  );
};
