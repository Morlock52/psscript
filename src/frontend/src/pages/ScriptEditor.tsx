import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui-enhanced';
import { scriptService } from '../services/api';
import { toast } from 'react-toastify';
import ScriptEditorShell from '../components/editor/ScriptEditorShell';

// Reusable style constants for theme-aware styling
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
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Edit Script</h1>
          <button onClick={handleCancel} className={buttonSecondaryStyles}>
            Back
          </button>
        </div>

        <ScriptEditorShell
          scriptId={id}
          title={title}
          description={description}
          onTitleChange={(t) => {
            setTitle(t);
            setIsDirty(true);
          }}
          onDescriptionChange={(d) => {
            setDescription(d);
            setIsDirty(true);
          }}
          content={content}
          onContentChange={handleContentChange}
          onReset={handleReset}
          initialSaveState={isDirty ? 'dirty' : 'saved'}
          onSave={async (_reason) => {
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
            } catch (saveError: any) {
              toast.error(saveError?.message || 'Failed to save script.');
              throw saveError;
            } finally {
              setIsSaving(false);
            }
          }}
        />

        <div className="mt-2 text-xs text-[var(--color-text-secondary)] flex justify-between">
          <span>{isDirty ? 'Unsaved changes' : 'All changes saved'}</span>
          <span>{lastSavedAt ? `Last saved: ${new Date(lastSavedAt).toLocaleString()}` : 'Not saved yet'}</span>
        </div>
      </Card>
    </div>
  );
};

export default ScriptEditor;
