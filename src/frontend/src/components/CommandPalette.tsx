/**
 * Command Palette Component (Cmd+K)
 * Based on cmdk library with keyboard shortcuts
 * 2026 best practices implementation
 */

import React, { useState, useEffect } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import {
  FiFile,
  FiSearch,
  FiSettings,
  FiZap,
  FiCode,
  FiFolder,
  FiClock,
  FiStar
} from 'react-icons/fi';
import './CommandPalette.css';

interface CommandPaletteProps {
  recentScripts?: Array<{ id: string; title: string; }>;
}

export function CommandPalette({ recentScripts = [] }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  // Toggle with Cmd+K or Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelect = (callback: () => void) => {
    setOpen(false);
    callback();
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command Menu"
      className="command-palette"
    >
      <div className="command-palette-header">
        <FiSearch className="search-icon" />
        <Command.Input
          placeholder="Type a command or search..."
          value={search}
          onValueChange={setSearch}
          className="command-input"
        />
        <kbd className="keyboard-hint">ESC</kbd>
      </div>

      <Command.List className="command-list">
        <Command.Empty className="command-empty">
          No results found for &quot;{search}&quot;
        </Command.Empty>

        {/* Actions Group */}
        <Command.Group heading="Actions" className="command-group">
          <Command.Item
            onSelect={() => handleSelect(() => navigate('/scripts/upload'))}
            className="command-item"
          >
            <FiFile className="item-icon" />
            <div className="item-content">
              <span className="item-title">Create new script</span>
              <span className="item-shortcut">Cmd+N</span>
            </div>
          </Command.Item>

          <Command.Item
            onSelect={() => handleSelect(() => navigate('/scripts'))}
            className="command-item"
          >
            <FiFolder className="item-icon" />
            <div className="item-content">
              <span className="item-title">Browse scripts</span>
              <span className="item-shortcut">Cmd+B</span>
            </div>
          </Command.Item>

          <Command.Item
            onSelect={() => handleSelect(() => {
              // Trigger AI analysis
              const event = new CustomEvent('trigger-analysis');
              window.dispatchEvent(event);
            })}
            className="command-item"
          >
            <FiZap className="item-icon" />
            <div className="item-content">
              <span className="item-title">Run AI analysis</span>
              <span className="item-shortcut">Cmd+Enter</span>
            </div>
          </Command.Item>

          <Command.Item
            onSelect={() => handleSelect(() => navigate('/chat'))}
            className="command-item"
          >
            <FiCode className="item-icon" />
            <div className="item-content">
              <span className="item-title">Open AI chat</span>
            </div>
          </Command.Item>
        </Command.Group>

        {/* Recent Scripts */}
        {recentScripts.length > 0 && (
          <Command.Group heading="Recent Scripts" className="command-group">
            {recentScripts.slice(0, 5).map((script) => (
              <Command.Item
                key={script.id}
                onSelect={() => handleSelect(() => navigate(`/scripts/${script.id}`))}
                className="command-item"
              >
                <FiClock className="item-icon" />
                <div className="item-content">
                  <span className="item-title">{script.title}</span>
                </div>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {/* Navigation */}
        <Command.Group heading="Navigation" className="command-group">
          <Command.Item
            onSelect={() => handleSelect(() => navigate('/dashboard'))}
            className="command-item"
          >
            <FiStar className="item-icon" />
            <span className="item-title">Dashboard</span>
          </Command.Item>

          <Command.Item
            onSelect={() => handleSelect(() => navigate('/analytics'))}
            className="command-item"
          >
            <FiZap className="item-icon" />
            <span className="item-title">Analytics</span>
          </Command.Item>

          <Command.Item
            onSelect={() => handleSelect(() => navigate('/settings/profile'))}
            className="command-item"
          >
            <FiSettings className="item-icon" />
            <span className="item-title">Settings</span>
          </Command.Item>
        </Command.Group>
      </Command.List>

      <div className="command-footer">
        <div className="footer-hint">
          <kbd>↑↓</kbd> to navigate
          <kbd>↵</kbd> to select
          <kbd>ESC</kbd> to close
        </div>
      </div>
    </Command.Dialog>
  );
}

export default CommandPalette;
