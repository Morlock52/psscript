import { ReactNode, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { GradientField } from '../primitives/GradientField';

export interface OperatorShellProps {
  children: ReactNode;
  theme?: 'dark' | 'light';
  /** Optional sticky right-rail content (used by Pattern 4). */
  rightRail?: ReactNode;
  /** Hide the sidebar entirely (e.g., focused detail mode). */
  hideSidebar?: boolean;
}

export const OperatorShell = ({ children, theme = 'dark', rightRail, hideSidebar }: OperatorShellProps) => {
  useEffect(() => {
    document.body.setAttribute('data-surface', 'operator');
    document.body.setAttribute('data-theme', theme);
    return () => {
      document.body.removeAttribute('data-surface');
      document.body.removeAttribute('data-theme');
    };
  }, [theme]);

  return (
    <div className="relative min-h-screen flex bg-surface-base text-ink-primary">
      <GradientField intensity="subtle" />
      {!hideSidebar && <Sidebar />}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <div className="flex-1 flex">
          <main className="flex-1 px-6 py-6 min-w-0">{children}</main>
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
