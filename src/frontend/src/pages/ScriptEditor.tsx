import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui-enhanced';

// Reusable style constants for theme-aware styling
const inputStyles = "w-full px-3 py-2 rounded-md bg-[var(--surface-base)] text-[var(--ink-primary)] border border-[var(--surface-overlay)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";
const buttonSecondaryStyles = "px-4 py-2 rounded-md bg-[var(--surface-overlay)] hover:bg-[var(--surface-base)] text-[var(--ink-primary)] border border-[var(--surface-overlay)]";

const ScriptEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [script, setScript] = useState<any>(null);
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, _setError] = useState<string | null>(null);

  useEffect(() => {
    // Placeholder for script loading logic
    // In a real implementation, this would fetch the script from the API
    setIsLoading(false);
    setScript({
      id,
      name: 'Example Script',
      description: 'This is a placeholder for the script editor.',
      content: '# Example PowerShell Script\n\nWrite-Host "Hello, World!"'
    });
    setContent('# Example PowerShell Script\n\nWrite-Host "Hello, World!"');
  }, [id]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  const handleSave = () => {
    // Placeholder for save logic
    console.log('Saving script:', { id, content });
    // In a real implementation, this would send the updated content to the API
  };

  const handleCancel = () => {
    navigate(`/scripts/${id}`);
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
          <h1 className="text-2xl font-bold text-[var(--ink-primary)]">Edit Script: {script?.name}</h1>
          <div className="space-x-2">
            <button
              onClick={handleCancel}
              className={buttonSecondaryStyles}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-md bg-[var(--accent)] hover:bg-[var(--color-primary-dark)] text-white"
            >
              Save
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="description" className="block mb-2 font-medium text-[var(--ink-secondary)]">
            Description
          </label>
          <input
            type="text"
            id="description"
            value={script?.description || ''}
            readOnly
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
