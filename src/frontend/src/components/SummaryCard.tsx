/**
 * DocumentCard Component (SummaryCard)
 *
 * A modern card for displaying PowerShell documentation entries.
 * Features clear visual hierarchy, AI-enhanced summaries, and easy-to-scan sections.
 *
 * Design follows 2026 best practices:
 * - Accessible with proper ARIA labels
 * - Dark mode optimized
 * - Responsive design
 */
import React from 'react';

// Types
interface DocMetadata {
  aiInsights?: string[];
  codeExample?: string;
  scriptsFound?: number;
  qualityScore?: number;
  relevanceScore?: number;
}

export interface SummaryCardDoc {
  id: number;
  title: string;
  summary?: string;
  content?: string;
  category?: string;
  tags?: string[];
  extractedCommands?: string[];
  extractedFunctions?: string[];
  source?: string;
  url?: string;
  crawledAt: string;
  metadata?: DocMetadata;
}

interface SummaryCardProps {
  doc: SummaryCardDoc;
  onClick?: () => void;
  onDelete?: (e: React.MouseEvent) => void;
}

// Category configuration with icons and colors
const CATEGORY_CONFIG: Record<string, { color: string; gradient: string; icon: string; emoji: string }> = {
  'Process Management': {
    color: 'blue',
    gradient: 'from-blue-600 to-blue-700',
    icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z',
    emoji: '⚙️'
  },
  'File System': {
    color: 'green',
    gradient: 'from-green-600 to-green-700',
    icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
    emoji: '📁'
  },
  'Service Management': {
    color: 'purple',
    gradient: 'from-purple-600 to-purple-700',
    icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01',
    emoji: '🔧'
  },
  'Network': {
    color: 'cyan',
    gradient: 'from-cyan-600 to-cyan-700',
    icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9',
    emoji: '🌐'
  },
  'Security': {
    color: 'red',
    gradient: 'from-red-600 to-red-700',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    emoji: '🔒'
  },
  'Module Management': {
    color: 'yellow',
    gradient: 'from-yellow-600 to-amber-600',
    icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    emoji: '📦'
  },
  'Data Conversion': {
    color: 'orange',
    gradient: 'from-orange-500 to-orange-600',
    icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
    emoji: '🔄'
  },
  'Pipeline': {
    color: 'pink',
    gradient: 'from-pink-600 to-pink-700',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    emoji: '⚡'
  },
  'Output': {
    color: 'indigo',
    gradient: 'from-indigo-600 to-indigo-700',
    icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    emoji: '📊'
  },
  'Web Requests': {
    color: 'teal',
    gradient: 'from-teal-600 to-teal-700',
    icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064',
    emoji: '🌍'
  },
  'General': {
    color: 'gray',
    gradient: 'from-gray-600 to-gray-700',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    emoji: '📄'
  },
};

/**
 * Format a title to be more descriptive and readable
 * Clean, professional title case formatting
 */
function formatTitle(title: string, category?: string): { main: string; subtitle?: string } {
  // Words that should stay lowercase (unless first word)
  const lowercaseWords = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'by', 'of', 'in', 'with', 'as']);

  // Words/acronyms that should stay uppercase
  const uppercaseWords = new Set(['api', 'url', 'http', 'https', 'sql', 'xml', 'json', 'html', 'css', 'dns', 'tcp', 'udp', 'ip', 'ui', 'ux', 'id', 'guid', 'uuid', 'wmi', 'com', 'ad', 'gpo', 'ou', 'ps', 'cli', 'gui', 'iis', 'ftp', 'smtp', 'ssl', 'tls', 'vpn', 'vm', 'cpu', 'ram', 'hdd', 'ssd', 'nas', 'san', 'raid', 'io']);

  // Clean up the title
  let cleanTitle = title
    // Remove common prefixes and file extensions
    .replace(/^(about_|about |get-|set-|new-|remove-|add-|invoke-|enable-|disable-|start-|stop-|test-|update-|export-|import-|copy-|move-|rename-|clear-|reset-|register-|unregister-)/gi, '')
    .replace(/\.(ps1|psm1|psd1|txt|md|html)$/i, '')
    // Replace separators with spaces
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2') // CamelCase to spaces
    .trim();

  // Apply title case formatting (like "Crawled Data Library")
  cleanTitle = cleanTitle
    .split(/\s+/)
    .map((word, index) => {
      const lowerWord = word.toLowerCase();

      // Check if it's an acronym that should be uppercase
      if (uppercaseWords.has(lowerWord)) {
        return word.toUpperCase();
      }

      // First word is always capitalized
      if (index === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }

      // Keep prepositions/articles lowercase (unless first word)
      if (lowercaseWords.has(lowerWord)) {
        return lowerWord;
      }

      // Standard title case: capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');

  // Generate subtitle from category if title is short
  if (cleanTitle.length < 25 && category) {
    return {
      main: cleanTitle,
      subtitle: `${category} Guide`
    };
  }

  // Split long titles at natural break points
  if (cleanTitle.length > 45) {
    // Try splitting at colon, dash, or parenthesis
    const separators = [':', ' - ', ' – ', ' — ', ' ('];
    for (const sep of separators) {
      const idx = cleanTitle.indexOf(sep);
      if (idx > 10 && idx < cleanTitle.length - 10) {
        return {
          main: cleanTitle.substring(0, idx).trim(),
          subtitle: cleanTitle.substring(idx + sep.length).replace(/\)$/, '').trim()
        };
      }
    }

    // If no separator found, split at a sensible word boundary
    const words = cleanTitle.split(' ');
    if (words.length > 4) {
      const midpoint = Math.ceil(words.length / 2);
      return {
        main: words.slice(0, midpoint).join(' '),
        subtitle: words.slice(midpoint).join(' ')
      };
    }
  }

  return { main: cleanTitle };
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  } catch {
    return 'Unknown';
  }
}

/**
 * Truncate text with ellipsis
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3).trim() + '...';
}

/**
 * Get quality indicator based on content richness
 */
function getQualityIndicator(doc: SummaryCardDoc): { level: 'high' | 'medium' | 'low'; label: string } {
  let score = 0;

  if (doc.summary && doc.summary.length > 100) score += 2;
  if (doc.extractedCommands && doc.extractedCommands.length > 0) score += 2;
  if (doc.metadata?.aiInsights && doc.metadata.aiInsights.length > 0) score += 2;
  if (doc.metadata?.codeExample) score += 1;
  if (doc.tags && doc.tags.length > 2) score += 1;
  if (doc.extractedFunctions && doc.extractedFunctions.length > 0) score += 2;

  if (score >= 7) return { level: 'high', label: 'Rich Content' };
  if (score >= 4) return { level: 'medium', label: 'Good Content' };
  return { level: 'low', label: 'Basic' };
}

/**
 * SummaryCard - Enhanced documentation card component
 */
const SummaryCard: React.FC<SummaryCardProps> = ({ doc, onClick, onDelete }) => {
  const category = doc.category || 'General';
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG['General'];
  const { main: mainTitle, subtitle } = formatTitle(doc.title, category);
  const quality = getQualityIndicator(doc);
  const hasScripts = (doc.extractedFunctions && doc.extractedFunctions.length > 0) ||
                     (doc.metadata?.scriptsFound && doc.metadata.scriptsFound > 0);

  return (
    <article
      onClick={onClick}
      className="group relative bg-gray-800/80 backdrop-blur-sm rounded-2xl overflow-hidden
                 border border-gray-700/50 hover:border-purple-500/50
                 shadow-lg hover:shadow-purple-500/10
                 transition-all duration-300 cursor-pointer
                 hover:transform hover:-translate-y-1"
    >
      {/* Category Header with Gradient */}
      <header className={`bg-gradient-to-r ${config.gradient} px-4 py-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl" role="img" aria-label={category}>
              {config.emoji}
            </span>
            <span className="text-xs font-semibold text-white/90 uppercase tracking-wider">
              {category}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Quality Badge */}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium
              ${quality.level === 'high' ? 'bg-green-500/30 text-green-200' :
                quality.level === 'medium' ? 'bg-yellow-500/30 text-yellow-200' :
                'bg-gray-500/30 text-gray-300'}`}>
              {quality.label}
            </span>
            {/* Scripts Badge */}
            {hasScripts && (
              <span className="flex items-center text-xs text-white/90 bg-black/20 px-2 py-0.5 rounded-full">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Code
              </span>
            )}
            {/* Delete Button */}
            {onDelete && (
              <button
                onClick={onDelete}
                className="p-1.5 rounded-full hover:bg-black/30 text-white/70 hover:text-red-300
                           transition-colors opacity-0 group-hover:opacity-100"
                title="Delete document"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Card Body */}
      <div className="p-5">
        {/* Title Section - Styled like "Crawled Data Library" */}
        <div className="mb-4">
          <h3 className="text-xl font-bold text-white group-hover:text-purple-300
                         transition-colors leading-snug tracking-tight">
            {truncate(mainTitle, 55)}
          </h3>
          {subtitle && (
            <p className="text-sm text-purple-300/70 mt-1.5 font-medium tracking-wide">
              {truncate(subtitle, 50)}
            </p>
          )}
        </div>

        {/* AI Summary Section */}
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-1h2v1zm0-2H9V7h2v4z"/>
            </svg>
            <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
              Summary
            </span>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed line-clamp-3">
            {doc.summary || doc.content?.substring(0, 200) || 'No summary available for this document.'}
          </p>
        </div>

        {/* Key Insights Section */}
        {doc.metadata?.aiInsights && doc.metadata.aiInsights.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z"/>
              </svg>
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                Key Insights
              </span>
            </div>
            <ul className="space-y-1.5">
              {doc.metadata.aiInsights.slice(0, 3).map((insight, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-amber-400 mt-0.5">▸</span>
                  <span className="line-clamp-1">{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Code Example */}
        {doc.metadata?.codeExample && (
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd"/>
              </svg>
              <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">
                Example
              </span>
            </div>
            <code className="block px-3 py-2 bg-gray-900/80 text-green-400 text-xs rounded-lg
                           font-mono truncate border border-green-900/30">
              {doc.metadata.codeExample}
            </code>
          </div>
        )}

        {/* Commands Section */}
        {doc.extractedCommands && doc.extractedCommands.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <svg className="w-4 h-4 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/>
              </svg>
              <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                Commands
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {doc.extractedCommands.slice(0, 4).map((cmd, idx) => (
                <code
                  key={idx}
                  className="px-2 py-1 bg-cyan-900/30 text-cyan-300 text-xs rounded-md
                           font-mono border border-cyan-800/30"
                >
                  {cmd}
                </code>
              ))}
              {doc.extractedCommands.length > 4 && (
                <span className="px-2 py-1 text-xs text-gray-500">
                  +{doc.extractedCommands.length - 4} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Tags */}
        {doc.tags && doc.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {doc.tags.slice(0, 4).map((tag, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 bg-gray-700/50 text-gray-300 text-xs rounded-full
                         border border-gray-600/30"
              >
                #{tag}
              </span>
            ))}
            {doc.tags.length > 4 && (
              <span className="px-2 py-0.5 text-gray-500 text-xs">
                +{doc.tags.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <footer className="flex items-center justify-between pt-3 mt-auto
                          border-t border-gray-700/50 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z" clipRule="evenodd"/>
            </svg>
            <span className="truncate max-w-[120px]">{doc.source || 'Microsoft Docs'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/>
            </svg>
            <span>Added {formatDate(doc.crawledAt)}</span>
          </div>
        </footer>
      </div>

      {/* Hover Overlay Effect */}
      <div className="absolute inset-0 bg-gradient-to-t from-purple-600/5 to-transparent
                      opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </article>
  );
};

export default SummaryCard;
