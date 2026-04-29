import React from 'react';
import { Link } from 'react-router-dom';
import { formatScriptRelativeDate, normalizeScriptSummary, type ScriptSummary } from '../utils/scriptSummary';

// Define Script interface
// Define props for ScriptCard
interface ScriptCardProps {
  script: any;
  showActions?: boolean;
  showDelete?: boolean;
  onExecute?: (id: string) => void;
  onAnalyze?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const ScriptCard: React.FC<ScriptCardProps> = ({
  script,
  showActions = true,
  showDelete = true,
  onExecute,
  onAnalyze,
  onDelete
}) => {
  const summary: ScriptSummary = normalizeScriptSummary(script);
  const formattedDate = formatScriptRelativeDate(summary);

  // Get security score color
  const getSecurityScoreColor = (score?: number) => {
    if (score === undefined) return 'text-[var(--ink-tertiary)]';
    if (score >= 8) return 'text-emerald-500';
    if (score >= 5) return 'text-amber-500';
    return 'text-red-500';
  };

  // Get quality score color
  const getQualityScoreColor = (score?: number) => {
    if (score === undefined) return 'text-[var(--ink-tertiary)]';
    if (score >= 8) return 'text-blue-500';
    if (score >= 5) return 'text-blue-400';
    return 'text-blue-300';
  };

  // Handle execute click
  const handleExecuteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onExecute) onExecute(summary.id);
  };

  // Handle analyze click
  const handleAnalyzeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onAnalyze) onAnalyze(summary.id);
  };

  // Handle delete click
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDelete) onDelete(summary.id);
  };

  return (
    <Link
      to={`/scripts/${summary.id}`}
      className="block rounded-xl overflow-hidden shadow-[var(--shadow-near)] transition-all duration-300 hover:shadow-[var(--shadow-near)] hover:-translate-y-1 bg-[var(--surface-raised)] border border-[var(--surface-overlay)]"
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold truncate text-[var(--ink-primary)] pr-2">{summary.title}</h3>
          <div className="flex items-center gap-2">
            {summary.isPublic ? (
              <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                Public
              </span>
            ) : (
              <span className="text-xs px-2 py-1 rounded-full bg-[var(--surface-overlay)] text-[var(--ink-tertiary)] border border-[var(--surface-overlay)]">
                Private
              </span>
            )}
            <span className="text-xs px-2 py-1 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--surface-overlay)]">
              {summary.lifecycleStatus.replace('_', ' ')}
            </span>
            {/* Delete Button */}
            {showDelete && onDelete && (
              <button
                onClick={handleDeleteClick}
                className="p-1 rounded-md text-[var(--ink-tertiary)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                title="Archive script"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-sm mb-3 line-clamp-2 text-[var(--ink-secondary)]">
          {summary.description || 'No description provided.'}
        </p>

        {/* Tags */}
        {summary.visibleTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {summary.visibleTags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface-overlay)] text-[var(--ink-secondary)]"
              >
                {tag}
              </span>
            ))}
            {summary.visibleTags.length > 3 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface-overlay)] text-[var(--ink-tertiary)]">
                +{summary.visibleTags.length - 3}
              </span>
            )}
          </div>
        )}

        {summary.riskBadges.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {summary.riskBadges.slice(0, 3).map(badge => (
              <span key={badge} className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">
                {badge}
              </span>
            ))}
          </div>
        )}

        {/* Metadata */}
        <div className="flex justify-between items-center text-xs">
          <div className="text-[var(--ink-tertiary)]">
            {summary.categoryName && (
              <span className="mr-2">{summary.categoryName}</span>
            )}
            <span>{formattedDate}</span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Security Score */}
            {summary.securityScore !== undefined && (
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${getSecurityScoreColor(summary.securityScore)}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className={`ml-1 ${getSecurityScoreColor(summary.securityScore)}`}>
                  {summary.securityScore.toFixed(1)}
                </span>
              </div>
            )}

            {/* Quality Score */}
            {summary.qualityScore !== undefined && (
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${getQualityScoreColor(summary.qualityScore)}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className={`ml-1 ${getQualityScoreColor(summary.qualityScore)}`}>
                  {summary.qualityScore.toFixed(1)}
                </span>
              </div>
            )}

            {/* Views */}
            {script.views !== undefined && (
              <div className="flex items-center text-[var(--ink-tertiary)]">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span className="ml-1">{script.views}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {showActions && (onExecute || onAnalyze) && (
          <div className="mt-3 flex justify-end space-x-2">
            {onExecute && (
              <button
                onClick={handleExecuteClick}
                className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                Execute
              </button>
            )}

            {onAnalyze && (
              <button
                onClick={handleAnalyzeClick}
                className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors"
              >
                Analyze
              </button>
            )}
          </div>
        )}
      </div>
    </Link>
  );
};

export default ScriptCard;
