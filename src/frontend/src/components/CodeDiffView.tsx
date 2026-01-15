/**
 * CodeDiffView Component - January 2026
 *
 * Displays side-by-side or unified diff between original and improved PowerShell scripts.
 * Features syntax highlighting and improvement category badges.
 */

import React, { useState } from 'react';

interface DiffLine {
  line_number_old: number | null;
  line_number_new: number | null;
  content_old: string | null;
  content_new: string | null;
  change_type: 'added' | 'removed' | 'modified' | 'unchanged';
}

interface DiffHunk {
  start_line_old: number;
  start_line_new: number;
  lines: DiffLine[];
  context_before: string[];
  context_after: string[];
}

interface Improvement {
  category: string;
  description: string;
  line_range: [number, number];
}

interface DiffData {
  original_lines: number;
  improved_lines: number;
  lines_added: number;
  lines_removed: number;
  lines_modified: number;
  hunks: DiffHunk[];
  improvements: Improvement[];
  unified_diff: string;
  similarity_ratio: number;
  summary?: string;
}

interface CodeDiffViewProps {
  original: string;
  improved: string;
  diffData?: DiffData;
  onAccept?: (improved: string) => void;
  onReject?: () => void;
  showActions?: boolean;
}

type ViewMode = 'side-by-side' | 'unified' | 'inline';

const categoryColors: Record<string, string> = {
  performance: 'bg-blue-100 text-blue-800 border-blue-200',
  security: 'bg-red-100 text-red-800 border-red-200',
  readability: 'bg-green-100 text-green-800 border-green-200',
  error_handling: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  best_practices: 'bg-purple-100 text-purple-800 border-purple-200',
  style: 'bg-gray-100 text-gray-800 border-gray-200',
  functionality: 'bg-indigo-100 text-indigo-800 border-indigo-200',
};

const categoryIcons: Record<string, string> = {
  performance: '\u26A1', // lightning
  security: '\uD83D\uDD12', // lock
  readability: '\uD83D\uDCD6', // book
  error_handling: '\u26A0\uFE0F', // warning
  best_practices: '\u2705', // checkmark
  style: '\uD83C\uDFA8', // palette
  functionality: '\u2699\uFE0F', // gear
};

export const CodeDiffView: React.FC<CodeDiffViewProps> = ({
  original,
  improved,
  diffData,
  onAccept,
  onReject,
  showActions = true,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side');
  const [showStats, setShowStats] = useState(true);

  const originalLines = original.split('\n');
  const improvedLines = improved.split('\n');

  // Generate simple diff if no diffData provided
  const generateSimpleDiff = (): { added: Set<number>; removed: Set<number> } => {
    const added = new Set<number>();
    const removed = new Set<number>();

    const originalSet = new Set(originalLines);
    const improvedSet = new Set(improvedLines);

    originalLines.forEach((line, idx) => {
      if (!improvedSet.has(line)) {
        removed.add(idx);
      }
    });

    improvedLines.forEach((line, idx) => {
      if (!originalSet.has(line)) {
        added.add(idx);
      }
    });

    return { added, removed };
  };

  const simpleDiff = generateSimpleDiff();

  const renderSideBySide = () => {
    const maxLines = Math.max(originalLines.length, improvedLines.length);

    return (
      <div className="grid grid-cols-2 gap-0 font-mono text-sm">
        {/* Original Header */}
        <div className="bg-red-50 px-4 py-2 border-b font-semibold text-red-800">
          Original ({originalLines.length} lines)
        </div>
        {/* Improved Header */}
        <div className="bg-green-50 px-4 py-2 border-b font-semibold text-green-800">
          Improved ({improvedLines.length} lines)
        </div>

        {/* Content */}
        {Array.from({ length: maxLines }).map((_, idx) => {
          const origLine = originalLines[idx] ?? '';
          const impLine = improvedLines[idx] ?? '';
          const isRemoved = simpleDiff.removed.has(idx);
          const isAdded = simpleDiff.added.has(idx);

          return (
            <React.Fragment key={idx}>
              {/* Original line */}
              <div
                className={`px-4 py-0.5 border-b border-r flex ${
                  isRemoved ? 'bg-red-100' : 'bg-white'
                }`}
              >
                <span className="text-gray-400 w-8 text-right mr-3 select-none">
                  {idx < originalLines.length ? idx + 1 : ''}
                </span>
                <pre className={`flex-1 whitespace-pre-wrap ${isRemoved ? 'text-red-800' : ''}`}>
                  {origLine}
                </pre>
              </div>

              {/* Improved line */}
              <div
                className={`px-4 py-0.5 border-b flex ${
                  isAdded ? 'bg-green-100' : 'bg-white'
                }`}
              >
                <span className="text-gray-400 w-8 text-right mr-3 select-none">
                  {idx < improvedLines.length ? idx + 1 : ''}
                </span>
                <pre className={`flex-1 whitespace-pre-wrap ${isAdded ? 'text-green-800' : ''}`}>
                  {impLine}
                </pre>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const renderUnified = () => {
    return (
      <div className="font-mono text-sm bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
        <pre className="whitespace-pre-wrap">
          {diffData?.unified_diff || generateUnifiedDiff()}
        </pre>
      </div>
    );
  };

  const generateUnifiedDiff = (): string => {
    const lines: string[] = [];
    lines.push('--- original.ps1');
    lines.push('+++ improved.ps1');
    lines.push(`@@ -1,${originalLines.length} +1,${improvedLines.length} @@`);

    originalLines.forEach((line, idx) => {
      if (simpleDiff.removed.has(idx)) {
        lines.push(`- ${line}`);
      } else {
        lines.push(`  ${line}`);
      }
    });

    improvedLines.forEach((line, idx) => {
      if (simpleDiff.added.has(idx)) {
        lines.push(`+ ${line}`);
      }
    });

    return lines.join('\n');
  };

  const renderInline = () => {
    return (
      <div className="space-y-4">
        {/* Original */}
        <div>
          <h4 className="font-semibold text-red-700 mb-2">Original:</h4>
          <div className="bg-red-50 rounded-lg p-4 font-mono text-sm overflow-x-auto">
            <pre className="whitespace-pre-wrap">{original}</pre>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <span className="text-2xl text-gray-400">\u2193</span>
        </div>

        {/* Improved */}
        <div>
          <h4 className="font-semibold text-green-700 mb-2">Improved:</h4>
          <div className="bg-green-50 rounded-lg p-4 font-mono text-sm overflow-x-auto">
            <pre className="whitespace-pre-wrap">{improved}</pre>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 border-b px-4 py-3 flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Code Comparison</h3>

        {/* View mode toggle */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode('side-by-side')}
            className={`px-3 py-1 rounded text-sm ${
              viewMode === 'side-by-side'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Side by Side
          </button>
          <button
            onClick={() => setViewMode('unified')}
            className={`px-3 py-1 rounded text-sm ${
              viewMode === 'unified'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Unified
          </button>
          <button
            onClick={() => setViewMode('inline')}
            className={`px-3 py-1 rounded text-sm ${
              viewMode === 'inline'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Inline
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {showStats && diffData && (
        <div className="bg-gray-100 border-b px-4 py-2 flex items-center space-x-6 text-sm">
          <button
            onClick={() => setShowStats(!showStats)}
            className="text-gray-500 hover:text-gray-700"
          >
            {showStats ? '\u25BC' : '\u25B6'}
          </button>
          <span className="text-green-600 font-medium">
            +{diffData.lines_added} added
          </span>
          <span className="text-red-600 font-medium">
            -{diffData.lines_removed} removed
          </span>
          <span className="text-yellow-600 font-medium">
            ~{diffData.lines_modified} modified
          </span>
          <span className="text-gray-600">
            {(diffData.similarity_ratio * 100).toFixed(1)}% similar
          </span>
        </div>
      )}

      {/* Improvements badges */}
      {diffData?.improvements && diffData.improvements.length > 0 && (
        <div className="bg-blue-50 border-b px-4 py-2">
          <div className="text-xs font-semibold text-gray-600 mb-2">Detected Improvements:</div>
          <div className="flex flex-wrap gap-2">
            {diffData.improvements.map((imp, idx) => (
              <span
                key={idx}
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                  categoryColors[imp.category] || 'bg-gray-100 text-gray-800'
                }`}
                title={`Lines ${imp.line_range[0]}-${imp.line_range[1]}`}
              >
                <span className="mr-1">{categoryIcons[imp.category] || '\u2022'}</span>
                {imp.description}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Diff content */}
      <div className="max-h-96 overflow-y-auto">
        {viewMode === 'side-by-side' && renderSideBySide()}
        {viewMode === 'unified' && renderUnified()}
        {viewMode === 'inline' && renderInline()}
      </div>

      {/* Actions */}
      {showActions && (onAccept || onReject) && (
        <div className="bg-gray-50 border-t px-4 py-3 flex justify-end space-x-3">
          {onReject && (
            <button
              onClick={onReject}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Keep Original
            </button>
          )}
          {onAccept && (
            <button
              onClick={() => onAccept(improved)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Accept Improvements
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CodeDiffView;
