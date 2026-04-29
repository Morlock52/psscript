import { FaBars } from 'react-icons/fa';

interface TopbarProps {
  onMenuClick?: () => void;
}

export const Topbar = ({ onMenuClick }: TopbarProps) => (
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
      <span className="truncate font-display text-base text-ink-primary md:hidden">PSScript</span>
      <div className="hidden text-xs text-ink-tertiary tabular-nums md:block" aria-live="polite" />
    </div>
    <div className="flex items-center gap-3">
      <button
        type="button"
        className="text-xs text-ink-tertiary hover:text-ink-primary border border-surface-overlay/60 rounded px-2 py-1"
        aria-label="Open command palette"
      >
        ⌘K
      </button>
    </div>
  </header>
);
