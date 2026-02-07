import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export type CommandExplainSource =
  | 'documentation'
  | 'chat'
  | 'script-analysis'
  | 'agent-chat'
  | 'unknown';

export interface CommandExplainState {
  open: boolean;
  command: string;
  source: CommandExplainSource;
}

interface CommandExplainContextValue extends CommandExplainState {
  openCommand: (command: string, source?: CommandExplainSource) => void;
  close: () => void;
  lastActiveElement: React.MutableRefObject<HTMLElement | null>;
}

const CommandExplainContext = createContext<CommandExplainContextValue | null>(null);

export const CommandExplainProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<CommandExplainState>({
    open: false,
    command: '',
    source: 'unknown',
  });

  // Used to restore focus when closing the drawer.
  const lastActiveElement = useRef<HTMLElement | null>(null);

  const openCommand = useCallback((command: string, source: CommandExplainSource = 'unknown') => {
    const trimmed = (command || '').trim();
    if (!trimmed) return;
    try {
      lastActiveElement.current = document.activeElement as HTMLElement | null;
    } catch (_e) {
      // ignore
    }
    setState({ open: true, command: trimmed, source });
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
    // Restore focus (best effort).
    setTimeout(() => {
      try {
        lastActiveElement.current?.focus?.();
      } catch (_e) {
        // ignore
      }
    }, 0);
  }, []);

  const value = useMemo<CommandExplainContextValue>(() => ({
    ...state,
    openCommand,
    close,
    lastActiveElement,
  }), [state, openCommand, close]);

  return (
    <CommandExplainContext.Provider value={value}>
      {children}
    </CommandExplainContext.Provider>
  );
};

export function useCommandExplain(): CommandExplainContextValue {
  const ctx = useContext(CommandExplainContext);
  if (!ctx) {
    throw new Error('useCommandExplain must be used within CommandExplainProvider');
  }
  return ctx;
}

