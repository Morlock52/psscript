export type LintSeverity = 'Info' | 'Warning' | 'Error';

export type LintIssue = {
  severity: LintSeverity;
  ruleName: string;
  message: string;
  line: number; // 1-based
  column?: number; // 1-based (optional)
};

export type LintResult = {
  issues: LintIssue[];
  source: 'deterministic' | 'ai_fallback';
};

export type EditorSaveState = 'saved' | 'dirty' | 'saving' | 'error';

