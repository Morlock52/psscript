import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

export type ToastTone = 'default' | 'success' | 'warning' | 'danger';

export interface ToastProps {
  open: boolean;
  tone?: ToastTone;
  title: string;
  description?: ReactNode;
  onDismiss?: () => void;
}

const toneClass: Record<ToastTone, string> = {
  default: 'border-surface-overlay',
  success: 'border-signal-success/40',
  warning: 'border-signal-warning/40',
  danger:  'border-signal-danger/40',
};

export const Toast = ({ open, tone = 'default', title, description, onDismiss }: ToastProps) => (
  <AnimatePresence>
    {open && (
      <motion.div
        role="status"
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 16 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        className={clsx(
          'fixed bottom-6 right-6 z-50 max-w-sm rounded-lg border p-4 bg-surface-overlay text-ink-primary shadow-far motion-transform',
          toneClass[tone],
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="text-sm font-[520]">{title}</div>
            {description && <div className="text-xs text-ink-tertiary mt-1">{description}</div>}
          </div>
          {onDismiss && (
            <button
              type="button"
              aria-label="Dismiss"
              onClick={onDismiss}
              className="text-ink-tertiary hover:text-ink-primary"
            >
              ×
            </button>
          )}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);
