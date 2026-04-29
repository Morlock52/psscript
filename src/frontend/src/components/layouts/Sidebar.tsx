import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import { FaTimes } from 'react-icons/fa';

interface NavItem {
  to: string;
  label: string;
  icon?: string;
}

const NAV: NavItem[] = [
  { to: '/dashboard',     label: 'Dashboard' },
  { to: '/scripts',       label: 'Scripts' },
  { to: '/search',        label: 'Search' },
  { to: '/categories',    label: 'Categories' },
  { to: '/documentation', label: 'Documentation' },
  { to: '/chat',          label: 'Chat' },
  { to: '/agentic',       label: 'Agentic' },
  { to: '/analytics',     label: 'Analytics' },
  { to: '/settings',      label: 'Settings' },
];

interface SidebarProps {
  mobile?: boolean;
  onClose?: () => void;
}

export const Sidebar = ({ mobile = false, onClose }: SidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <nav
      className={clsx(
        'relative shrink-0 border-r border-surface-overlay/40 bg-surface-base/90 backdrop-blur-sm',
        mobile
          ? 'h-full w-[min(82vw,20rem)] shadow-[var(--shadow-far)]'
          : clsx('hidden md:block transition-[width] duration-200', collapsed ? 'w-[64px]' : 'w-[240px]'),
      )}
      aria-label="Primary navigation"
    >
      <div className="h-14 flex items-center justify-between px-4 border-b border-surface-overlay/40">
        <span className="font-display text-ink-primary text-lg">{collapsed && !mobile ? 'PS' : 'PSScript'}</span>
        {mobile && (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-surface-overlay/60 text-ink-tertiary hover:text-ink-primary"
            aria-label="Close navigation"
          >
            <FaTimes aria-hidden="true" />
          </button>
        )}
      </div>
      <ul className="py-3">
        {NAV.map((n) => (
          <li key={n.to}>
            <NavLink
              to={n.to}
              onClick={onClose}
              className={({ isActive }) =>
                clsx(
                  'relative flex items-center h-10 px-4 text-sm text-ink-secondary hover:text-ink-primary',
                  isActive && 'text-ink-primary before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2px] before:bg-accent before:rounded-r',
                )
              }
            >
              {!collapsed || mobile ? n.label : n.label[0]}
            </NavLink>
          </li>
        ))}
      </ul>
      {!mobile && (
        <div className="absolute bottom-4 left-4 right-4 space-y-3">
          {!collapsed && (
            <p className="text-[11px] leading-4 text-ink-tertiary">
              Designed and Built by David Keanna
            </p>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="text-xs text-ink-tertiary hover:text-ink-primary"
            aria-pressed={collapsed}
          >
            {collapsed ? '›' : '‹ collapse'}
          </button>
        </div>
      )}
    </nav>
  );
};
