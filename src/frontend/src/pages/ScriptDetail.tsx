import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { categoryService, scriptService } from '../services/api';
import ScriptDownloadButton from '../components/ScriptDownloadButton';
import toast from 'react-hot-toast';
import { isHostedStaticAnalysisOnly } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';

type ScriptDetailsFormState = {
  title: string;
  description: string;
  categoryId: string;
  isPublic: boolean;
  tags: string;
  content: string;
};

const parseTagsInput = (value: string): string[] =>
  Array.from(new Set(
    value
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(Boolean)
  )).slice(0, 10);

const ScriptDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [detailsForm, setDetailsForm] = useState<ScriptDetailsFormState | null>(null);
  const hostedStaticOnly = isHostedStaticAnalysisOnly();
  const isAdmin = user?.role === 'admin';

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

  const { data: versionHistory, refetch: refetchVersions } = useQuery({
    queryKey: ['scriptVersions', id],
    queryFn: () => scriptService.getScriptVersions(id || ''),
    enabled: !!id,
    refetchOnWindowFocus: false,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: categoryService.getCategories,
    enabled: isAdmin && !!detailsForm,
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
    mutationFn: (payload: {
      title: string;
      description: string;
      categoryId: number | null;
      isPublic: boolean;
      tags: string[];
      content: string;
    }) => scriptService.updateScript(id || '', payload),
    onSuccess: () => {
      refetch();
      refetchVersions();
      setDetailsForm(null);
      toast.success('Script details updated');
    },
    onError: (error) => {
      console.error('Error updating script:', error);
      toast.error('Failed to update script');
    }
  });

  const deleteScriptMutation = useMutation({
    mutationFn: () => scriptService.archiveScript(id || '', 'Archived from script detail'),
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Script archived successfully');
        navigate('/scripts');
      } else {
        toast.error('Failed to archive script');
      }
    },
    onError: (error) => {
      console.error('Error archiving script:', error);
      toast.error('Failed to archive script');
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

  const handleOpenDetails = () => {
    if (!isAdmin) {
      toast.error('Only admins can edit script details.');
      return;
    }
    setDetailsForm({
      title: script.title || '',
      description: script.description || '',
      categoryId: script.categoryId ? String(script.categoryId) : '',
      isPublic: Boolean(script.isPublic),
      tags: Array.isArray(script.tags) ? script.tags.join(', ') : '',
      content: script.content || '',
    });
  };

  const handleSaveDetails = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isAdmin) {
      toast.error('Only admins can edit script details.');
      return;
    }
    if (!detailsForm) return;
    if (!detailsForm.title.trim()) {
      toast.error('Script title is required');
      return;
    }
    if (!detailsForm.content.trim()) {
      toast.error('Script content is required');
      return;
    }
    updateScriptMutation.mutate({
      title: detailsForm.title.trim(),
      description: detailsForm.description.trim(),
      categoryId: detailsForm.categoryId ? Number(detailsForm.categoryId) : null,
      isPublic: detailsForm.isPublic,
      tags: parseTagsInput(detailsForm.tags),
      content: detailsForm.content,
    });
  };

  const handleAnalyzeScript = () => {
    navigate(`/scripts/${id}/analysis`);
  };

  const handleDeleteScript = () => {
    if (window.confirm(`Archive "${script.title}"? It will be hidden from normal script lists and can be restored by an admin.`)) {
      deleteScriptMutation.mutate();
    }
  };

  // Reusable styles
  const cardStyles = "rounded-xl shadow-[var(--shadow-near)] overflow-hidden bg-[var(--surface-raised)] border border-[var(--surface-overlay)] transition-colors duration-300";
  const cardHeaderStyles = "p-4 bg-[var(--surface-overlay)] border-b border-[var(--surface-overlay)]";
  const buttonPrimaryStyles = "px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-soft)] transition-colors";
  const buttonSecondaryStyles = "px-4 py-2 bg-[var(--surface-overlay)] text-[var(--ink-primary)] rounded-lg hover:bg-[var(--surface-overlay)]/80 transition-colors";

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--accent)]"></div>
      </div>
    );
  }

  if (error || !script) {
    return (
      <div className={`${cardStyles} p-8 text-center`}>
        <h2 className="text-2xl font-bold text-[var(--ink-primary)] mb-4">Script Not Found</h2>
        <p className="text-[var(--ink-secondary)] mb-6">
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
        <h1 className="text-2xl font-bold text-[var(--ink-primary)]">{script.title}</h1>
        <div className="flex space-x-2">
          <ScriptDownloadButton
            scriptContent={script.content}
            scriptTitle={script.title}
            showOptions={true}
            variant="primary"
          />
          {isAdmin && (
            <button
              className={buttonPrimaryStyles}
              onClick={handleOpenDetails}
            >
              Edit Details
            </button>
          )}
          <button
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center transition-colors"
            onClick={handleAnalyzeScript}
          >
            Analyze with AI
          </button>
          <button
            className={buttonSecondaryStyles}
            onClick={() => navigate('/scripts')}
          >
            Back to Scripts
          </button>
          <button
            className="px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 disabled:opacity-50 transition-colors"
            onClick={handleDeleteScript}
            disabled={deleteScriptMutation.isPending}
          >
            {deleteScriptMutation.isPending ? 'Archiving...' : 'Archive'}
          </button>
          <button
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            onClick={() => navigate('/')}
          >
            Dashboard
          </button>
        </div>
      </div>

      {isAdmin && detailsForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <form
            onSubmit={handleSaveDetails}
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl border border-[var(--surface-overlay)] bg-[var(--surface-raised)] shadow-[var(--shadow-far)]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--surface-overlay)] p-5">
              <div>
                <h2 className="text-xl font-semibold text-[var(--ink-primary)]">Edit Script Details</h2>
                <p className="mt-1 text-sm text-[var(--ink-secondary)]">
                  Content edits create a new script version. Metadata-only edits keep the current version.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailsForm(null)}
                className={buttonSecondaryStyles}
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="block text-sm font-medium text-[var(--ink-secondary)]">Title</span>
                <input
                  type="text"
                  value={detailsForm.title}
                  onChange={(e) => setDetailsForm(prev => prev ? { ...prev, title: e.target.value } : prev)}
                  className="w-full rounded-md border border-[var(--surface-overlay)] bg-[var(--surface-base)] px-3 py-2 text-[var(--ink-primary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/40"
                />
              </label>

              <label className="space-y-2">
                <span className="block text-sm font-medium text-[var(--ink-secondary)]">Category</span>
                <select
                  value={detailsForm.categoryId}
                  onChange={(e) => setDetailsForm(prev => prev ? { ...prev, categoryId: e.target.value } : prev)}
                  className="w-full rounded-md border border-[var(--surface-overlay)] bg-[var(--surface-base)] px-3 py-2 text-[var(--ink-primary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/40"
                >
                  <option value="">Uncategorized</option>
                  {(categories?.categories || []).map((category: any) => (
                    <option key={category.id} value={String(category.id)}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="block text-sm font-medium text-[var(--ink-secondary)]">Description</span>
                <textarea
                  value={detailsForm.description}
                  onChange={(e) => setDetailsForm(prev => prev ? { ...prev, description: e.target.value } : prev)}
                  rows={3}
                  className="w-full rounded-md border border-[var(--surface-overlay)] bg-[var(--surface-base)] px-3 py-2 text-[var(--ink-primary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/40"
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="block text-sm font-medium text-[var(--ink-secondary)]">Tags</span>
                <input
                  type="text"
                  value={detailsForm.tags}
                  onChange={(e) => setDetailsForm(prev => prev ? { ...prev, tags: e.target.value } : prev)}
                  placeholder="powershell, security, operations"
                  className="w-full rounded-md border border-[var(--surface-overlay)] bg-[var(--surface-base)] px-3 py-2 text-[var(--ink-primary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/40"
                />
              </label>

              <label className="flex items-center gap-3 rounded-md border border-[var(--surface-overlay)] bg-[var(--surface-base)] px-3 py-2 md:col-span-2">
                <input
                  type="checkbox"
                  checked={detailsForm.isPublic}
                  onChange={(e) => setDetailsForm(prev => prev ? { ...prev, isPublic: e.target.checked } : prev)}
                  className="h-4 w-4 rounded border-[var(--surface-overlay)] text-[var(--accent)] focus:ring-[var(--accent)]"
                />
                <span className="text-sm text-[var(--ink-secondary)]">Public script</span>
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="block text-sm font-medium text-[var(--ink-secondary)]">Script Content</span>
                <textarea
                  value={detailsForm.content}
                  onChange={(e) => setDetailsForm(prev => prev ? { ...prev, content: e.target.value } : prev)}
                  rows={16}
                  className="w-full rounded-md border border-[var(--surface-overlay)] bg-[var(--surface-base)] px-3 py-2 font-mono text-sm text-[var(--ink-primary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/40"
                />
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-[var(--surface-overlay)] p-5">
              <button
                type="button"
                onClick={() => setDetailsForm(null)}
                className={buttonSecondaryStyles}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateScriptMutation.isPending}
                className={`${buttonPrimaryStyles} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {updateScriptMutation.isPending ? 'Saving...' : 'Save Details'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Script Content */}
        <div className="lg:col-span-2">
          <div className={`${cardStyles} mb-6`}>
            <div className={`${cardHeaderStyles} flex justify-between items-center`}>
              <h2 className="text-lg font-medium text-[var(--ink-primary)]">Script Content</h2>
              <div className="text-xs text-[var(--ink-tertiary)]">
                Version {script.version} | Updated {new Date(script.updatedAt).toLocaleDateString()}
              </div>
            </div>
            <div className="p-0">
              <pre className="p-4 text-sm font-mono text-[var(--ink-secondary)] overflow-x-auto max-h-96 bg-[var(--surface-base)]">
                {script.content}
              </pre>
            </div>
          </div>

          {/* Parameters Section */}
          {!hostedStaticOnly && analysis?.parameters && Object.keys(analysis.parameters).length > 0 && (
            <div className={`${cardStyles} mb-6`}>
              <div className={cardHeaderStyles}>
                <h2 className="text-lg font-medium text-[var(--ink-primary)]">Execute Script</h2>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(analysis.parameters).map(([name, info]: [string, any]) => (
                    <div key={name} className="space-y-2">
                      <label className="block text-sm font-medium text-[var(--ink-secondary)]">
                        {name}
                        {info.mandatory && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <input
                        type="text"
                        className="w-full bg-[var(--surface-base)] border border-[var(--surface-overlay)] rounded-md text-[var(--ink-primary)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--accent)]/50 focus:border-[var(--accent)]"
                        placeholder={info.type || 'String'}
                        value={parameters[name] || ''}
                        onChange={(e) => handleParameterChange(name, e.target.value)}
                      />
                      {info.description && (
                        <p className="text-xs text-[var(--ink-tertiary)]">{info.description}</p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    onClick={handleExecute}
                    disabled={executeMutation.isPending}
                  >
                    {executeMutation.isPending ? 'Executing...' : 'Execute Script'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {hostedStaticOnly && analysis?.parameters && Object.keys(analysis.parameters).length > 0 && (
            <div className={`${cardStyles} mb-6`}>
              <div className={cardHeaderStyles}>
                <h2 className="text-lg font-medium text-[var(--ink-primary)]">Execution Disabled</h2>
              </div>
              <div className="p-4">
                <p className="text-sm text-[var(--ink-secondary)]">
                  Hosted PSScript supports static analysis only. Download the script to run it in your own PowerShell environment.
                </p>
              </div>
            </div>
          )}

          {/* Execution Result */}
          {executeMutation.data && (
            <div className={`${cardStyles} mb-6`}>
              <div className={cardHeaderStyles}>
                <h2 className="text-lg font-medium text-[var(--ink-primary)]">Execution Result</h2>
              </div>
              <div className="p-0">
                <pre className="p-4 text-sm font-mono text-[var(--ink-secondary)] overflow-x-auto max-h-96 bg-[var(--surface-base)]">
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
              <h2 className="text-lg font-medium text-[var(--ink-primary)]">Script Information</h2>
            </div>
            <div className="p-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm text-[var(--ink-tertiary)]">Description</h3>
                  <p className="text-[var(--ink-primary)]">{script.description || 'No description provided'}</p>
                </div>
                <div>
                  <h3 className="text-sm text-[var(--ink-tertiary)]">Category</h3>
                  <p className="text-[var(--ink-primary)]">{script.category?.name || 'Uncategorized'}</p>
                </div>
                <div>
                  <h3 className="text-sm text-[var(--ink-tertiary)]">Visibility</h3>
                  <p className="text-[var(--ink-primary)]">{script.isPublic ? 'Public' : 'Private'}</p>
                </div>
                <div>
                  <h3 className="text-sm text-[var(--ink-tertiary)]">Tags</h3>
                  {Array.isArray(script.tags) && script.tags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {script.tags.map((tag: string) => (
                        <span
                          key={tag}
                          className="rounded-full bg-[var(--surface-overlay)] px-2 py-1 text-xs text-[var(--ink-secondary)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[var(--ink-primary)]">No tags</p>
                  )}
                </div>
                <div>
                  <h3 className="text-sm text-[var(--ink-tertiary)]">Author</h3>
                  <p className="text-[var(--ink-primary)]">{script.user?.username || 'Unknown'}</p>
                </div>
                <div>
                  <h3 className="text-sm text-[var(--ink-tertiary)]">Created</h3>
                  <p className="text-[var(--ink-primary)]">{new Date(script.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <h3 className="text-sm text-[var(--ink-tertiary)]">Execution Count</h3>
                  <p className="text-[var(--ink-primary)]">{script.executionCount || 0}</p>
                </div>
              </div>
            </div>
          </div>

          <div className={cardStyles}>
            <div className={cardHeaderStyles}>
              <h2 className="text-lg font-medium text-[var(--ink-primary)]">Version History</h2>
            </div>
            <div className="p-4">
              {versionHistory?.versions?.length ? (
                <ol className="space-y-3">
                  {versionHistory.versions.map((version: any) => (
                    <li key={version.id} className="border-l-2 border-[var(--accent)] pl-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-[var(--ink-primary)]">
                          Version {version.version}
                        </span>
                        <span className="text-xs text-[var(--ink-tertiary)]">
                          {new Date(version.created_at || version.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[var(--ink-secondary)]">
                        {version.commit_message || version.commitMessage || 'Script version saved'}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-[var(--ink-secondary)]">
                  No version entries are available yet. Editing and saving script content creates the next version.
                </p>
              )}
            </div>
          </div>

          <div className={cardStyles}>
            <div className={cardHeaderStyles}>
              <h2 className="text-lg font-medium text-[var(--ink-primary)]">Data Protection</h2>
            </div>
            <div className="p-4 space-y-3 text-sm text-[var(--ink-secondary)]">
              <div className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true"></span>
                <p>Transport is protected by HTTPS/TLS on the hosted app.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true"></span>
                <p>Script access is scoped by signed-in user and public/private visibility.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" aria-hidden="true"></span>
                <p>Per-script client-side encryption is not enabled in this build.</p>
              </div>
            </div>
          </div>

          {/* AI Analysis Button (when no analysis exists) */}
          {!analysis && (
            <div className={cardStyles}>
              <div className={cardHeaderStyles}>
                <h2 className="text-lg font-medium text-[var(--ink-primary)]">AI Analysis</h2>
              </div>
              <div className="p-6 text-center">
                <p className="text-[var(--ink-secondary)] mb-4">No analysis available for this script yet.</p>
                <button
                  className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 w-full flex items-center justify-center transition-colors"
                  onClick={handleAnalyzeScript}
                >
                  Choose AI Model
                </button>
              </div>
            </div>
          )}

          {/* AI Analysis Results */}
          {analysis && (
            <div className={cardStyles}>
              <div className={`${cardHeaderStyles} flex justify-between items-center`}>
                <h2 className="text-lg font-medium text-[var(--ink-primary)]">AI Analysis</h2>
                <button
                  className="text-xs px-2 py-1 bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-soft)] transition-colors"
                  onClick={() => window.open(`/scripts/${id}/analysis`, '_blank')}
                >
                  View Full Analysis
                </button>
              </div>
              <div className="p-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm text-[var(--ink-tertiary)]">Purpose</h3>
                    <p className="text-[var(--ink-primary)]">{analysis.purpose || 'Not analyzed yet'}</p>
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
                        <div className="text-center py-4 text-[var(--ink-tertiary)]">
                          <svg className="w-12 h-12 mx-auto mb-2 text-[var(--ink-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          <p className="font-medium">Not Analyzed Yet</p>
                          <p className="text-sm">Open the analysis screen to choose an AI model and generate scores.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h3 className="text-sm text-[var(--ink-tertiary)]">Quality Score</h3>
                          <div className="flex items-center">
                            <div className="w-full bg-[var(--surface-overlay)] rounded-full h-2.5 mr-2">
                              <div
                                className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                                style={{ width: `${(qualityScore ?? 0) * 10}%` }}
                              ></div>
                            </div>
                            <span className="min-w-[3rem] text-right text-[var(--ink-primary)]">
                              {qualityScore !== null ? `${qualityScore.toFixed(1)}/10` : 'N/A'}
                            </span>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm text-[var(--ink-tertiary)]">Security Score</h3>
                          <div className="flex items-center">
                            <div className="w-full bg-[var(--surface-overlay)] rounded-full h-2.5 mr-2">
                              <div
                                className={`h-2.5 rounded-full transition-all duration-500 ${
                                  securityScore !== null
                                    ? securityScore > 7
                                      ? 'bg-emerald-500'
                                      : securityScore > 4
                                      ? 'bg-amber-500'
                                      : 'bg-red-500'
                                    : 'bg-[var(--surface-overlay)]'
                                }`}
                                style={{ width: `${(securityScore ?? 0) * 10}%` }}
                              ></div>
                            </div>
                            <span className="min-w-[3rem] text-right text-[var(--ink-primary)]">
                              {securityScore !== null ? `${securityScore.toFixed(1)}/10` : 'N/A'}
                            </span>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm text-[var(--ink-tertiary)]">Risk Assessment</h3>
                          <div className="flex items-center">
                            <div className="w-full bg-[var(--surface-overlay)] rounded-full h-2.5 mr-2">
                              <div
                                className={`h-2.5 rounded-full transition-all duration-500 ${
                                  riskScore !== null
                                    ? riskScore < 3
                                      ? 'bg-emerald-500'
                                      : riskScore < 7
                                      ? 'bg-amber-500'
                                      : 'bg-red-500'
                                    : 'bg-[var(--surface-overlay)]'
                                }`}
                                style={{ width: `${(riskScore ?? 0) * 10}%` }}
                              ></div>
                            </div>
                            <span className="min-w-[3rem] text-right text-[var(--ink-primary)]">
                              {riskScore !== null ? `${riskScore.toFixed(1)}/10` : 'N/A'}
                            </span>
                          </div>
                        </div>

                        {complexityScore !== null && (
                          <div>
                            <h3 className="text-sm text-[var(--ink-tertiary)]">Complexity</h3>
                            <div className="flex items-center">
                              <div className="w-full bg-[var(--surface-overlay)] rounded-full h-2.5 mr-2">
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
                              <span className="min-w-[3rem] text-right text-[var(--ink-primary)]">{complexityScore.toFixed(1)}/10</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {analysis.optimization_suggestions && analysis.optimization_suggestions.length > 0 && (
                    <div>
                      <h3 className="text-sm text-[var(--ink-tertiary)] mb-2">Optimization Suggestions</h3>
                      <ul className="list-disc pl-5 text-sm text-[var(--ink-secondary)] space-y-1">
                        {analysis.optimization_suggestions.map((suggestion, index) => (
                          <li key={index}>{suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysis.security_concerns && analysis.security_concerns.length > 0 && (
                    <div>
                      <h3 className="text-sm text-[var(--ink-tertiary)] mb-2">Security Concerns</h3>
                      <ul className="list-disc pl-5 text-sm text-red-500 space-y-1">
                        {analysis.security_concerns.map((concern, index) => (
                          <li key={index}>{concern}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysis.best_practices && analysis.best_practices.length > 0 && (
                    <div>
                      <h3 className="text-sm text-[var(--ink-tertiary)] mb-2">Best Practices</h3>
                      <ul className="list-disc pl-5 text-sm text-blue-500 space-y-1">
                        {analysis.best_practices.map((practice, index) => (
                          <li key={index}>{practice}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysis.performance_suggestions && analysis.performance_suggestions.length > 0 && (
                    <div>
                      <h3 className="text-sm text-[var(--ink-tertiary)] mb-2">Performance Tips</h3>
                      <ul className="list-disc pl-5 text-sm text-emerald-500 space-y-1">
                        {analysis.performance_suggestions.map((suggestion, index) => (
                          <li key={index}>{suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-[var(--surface-overlay)]">
                    <button
                      className="w-full text-center text-sm text-[var(--accent)] hover:text-[var(--accent-soft)]"
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
                <h2 className="text-lg font-medium text-[var(--ink-primary)]">Similar Scripts</h2>
              </div>
              <div className="p-4">
                <ul className="space-y-2">
                  {similarScripts.similar_scripts.map((similar: any) => (
                    <li key={similar.script_id}>
                      <a
                        href={`/scripts/${similar.script_id}`}
                        className="text-[var(--accent)] hover:text-[var(--accent-soft)] flex items-center"
                      >
                        <span className="flex-1">{similar.title}</span>
                        <span className="text-xs text-[var(--ink-tertiary)]">
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
