import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { scriptService, categoryService } from '../services/api';

interface Script {
  id: string;
  title: string;
  description: string;
  author: string;
  version: string;
  dateCreated: string;
  dateModified: string;
  tags: string[];
  isPublic: boolean;
  category: string;
  executionCount: number;
  averageRating: number;
}

interface Category {
  id: number;
  name: string;
}

const ScriptManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedScripts, setSelectedScripts] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [isPublicFilter, setIsPublicFilter] = useState<boolean | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showBulkActions, setShowBulkActions] = useState(false);
  
  // Fetch scripts with filters
  const { data: scriptsData, isLoading: isScriptsLoading } = useQuery(
    ['scripts', selectedCategory, isPublicFilter, selectedTags, searchQuery],
    () => scriptService.getScripts({
      category: selectedCategory,
      isPublic: isPublicFilter,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      search: searchQuery || undefined
    }),
    {
      keepPreviousData: true,
      staleTime: 10000
    }
  );

  // Fetch categories
  const { data: categoriesData } = useQuery(
    ['categories'],
    () => categoryService.getCategories(),
    {
      staleTime: 600000
    }
  );

  // Mock data for tags
  const availableTags = [
    'automation', 'security', 'network', 'utility', 'admin',
    'monitoring', 'backup', 'installation', 'reporting', 'cloud'
  ];

  // Bulk mutate scripts (public/private status)
  const bulkUpdateMutation = useMutation(
    (data: { ids: string[], isPublic: boolean }) => 
      scriptService.bulkUpdateScripts(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('scripts');
        setSelectedScripts([]);
        setShowBulkActions(false);
      }
    }
  );

  // Delete script mutation
  const deleteScriptMutation = useMutation(
    (id: string) => scriptService.deleteScript(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('scripts');
      }
    }
  );

  // Bulk delete scripts
  const bulkDeleteMutation = useMutation(
    (ids: string[]) => scriptService.bulkDeleteScripts(ids),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('scripts');
        setSelectedScripts([]);
        setShowBulkActions(false);
      }
    }
  );

  // Handle selecting all scripts
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked && scriptsData?.scripts) {
      setSelectedScripts(scriptsData.scripts.map(script => script.id));
      setShowBulkActions(true);
    } else {
      setSelectedScripts([]);
      setShowBulkActions(false);
    }
  };

  // Handle selecting individual script
  const handleSelectScript = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedScripts(prev => [...prev, id]);
    } else {
      setSelectedScripts(prev => prev.filter(scriptId => scriptId !== id));
    }
  };

  // Effect to show/hide bulk actions based on selection
  useEffect(() => {
    setShowBulkActions(selectedScripts.length > 0);
  }, [selectedScripts]);

  // Toggle tag filter
  const handleTagToggle = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  // Handle bulk make public/private
  const handleBulkVisibility = (isPublic: boolean) => {
    bulkUpdateMutation.mutate({
      ids: selectedScripts,
      isPublic
    });
  };

  // Handle bulk delete
  const handleBulkDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${selectedScripts.length} scripts?`)) {
      bulkDeleteMutation.mutate(selectedScripts);
    }
  };

  const scripts: Script[] = scriptsData?.scripts || [];
  const categories: Category[] = categoriesData?.categories || [];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Manage Scripts</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Batch manage your PowerShell scripts, apply bulk actions and organize your collection.
        </p>
      </div>

      {/* Filters and Search */}
      <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-2">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <select 
                className="w-full border border-gray-300 dark:border-gray-700 rounded-md py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                value={selectedCategory?.toString() || ""}
                onChange={(e) => setSelectedCategory(e.target.value ? parseInt(e.target.value) : null)}
              >
                <option value="">All Categories</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id.toString()}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Visibility Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Visibility
              </label>
              <select 
                className="w-full border border-gray-300 dark:border-gray-700 rounded-md py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                value={isPublicFilter === null ? "" : isPublicFilter ? "public" : "private"}
                onChange={(e) => {
                  if (e.target.value === "") setIsPublicFilter(null);
                  else setIsPublicFilter(e.target.value === "public");
                }}
              >
                <option value="">All</option>
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Search
              </label>
              <div className="relative">
                <input
                  type="text"
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-md py-2 pl-10 pr-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Search scripts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="absolute left-3 top-2.5 text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tags */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {availableTags.map(tag => (
              <button
                key={tag}
                onClick={() => handleTagToggle(tag)}
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  selectedTags.includes(tag)
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {showBulkActions && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-md p-4 z-10 border-t border-gray-200 dark:border-gray-700">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {selectedScripts.length} scripts selected
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => handleBulkVisibility(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium"
              >
                Make Public
              </button>
              <button
                onClick={() => handleBulkVisibility(false)}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md text-sm font-medium"
              >
                Make Private
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium"
              >
                Delete Selected
              </button>
              <button
                onClick={() => {
                  setSelectedScripts([]);
                  setShowBulkActions(false);
                }}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scripts Table */}
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
        {isScriptsLoading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-3 text-gray-600 dark:text-gray-400">Loading scripts...</p>
          </div>
        ) : scripts.length === 0 ? (
          <div className="p-6 text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
            </svg>
            <p className="mt-3 text-gray-600 dark:text-gray-400">No scripts match your filters.</p>
            <button
              onClick={() => {
                setSelectedCategory(null);
                setIsPublicFilter(null);
                setSelectedTags([]);
                setSearchQuery("");
              }}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        onChange={handleSelectAll}
                        checked={selectedScripts.length > 0 && selectedScripts.length === scripts.length}
                      />
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Script
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Category
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Version
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Visibility
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Usage
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {scripts.map((script) => (
                  <tr key={script.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        checked={selectedScripts.includes(script.id)}
                        onChange={(e) => handleSelectScript(script.id, e.target.checked)}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            <Link to={`/scripts/${script.id}`} className="hover:text-blue-600 dark:hover:text-blue-400">
                              {script.title}
                            </Link>
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                            {script.description}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 dark:text-white">
                        {script.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 dark:text-white">
                        {script.version}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        script.isPublic 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}>
                        {script.isPublic ? 'Public' : 'Private'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {script.executionCount} executions
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex space-x-2">
                        <Link 
                          to={`/scripts/${script.id}`}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          View
                        </Link>
                        <Link 
                          to={`/scripts/${script.id}/edit`}
                          className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete "${script.title}"?`)) {
                              deleteScriptMutation.mutate(script.id);
                            }
                          }}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScriptManagement;