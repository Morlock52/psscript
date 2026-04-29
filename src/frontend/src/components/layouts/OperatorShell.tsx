import { ReactNode, useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { GradientField } from '../primitives/GradientField';
import { useTheme } from '../../contexts/ThemeContext';

export interface OperatorShellProps {
  children: ReactNode;
  theme?: 'dark' | 'light';
  /** Optional sticky right-rail content (used by Pattern 4). */
  rightRail?: ReactNode;
  /** Hide the sidebar entirely (e.g., focused detail mode). */
  hideSidebar?: boolean;
}

export const OperatorShell = ({ children, theme, rightRail, hideSidebar }: OperatorShellProps) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { theme: appTheme } = useTheme();
  const activeTheme = theme ?? appTheme;

  useEffect(() => {
    document.body.setAttribute('data-surface', 'operator');
    document.body.setAttribute('data-theme', activeTheme);
    return () => {
      document.body.removeAttribute('data-surface');
      document.body.removeAttribute('data-theme');
    };
  }, [activeTheme]);

  return (
    <div className="relative min-h-screen flex overflow-x-hidden bg-surface-base text-ink-primary">
      <GradientField intensity="subtle" />
      {!hideSidebar && <Sidebar />}
      {!hideSidebar && mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            className="absolute inset-0 h-full w-full bg-black/60"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation overlay"
          />
          <div className="relative h-full">
            <Sidebar mobile onClose={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setMobileNavOpen(true)} />
        <div className="flex-1 flex">
          <main className="flex-1 min-w-0 px-3 py-4 sm:px-4 md:px-6 md:py-6">{children}</main>
          {rightRail && (
            <aside className="hidden lg:block w-[280px] shrink-0 border-l border-surface-overlay/40 px-5 py-6">
              {rightRail}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};
