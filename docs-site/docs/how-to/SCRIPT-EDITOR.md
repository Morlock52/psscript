---
title: Modern Script Editor
description: VS Code-class editing for PowerShell (command palette, problems, versions/diff, autosave)
---

# Modern Script Editor

The Script Editor is designed to feel like a modern IDE: fast, keyboard-first, and feedback-rich.

It includes:

- A VS Code-like layout (panels + status bar)
- Command palette (keyboard discoverability)
- Problems panel (lint + diagnostics)
- Version history + diff + revert
- Autosave with clear save state
- Optional PowerShell language intelligence when the language server is online

## Open the editor

1. Go to **Script Management**
2. Open a script
3. Click **Edit**

Or use the direct route: `http://localhost:3090/scripts/<id>/edit`

![Modern editor shell](/images/screenshots/variants/script-editor-v1.png)

## Command palette

Open the command palette:

- Button: **Commands**
- Shortcut: `Ctrl/Cmd+Shift+P`

Use it to run actions like Save, Format, Lint, panel toggles, Find/Replace, and navigation.

![Command palette](/images/screenshots/variants/script-editor-palette-v1.png)

## Problems (lint + diagnostics)

The bottom **Problems** panel shows diagnostics with click-to-jump.

- Primary: deterministic lint (PSScriptAnalyzer via the `pwsh-tools` service)
- Fallback: AI lint (if deterministic lint is unavailable)

![Problems panel](/images/screenshots/variants/script-editor-problems-v1.png)

## Versions, diff, revert

The left **Versions** panel shows version history.

- **Diff vs current** opens the Diff panel
- **Revert** reverts to a previous version (creates a new version)

![Diff panel](/images/screenshots/variants/script-editor-diff-v1.png)

## Status bar

The status bar includes:

- cursor position (line/column)
- diagnostics counts
- save state
- language server status

## PowerShell language server (optional)

When available, the editor can connect to the PowerShell language server for IntelliSense-like features.

Local ports:

- Frontend: `http://localhost:3090`
- Backend: `http://localhost:4000`
- AI service: `http://localhost:8000`
- PowerShell tools (lint/format + LSP): `http://localhost:7002` (HTTP) and `ws://localhost:7001` (WS)

