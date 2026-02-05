import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui-enhanced';
import MonacoEditor from 'react-monaco-editor';
import 'monaco-editor/esm/vs/basic-languages/powershell/powershell';
import { scriptService } from '../services/api';
import { toast } from 'react-toastify';

// Reusable style constants for theme-aware styling
const inputStyles = "w-full px-3 py-2 rounded-md bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]";
const buttonSecondaryStyles = "px-4 py-2 rounded-md bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] border border-[var(--color-border-default)]";

const ScriptEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [script, setScript] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  useEffect(() => {
    const loadScript = async () => {
      if (!id) {
        setError('Script ID is missing.');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await scriptService.getScript(id);
        const loadedScript = response?.script || response;

        if (!loadedScript) {
          throw new Error('Script not found.');
        }

        setScript(loadedScript);
        setTitle(loadedScript.title || '');
        setDescription(loadedScript.description || '');
        setContent(loadedScript.content || '');
        setLastSavedAt(loadedScript.updatedAt || null);
        setIsDirty(false);
      } catch (loadError: any) {
        setError(loadError?.message || 'Failed to load script.');
      } finally {
        setIsLoading(false);
      }
    };

    loadScript();
  }, [id]);

  const handleContentChange = (value: string) => {
    setContent(value);
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!id) return;
    setIsSaving(true);
    try {
      const payload = {
        title: title.trim() || script?.title || 'Untitled Script',
        description: description.trim(),
        content
      };
      const response = await scriptService.updateScript(id, payload);
      const updatedScript = response?.script || response;
      setScript(updatedScript);
      setLastSavedAt(updatedScript?.updatedAt || new Date().toISOString());
      setIsDirty(false);
      toast.success('Script saved.');
    } catch (saveError: any) {
      toast.error(saveError?.message || 'Failed to save script.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    navigate(`/scripts/${id}`);
  };

  const handleReset = () => {
    if (!script) return;
    setTitle(script.title || '');
    setDescription(script.description || '');
    setContent(script.content || '');
    setIsDirty(false);
  };

  const editorOptions = useMemo(
    () => ({
      automaticLayout: true,
      wordWrap: 'on' as const,
      minimap: { enabled: false },
      fontSize: 13,
      lineNumbers: 'on' as const,
      scrollBeyondLastLine: false
    }),
    []
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--color-primary)]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="text-red-500 text-center p-4 bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg">
          <h2 className="text-xl font-bold mb-2">Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <Card className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Edit Script: {script?.title}</h1>
          <div className="space-x-2">
            <button
              onClick={handleCancel}
              className={buttonSecondaryStyles}
            >
              Cancel
            </button>
            <button
              onClick={handleReset}
              disabled={!isDirty}
              className={`${buttonSecondaryStyles} ${!isDirty ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className={`px-4 py-2 rounded-md bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white ${isSaving || !isDirty ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="title" className="block mb-2 font-medium text-[var(--color-text-secondary)]">
            Title
          </label>
          <input
            id="title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setIsDirty(true);
            }}
            className={inputStyles}
          />
        </div>

        <div className="mb-4">
          <label htmlFor="description" className="block mb-2 font-medium text-[var(--color-text-secondary)]">
            Description
          </label>
          <input
            type="text"
            id="description"
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              setIsDirty(true);
            }}
            className={inputStyles}
          />
        </div>

        <div>
          <label htmlFor="content" className="block mb-2 font-medium text-[var(--color-text-secondary)]">
            Script Content
          </label>
          <div className="border border-[var(--color-border-default)] rounded-md overflow-hidden">
            <MonacoEditor
              language="powershell"
              theme="vs-dark"
              value={content}
              options={editorOptions}
              onChange={handleContentChange}
              height={460}
            />
          </div>
          <div className="mt-2 text-xs text-[var(--color-text-secondary)] flex justify-between">
            <span>{isDirty ? 'Unsaved changes' : 'All changes saved'}</span>
            <span>{lastSavedAt ? `Last saved: ${new Date(lastSavedAt).toLocaleString()}` : 'Not saved yet'}</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ScriptEditor;
