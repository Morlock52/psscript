export const Topbar = () => (
  <header className="h-14 flex items-center justify-between px-6 border-b border-surface-overlay/40 bg-surface-base/60 backdrop-blur-sm">
    <div className="text-xs text-ink-tertiary tabular-nums" aria-live="polite" />
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
