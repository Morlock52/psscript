import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from 'react-query';
import { scriptService, categoryService, tagService } from '../services/api';

const ScriptUpload: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [analyzeWithAI, setAnalyzeWithAI] = useState(true);
  const [customTag, setCustomTag] = useState('');
  const [fileError, setFileError] = useState('');
  const [showAnalysisPreview, setShowAnalysisPreview] = useState(false);
  const [analysisPreview, setAnalysisPreview] = useState<any>(null);
  
  // Fetch categories
  const { data: categories } = useQuery('categories', () => categoryService.getCategories());
  
  // Fetch tags
  const { data: existingTags } = useQuery('tags', () => tagService.getTags());
  
  // Script upload mutation
  const uploadMutation = useMutation(
    (scriptData: any) => scriptService.uploadScript(scriptData),
    {
      onSuccess: (data) => {
        console.log("Script uploaded successfully:", data);
        // Add a small delay to ensure the script is properly added to the mock data
        setTimeout(() => {
          navigate(`/scripts/${data.id}`);
        }, 300);
      },
      onError: (error) => {
        console.error("Error uploading script:", error);
        alert("Failed to upload script. Please try again.");
      }
    }
  );
  
  // AI analysis preview mutation
  const analysisPreviewMutation = useMutation(
    (scriptContent: string) => {
      // Use the existing analyze endpoint instead of a preview-specific one
      return scriptService.analyzeScript(scriptContent);
    }
  );
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file extension
    if (!file.name.toLowerCase().endsWith('.ps1')) {
      setFileError('Only PowerShell (.ps1) files are allowed');
      return;
    }
    
    setFileError('');
    
    // Read file content
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setContent(content);
      
      // Try to extract title from filename if not set
      if (!title) {
        const filename = file.name.replace('.ps1', '');
        setTitle(filename);
      }
      
      // Reset analysis preview when file changes
      setShowAnalysisPreview(false);
      setAnalysisPreview(null);
    };
    reader.readAsText(file);
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    const file = e.dataTransfer.files[0];
    if (!file) return;
    
    // Update the file input
    if (fileInputRef.current) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInputRef.current.files = dataTransfer.files;
      
      // Trigger change event
      const event = new Event('change', { bubbles: true });
      fileInputRef.current.dispatchEvent(event);
    }
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };
  
  const handleTagAdd = () => {
    if (customTag.trim() && !tags.includes(customTag.trim())) {
      setTags([...tags, customTag.trim()]);
      setCustomTag('');
    }
  };
  
  const handleTagToggle = (tag: string) => {
    if (tags.includes(tag)) {
      setTags(tags.filter(t => t !== tag));
    } else {
      setTags([...tags, tag]);
    }
  };
  
  const handlePreviewAnalysis = () => {
    if (!content) return;
    
    analysisPreviewMutation.mutate(content, {
      onSuccess: (data) => {
        setAnalysisPreview(data);
        setShowAnalysisPreview(true);
      }
    });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !content) {
      return;
    }
    
    const scriptData = {
      title,
      description,
      content,
      category_id: category || undefined,
      tags,
      is_public: isPublic,
      analyze_with_ai: analyzeWithAI
    };
    
    uploadMutation.mutate(scriptData);
  };
  
  return (
    <div className="container mx-auto pb-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Upload Script</h1>
      </div>
      
      <div className="bg-gray-700 rounded-lg shadow p-6">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Script Upload and Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* File Upload */}
              <div 
                className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept=".ps1"
                  onChange={handleFileChange}
                />
                
                <svg 
                  className="mx-auto h-12 w-12 text-gray-400" 
                  stroke="currentColor" 
                  fill="none" 
                  viewBox="0 0 48 48" 
                  aria-hidden="true"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth="2" 
                    d="M8 14v20c0 4.418 7.163 8 16 8 1.381 0 2.721-.087 4-.252M8 14c0 4.418 7.163 8 16 8s16-3.582 16-8M8 14c0-4.418 7.163-8 16-8s16 3.582 16 8m0 0v14m0-4c0 4.418-7.163 8-16 8S8 28.418 8 24m32 10v6m0 0v6m0-6h6m-6 0h-6" 
                  />
                </svg>
                
                <p className="mt-2 text-sm text-gray-400">
                  Drag and drop your PowerShell script here, or click to browse
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Only .ps1 files are accepted
                </p>
                
                {fileError && (
                  <p className="mt-2 text-sm text-red-500">{fileError}</p>
                )}
                
                {content && (
                  <p className="mt-2 text-sm text-green-500">
                    ✓ Script loaded successfully ({content.length} bytes)
                  </p>
                )}
              </div>
              
              {/* Script Content Preview */}
              {content && (
                <div className="border border-gray-600 rounded-lg overflow-hidden">
                  <div className="bg-gray-800 px-4 py-2 border-b border-gray-600 flex justify-between items-center">
                    <h2 className="text-sm font-medium">Script Content Preview</h2>
                    <span className="text-xs text-gray-400">
                      {content.split('\n').length} lines
                    </span>
                  </div>
                  <pre className="p-4 bg-gray-900 text-sm font-mono text-gray-300 overflow-x-auto max-h-60">
                    {content}
                  </pre>
                </div>
              )}
              
              {/* AI Analysis Preview */}
              {showAnalysisPreview && analysisPreview && (
                <div className="border border-gray-600 rounded-lg overflow-hidden">
                  <div className="bg-gray-800 px-4 py-2 border-b border-gray-600">
                    <h2 className="text-sm font-medium">AI Analysis Preview</h2>
                  </div>
                  <div className="p-4 bg-gray-900">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-xs uppercase text-gray-400 mb-1">Purpose</h3>
                        <p className="text-sm text-white">{analysisPreview.purpose}</p>
                      </div>
                      <div>
                        <h3 className="text-xs uppercase text-gray-400 mb-1">Category</h3>
                        <p className="text-sm text-white">{analysisPreview.category}</p>
                      </div>
                      <div>
                        <h3 className="text-xs uppercase text-gray-400 mb-1">Security Score</h3>
                        <div className="flex items-center">
                          <div className="w-full bg-gray-800 rounded-full h-2 mr-2">
                            <div 
                              className={`h-2 rounded-full ${
                                analysisPreview.security_score > 7 
                                  ? 'bg-green-500' 
                                  : analysisPreview.security_score > 4 
                                  ? 'bg-yellow-500' 
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${analysisPreview.security_score * 10}%` }}
                            ></div>
                          </div>
                          <span className="text-sm">{analysisPreview.security_score}/10</span>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xs uppercase text-gray-400 mb-1">Code Quality</h3>
                        <div className="flex items-center">
                          <div className="w-full bg-gray-800 rounded-full h-2 mr-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full" 
                              style={{ width: `${analysisPreview.code_quality_score * 10}%` }}
                            ></div>
                          </div>
                          <span className="text-sm">{analysisPreview.code_quality_score}/10</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Script Metadata */}
            <div className="space-y-6">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-md text-white px-3 py-2"
                  placeholder="Script title"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-md text-white px-3 py-2"
                  placeholder="What does this script do?"
                  rows={3}
                />
              </div>
              
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-300 mb-1">
                  Category
                </label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-md text-white px-3 py-2"
                >
                  <option value="">-- Select Category --</option>
                  {categories?.categories?.map((cat: any) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {existingTags?.tags?.slice(0, 10).map((tag: any) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleTagToggle(tag.name)}
                      className={`text-xs px-2 py-1 rounded-full ${
                        tags.includes(tag.name)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
                <div className="flex">
                  <input
                    type="text"
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-600 rounded-l-md text-white px-3 py-2 text-sm"
                    placeholder="Add custom tag"
                  />
                  <button
                    type="button"
                    onClick={handleTagAdd}
                    className="bg-blue-600 text-white px-3 py-2 rounded-r-md hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
              </div>
              
              <div className="flex items-center">
                <input
                  id="is-public"
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-600 rounded"
                />
                <label htmlFor="is-public" className="ml-2 block text-sm text-gray-300">
                  Make script public
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  id="analyze-ai"
                  type="checkbox"
                  checked={analyzeWithAI}
                  onChange={(e) => setAnalyzeWithAI(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-600 rounded"
                />
                <label htmlFor="analyze-ai" className="ml-2 block text-sm text-gray-300">
                  Analyze with AI
                </label>
              </div>
              
              {content && analyzeWithAI && !showAnalysisPreview && (
                <button
                  type="button"
                  onClick={handlePreviewAnalysis}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-md"
                  disabled={analysisPreviewMutation.isLoading}
                >
                  {analysisPreviewMutation.isLoading ? 'Analyzing...' : 'Preview Analysis'}
                </button>
              )}
            </div>
          </div>
          
          <div className="mt-8 flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate('/scripts')}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              disabled={!title || !content || uploadMutation.isLoading}
            >
              {uploadMutation.isLoading ? 'Uploading...' : 'Upload Script'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ScriptUpload;