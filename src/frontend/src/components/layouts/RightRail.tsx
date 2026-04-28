import { ReactNode } from 'react';

export const RightRail = ({ children }: { children: ReactNode }) => (
  <div className="sticky top-6 space-y-6 text-sm text-ink-secondary">{children}</div>
);
