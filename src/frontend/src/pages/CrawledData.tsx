import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import documentationApi, { DocItem } from '../services/documentationApi';
import SummaryCard from '../components/SummaryCard';

const CrawledData: React.FC = () => {
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<DocItem | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const docs = await documentationApi.getRecentDocumentation(100);
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get unique categories
  const categories = ['all', ...new Set(documents.map(d => d.category || 'General'))];

  // Filter documents
  const filteredDocs = documents.filter(doc => {
    const matchesFilter = filter === 'all' || (doc.category || 'General') === filter;
    const matchesSearch = !searchQuery ||
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.summary && doc.summary.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Unknown';
    }
  };

  // Handle delete document
  const handleDelete = async (e: React.MouseEvent, docId: number) => {
    e.stopPropagation(); // Prevent opening the modal
    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        await documentationApi.delete(docId);
        // Remove from local state
        setDocuments(prev => prev.filter(d => d.id !== docId));
      } catch (error) {
        console.error('Error deleting document:', error);
        alert('Failed to delete document');
      }
    }
  };

  // Get category color for modal
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Process Management': 'bg-blue-600',
      'File System': 'bg-green-600',
      'Service Management': 'bg-purple-600',
      'Network': 'bg-cyan-600',
      'Security': 'bg-red-600',
      'Module Management': 'bg-yellow-600',
      'Data Conversion': 'bg-orange-600',
      'Pipeline': 'bg-pink-600',
      'Output': 'bg-indigo-600',
      'Web Requests': 'bg-teal-600',
      'General': 'bg-gray-600'
    };
    return colors[category] || 'bg-gray-600';
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-pink-900 py-8">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Documentation Library</h1>
              <p className="text-purple-200 mt-1">
                {documents.length} PowerShell references with AI-enhanced summaries
              </p>
            </div>
            <div className="flex space-x-3">
              <Link
                to="/documentation"
                className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition"
              >
                Search Docs
              </Link>
              <Link
                to="/documentation/crawl"
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Documentation
              </Link>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-wrap gap-4 mt-6">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.slice(0, 8).map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                    filter === cat
                      ? 'bg-white text-purple-900'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {cat === 'all' ? 'All' : cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="text-center py-20">
            <svg className="mx-auto h-16 w-16 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-4 text-xl font-medium text-gray-400">No documents yet</h3>
            <p className="mt-2 text-gray-500">Add PowerShell documentation to build your library</p>
            <Link
              to="/documentation/crawl"
              className="mt-4 inline-flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Documentation
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDocs.map((doc) => (
              <SummaryCard
                key={doc.id}
                doc={doc}
                onClick={() => setSelectedDoc(doc)}
                onDelete={(e) => handleDelete(e, doc.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedDoc && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedDoc(null)}
        >
          <div
            className="bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`${getCategoryColor(selectedDoc.category || 'General')} px-6 py-4`}>
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-medium text-white/80 uppercase tracking-wider">
                    {selectedDoc.category || 'General'}
                  </span>
                  <h2 className="text-2xl font-bold text-white mt-1">{selectedDoc.title}</h2>
                </div>
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="text-white/80 hover:text-white p-1"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* AI Summary */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-2">
                  AI Summary
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  {selectedDoc.summary || 'No AI summary available for this document.'}
                </p>
              </div>

              {/* AI Insights */}
              {(selectedDoc.metadata as any)?.aiInsights && (selectedDoc.metadata as any).aiInsights.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-2">
                    Key Insights
                  </h3>
                  <ul className="space-y-2">
                    {((selectedDoc.metadata as any).aiInsights as string[]).map((insight, idx) => (
                      <li key={idx} className="flex items-start text-gray-300">
                        <span className="text-purple-400 mr-3 text-lg">•</span>
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Code Example */}
              {(selectedDoc.metadata as any)?.codeExample && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wider mb-2">
                    Example Code
                  </h3>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <code className="text-green-400 font-mono text-sm">
                      {(selectedDoc.metadata as any).codeExample}
                    </code>
                  </div>
                </div>
              )}

              {/* Tags */}
              {selectedDoc.tags && selectedDoc.tags.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-2">
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedDoc.tags.map((tag, idx) => (
                      <span key={idx} className="px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-sm">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Extracted Commands */}
              {selectedDoc.extractedCommands && selectedDoc.extractedCommands.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wider mb-2">
                    PowerShell Commands Found
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedDoc.extractedCommands.map((cmd, idx) => (
                      <code key={idx} className="px-3 py-1 bg-green-900/30 text-green-400 rounded font-mono text-sm">
                        {cmd}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              {/* Extracted Functions/Scripts */}
              {selectedDoc.extractedFunctions && selectedDoc.extractedFunctions.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-yellow-400 uppercase tracking-wider mb-2">
                    Scripts Analyzed
                  </h3>
                  <div className="space-y-2">
                    {selectedDoc.extractedFunctions.map((func, idx) => (
                      <div key={idx} className="px-4 py-2 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                        <span className="text-yellow-300 font-medium">{func}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Content */}
              {selectedDoc.content && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-2">
                    Full Content
                  </h3>
                  <div className="bg-gray-900 rounded-lg p-4 max-h-64 overflow-y-auto">
                    <p className="text-gray-400 text-sm whitespace-pre-wrap font-mono">
                      {selectedDoc.content}
                    </p>
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="text-xs text-gray-500 border-t border-gray-700 pt-4 flex justify-between">
                <span>Source: {selectedDoc.source}</span>
                <span>Added: {formatDate(selectedDoc.crawledAt)}</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-900 border-t border-gray-700 flex justify-between">
              {selectedDoc.url && selectedDoc.url.startsWith('http') && (
                <a
                  href={selectedDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open Original
                </a>
              )}
              <button
                onClick={() => setSelectedDoc(null)}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrawledData;
