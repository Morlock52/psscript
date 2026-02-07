import React, { useEffect, useMemo, useRef, useState } from 'react';
import MonacoEditor from 'react-monaco-editor';
import 'monaco-editor/esm/vs/basic-languages/powershell/powershell';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import EditorCommandPalette, { EditorCommand } from './EditorCommandPalette';
import { scriptService } from '../../services/api';
import type { EditorSaveState, LintIssue, LintResult } from './types';
import { CodeDiffView } from '../CodeDiffView';
import { getApiUrl } from '../../utils/apiUrl';
import { attachPowerShellLsp, type LspStatus } from './lsp/powershellLspClient';

type VersionRow = {
  id: number;
  version: number;
  changelog?: string | null;
  userId?: number;
  createdAt?: string;
  user?: { id: number; username: string } | null;
  linesChanged?: number;
};

type VersionsResponse = {
  scriptId: number;
  scriptTitle: string;
  currentVersion: number;
  totalVersions: number;
  versions: VersionRow[];
};

type Props = {
  scriptId?: string;
  title?: string;
  description?: string;
  onTitleChange?: (title: string) => void;
  onDescriptionChange?: (desc: string) => void;

  content: string;
  onContentChange: (content: string) => void;

  onSave: (reason: 'manual' | 'autosave') => Promise<void>;
  onReset?: () => void;

  initialSaveState?: EditorSaveState;
  autosaveDefaultOn?: boolean;
};

const cardStyles =
  'rounded-xl shadow-[var(--shadow-md)] overflow-hidden bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] transition-colors duration-300';

const panelStyles =
  'bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg overflow-hidden';

const buttonPrimaryStyles =
  'px-3 py-2 rounded-md bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white transition disabled:opacity-60 disabled:cursor-not-allowed';
const buttonSecondaryStyles =
  'px-3 py-2 rounded-md bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] transition disabled:opacity-60 disabled:cursor-not-allowed';

function severityToMonaco(s: string): number {
  const monaco = (window as any).monaco;
  if (!monaco?.MarkerSeverity) return 3;
  if (s === 'Error') return monaco.MarkerSeverity.Error;
  if (s === 'Warning') return monaco.MarkerSeverity.Warning;
  return monaco.MarkerSeverity.Info;
}

function buildSimpleOutline(text: string): Array<{ name: string; line: number }> {
  // Heuristic outline for PowerShell: functions + classes + regions
  const out: Array<{ name: string; line: number }> = [];
  const lines = text.split('\n');
  const rxFunc = /^\s*function\s+([A-Za-z0-9_-]+)\b/i;
  const rxClass = /^\s*class\s+([A-Za-z0-9_]+)\b/i;
  const rxRegion = /^\s*#region\s+(.+)\s*$/i;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m1 = line.match(rxFunc);
    if (m1) out.push({ name: `function ${m1[1]}`, line: i + 1 });
    const m2 = line.match(rxClass);
    if (m2) out.push({ name: `class ${m2[1]}`, line: i + 1 });
    const m3 = line.match(rxRegion);
    if (m3) out.push({ name: `#region ${m3[1]}`, line: i + 1 });
  }
  return out;
}

export default function ScriptEditorShell({
  scriptId,
  title,
  description,
  onTitleChange,
  onDescriptionChange,
  content,
  onContentChange,
  onSave,
  onReset,
  initialSaveState = 'saved',
  autosaveDefaultOn = true,
}: Props) {
  const editorRef = useRef<any>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const [leftOpen, setLeftOpen] = useState(true);
  const [bottomOpen, setBottomOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(false);

  const [leftTab, setLeftTab] = useState<'details' | 'outline' | 'versions'>('versions');
  const [bottomTab, setBottomTab] = useState<'problems' | 'diff'>('problems');

  const [autosaveOn, setAutosaveOn] = useState(autosaveDefaultOn);
  const [saveState, setSaveState] = useState<EditorSaveState>(initialSaveState);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const [cursor, setCursor] = useState<{ line: number; col: number }>({ line: 1, col: 1 });
  const [wordWrap, setWordWrap] = useState<'on' | 'off'>('on');

  const [lint, setLint] = useState<LintResult | null>(null);
  const [lintRunning, setLintRunning] = useState(false);
  const [lintUpdatedAt, setLintUpdatedAt] = useState<string | null>(null);

  const [diffFrom, setDiffFrom] = useState<number | null>(null);
  const [diffTo, setDiffTo] = useState<number | null>(null);
  const [diffOriginal, setDiffOriginal] = useState<string>('');
  const [diffImproved, setDiffImproved] = useState<string>('');

  const apiUrl = getApiUrl();
  const [lspStatus, setLspStatus] = useState<LspStatus>('offline');
  const lspRef = useRef<any>(null);

  const versionsQuery = useQuery({
    queryKey: ['scriptVersions', scriptId],
    queryFn: () => scriptService.getScriptVersions(String(scriptId)),
    enabled: Boolean(scriptId),
    staleTime: 15_000,
    retry: 0,
  });

  const versionsData = (versionsQuery.data || null) as VersionsResponse | null;

  const outline = useMemo(() => buildSimpleOutline(content), [content]);

  // Hotkeys
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void runSave('manual');
      }
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        void runFormat();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, autosaveOn, saveState]);

  // Autosave debounce
  useEffect(() => {
    if (!autosaveOn) return;
    if (saveState !== 'dirty') return;

    const t = setTimeout(() => {
      void runSave('autosave');
    }, 1600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, title, description, autosaveOn, saveState]);

  // Lint debounce (only if dirty, and not too frequent)
  useEffect(() => {
    if (saveState === 'dirty') {
      const t = setTimeout(() => {
        void runLint({ silent: true });
      }, 1800);
      return () => clearTimeout(t);
    }
    return;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  // Map lint issues to Monaco markers
  useEffect(() => {
    const monaco = (window as any).monaco;
    const editor = editorRef.current;
    if (!monaco || !editor) return;
    const model = editor.getModel?.();
    if (!model) return;

    const markers = (lint?.issues || []).map((i) => ({
      severity: severityToMonaco(i.severity),
      message: `${i.ruleName}: ${i.message}`,
      startLineNumber: Math.max(1, i.line),
      endLineNumber: Math.max(1, i.line),
      startColumn: Math.max(1, i.column || 1),
      endColumn: Math.max(1, (i.column || 1) + 1),
      source: lint?.source === 'deterministic' ? 'PSScriptAnalyzer' : 'AI Lint',
    }));
    monaco.editor.setModelMarkers(model, 'problems', markers);
  }, [lint]);

  // LSP attaches once the Monaco editor is mounted (best-effort).
  const attachLspIfNeeded = () => {
    if (!scriptId) return;
    const monaco = (window as any).monaco;
    const editor = editorRef.current;
    if (!monaco || !editor) return;
    if (lspRef.current) return;

    lspRef.current = attachPowerShellLsp({
      apiUrl,
      scriptId,
      editor,
      monaco,
      getText: () => content,
      onDiagnostics: (diags) => {
        const issues: LintIssue[] = diags.map((d) => ({
          severity: (d.severity as any) || 'Info',
          ruleName: d.ruleName || 'PSES',
          message: d.message,
          line: d.line,
          column: d.column,
        }));
        setLint({ issues, source: 'deterministic' });
        setLintUpdatedAt(new Date().toISOString());
      },
      setStatus: setLspStatus,
    });
  };

  useEffect(() => {
    return () => {
      try { lspRef.current?.dispose?.(); } catch {}
      lspRef.current = null;
    };
  }, []);

  const runSave = async (reason: 'manual' | 'autosave') => {
    if (saveState === 'saving') return;
    setSaveError(null);
    setSaveState('saving');
    try {
      await onSave(reason);
      setSaveState('saved');
      setLastSavedAt(new Date().toISOString());
      if (reason === 'manual') toast.success('Saved');
    } catch (err: any) {
      const msg = String(err?.message || 'Save failed');
      setSaveError(msg);
      setSaveState('error');
      toast.error(msg);
    }
  };

  const runLint = async ({ silent }: { silent: boolean }) => {
    if (lintRunning) return;
    setLintRunning(true);
    try {
      // Primary: deterministic (pwsh-tools via backend)
      const resp = await fetch(`${apiUrl}/editor/lint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (resp.ok) {
        const data = (await resp.json()) as { issues: LintIssue[] };
        setLint({ issues: data.issues || [], source: 'deterministic' });
        setLintUpdatedAt(new Date().toISOString());
        if (!silent) toast.success('Lint complete');
        return;
      }
      throw new Error(`deterministic lint failed (${resp.status})`);
    } catch (_err) {
      try {
        // Fallback: AI lint
        const resp2 = await fetch(`${apiUrl}/ai-agent/lint`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });
        if (!resp2.ok) throw new Error(`AI lint failed (${resp2.status})`);
        const data2 = (await resp2.json()) as { issues: LintIssue[] };
        setLint({ issues: data2.issues || [], source: 'ai_fallback' });
        setLintUpdatedAt(new Date().toISOString());
        if (!silent) toast.info('Lint complete (AI fallback)');
      } catch (err2: any) {
        if (!silent) toast.error(String(err2?.message || 'Lint failed'));
      }
    } finally {
      setLintRunning(false);
    }
  };

  const runFormat = async () => {
    try {
      const resp = await fetch(`${apiUrl}/editor/format`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (resp.ok) {
        const data = (await resp.json()) as { formatted: string };
        if (typeof data.formatted === 'string' && data.formatted.length > 0) {
          onContentChange(data.formatted);
          setSaveState('dirty');
          toast.success('Formatted');
          return;
        }
      }
      throw new Error('Format unavailable');
    } catch (_err) {
      // Monaco format action may exist if LSP is connected.
      try {
        const editor = editorRef.current;
        await editor?.getAction?.('editor.action.formatDocument')?.run?.();
        toast.info('Attempted Monaco format');
      } catch {
        toast.error('Format not available (LSP offline)');
      }
    }
  };

  const openDiff = async (from: number, to: number) => {
    if (!scriptId) return;
    setBottomOpen(true);
    setBottomTab('diff');
    setDiffFrom(from);
    setDiffTo(to);
    try {
      const [a, b] = await Promise.all([
        scriptService.getScriptVersion(String(scriptId), from),
        scriptService.getScriptVersion(String(scriptId), to),
      ]);
      setDiffOriginal(String(a?.version?.content || ''));
      setDiffImproved(String(b?.version?.content || ''));
    } catch (err: any) {
      toast.error(String(err?.message || 'Failed to load versions for diff'));
    }
  };

  const applyDiffImproved = () => {
    if (!diffImproved) return;
    onContentChange(diffImproved);
    setSaveState('dirty');
    toast.success('Applied diff target to editor');
  };

  const jumpToLine = (line: number, col: number = 1) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.revealLineInCenter?.(line);
    editor.setPosition?.({ lineNumber: line, column: col });
    editor.focus?.();
  };

  const commands: EditorCommand[] = useMemo(() => {
    const cmd: EditorCommand[] = [
      { id: 'save', title: 'Save', shortcut: 'Ctrl/Cmd+S', keywords: ['write', 'persist'], run: () => void runSave('manual') },
      { id: 'format', title: 'Format Document', shortcut: 'Shift+Alt/Option+F', keywords: ['prettify'], run: () => void runFormat() },
      { id: 'lint', title: 'Run Lint', keywords: ['problems', 'diagnostics'], run: () => void runLint({ silent: false }) },
      { id: 'toggle-left', title: leftOpen ? 'Hide Left Panel' : 'Show Left Panel', keywords: ['outline', 'versions'], run: () => setLeftOpen((v) => !v) },
      { id: 'toggle-bottom', title: bottomOpen ? 'Hide Bottom Panel' : 'Show Bottom Panel', keywords: ['problems', 'diff'], run: () => setBottomOpen((v) => !v) },
      { id: 'toggle-right', title: rightOpen ? 'Hide Right Panel' : 'Show Right Panel', keywords: ['ai'], run: () => setRightOpen((v) => !v) },
      {
        id: 'toggle-wrap',
        title: wordWrap === 'on' ? 'Disable Word Wrap' : 'Enable Word Wrap',
        keywords: ['wrap'],
        run: () => setWordWrap((v) => (v === 'on' ? 'off' : 'on')),
      },
      {
        id: 'find',
        title: 'Find',
        shortcut: 'Ctrl/Cmd+F',
        keywords: ['search'],
        run: () => editorRef.current?.getAction?.('actions.find')?.run?.(),
      },
      {
        id: 'replace',
        title: 'Replace',
        shortcut: 'Ctrl/Cmd+H',
        keywords: ['search'],
        run: () => editorRef.current?.getAction?.('editor.action.startFindReplaceAction')?.run?.(),
      },
      {
        id: 'go-line',
        title: 'Go to Line',
        shortcut: 'Ctrl/Cmd+G',
        keywords: ['navigate'],
        run: () => editorRef.current?.getAction?.('editor.action.gotoLine')?.run?.(),
      },
    ];

    if (onReset) cmd.push({ id: 'reset', title: 'Reset Changes', keywords: ['revert', 'discard'], run: () => onReset() });
    return cmd;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftOpen, bottomOpen, rightOpen, wordWrap, onReset, saveState, autosaveOn]);

  const editorOptions = useMemo(
    () => ({
      automaticLayout: true,
      minimap: { enabled: true },
      fontSize: 13,
      lineNumbers: 'on' as const,
      scrollBeyondLastLine: false,
      wordWrap,
      contextmenu: true,
      formatOnPaste: true,
      formatOnType: true,
    }),
    [wordWrap]
  );

  const handleEditorMount = (editor: any) => {
    editorRef.current = editor;
    editor.focus();
    editor.onDidChangeCursorPosition?.((e: any) => {
      setCursor({ line: e.position.lineNumber, col: e.position.column });
    });
    attachLspIfNeeded();
  };

  const problemCounts = useMemo(() => {
    const issues = lint?.issues || [];
    const counts = { Error: 0, Warning: 0, Info: 0 };
    for (const i of issues) {
      if (i.severity === 'Error') counts.Error++;
      else if (i.severity === 'Warning') counts.Warning++;
      else counts.Info++;
    }
    return counts;
  }, [lint]);

  const lspLabel = lspStatus === 'online' ? 'Online' : lspStatus === 'connecting' ? 'Connecting…' : 'Offline';

  return (
    <div className={cardStyles}>
      <EditorCommandPalette isOpen={paletteOpen} onOpenChange={setPaletteOpen} commands={commands} />

      {/* Top bar */}
      <div className="px-4 py-3 border-b border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="font-semibold text-[var(--color-text-primary)] truncate">
            {title || 'Untitled Script'}
          </div>
          <div className="text-xs px-2 py-1 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)]">
            {saveState === 'dirty' ? 'Unsaved' : saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Save error' : 'Saved'}
          </div>
          {saveError ? (
            <div className="text-xs text-red-400 truncate">({saveError})</div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonSecondaryStyles} onClick={() => setPaletteOpen(true)}>
            Commands <span className="text-xs opacity-70 ml-1">Ctrl+Shift+P</span>
          </button>
          <button type="button" className={buttonSecondaryStyles} onClick={() => setLeftOpen((v) => !v)}>
            {leftOpen ? 'Hide' : 'Show'} Left
          </button>
          <button type="button" className={buttonSecondaryStyles} onClick={() => setBottomOpen((v) => !v)}>
            {bottomOpen ? 'Hide' : 'Show'} Bottom
          </button>
          <button type="button" className={buttonSecondaryStyles} onClick={() => setRightOpen((v) => !v)}>
            {rightOpen ? 'Hide' : 'Show'} Right
          </button>

          <button type="button" className={buttonSecondaryStyles} onClick={() => void runLint({ silent: false })} disabled={lintRunning}>
            {lintRunning ? 'Linting…' : 'Lint'}
          </button>
          <button type="button" className={buttonSecondaryStyles} onClick={() => void runFormat()}>
            Format
          </button>
          <button type="button" className={buttonPrimaryStyles} onClick={() => void runSave('manual')} disabled={saveState === 'saving'}>
            Save
          </button>
        </div>
      </div>

      {/* Main workspace */}
      <div className="flex flex-col h-[70vh]">
        <div className="flex flex-1 min-h-0">
          {/* Left panel */}
          {leftOpen ? (
            <div className="w-[320px] shrink-0 border-r border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-3 flex flex-col min-h-0">
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  className={`${buttonSecondaryStyles} !px-2 !py-1 text-xs ${leftTab === 'versions' ? 'bg-[var(--color-bg-primary)]' : ''}`}
                  onClick={() => setLeftTab('versions')}
                >
                  Versions
                </button>
                <button
                  type="button"
                  className={`${buttonSecondaryStyles} !px-2 !py-1 text-xs ${leftTab === 'outline' ? 'bg-[var(--color-bg-primary)]' : ''}`}
                  onClick={() => setLeftTab('outline')}
                >
                  Outline
                </button>
                <button
                  type="button"
                  className={`${buttonSecondaryStyles} !px-2 !py-1 text-xs ${leftTab === 'details' ? 'bg-[var(--color-bg-primary)]' : ''}`}
                  onClick={() => setLeftTab('details')}
                >
                  Details
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-auto">
                {leftTab === 'details' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs mb-1 text-[var(--color-text-secondary)]">Title</label>
                      <input
                        value={title || ''}
                        onChange={(e) => {
                          onTitleChange?.(e.target.value);
                          setSaveState('dirty');
                        }}
                        className="w-full px-2 py-2 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1 text-[var(--color-text-secondary)]">Description</label>
                      <textarea
                        value={description || ''}
                        onChange={(e) => {
                          onDescriptionChange?.(e.target.value);
                          setSaveState('dirty');
                        }}
                        rows={5}
                        className="w-full px-2 py-2 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--color-text-tertiary)]">Autosave</span>
                      <button
                        type="button"
                        className={`${buttonSecondaryStyles} !px-2 !py-1 text-xs`}
                        onClick={() => setAutosaveOn((v) => !v)}
                      >
                        {autosaveOn ? 'On' : 'Off'}
                      </button>
                    </div>
                  </div>
                ) : null}

                {leftTab === 'outline' ? (
                  <div className="space-y-2">
                    {outline.length === 0 ? (
                      <div className="text-sm text-[var(--color-text-secondary)]">
                        No outline items found. (When LSP is online, this will be richer.)
                      </div>
                    ) : (
                      outline.map((o) => (
                        <button
                          key={`${o.name}-${o.line}`}
                          type="button"
                          className="w-full text-left px-3 py-2 rounded-md hover:bg-[var(--color-bg-tertiary)] text-sm text-[var(--color-text-primary)] border border-transparent hover:border-[var(--color-border-default)]"
                          onClick={() => jumpToLine(o.line, 1)}
                        >
                          <div className="font-mono truncate">{o.name}</div>
                          <div className="text-xs text-[var(--color-text-tertiary)]">Line {o.line}</div>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}

                {leftTab === 'versions' ? (
                  <div className="space-y-2">
                    {!scriptId ? (
                      <div className="text-sm text-[var(--color-text-secondary)]">Versions are unavailable.</div>
                    ) : versionsQuery.isLoading ? (
                      <div className="text-sm text-[var(--color-text-secondary)]">Loading versions…</div>
                    ) : versionsQuery.isError ? (
                      <div className="text-sm text-red-400">Failed to load versions.</div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-xs text-[var(--color-text-tertiary)]">
                          Current version: {versionsData?.currentVersion ?? '—'}
                        </div>
                        {(versionsData?.versions || []).map((v) => (
                          <div key={v.id} className={panelStyles}>
                            <div className="p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                                  v{v.version}
                                </div>
                                <div className="text-xs text-[var(--color-text-tertiary)]">
                                  {v.user?.username ? `@${v.user.username}` : ''}
                                </div>
                              </div>
                              {v.changelog ? (
                                <div className="text-xs mt-1 text-[var(--color-text-secondary)] line-clamp-2">
                                  {v.changelog}
                                </div>
                              ) : null}
                              <div className="flex gap-2 mt-2">
                                <button
                                  type="button"
                                  className={`${buttonSecondaryStyles} !px-2 !py-1 text-xs`}
                                  onClick={() => {
                                    const current = versionsData?.currentVersion ?? v.version;
                                    if (v.version === current) return;
                                    void openDiff(v.version, current);
                                  }}
                                >
                                  Diff vs current
                                </button>
                                <button
                                  type="button"
                                  className={`${buttonSecondaryStyles} !px-2 !py-1 text-xs`}
                                  onClick={async () => {
                                    if (!scriptId) return;
                                    if (!confirm(`Revert to v${v.version}? This creates a new version.`)) return;
                                    try {
                                      await scriptService.revertToVersion(String(scriptId), v.version);
                                      toast.success(`Reverted to v${v.version}`);
                                      await versionsQuery.refetch();
                                    } catch (err: any) {
                                      toast.error(String(err?.message || 'Revert failed'));
                                    }
                                  }}
                                >
                                  Revert
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Editor */}
          <div className="flex-1 min-w-0 flex flex-col bg-[var(--color-bg-primary)]">
            <div className="flex-1 min-h-0">
              <MonacoEditor
                language="powershell"
                theme={(document.documentElement.classList.contains('dark') ? 'vs-dark' : 'vs') as any}
                value={content}
                options={editorOptions}
                onChange={(v: string) => {
                  onContentChange(v);
                  setSaveState('dirty');
                }}
                editorDidMount={handleEditorMount}
                height="100%"
              />
            </div>
          </div>

          {/* Right panel */}
          {rightOpen ? (
            <div className="w-[320px] shrink-0 border-l border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-3 flex flex-col min-h-0">
              <div className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Editor</div>
              <div className={panelStyles}>
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--color-text-secondary)]">Word wrap</span>
                    <button
                      type="button"
                      className={`${buttonSecondaryStyles} !px-2 !py-1 text-xs`}
                      onClick={() => setWordWrap((v) => (v === 'on' ? 'off' : 'on'))}
                    >
                      {wordWrap === 'on' ? 'On' : 'Off'}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--color-text-secondary)]">Autosave</span>
                    <button
                      type="button"
                      className={`${buttonSecondaryStyles} !px-2 !py-1 text-xs`}
                      onClick={() => setAutosaveOn((v) => !v)}
                    >
                      {autosaveOn ? 'On' : 'Off'}
                    </button>
                  </div>
                    <div className="text-xs text-[var(--color-text-tertiary)]">
                    LSP: {lspLabel}
                  </div>
                </div>
              </div>
              <div className="text-xs mt-3 text-[var(--color-text-tertiary)]">
                Backend: <span className="font-mono">{apiUrl}</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Bottom panel */}
        {bottomOpen ? (
          <div className="border-t border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-3">
            <div className="flex items-center gap-2 mb-3">
              <button
                type="button"
                className={`${buttonSecondaryStyles} !px-2 !py-1 text-xs ${bottomTab === 'problems' ? 'bg-[var(--color-bg-primary)]' : ''}`}
                onClick={() => setBottomTab('problems')}
              >
                Problems ({problemCounts.Error}/{problemCounts.Warning}/{problemCounts.Info})
              </button>
              <button
                type="button"
                className={`${buttonSecondaryStyles} !px-2 !py-1 text-xs ${bottomTab === 'diff' ? 'bg-[var(--color-bg-primary)]' : ''}`}
                onClick={() => setBottomTab('diff')}
              >
                Diff
              </button>
              <div className="ml-auto text-xs text-[var(--color-text-tertiary)]">
                {lintUpdatedAt ? `Lint: ${new Date(lintUpdatedAt).toLocaleTimeString()}` : ''}
              </div>
            </div>

            {bottomTab === 'problems' ? (
              <div className={panelStyles}>
                <div className="p-3">
                  {lint?.issues?.length ? (
                    <div className="space-y-2">
                      <div className="text-xs text-[var(--color-text-tertiary)]">
                        Source: {lint.source === 'deterministic' ? 'PSScriptAnalyzer (deterministic)' : 'AI lint (fallback)'}
                      </div>
                      {lint.issues.map((i, idx) => (
                        <button
                          key={`${i.ruleName}-${i.line}-${idx}`}
                          type="button"
                          className="w-full text-left p-3 rounded-md hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)]"
                          onClick={() => jumpToLine(i.line, i.column || 1)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm text-[var(--color-text-primary)]">
                              <span
                                className={`inline-block w-2 h-2 rounded-full mr-2 ${
                                  i.severity === 'Error' ? 'bg-red-500' : i.severity === 'Warning' ? 'bg-yellow-500' : 'bg-blue-500'
                                }`}
                              />
                              <span className="font-semibold">{i.ruleName}</span>
                            </div>
                            <div className="text-xs text-[var(--color-text-tertiary)]">
                              L{i.line}
                            </div>
                          </div>
                          <div className="text-xs mt-1 text-[var(--color-text-secondary)]">{i.message}</div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-[var(--color-text-secondary)]">
                      No problems to show. Run Lint to populate diagnostics.
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {bottomTab === 'diff' ? (
              <div className={panelStyles}>
                <div className="p-3">
                  {!diffFrom || !diffTo ? (
                    <div className="text-sm text-[var(--color-text-secondary)]">
                      Select a version and click “Diff vs current”.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-[var(--color-text-secondary)]">
                          Comparing v{diffFrom} → v{diffTo}
                        </div>
                        <button type="button" className={buttonPrimaryStyles} onClick={applyDiffImproved}>
                          Apply v{diffTo} to editor
                        </button>
                      </div>
                      <CodeDiffView original={diffOriginal} improved={diffImproved} showActions={false} />
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Status bar */}
        <div className="px-4 py-2 border-t border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] text-xs text-[var(--color-text-secondary)] flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-4 items-center">
            <span className="font-mono">Ln {cursor.line}, Col {cursor.col}</span>
            <span className="font-mono">pwsh</span>
            <span>Problems: {problemCounts.Error}/{problemCounts.Warning}/{problemCounts.Info}</span>
            <span>LSP: {lspLabel}</span>
          </div>
          <div className="flex gap-4 items-center">
            <span>Wrap: {wordWrap}</span>
            <span>Autosave: {autosaveOn ? 'on' : 'off'}</span>
            <span>{lastSavedAt ? `Saved: ${new Date(lastSavedAt).toLocaleTimeString()}` : ''}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
