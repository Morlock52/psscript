import monacoEditorCssUrl from 'monaco-editor/min/vs/editor/editor.main.css?url';

const MONACO_CSS_LINK_ID = 'monaco-editor-css';

export function loadMonacoCss(): void {
  if (typeof document === 'undefined' || document.getElementById(MONACO_CSS_LINK_ID)) {
    return;
  }

  const link = document.createElement('link');
  link.id = MONACO_CSS_LINK_ID;
  link.rel = 'stylesheet';
  link.href = monacoEditorCssUrl;
  document.head.appendChild(link);
}
