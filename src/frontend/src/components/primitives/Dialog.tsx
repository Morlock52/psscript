import { ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

export interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: 'sm' | 'md' | 'lg';
}

const widthClass: Record<NonNullable<DialogProps['width']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-3xl',
};

export const Dialog = ({ open, title, onClose, children, width = 'md' }: DialogProps) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          ref={ref}
          tabIndex={-1}
          onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <motion.div
            data-testid="dialog-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 bg-surface-base/70 backdrop-blur-sm motion-transform"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={clsx('relative bg-surface-overlay text-ink-primary rounded-lg shadow-far w-full', widthClass[width], 'p-6 motion-transform')}
          >
            <h2 className="text-lg font-[680] mb-4">{title}</h2>
            <div>{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
