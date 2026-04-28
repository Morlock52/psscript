import { KeyboardEvent } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

export interface TabItem {
  id: string;
  label: string;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export const Tabs = ({ items, active, onChange, className, size = 'md' }: TabsProps) => {
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const idx = items.findIndex((t) => t.id === active);
    if (idx < 0) return;
    let next = idx;
    if (e.key === 'ArrowRight') next = Math.min(items.length - 1, idx + 1);
    if (e.key === 'ArrowLeft')  next = Math.max(0, idx - 1);
    if (e.key === 'Home')       next = 0;
    if (e.key === 'End')        next = items.length - 1;
    if (next !== idx) {
      e.preventDefault();
      onChange(items[next].id);
    }
  };

  return (
    <div role="tablist" className={clsx('flex items-stretch border-b border-surface-overlay', className)}>
      {items.map((t) => {
        const selected = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={selected}
            aria-disabled={t.disabled || undefined}
            disabled={t.disabled}
            tabIndex={selected ? 0 : -1}
            onClick={() => !t.disabled && onChange(t.id)}
            onKeyDown={onKey}
            className={clsx(
              'relative px-4 py-2 text-sm font-[520] transition-colors',
              size === 'sm' ? 'h-8' : 'h-10',
              selected ? 'text-ink-primary' : 'text-ink-tertiary hover:text-ink-secondary',
              t.disabled && 'opacity-50 pointer-events-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus',
            )}
          >
            {t.label}
            {selected && (
              <motion.span
                layoutId="tabs-indicator"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="absolute left-2 right-2 -bottom-px h-[2px] bg-accent"
              />
            )}
          </button>
        );
      })}
    </div>
  );
};
