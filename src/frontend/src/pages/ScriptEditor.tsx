import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui-enhanced';
import { scriptService } from '../services/api';

// Reusable style constants for theme-aware styling
const inputStyles = "w-full px-3 py-2 rounded-md bg-[var(--surface-base)] text-[var(--ink-primary)] border border-[var(--surface-overlay)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";
const buttonSecondaryStyles = "px-4 py-2 rounded-md bg-[var(--surface-overlay)] hover:bg-[var(--surface-base)] text-[var(--ink-primary)] border border-[var(--surface-overlay)]";

const getScriptLocalPath = (script: any): string => {
  const candidates = [
    script?.localPath,
    script?.local_path,
    script?.filePath,
    script?.file_path,
    script?.sourcePath,
    script?.source_path,
    script?.absolutePath,
    script?.absolute_path,
  ];

  return candidates.find((candidate) => typeof candidate === 'string' && candidate.trim())?.trim() || '';
};

const buildPowerShellFileName = (title: string, script: any, id?: string): string => {
  const baseName = (title || script?.title || script?.name || `script-${id || 'draft'}`)
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `script-${id || 'draft'}`;

  return baseName.toLowerCase().endsWith('.ps1') ? baseName : `${baseName}.ps1`;
};

const ScriptEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [script, setScript] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadScript = async () => {
      if (!id) return;

      setIsLoading(true);
      setError(null);

      try {
        const loadedScript = await scriptService.getScript(id);
        if (!isMounted) return;

        setScript(loadedScript);
        setTitle(loadedScript.title || loadedScript.name || '');
        setDescription(loadedScript.description || '');
        setContent(loadedScript.content || '');
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load script');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadScript();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  const handleSave = async () => {
    if (!id) return;

    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      const updatedScript = await scriptService.updateScript(id, {
        title,
        description,
        content,
      });
      setScript(updatedScript.script || updatedScript);
      setNotice('Script saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save script');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    navigate(`/scripts/${id}`);
  };

  const handleDownloadForVSCode = () => {
    const fileName = buildPowerShellFileName(title, script, id);
    const blob = new Blob([content], { type: 'text/x-powershell;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setNotice('Downloaded a .ps1 copy of the current editor buffer. Open the downloaded file with VS Code to continue locally.');
  };

  const handleOpenInVSCode = () => {
    const localPath = getScriptLocalPath(script);

    if (!localPath) {
      setNotice('This hosted script does not have a local file path saved, so the browser cannot open it directly in VS Code. Use "Download .ps1" to open a local copy.');
      return;
    }

    const normalizedPath = localPath.replace(/\\/g, '/');
    const vscodeUrl = `vscode://file/${encodeURI(normalizedPath)}`;
    window.location.href = vscodeUrl;
    setNotice('Opening VS Code. If nothing happens, confirm Visual Studio Code is installed and registered for vscode:// links.');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--accent)]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="text-red-500 text-center p-4 bg-[var(--surface-raised)] border border-[var(--surface-overlay)] rounded-lg">
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
          <h1 className="text-2xl font-bold text-[var(--ink-primary)]">Edit Script: {title || script?.title || script?.name}</h1>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleOpenInVSCode}
              className={buttonSecondaryStyles}
            >
              Open in VS Code
            </button>
            <button
              onClick={handleDownloadForVSCode}
              className={buttonSecondaryStyles}
            >
              Download .ps1
            </button>
            <button
              onClick={handleCancel}
              className={buttonSecondaryStyles}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 rounded-md bg-[var(--accent)] hover:bg-[var(--color-primary-dark)] text-white disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {notice && (
          <div className="mb-4 rounded-md border border-[var(--surface-overlay)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--ink-secondary)]">
            {notice}
          </div>
        )}

        <div className="mb-4">
          <label htmlFor="title" className="block mb-2 font-medium text-[var(--ink-secondary)]">
            Title
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={inputStyles}
          />
        </div>

        <div className="mb-4">
          <label htmlFor="description" className="block mb-2 font-medium text-[var(--ink-secondary)]">
            Description
          </label>
          <input
            type="text"
            id="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={inputStyles}
          />
        </div>

        <div>
          <label htmlFor="content" className="block mb-2 font-medium text-[var(--ink-secondary)]">
            Script Content
          </label>
          <textarea
            id="content"
            value={content}
            onChange={handleContentChange}
            rows={20}
            className={`${inputStyles} font-mono`}
          ></textarea>
        </div>
      </Card>
    </div>
  );
};

export default ScriptEditor;
