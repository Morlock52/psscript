import React, { useEffect, useMemo, useState } from 'react';
import { Command } from 'cmdk';

export type EditorCommand = {
  id: string;
  title: string;
  keywords?: string[];
  shortcut?: string;
  run: () => void;
};

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  commands: EditorCommand[];
};

export default function EditorCommandPalette({ isOpen, onOpenChange, commands }: Props) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isOpen) setSearch('');
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => {
      const hay = [c.title, ...(c.keywords || [])].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [commands, search]);

  const handleSelect = (cmd: EditorCommand) => {
    onOpenChange(false);
    cmd.run();
  };

  return (
    <Command.Dialog
      open={isOpen}
      onOpenChange={onOpenChange}
      label="Editor Command Palette"
      className="command-palette"
    >
      <div className="command-palette-header">
        <Command.Input
          placeholder="Type a command…"
          value={search}
          onValueChange={setSearch}
          className="command-input"
          autoFocus
        />
        <kbd className="keyboard-hint">ESC</kbd>
      </div>

      <Command.List className="command-list">
        <Command.Empty className="command-empty">
          No results found for &quot;{search}&quot;
        </Command.Empty>

        <Command.Group heading="Editor" className="command-group">
          {filtered.map((c) => (
            <Command.Item
              key={c.id}
              value={`${c.title} ${(c.keywords || []).join(' ')}`}
              onSelect={() => handleSelect(c)}
              className="command-item"
            >
              <div className="item-content" style={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                <span className="item-title">{c.title}</span>
                {c.shortcut ? <span className="item-shortcut">{c.shortcut}</span> : null}
              </div>
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}

