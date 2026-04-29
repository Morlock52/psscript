import { useNavigate } from 'react-router-dom';
import { FaBars, FaMoon, FaSignOutAlt, FaSun } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';

interface TopbarProps {
  onMenuClick?: () => void;
}

export const Topbar = ({ onMenuClick }: TopbarProps) => {
  const navigate = useNavigate();
  const { logout, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 h-14 flex items-center justify-between gap-3 px-3 sm:px-4 md:px-6 border-b border-surface-overlay/40 bg-surface-base/85 backdrop-blur-sm">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-surface-overlay/60 text-ink-tertiary hover:text-ink-primary md:hidden"
          aria-label="Open navigation"
        >
          <FaBars aria-hidden="true" />
        </button>
        <div className="min-w-0 max-w-[46vw] leading-tight">
          <span className="block truncate font-display text-base text-ink-primary">PSScript</span>
          <span className="block truncate text-[10px] text-ink-tertiary sm:text-[11px]">
            Designed and Built by David Keanna
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleTheme}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-surface-overlay/60 px-3 text-xs text-ink-tertiary hover:text-ink-primary"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <FaSun aria-hidden="true" /> : <FaMoon aria-hidden="true" />}
          <span className="hidden sm:inline">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
        {isAuthenticated && (
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-surface-overlay/60 px-3 text-xs text-ink-tertiary hover:border-red-400/60 hover:text-red-300"
            aria-label="Log out"
            title="Log out"
          >
            <FaSignOutAlt aria-hidden="true" />
            <span className="hidden sm:inline">Log out</span>
          </button>
        )}
      </div>
    </header>
  );
};
