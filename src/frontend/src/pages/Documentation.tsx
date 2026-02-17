import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import documentationApi, { DocItem, DocStats } from '../services/documentationApi';
import SummaryCard from '../components/SummaryCard';
import docsScreenshot from '../../../../docs/screenshots/documentation.png';
import dashboardScreenshot from '../../../../docs/screenshots/dashboard.png';
import uploadScreenshot from '../../../../docs/screenshots/upload.png';
import settingsScreenshot from '../../../../docs/screenshots/settings.png';

const Documentation: React.FC = () => {
  const prefersReducedMotion = useReducedMotion();
  const [query, setQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [docItems, setDocItems] = useState<DocItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<DocItem[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('date');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [stats, setStats] = useState<DocStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<DocItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DocItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [docsData, sourcesData, tagsData, statsData] = await Promise.all([
          documentationApi.getRecentDocumentation(50),
          documentationApi.getSources(),
          documentationApi.getTags(),
          documentationApi.getStats()
        ]);

        setDocItems(docsData);
        setFilteredItems(docsData);
        setSources(sourcesData);
        setTags(tagsData);
        setStats(statsData);

        // Extract unique categories from documents
        const uniqueCategories = [...new Set(docsData.map(d => d.category || 'General').filter(Boolean))];
        setCategories(uniqueCategories.sort());
      } catch (err) {
        console.error('Error loading documentation:', err);
        setError('Failed to load documentation. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Filter items based on search query, selected sources, tags, and category
  useEffect(() => {
    let filtered = [...docItems];

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(item => (item.category || 'General') === selectedCategory);
    }

    // Filter by search query (client-side for responsiveness)
    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(item => {
        const title = (item.title || '').toLowerCase();
        const content = (item.content || '').toLowerCase();
        const summary = (item.summary || '').toLowerCase();
        return (
          title.includes(lowerQuery) ||
          (!!content && content.includes(lowerQuery)) ||
          (!!summary && summary.includes(lowerQuery))
        );
      });
    }

    // Filter by selected sources
    if (selectedSources.length > 0) {
      filtered = filtered.filter(item => item.source && selectedSources.includes(item.source));
    }

    // Filter by selected tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter(item =>
        Array.isArray(item.tags) && item.tags.some(tag => selectedTags.includes(tag))
      );
    }

    // Sort items
    switch (sortBy) {
      case 'date':
        filtered.sort((a, b) => new Date(b.crawledAt).getTime() - new Date(a.crawledAt).getTime());
        break;
      case 'title':
        filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      case 'relevance':
        filtered.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
        break;
      default:
        break;
    }

    setFilteredItems(filtered);
  }, [docItems, query, selectedSources, selectedTags, selectedCategory, sortBy]);

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);
    setError(null);

    try {
      const result = await documentationApi.searchDocumentation({
        query: query.trim() || undefined,
        sources: selectedSources.length > 0 ? selectedSources : undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        sortBy: sortBy as 'relevance' | 'date' | 'title',
        limit: 50
      });

      setDocItems(result.items);
      setFilteredItems(result.items);
    } catch (err) {
      console.error('Error searching documentation:', err);
      setError('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  }, [query, selectedSources, selectedTags, sortBy]);

  const toggleSource = (source: string) => {
    setSelectedSources(prev =>
      prev.includes(source)
        ? prev.filter(s => s !== source)
        : [...prev, source]
    );
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  // Handle document deletion
  const handleDelete = async (doc: DocItem) => {
    setIsDeleting(true);
    try {
      const success = await documentationApi.delete(doc.id);
      if (success) {
        // Remove from local state
        setDocItems(prev => prev.filter(item => item.id !== doc.id));
        setFilteredItems(prev => prev.filter(item => item.id !== doc.id));
        // Update stats
        if (stats) {
          setStats({ ...stats, total: stats.total - 1 });
        }
        setDeleteConfirm(null);
        setSelectedDoc(null);
      } else {
        setError('Failed to delete document. Please try again.');
      }
    } catch (err) {
      console.error('Error deleting document:', err);
      setError('Failed to delete document. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Check if a document might be corrupted (e.g., binary data in title)
  const isCorruptedEntry = (item: DocItem): boolean => {
    const safeTitle = item.title || '';
    // Check for PNG/binary signatures or unusual characters
    // eslint-disable-next-line no-control-regex -- Intentionally detecting binary/corrupted data
    const hasNonPrintable = /[\x00-\x08\x0E-\x1F]/.test(safeTitle);
    const hasPngSignature = safeTitle.includes('PNG') && safeTitle.includes('IHDR');
    const hasFileExtension = /\.(png|jpg|gif|pdf|exe|dll)\?/.test(safeTitle.toLowerCase());
    return hasNonPrintable || hasPngSignature || hasFileExtension;
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  // Get category color for modal header
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Process Management': 'bg-gradient-to-r from-blue-600 to-blue-700',
      'File System': 'bg-gradient-to-r from-teal-600 to-teal-700',
      'Service Management': 'bg-gradient-to-r from-purple-600 to-purple-700',
      'Network': 'bg-gradient-to-r from-cyan-600 to-cyan-700',
      'Security': 'bg-gradient-to-r from-red-600 to-red-700',
      'Module Management': 'bg-gradient-to-r from-yellow-600 to-yellow-700',
      'Data Conversion': 'bg-gradient-to-r from-orange-600 to-orange-700',
      'Pipeline': 'bg-gradient-to-r from-pink-600 to-pink-700',
      'Output': 'bg-gradient-to-r from-indigo-600 to-indigo-700',
      'Web Requests': 'bg-gradient-to-r from-emerald-600 to-emerald-700',
      'General': 'bg-gradient-to-r from-slate-600 to-slate-700'
    };
    return colors[category] || colors['General'];
  };

  // Format content for better readability - handles different text patterns
  const formatContent = (content: string): { type: 'text' | 'code'; content: string }[] => {
    const results: { type: 'text' | 'code'; content: string }[] = [];

    // Split by code blocks first (``` or indented blocks)
    const parts = content.split(/(```[\s\S]*?```|(?:^[ \t]{4,}.+$\n?)+)/gm);

    parts.forEach(part => {
      const trimmed = part.trim();
      if (!trimmed) return;

      // Check if it's a code block
      if (trimmed.startsWith('```') || /^[ \t]{4,}/.test(part)) {
        // Remove ``` markers if present
        const codeContent = trimmed.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
        results.push({ type: 'code', content: codeContent.trim() });
      } else {
        // Regular text - split into paragraphs by double newlines first
        const paragraphs = trimmed
          .split(/\n{2,}/)
          .map(p => p.replace(/\n/g, ' ').trim())
          .filter(p => p.length > 0);

        paragraphs.forEach(p => {
          // If paragraph is very long (>400 chars), break it into smaller chunks
          if (p.length > 400) {
            // Split on sentence boundaries (. ! ?) followed by space
            const sentences = p.split(/(?<=[.!?])\s+/);
            let chunk = '';

            sentences.forEach((sentence, idx) => {
              chunk += (chunk ? ' ' : '') + sentence;
              // Create a new paragraph every 2-3 sentences or if chunk is getting long
              if ((idx + 1) % 3 === 0 || chunk.length > 350 || idx === sentences.length - 1) {
                if (chunk.trim()) {
                  results.push({ type: 'text', content: chunk.trim() });
                }
                chunk = '';
              }
            });
          } else {
            results.push({ type: 'text', content: p });
          }
        });
      }
    });

    return results;
  };

  const sourceBreakdown = useMemo(() => {
    if (!stats?.sources) return [];
    return Object.entries(stats.sources)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [stats]);

  const categoryBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    docItems.forEach((item) => {
      const category = item.category || 'General';
      counts[category] = (counts[category] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [docItems]);

  const crawlTrend = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i * 7);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      buckets.push({
        key,
        label: weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        count: 0,
      });
    }

    const byWeek = new Map<string, number>();
    docItems.forEach((item) => {
      const date = new Date(item.crawledAt);
      date.setDate(date.getDate() - date.getDay());
      const key = date.toISOString().slice(0, 10);
      byWeek.set(key, (byWeek.get(key) || 0) + 1);
    });

    return buckets.map((bucket) => ({
      ...bucket,
      count: byWeek.get(bucket.key) || 0,
    }));
  }, [docItems]);

  const maxSourceCount = Math.max(1, ...sourceBreakdown.map((entry) => entry.count));
  const maxCategoryCount = Math.max(1, ...categoryBreakdown.map((entry) => entry.count));
  const maxTrendCount = Math.max(1, ...crawlTrend.map((entry) => entry.count));

  const screenshotCards = [
    {
      src: docsScreenshot,
      title: 'Documentation Index',
      detail: 'Clean knowledge navigation with summaries and metadata',
    },
    {
      src: dashboardScreenshot,
      title: 'Operations Dashboard',
      detail: 'Cross-view context between docs, analytics, and scripts',
    },
    {
      src: uploadScreenshot,
      title: 'Content Intake',
      detail: 'Structured upload workflows for new script content',
    },
    {
      src: settingsScreenshot,
      title: 'Configuration Control',
      detail: 'Provider and security settings with clear sectioning',
    },
  ];

  const panelMotion = {
    hidden: { opacity: 0, y: 14 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.28,
      },
    },
  };

  const sourceBarColors = ['bg-blue-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500'];
  const categoryBarColors = ['bg-indigo-500', 'bg-sky-500', 'bg-teal-500', 'bg-orange-500', 'bg-fuchsia-500'];

  return (
    <div className="container mx-auto pb-10 space-y-8 text-[var(--color-text-primary)]">
      <motion.section
        variants={panelMotion}
        initial={prefersReducedMotion ? false : 'hidden'}
        animate="show"
        className="relative overflow-hidden rounded-3xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-6 md:p-8"
      >
        <div className="pointer-events-none absolute -left-24 -top-20 h-56 w-56 rounded-full bg-[var(--color-primary)]/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-[var(--color-accent)]/15 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full border border-[var(--color-border-default)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
              Documentation Workspace
            </div>
            <h1 className="mt-4 text-3xl font-bold leading-tight md:text-4xl">
              Documentation Explorer
            </h1>
            <p className="mt-3 text-base text-[var(--color-text-secondary)] md:text-lg">
              Structured docs with visual context, analytics, and script-ready references. Designed for fast scanning with generous spacing and clear hierarchy.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-[var(--color-bg-tertiary)] px-3 py-1 text-xs font-medium text-[var(--color-text-secondary)]">
                {(stats?.total || 0).toLocaleString()} indexed docs
              </span>
              <span className="rounded-full bg-[var(--color-bg-tertiary)] px-3 py-1 text-xs font-medium text-[var(--color-text-secondary)]">
                {(stats?.tagsCount || tags.length).toLocaleString()} tags
              </span>
              <span className="rounded-full bg-[var(--color-bg-tertiary)] px-3 py-1 text-xs font-medium text-[var(--color-text-secondary)]">
                {stats?.lastCrawled ? `Last crawl ${formatDate(stats.lastCrawled)}` : 'Crawl pending'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]"
            >
              Dashboard
            </Link>
            <Link
              to="/documentation/crawl"
              className="inline-flex items-center rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:shadow-md"
            >
              Crawl New Content
            </Link>
          </div>
        </div>
      </motion.section>

      <motion.section
        variants={panelMotion}
        initial={prefersReducedMotion ? false : 'hidden'}
        animate="show"
        transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.06 }}
        className="grid grid-cols-1 gap-4 lg:grid-cols-3"
      >
        <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            Source Coverage
          </h2>
          <div className="mt-4 space-y-3">
            {sourceBreakdown.length > 0 ? sourceBreakdown.map((entry, index) => (
              <div key={entry.source}>
                <div className="mb-1 flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                  <span>{entry.source}</span>
                  <span>{entry.count}</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--color-bg-tertiary)]">
                  <div
                    className={`h-2 rounded-full ${sourceBarColors[index % sourceBarColors.length]}`}
                    style={{ width: `${Math.max(8, Math.round((entry.count / maxSourceCount) * 100))}%` }}
                  />
                </div>
              </div>
            )) : (
              <p className="text-sm text-[var(--color-text-tertiary)]">No source stats yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            Category Mix
          </h2>
          <div className="mt-4 space-y-3">
            {categoryBreakdown.length > 0 ? categoryBreakdown.map((entry, index) => (
              <div key={entry.category}>
                <div className="mb-1 flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                  <span>{entry.category}</span>
                  <span>{entry.count}</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--color-bg-tertiary)]">
                  <div
                    className={`h-2 rounded-full ${categoryBarColors[index % categoryBarColors.length]}`}
                    style={{ width: `${Math.max(8, Math.round((entry.count / maxCategoryCount) * 100))}%` }}
                  />
                </div>
              </div>
            )) : (
              <p className="text-sm text-[var(--color-text-tertiary)]">No category data yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            Crawl Trend
          </h2>
          <div className="mt-5 flex h-32 items-end justify-between gap-2">
            {crawlTrend.map((entry) => (
              <div key={entry.key} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-24 w-full items-end">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-[var(--color-primary)] to-[var(--color-accent)]"
                    style={{ height: `${Math.max(6, Math.round((entry.count / maxTrendCount) * 100))}%` }}
                    title={`${entry.label}: ${entry.count}`}
                  />
                </div>
                <span className="text-[10px] text-[var(--color-text-tertiary)]">{entry.label}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.section
        variants={panelMotion}
        initial={prefersReducedMotion ? false : 'hidden'}
        animate="show"
        transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.12 }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Visual Documentation Gallery</h2>
          <p className="text-sm text-[var(--color-text-tertiary)]">Screenshots from live product areas</p>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {screenshotCards.map((card) => (
            <article key={card.title} className="overflow-hidden rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)]">
              <img src={card.src} alt={card.title} className="h-48 w-full object-cover md:h-56" loading="lazy" />
              <div className="p-4">
                <h3 className="text-base font-semibold">{card.title}</h3>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{card.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </motion.section>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-6 shadow-[var(--shadow-sm)] mb-6">
        <form onSubmit={handleSearch}>
          <div className="flex mb-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search PowerShell documentation..."
              className="flex-1 rounded-l-xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-4 py-2.5 text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
            <button
              type="submit"
              disabled={isSearching || isLoading}
              className="rounded-r-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] px-4 py-2.5 text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSearching ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Searching...
                </span>
              ) : (
                'Search'
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Sources Filter */}
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Sources</h3>
              <div className="space-y-2">
                {sources.map(source => (
                  <label key={source} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedSources.includes(source)}
                      onChange={() => toggleSource(source)}
                      className="h-4 w-4 rounded border-[var(--color-border-strong)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                    />
                    <span className="ml-2 text-sm text-[var(--color-text-secondary)]">{source}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Tags Filter */}
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {tags.slice(0, 20).map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`text-xs px-2 py-1 rounded-full ${
                      selectedTags.includes(tag)
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort and View Options */}
            <div>
              <div className="flex justify-between mb-2">
                <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">Sort By</h3>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setViewMode('card')}
                    className={`p-1 rounded-md ${
                      viewMode === 'card' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-secondary)]'
                    }`}
                    title="Grid view"
                    aria-label="Switch to grid view"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`p-1 rounded-md ${
                      viewMode === 'list' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-secondary)]'
                    }`}
                    title="List view"
                    aria-label="Switch to list view"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              <label htmlFor="sort-select" className="sr-only">Sort by</label>
              <select
                id="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="block w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-2 text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                aria-label="Sort documents by"
              >
                <option value="date">Most Recent</option>
                <option value="title">Title (A-Z)</option>
                <option value="relevance">Relevance</option>
              </select>
            </div>
          </div>
        </form>
      </div>

      {/* Category Tabs */}
      {categories.length > 0 && (
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory('All')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedCategory === 'All'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
              }`}
            >
              All ({docItems.length})
            </button>
            {categories.map(category => {
              const count = docItems.filter(d => (d.category || 'General') === category).length;
              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedCategory === category
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                  }`}
                >
                  {category} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Results Count */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-[var(--color-text-tertiary)]">
          {isLoading
            ? 'Loading...'
            : filteredItems.length === 0
              ? 'No results found'
              : `Showing ${filteredItems.length} result${filteredItems.length === 1 ? '' : 's'}${selectedCategory !== 'All' ? ` in ${selectedCategory}` : ''}`}
        </div>
        <div className="text-sm text-[var(--color-text-tertiary)]">
          Powered by database search
        </div>
      </div>

      {/* Loading State */}
      {(isSearching || isLoading) && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* No Results */}
      {!isSearching && !isLoading && filteredItems.length === 0 && (
        <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-8 text-center">
          <svg
            className="mx-auto h-12 w-12 text-[var(--color-text-tertiary)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-4 text-xl font-medium text-[var(--color-text-primary)]">No documentation found</h3>
          <p className="mt-2 text-[var(--color-text-secondary)]">
            {docItems.length === 0
              ? 'The documentation database is empty. Start by crawling some content.'
              : 'Try changing your search criteria or crawl new content.'}
          </p>
          <Link
            to="/documentation/crawl"
            className="mt-4 inline-flex items-center rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] px-4 py-2.5 text-white"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              ></path>
            </svg>
            Crawl New Content
          </Link>
        </div>
      )}

      {/* Card View - Using SummaryCard tiles for beautiful display */}
      {!isSearching && !isLoading && filteredItems.length > 0 && viewMode === 'card' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <SummaryCard
              key={item.id}
              doc={item}
              onClick={() => setSelectedDoc(item)}
              onDelete={(e) => {
                e.stopPropagation();
                setDeleteConfirm(item);
              }}
            />
          ))}
        </div>
      )}

      {/* List View */}
      {!isSearching && !isLoading && filteredItems.length > 0 && viewMode === 'list' && (
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] shadow-[var(--shadow-sm)]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--color-border-default)]">
              <thead className="bg-[var(--color-bg-secondary)]">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Title
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Source
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Tags
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Crawled
                  </th>
                  {sortBy === 'relevance' && (
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                      Similarity
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-default)]">
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedDoc(item)}
                    className="cursor-pointer hover:bg-[var(--color-bg-secondary)]"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <span className="font-medium text-[var(--color-text-primary)] hover:text-[var(--color-primary)]">
                          {item.title}
                        </span>
                        <p className="mt-1 line-clamp-1 text-sm text-[var(--color-text-tertiary)]">
                          {item.summary || item.content || 'No description available'}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-text-secondary)]">
                      {item.source}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {item.tags && item.tags.map(tag => (
                          <span
                            key={tag}
                            className="inline-flex items-center rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-text-secondary)]">
                      {formatDate(item.crawledAt)}
                    </td>
                    {sortBy === 'relevance' && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-text-secondary)]">
                        {item.similarity ? item.similarity.toFixed(2) : 'N/A'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Document Detail Modal - Beautiful 2026 Design */}
      {selectedDoc && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedDoc(null)}
        >
          <div
            className="bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Colored Modal Header */}
            <div className={`${getCategoryColor(selectedDoc.category || 'General')} px-6 py-5`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-semibold text-white/90 uppercase tracking-wider bg-white/20 px-2 py-1 rounded">
                      {selectedDoc.category || 'General'}
                    </span>
                    <span className="text-xs text-white/70">
                      {selectedDoc.source}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-white leading-tight">{selectedDoc.title}</h2>
                </div>
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
                  aria-label="Close modal"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
              {/* AI Summary Section */}
              {selectedDoc.summary && (
                <div className="bg-gradient-to-r from-purple-900/20 to-indigo-900/20 rounded-xl p-5 border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider">
                      AI Summary
                    </h3>
                  </div>
                  <p className="text-gray-200 leading-relaxed text-base">
                    {selectedDoc.summary}
                  </p>
                </div>
              )}

              {/* Key Insights Section */}
              {(selectedDoc.metadata as any)?.aiInsights && (selectedDoc.metadata as any).aiInsights.length > 0 && (
                <div className="bg-gradient-to-r from-amber-900/20 to-orange-900/20 rounded-xl p-5 border border-amber-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">
                      Key Insights
                    </h3>
                  </div>
                  <ul className="space-y-2">
                    {((selectedDoc.metadata as any).aiInsights as string[]).map((insight, idx) => (
                      <li key={idx} className="flex items-start text-gray-300">
                        <span className="text-amber-400 mr-3 mt-1">•</span>
                        <span className="leading-relaxed">{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Tags Section */}
              {selectedDoc.tags && selectedDoc.tags.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedDoc.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 bg-gray-700/50 text-gray-300 rounded-full text-sm font-medium hover:bg-gray-700 transition-colors"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* PowerShell Commands Section */}
              {selectedDoc.extractedCommands && selectedDoc.extractedCommands.length > 0 && (
                <div className="bg-gradient-to-r from-green-900/20 to-emerald-900/20 rounded-xl p-5 border border-green-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wider">
                      PowerShell Commands
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedDoc.extractedCommands.map((cmd, idx) => (
                      <code
                        key={idx}
                        className="px-3 py-1.5 bg-green-900/40 text-green-300 rounded-lg font-mono text-sm border border-green-600/30"
                      >
                        {cmd}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              {/* Functions Section */}
              {selectedDoc.extractedFunctions && selectedDoc.extractedFunctions.length > 0 && (
                <div className="bg-gradient-to-r from-violet-900/20 to-purple-900/20 rounded-xl p-5 border border-violet-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                    <h3 className="text-sm font-semibold text-violet-400 uppercase tracking-wider">
                      Functions & Scripts
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedDoc.extractedFunctions.map((func, idx) => (
                      <code
                        key={idx}
                        className="px-3 py-1.5 bg-violet-900/40 text-violet-300 rounded-lg font-mono text-sm border border-violet-600/30"
                      >
                        {func}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              {/* Modules Section */}
              {selectedDoc.extractedModules && selectedDoc.extractedModules.length > 0 && (
                <div className="bg-gradient-to-r from-yellow-900/20 to-amber-900/20 rounded-xl p-5 border border-yellow-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <h3 className="text-sm font-semibold text-yellow-400 uppercase tracking-wider">
                      PowerShell Modules
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedDoc.extractedModules.map((mod, idx) => (
                      <code
                        key={idx}
                        className="px-3 py-1.5 bg-yellow-900/40 text-yellow-300 rounded-lg font-mono text-sm border border-yellow-600/30"
                      >
                        {mod}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Content Section - Clean, readable formatting */}
              {selectedDoc.content && (
                <div className="bg-gray-900/50 rounded-xl border border-gray-700/50 overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-3 bg-gray-800/50 border-b border-gray-700/50">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                      Full Content
                    </h3>
                  </div>
                  <div className="p-6 max-h-80 overflow-y-auto">
                    <div className="space-y-4">
                      {formatContent(selectedDoc.content).map((block, idx) => (
                        block.type === 'code' ? (
                          <pre key={idx} className="bg-gray-950 rounded-lg p-4 overflow-x-auto border border-gray-700/50">
                            <code className="text-green-400 font-mono text-sm whitespace-pre-wrap">
                              {block.content}
                            </code>
                          </pre>
                        ) : (
                          <p key={idx} className="text-gray-200 text-base leading-7 font-normal">
                            {block.content}
                          </p>
                        )
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Source & Date Footer */}
              <div className="flex items-center justify-between text-xs text-gray-500 pt-4 border-t border-gray-700/50">
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Source: {selectedDoc.source}
                </span>
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Added: {formatDate(selectedDoc.crawledAt)}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-900/50 border-t border-gray-700/50 flex justify-between items-center">
              <div className="flex gap-3">
                {selectedDoc.url && selectedDoc.url.startsWith('http') && (
                  <a
                    href={selectedDoc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Open Original
                  </a>
                )}
                <button
                  onClick={() => setDeleteConfirm(selectedDoc)}
                  className="inline-flex items-center px-4 py-2.5 bg-red-600/80 text-white rounded-xl hover:bg-red-600 transition-colors font-medium"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className="px-5 py-2.5 bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4"
          onClick={() => !isDeleting && setDeleteConfirm(null)}
        >
          <div
            className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 bg-red-600/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Delete Document</h3>
                <p className="text-sm text-gray-400">This action cannot be undone.</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-gray-300">
                Are you sure you want to delete{' '}
                <span className="font-medium text-white">&ldquo;{deleteConfirm.title}&rdquo;</span>?
              </p>
              {isCorruptedEntry(deleteConfirm) && (
                <div className="mt-3 p-3 bg-red-900/30 border border-red-700 rounded-lg">
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    This entry appears to be corrupted and should be deleted.
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Document
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Documentation;
