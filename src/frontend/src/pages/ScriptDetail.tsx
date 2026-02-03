import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { scriptService } from '../services/api';
import ScriptDownloadButton from '../components/ScriptDownloadButton';
import FullScreenEditor from '../components/FullScreenEditor';
import toast from 'react-hot-toast';

const ScriptDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: script, isLoading, error, refetch } = useQuery({
    queryKey: ['script', id],
    queryFn: () => scriptService.getScript(id || ''),
    enabled: !!id,
    refetchOnWindowFocus: false,
  });

  const { data: analysis, error: _analysisError } = useQuery({
    queryKey: ['scriptAnalysis', id],
    queryFn: () => scriptService.getScriptAnalysis(id || ''),
    enabled: !!id,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const { data: similarScripts } = useQuery({
    queryKey: ['similarScripts', id],
    queryFn: () => scriptService.getSimilarScripts(id || ''),
    enabled: !!id,
    refetchOnWindowFocus: false,
  });

  const executeMutation = useMutation({
    mutationFn: (params: Record<string, string>) => scriptService.executeScript(id || '', params),
    onSuccess: (data) => {
      console.log('Script executed successfully:', data);
      // Handle successful execution
    },
    onError: (error) => {
      console.error('Error executing script:', error);
      // Handle execution error
    }
  });

  const updateScriptMutation = useMutation({
    mutationFn: (content: string) => scriptService.updateScript(id || '', { content }),
    onSuccess: () => {
      // Refetch the script to get the updated version
      refetch();
    },
    onError: (error) => {
      console.error('Error updating script:', error);
      toast.error('Failed to update script');
    }
  });

  // Mutation for analyzing script with AI and saving to database
  const analyzeScriptMutation = useMutation({
    mutationFn: () => scriptService.analyzeScriptAndSave(id || ''),
    onSuccess: (_analysisData) => {
      toast.success('Script analyzed successfully');

      // Navigate to the analysis page
      navigate(`/scripts/${id}/analysis`);
    },
    onError: (error) => {
      console.error('Error analyzing script:', error);
      toast.error('Failed to analyze script');
    },
    onSettled: () => {
      setIsAnalyzing(false);
    }
  });

  const handleExecute = () => {
    executeMutation.mutate(parameters);
  };

  const handleParameterChange = (name: string, value: string) => {
    setParameters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleOpenEditor = () => {
    setIsEditorOpen(true);
  };

  const handleSaveScript = (content: string) => {
    updateScriptMutation.mutate(content);
  };

  const handleAnalyzeScript = () => {
    setIsAnalyzing(true);
    analyzeScriptMutation.mutate();
  };

  // Reusable styles
  const cardStyles = "rounded-xl shadow-[var(--shadow-md)] overflow-hidden bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] transition-colors duration-300";
  const cardHeaderStyles = "p-4 bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border-default)]";
  const buttonPrimaryStyles = "px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-light)] transition-colors";
  const buttonSecondaryStyles = "px-4 py-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-bg-tertiary)]/80 transition-colors";

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--color-primary)]"></div>
      </div>
    );
  }

  if (error || !script) {
    return (
      <div className={`${cardStyles} p-8 text-center`}>
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-4">Script Not Found</h2>
        <p className="text-[var(--color-text-secondary)] mb-6">
          The script you are looking for does not exist or you don&apos;t have permission to view it.
        </p>
        <button
          onClick={() => navigate('/scripts')}
          className={buttonPrimaryStyles}
        >
          Back to Scripts
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto pb-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{script.title}</h1>
        <div className="flex space-x-2">
          <ScriptDownloadButton
            scriptContent={script.content}
            scriptTitle={script.title}
            showOptions={true}
            variant="primary"
          />
          <button
            className={buttonPrimaryStyles}
            onClick={handleOpenEditor}
          >
            Edit
          </button>
          <button
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center transition-colors"
            onClick={handleAnalyzeScript}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Analyzing...
              </>
            ) : (
              'Analyze with AI'
            )}
          </button>
          <button
            className={buttonSecondaryStyles}
            onClick={() => navigate('/scripts')}
          >
            Back to Scripts
          </button>
          <button
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            onClick={() => navigate('/')}
          >
            Dashboard
          </button>
        </div>
      </div>

      {/* Full Screen Editor */}
      <FullScreenEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        initialContent={script.content}
        onSave={handleSaveScript}
        title="Edit PowerShell Script"
        scriptName={script.title}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Script Content */}
        <div className="lg:col-span-2">
          <div className={`${cardStyles} mb-6`}>
            <div className={`${cardHeaderStyles} flex justify-between items-center`}>
              <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Script Content</h2>
              <div className="text-xs text-[var(--color-text-tertiary)]">
                Version {script.version} | Updated {new Date(script.updatedAt).toLocaleDateString()}
              </div>
            </div>
            <div className="p-0">
              <pre className="p-4 text-sm font-mono text-[var(--color-text-secondary)] overflow-x-auto max-h-96 bg-[var(--color-bg-primary)]">
                {script.content}
              </pre>
            </div>
          </div>

          {/* Execution Result */}
          {executeMutation.data && (
            <div className={`${cardStyles} mb-6`}>
              <div className={cardHeaderStyles}>
                <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Execution Result</h2>
              </div>
              <div className="p-0">
                <pre className="p-4 text-sm font-mono text-[var(--color-text-secondary)] overflow-x-auto max-h-96 bg-[var(--color-bg-primary)]">
                  {JSON.stringify(executeMutation.data, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Script Info */}
          <div className={cardStyles}>
            <div className={cardHeaderStyles}>
              <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Script Information</h2>
            </div>
            <div className="p-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm text-[var(--color-text-tertiary)]">Category</h3>
                  <p className="text-[var(--color-text-primary)]">{script.category?.name || 'Uncategorized'}</p>
                </div>
                <div>
                  <h3 className="text-sm text-[var(--color-text-tertiary)]">Author</h3>
                  <p className="text-[var(--color-text-primary)]">{script.user?.username || 'Unknown'}</p>
                </div>
                <div>
                  <h3 className="text-sm text-[var(--color-text-tertiary)]">Created</h3>
                  <p className="text-[var(--color-text-primary)]">{new Date(script.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <h3 className="text-sm text-[var(--color-text-tertiary)]">Execution Count</h3>
                  <p className="text-[var(--color-text-primary)]">{script.executionCount || 0}</p>
                </div>
              </div>
            </div>
          </div>

          {/* AI Analysis Button (when no analysis exists) */}
          {!analysis && (
            <div className={cardStyles}>
              <div className={cardHeaderStyles}>
                <h2 className="text-lg font-medium text-[var(--color-text-primary)]">AI Analysis</h2>
              </div>
              <div className="p-6 text-center">
                <p className="text-[var(--color-text-secondary)] mb-4">No analysis available for this script yet.</p>
                <button
                  className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 w-full flex items-center justify-center transition-colors"
                  onClick={handleAnalyzeScript}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Analyzing Script...
                    </>
                  ) : (
                    'Analyze with AI'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* AI Analysis Results */}
          {analysis && (
            <div className={cardStyles}>
              <div className={`${cardHeaderStyles} flex justify-between items-center`}>
                <h2 className="text-lg font-medium text-[var(--color-text-primary)]">AI Analysis</h2>
                <button
                  className="text-xs px-2 py-1 bg-[var(--color-primary)] text-white rounded hover:bg-[var(--color-primary-light)] transition-colors"
                  onClick={() => window.open(`/scripts/${id}/analysis`, '_blank')}
                >
                  View Full Analysis
                </button>
              </div>
              <div className="p-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm text-[var(--color-text-tertiary)]">Purpose</h3>
                    <p className="text-[var(--color-text-primary)]">{analysis.purpose || 'Not analyzed yet'}</p>
                  </div>

                  {/* Helper function to normalize scores (handles both snake_case and camelCase, and 0-100 vs 1-10 scales) */}
                  {(() => {
                    const normalizeScore = (score: number | undefined | null): number | null => {
                      if (score === undefined || score === null || isNaN(Number(score))) return null;
                      let normalized = Number(score);
                      // If score > 10, assume it's on 0-100 scale and convert to 1-10
                      if (normalized > 10) normalized = normalized / 10;
                      return Math.min(10, Math.max(0, normalized));
                    };

                    // Get scores from either snake_case or camelCase fields
                    const qualityScore = normalizeScore(
                      (analysis as any).codeQualityScore ?? (analysis as any).code_quality_score
                    );
                    const securityScore = normalizeScore(
                      (analysis as any).securityScore ?? (analysis as any).security_score
                    );
                    const riskScore = normalizeScore(
                      (analysis as any).riskScore ?? (analysis as any).risk_score
                    );
                    const complexityScore = normalizeScore(
                      (analysis as any).complexityScore ?? (analysis as any).complexity_score
                    );

                    // Check if any score exists
                    const hasScores = qualityScore !== null || securityScore !== null || riskScore !== null;

                    if (!hasScores) {
                      return (
                        <div className="text-center py-4 text-[var(--color-text-tertiary)]">
                          <svg className="w-12 h-12 mx-auto mb-2 text-[var(--color-text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          <p className="font-medium">Not Analyzed Yet</p>
                          <p className="text-sm">Click &quot;Analyze with AI&quot; to generate scores</p>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h3 className="text-sm text-[var(--color-text-tertiary)]">Quality Score</h3>
                          <div className="flex items-center">
                            <div className="w-full bg-[var(--color-bg-tertiary)] rounded-full h-2.5 mr-2">
                              <div
                                className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                                style={{ width: `${(qualityScore ?? 0) * 10}%` }}
                              ></div>
                            </div>
                            <span className="min-w-[3rem] text-right text-[var(--color-text-primary)]">
                              {qualityScore !== null ? `${qualityScore.toFixed(1)}/10` : 'N/A'}
                            </span>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm text-[var(--color-text-tertiary)]">Security Score</h3>
                          <div className="flex items-center">
                            <div className="w-full bg-[var(--color-bg-tertiary)] rounded-full h-2.5 mr-2">
                              <div
                                className={`h-2.5 rounded-full transition-all duration-500 ${
                                  securityScore !== null
                                    ? securityScore > 7
                                      ? 'bg-emerald-500'
                                      : securityScore > 4
                                      ? 'bg-amber-500'
                                      : 'bg-red-500'
                                    : 'bg-[var(--color-bg-tertiary)]'
                                }`}
                                style={{ width: `${(securityScore ?? 0) * 10}%` }}
                              ></div>
                            </div>
                            <span className="min-w-[3rem] text-right text-[var(--color-text-primary)]">
                              {securityScore !== null ? `${securityScore.toFixed(1)}/10` : 'N/A'}
                            </span>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm text-[var(--color-text-tertiary)]">Risk Assessment</h3>
                          <div className="flex items-center">
                            <div className="w-full bg-[var(--color-bg-tertiary)] rounded-full h-2.5 mr-2">
                              <div
                                className={`h-2.5 rounded-full transition-all duration-500 ${
                                  riskScore !== null
                                    ? riskScore < 3
                                      ? 'bg-emerald-500'
                                      : riskScore < 7
                                      ? 'bg-amber-500'
                                      : 'bg-red-500'
                                    : 'bg-[var(--color-bg-tertiary)]'
                                }`}
                                style={{ width: `${(riskScore ?? 0) * 10}%` }}
                              ></div>
                            </div>
                            <span className="min-w-[3rem] text-right text-[var(--color-text-primary)]">
                              {riskScore !== null ? `${riskScore.toFixed(1)}/10` : 'N/A'}
                            </span>
                          </div>
                        </div>

                        {complexityScore !== null && (
                          <div>
                            <h3 className="text-sm text-[var(--color-text-tertiary)]">Complexity</h3>
                            <div className="flex items-center">
                              <div className="w-full bg-[var(--color-bg-tertiary)] rounded-full h-2.5 mr-2">
                                <div
                                  className={`h-2.5 rounded-full transition-all duration-500 ${
                                    complexityScore < 4
                                      ? 'bg-emerald-500'
                                      : complexityScore < 8
                                      ? 'bg-amber-500'
                                      : 'bg-red-500'
                                  }`}
                                  style={{ width: `${complexityScore * 10}%` }}
                                ></div>
                              </div>
                              <span className="min-w-[3rem] text-right text-[var(--color-text-primary)]">{complexityScore.toFixed(1)}/10</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {analysis.optimization_suggestions && analysis.optimization_suggestions.length > 0 && (
                    <div>
                      <h3 className="text-sm text-[var(--color-text-tertiary)] mb-2">Optimization Suggestions</h3>
                      <ul className="list-disc pl-5 text-sm text-[var(--color-text-secondary)] space-y-1">
                        {analysis.optimization_suggestions.map((suggestion, index) => (
                          <li key={index}>{suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysis.security_concerns && analysis.security_concerns.length > 0 && (
                    <div>
                      <h3 className="text-sm text-[var(--color-text-tertiary)] mb-2">Security Concerns</h3>
                      <ul className="list-disc pl-5 text-sm text-red-500 space-y-1">
                        {analysis.security_concerns.map((concern, index) => (
                          <li key={index}>{concern}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysis.best_practices && analysis.best_practices.length > 0 && (
                    <div>
                      <h3 className="text-sm text-[var(--color-text-tertiary)] mb-2">Best Practices</h3>
                      <ul className="list-disc pl-5 text-sm text-blue-500 space-y-1">
                        {analysis.best_practices.map((practice, index) => (
                          <li key={index}>{practice}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysis.performance_suggestions && analysis.performance_suggestions.length > 0 && (
                    <div>
                      <h3 className="text-sm text-[var(--color-text-tertiary)] mb-2">Performance Tips</h3>
                      <ul className="list-disc pl-5 text-sm text-emerald-500 space-y-1">
                        {analysis.performance_suggestions.map((suggestion, index) => (
                          <li key={index}>{suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-[var(--color-border-default)]">
                    <button
                      className="w-full text-center text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-light)]"
                      onClick={() => window.open(`/scripts/${id}/analysis`, '_blank')}
                    >
                      View Detailed Analysis →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Similar Scripts */}
          {similarScripts && similarScripts.similar_scripts?.length > 0 && (
            <div className={cardStyles}>
              <div className={cardHeaderStyles}>
                <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Similar Scripts</h2>
              </div>
              <div className="p-4">
                <ul className="space-y-2">
                  {similarScripts.similar_scripts.map((similar: any) => (
                    <li key={similar.script_id}>
                      <a
                        href={`/scripts/${similar.script_id}`}
                        className="text-[var(--color-primary)] hover:text-[var(--color-primary-light)] flex items-center"
                      >
                        <span className="flex-1">{similar.title}</span>
                        <span className="text-xs text-[var(--color-text-tertiary)]">
                          {(similar.similarity * 100).toFixed(0)}% match
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScriptDetail;
