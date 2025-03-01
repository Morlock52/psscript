import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from 'react-query';
import { scriptService } from '../services/api';
import ScriptDownloadButton from '../components/ScriptDownloadButton';
import FullScreenEditor from '../components/FullScreenEditor';

const ScriptDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  
  const { data: script, isLoading, error, refetch } = useQuery(
    ['script', id],
    () => scriptService.getScript(id || ''),
    {
      enabled: !!id,
      refetchOnWindowFocus: false,
    }
  );
  
  const { data: analysis } = useQuery(
    ['scriptAnalysis', id],
    () => scriptService.getScriptAnalysis(id || ''),
    {
      enabled: !!id,
      refetchOnWindowFocus: false,
    }
  );
  
  const { data: similarScripts } = useQuery(
    ['similarScripts', id],
    () => scriptService.getSimilarScripts(id || ''),
    {
      enabled: !!id,
      refetchOnWindowFocus: false,
    }
  );
  
  const executeMutation = useMutation(
    (params: Record<string, string>) => scriptService.executeScript(id || '', params),
    {
      onSuccess: (data) => {
        console.log('Script executed successfully:', data);
        // Handle successful execution
      },
      onError: (error) => {
        console.error('Error executing script:', error);
        // Handle execution error
      }
    }
  );
  
  const updateScriptMutation = useMutation(
    (content: string) => scriptService.updateScript(id || '', { content }),
    {
      onSuccess: () => {
        // Refetch the script to get the updated version
        refetch();
      },
      onError: (error) => {
        console.error('Error updating script:', error);
        // Handle error (could show a toast notification here)
      }
    }
  );
  
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
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (error || !script) {
    return (
      <div className="bg-gray-700 rounded-lg p-8 shadow text-center">
        <h2 className="text-2xl font-bold text-white mb-4">Script Not Found</h2>
        <p className="text-gray-300 mb-6">
          The script you are looking for does not exist or you don't have permission to view it.
        </p>
        <button
          onClick={() => navigate('/scripts')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Back to Scripts
        </button>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto pb-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{script.title}</h1>
        <div className="flex space-x-2">
          <ScriptDownloadButton 
            scriptContent={script.content} 
            scriptTitle={script.title}
            showOptions={true}
            variant="primary"
          />
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            onClick={handleOpenEditor}
          >
            Edit
          </button>
          <button
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            onClick={() => navigate('/scripts')}
          >
            Back
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
          <div className="bg-gray-700 rounded-lg shadow overflow-hidden mb-6">
            <div className="p-4 bg-gray-800 border-b border-gray-600 flex justify-between items-center">
              <h2 className="text-lg font-medium">Script Content</h2>
              <div className="text-xs text-gray-400">
                Version {script.version} | Updated {new Date(script.updatedAt).toLocaleDateString()}
              </div>
            </div>
            <div className="p-0">
              <pre className="p-4 text-sm font-mono text-gray-300 overflow-x-auto max-h-96">
                {script.content}
              </pre>
            </div>
          </div>
          
          {/* Parameters Section */}
          {analysis?.parameters && Object.keys(analysis.parameters).length > 0 && (
            <div className="bg-gray-700 rounded-lg shadow mb-6">
              <div className="p-4 bg-gray-800 border-b border-gray-600">
                <h2 className="text-lg font-medium">Execute Script</h2>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(analysis.parameters).map(([name, info]: [string, any]) => (
                    <div key={name} className="space-y-2">
                      <label className="block text-sm font-medium text-gray-300">
                        {name}
                        {info.mandatory && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <input
                        type="text"
                        className="w-full bg-gray-800 border border-gray-600 rounded-md text-white px-3 py-2 text-sm"
                        placeholder={info.type || 'String'}
                        value={parameters[name] || ''}
                        onChange={(e) => handleParameterChange(name, e.target.value)}
                      />
                      {info.description && (
                        <p className="text-xs text-gray-400">{info.description}</p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    onClick={handleExecute}
                    disabled={executeMutation.isLoading}
                  >
                    {executeMutation.isLoading ? 'Executing...' : 'Execute Script'}
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Execution Result */}
          {executeMutation.data && (
            <div className="bg-gray-700 rounded-lg shadow mb-6">
              <div className="p-4 bg-gray-800 border-b border-gray-600">
                <h2 className="text-lg font-medium">Execution Result</h2>
              </div>
              <div className="p-0">
                <pre className="p-4 text-sm font-mono text-gray-300 overflow-x-auto max-h-96">
                  {JSON.stringify(executeMutation.data, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
        
        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Script Info */}
          <div className="bg-gray-700 rounded-lg shadow">
            <div className="p-4 bg-gray-800 border-b border-gray-600">
              <h2 className="text-lg font-medium">Script Information</h2>
            </div>
            <div className="p-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm text-gray-400">Category</h3>
                  <p className="text-white">{script.category?.name || 'Uncategorized'}</p>
                </div>
                <div>
                  <h3 className="text-sm text-gray-400">Author</h3>
                  <p className="text-white">{script.user?.username || 'Unknown'}</p>
                </div>
                <div>
                  <h3 className="text-sm text-gray-400">Created</h3>
                  <p className="text-white">{new Date(script.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <h3 className="text-sm text-gray-400">Execution Count</h3>
                  <p className="text-white">{script.executionCount || 0}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* AI Analysis */}
          {analysis && (
            <div className="bg-gray-700 rounded-lg shadow">
              <div className="p-4 bg-gray-800 border-b border-gray-600">
                <h2 className="text-lg font-medium">AI Analysis</h2>
              </div>
              <div className="p-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm text-gray-400">Purpose</h3>
                    <p className="text-white">{analysis.purpose}</p>
                  </div>
                  <div>
                    <h3 className="text-sm text-gray-400">Quality Score</h3>
                    <div className="flex items-center">
                      <div className="w-full bg-gray-800 rounded-full h-2.5 mr-2">
                        <div 
                          className="bg-blue-600 h-2.5 rounded-full" 
                          style={{ width: `${analysis.code_quality_score * 10}%` }}
                        ></div>
                      </div>
                      <span>{analysis.code_quality_score}/10</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm text-gray-400">Security Score</h3>
                    <div className="flex items-center">
                      <div className="w-full bg-gray-800 rounded-full h-2.5 mr-2">
                        <div 
                          className={`h-2.5 rounded-full ${
                            analysis.security_score > 7 
                              ? 'bg-green-500' 
                              : analysis.security_score > 4 
                              ? 'bg-yellow-500' 
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${analysis.security_score * 10}%` }}
                        ></div>
                      </div>
                      <span>{analysis.security_score}/10</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm text-gray-400">Risk Assessment</h3>
                    <div className="flex items-center">
                      <div className="w-full bg-gray-800 rounded-full h-2.5 mr-2">
                        <div 
                          className={`h-2.5 rounded-full ${
                            analysis.risk_score < 3 
                              ? 'bg-green-500' 
                              : analysis.risk_score < 7 
                              ? 'bg-yellow-500' 
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${analysis.risk_score * 10}%` }}
                        ></div>
                      </div>
                      <span>{analysis.risk_score}/10</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Similar Scripts */}
          {similarScripts && similarScripts.similar_scripts?.length > 0 && (
            <div className="bg-gray-700 rounded-lg shadow">
              <div className="p-4 bg-gray-800 border-b border-gray-600">
                <h2 className="text-lg font-medium">Similar Scripts</h2>
              </div>
              <div className="p-4">
                <ul className="space-y-2">
                  {similarScripts.similar_scripts.map((similar: any) => (
                    <li key={similar.script_id}>
                      <a 
                        href={`/scripts/${similar.script_id}`}
                        className="text-blue-400 hover:text-blue-300 flex items-center"
                      >
                        <span className="flex-1">{similar.title}</span>
                        <span className="text-xs text-gray-400">
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