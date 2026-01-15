import React from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

// Define Script interface
interface Script {
  id: string;
  title: string;
  description: string;
  content: string;
  author: string;
  created_at: string;
  updated_at: string;
  category_id: number;
  category_name?: string;
  tags?: string[];
  is_public: boolean;
  version: number;
  security_score?: number;
  quality_score?: number;
  views?: number;
  executions?: number;
  file_hash?: string;
}

// Define props for ScriptCard
interface ScriptCardProps {
  script: Script;
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
  // Format date with error handling
  let formattedDate = 'Unknown date';
  try {
    const dateString = script.updated_at || script.created_at;
    if (dateString) {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        formattedDate = formatDistanceToNow(date, { addSuffix: true });
      }
    }
  } catch (error) {
    console.warn('Error formatting date:', error);
  }

  // Get security score color
  const getSecurityScoreColor = (score?: number) => {
    if (score === undefined) return 'text-[var(--color-text-tertiary)]';
    if (score >= 8) return 'text-emerald-500';
    if (score >= 5) return 'text-amber-500';
    return 'text-red-500';
  };

  // Get quality score color
  const getQualityScoreColor = (score?: number) => {
    if (score === undefined) return 'text-[var(--color-text-tertiary)]';
    if (score >= 8) return 'text-blue-500';
    if (score >= 5) return 'text-blue-400';
    return 'text-blue-300';
  };

  // Handle execute click
  const handleExecuteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onExecute) onExecute(script.id);
  };

  // Handle analyze click
  const handleAnalyzeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onAnalyze) onAnalyze(script.id);
  };

  // Handle delete click
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDelete) onDelete(script.id);
  };

  return (
    <Link
      to={`/scripts/${script.id}`}
      className="block rounded-xl overflow-hidden shadow-[var(--shadow-sm)] transition-all duration-300 hover:shadow-[var(--shadow-md)] hover:-translate-y-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)]"
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold truncate text-[var(--color-text-primary)] pr-2">{script.title}</h3>
          <div className="flex items-center gap-2">
            {script.is_public ? (
              <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                Public
              </span>
            ) : (
              <span className="text-xs px-2 py-1 rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] border border-[var(--color-border-default)]">
                Private
              </span>
            )}
            {/* Delete Button */}
            {showDelete && onDelete && (
              <button
                onClick={handleDeleteClick}
                className="p-1 rounded-md text-[var(--color-text-tertiary)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                title="Delete script"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-sm mb-3 line-clamp-2 text-[var(--color-text-secondary)]">
          {script.description || 'No description provided.'}
        </p>

        {/* Tags */}
        {script.tags && script.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {script.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
              >
                {tag}
              </span>
            ))}
            {script.tags.length > 3 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]">
                +{script.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Metadata */}
        <div className="flex justify-between items-center text-xs">
          <div className="text-[var(--color-text-tertiary)]">
            {script.category_name && (
              <span className="mr-2">{script.category_name}</span>
            )}
            <span>{formattedDate}</span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Security Score */}
            {script.security_score !== undefined && (
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${getSecurityScoreColor(script.security_score)}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className={`ml-1 ${getSecurityScoreColor(script.security_score)}`}>
                  {script.security_score.toFixed(1)}
                </span>
              </div>
            )}

            {/* Quality Score */}
            {script.quality_score !== undefined && (
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${getQualityScoreColor(script.quality_score)}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className={`ml-1 ${getQualityScoreColor(script.quality_score)}`}>
                  {script.quality_score.toFixed(1)}
                </span>
              </div>
            )}

            {/* Views */}
            {script.views !== undefined && (
              <div className="flex items-center text-[var(--color-text-tertiary)]">
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
