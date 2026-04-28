import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';

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

export const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <nav
      className={clsx(
        'relative shrink-0 border-r border-surface-overlay/40 bg-surface-base/60 backdrop-blur-sm transition-[width] duration-200',
        collapsed ? 'w-[64px]' : 'w-[240px]',
      )}
      aria-label="Primary navigation"
    >
      <div className="h-14 flex items-center px-4 border-b border-surface-overlay/40">
        <span className="font-display text-ink-primary text-lg">PSScript</span>
      </div>
      <ul className="py-3">
        {NAV.map((n) => (
          <li key={n.to}>
            <NavLink
              to={n.to}
              className={({ isActive }) =>
                clsx(
                  'relative flex items-center h-10 px-4 text-sm text-ink-secondary hover:text-ink-primary',
                  isActive && 'text-ink-primary before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2px] before:bg-accent before:rounded-r',
                )
              }
            >
              {!collapsed ? n.label : n.label[0]}
            </NavLink>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="absolute bottom-4 left-4 text-xs text-ink-tertiary hover:text-ink-primary"
        aria-pressed={collapsed}
      >
        {collapsed ? '›' : '‹ collapse'}
      </button>
    </nav>
  );
};
