import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { scriptService } from '../services/api-simple';
import useChat, { Message } from '../hooks/useChat';
import ChatMessage from '../components/ChatMessage';

const SimpleChatWithAI = () => {
  // Get theme and auth from context
  const { toggleTheme, isDark } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Use our custom chat hook
  const {
    messages,
    input,
    isLoading,
    isSaving,
    searchQuery,
    searchResults,
    isSearching,
    showSearch,
    selectedFile,
    isUploading,
    sessionId: _sessionId,
    messagesEndRef,
    inputRef,
    fileInputRef,
    setInput,
    sendMessage,
    clearChat,
    uploadFile,
    setSelectedFile,
    extractPowerShellCode,
    generateScriptName,
    setShowSearch,
    setSearchQuery,
    searchChatHistory,
    loadChatHistory,
    setSessionId: _setSessionId
  } = useChat({
    autoSave: true,
    mockMode: false
  });

  // State for script creation modal
  const [showCreateScriptModal, setShowCreateScriptModal] = useState(false);
  const [scriptContent, setScriptContent] = useState('');
  const [scriptName, setScriptName] = useState('');
  const [scriptDescription, setScriptDescription] = useState('');

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    await sendMessage(input);
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // Handle file upload
  const handleFileUpload = async () => {
    if (!selectedFile) return;
    await uploadFile(selectedFile);
  };

  // Open the create script modal with content from a message
  const openCreateScriptModal = (message: Message) => {
    try {
      const code = extractPowerShellCode(message.content);
      if (code && code.trim()) {
        setScriptContent(code);
        setScriptName(generateScriptName(code));
        setScriptDescription(''); // Reset description
        setShowCreateScriptModal(true);
      } else {
        alert('No PowerShell code found in this message. Please make sure the AI has generated code blocks.');
      }
    } catch (error) {
      console.error('Error opening script modal:', error);
      alert('There was an error processing this code. Please try again.');
    }
  };

  // Create a new script
  const createScript = async () => {
    if (!scriptName || !scriptContent) {
      alert('Script name and content are required');
      return;
    }

    if (!isAuthenticated) {
      alert('You need to be logged in to save scripts');
      setShowCreateScriptModal(false);
      return;
    }

    try {
      const scriptData = {
        name: scriptName,
        content: scriptContent,
        description: scriptDescription || 'Created from chat',
        isPublic: false
      };

      const result = await scriptService.uploadScript(scriptData);

      // Close modal and add a message about the saved script
      setShowCreateScriptModal(false);
      sendMessage(`I've saved the script "${scriptName}" successfully.`);

      // Redirect to the script detail page if we have a valid ID
      if (result && result.id) {
        try {
          navigate(`/scripts/${result.id}`);
        } catch (navError) {
          console.error('Navigation error:', navError);
          // If navigation fails, just stay on the current page
        }
      }
    } catch (error) {
      console.error('Error creating script:', error);
      setShowCreateScriptModal(false);

      // Add error message to chat
      sendMessage(`Sorry, I couldn't save the script "${scriptName}". There was an error.`);
    }
  };

  // Handle search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !isAuthenticated) return;
    await searchChatHistory(searchQuery);
  };

  // Reusable styles
  const inputStyles = "bg-[var(--surface-base)]/45 border border-[var(--surface-overlay)] focus:ring-2 focus:ring-[var(--ring-focus)]/35 focus:border-[var(--ring-focus)] focus:outline-none";
  const buttonPrimaryStyles = "px-4 py-2 rounded border border-[var(--ink-muted)] bg-[var(--surface-overlay)] text-[var(--ink-primary)] hover:bg-[var(--surface-raised)] disabled:opacity-50 transition-colors";
  const buttonSecondaryStyles = "px-3 py-1 rounded text-sm border border-[var(--surface-overlay)] bg-[var(--surface-overlay)]/55 hover:bg-[var(--surface-overlay)] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] transition-colors";
  const headerButtonStyles = "px-3 py-1 rounded border border-[var(--surface-overlay)] bg-[var(--surface-overlay)]/45 hover:bg-[var(--surface-overlay)] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] flex items-center transition-colors";

  return (
    <div className="flex flex-col h-full bg-[var(--surface-base)] text-[var(--ink-primary)]">
      {/* Header */}
      <div className="p-4 flex justify-between items-center bg-[var(--surface-raised)]/90 text-[var(--ink-primary)] border-b border-[var(--surface-overlay)] shadow-[var(--shadow-near)]">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigate('/dashboard')}
            className={headerButtonStyles}
            aria-label="Back to Dashboard"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-sm font-medium">Dashboard</span>
          </button>
          <h1 className="text-xl font-bold">PSScript AI Assistant</h1>
        </div>
        <div className="flex gap-2 items-center">
          {isSaving && (
            <span className="text-xs opacity-70">Saving...</span>
          )}
          {isAuthenticated && (
            <>
              <button
                onClick={() => setShowSearch(prevState => !prevState)}
                className={headerButtonStyles}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {showSearch ? 'Close' : 'Search'}
              </button>
              <button
                onClick={() => navigate('/chat/history')}
                className={headerButtonStyles}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                History
              </button>
            </>
          )}
          <button
            onClick={toggleTheme}
            className={headerButtonStyles}
          >
            {isDark ? 'Light' : 'Dark'}
          </button>
          <button
            onClick={clearChat}
            className={headerButtonStyles}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Search panel */}
      {showSearch && (
        <div className="p-4 bg-[var(--surface-raised)] border-b border-[var(--surface-overlay)]">
          <form onSubmit={handleSearch} className="flex gap-2 mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your chat history..."
              className={`flex-1 p-2 rounded ${inputStyles}`}
              disabled={isSearching || !isAuthenticated}
            />
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim() || !isAuthenticated}
              className={buttonPrimaryStyles}
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>

          {!isAuthenticated && (
            <div className="text-center py-2 text-amber-500">
              Please log in to search your chat history
            </div>
          )}

          <div className={`max-h-60 overflow-y-auto rounded ${searchResults.length > 0 ? 'border border-[var(--surface-overlay)]' : ''}`}>
            {searchResults.map((result, idx) => (
              <div
                key={result.id || idx}
                className={`p-3 cursor-pointer hover:bg-[var(--surface-overlay)] border-b border-[var(--surface-overlay)] transition-colors ${idx === searchResults.length - 1 ? 'border-b-0' : ''}`}
                onClick={() => loadChatHistory(result.messages)}
              >
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-[var(--ink-primary)]">{result.date}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full border border-[var(--surface-overlay)] bg-[var(--surface-overlay)]/50 text-[var(--ink-tertiary)]">
                    Score: {result.score.toFixed(2)}
                  </span>
                </div>
                <div className="text-sm truncate text-[var(--ink-secondary)]">
                  {result.messages[0]?.content || 'No content'}
                </div>
              </div>
            ))}

            {searchResults.length === 0 && searchQuery.trim() !== '' && !isSearching && (
              <div className="p-4 text-center text-[var(--ink-tertiary)]">
                No results found
              </div>
            )}

            {isSearching && (
              <div className="p-4 text-center">
                <div className="inline-block">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-[var(--ink-tertiary)] rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-[var(--ink-tertiary)] rounded-full animate-bounce delay-150"></div>
                    <div className="w-2 h-2 bg-[var(--ink-tertiary)] rounded-full animate-bounce delay-300"></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto bg-[var(--surface-raised)]">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--ink-tertiary)]">
            <div className="text-center">
              <p>No messages yet</p>
              <p className="text-sm mt-2">Start a conversation by typing a message below</p>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <ChatMessage
              key={index}
              message={msg}
              onSaveScript={msg.role === 'assistant' ? () => openCreateScriptModal(msg) : undefined}
            />
          ))
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center mb-4">
            <div className="p-3 rounded-lg bg-[var(--surface-raised)]">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-[var(--ink-tertiary)] rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-[var(--ink-tertiary)] rounded-full animate-bounce delay-150"></div>
                <div className="w-2 h-2 bg-[var(--ink-tertiary)] rounded-full animate-bounce delay-300"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef}></div>
      </div>

      {/* Input form */}
      <div className="p-4 bg-[var(--surface-raised)] border-t border-[var(--surface-overlay)]">
        <div className="flex gap-2 mb-2">
          <label htmlFor="file-upload" className="sr-only">
            Upload PowerShell Script
          </label>
          <input
            id="file-upload"
            ref={fileInputRef}
            type="file"
            accept=".ps1,.psm1,.psd1"
            onChange={handleFileSelect}
            className="hidden"
            multiple={false}
            aria-label="Upload PowerShell Script"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={buttonSecondaryStyles}
            disabled={isLoading || isUploading}
          >
            Upload Script
          </button>
          {selectedFile && (
            <div className="flex-1 flex items-center">
              <span className="text-sm truncate text-[var(--ink-primary)]">{selectedFile.name}</span>
              <button
                type="button"
                onClick={handleFileUpload}
                className="ml-2 px-3 py-1 rounded text-sm border border-[var(--ink-muted)] bg-[var(--surface-overlay)] text-[var(--ink-primary)] hover:bg-[var(--surface-raised)] transition-colors"
                disabled={isLoading || isUploading}
              >
                {isUploading ? 'Uploading...' : 'Analyze'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className={`ml-2 ${buttonSecondaryStyles}`}
                disabled={isLoading || isUploading}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your PowerShell question..."
            className={`flex-1 p-2 rounded ${inputStyles}`}
            disabled={isLoading || isUploading}
          />
          <button
            type="submit"
            disabled={isLoading || isUploading || !input.trim()}
            className={buttonPrimaryStyles}
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </form>
        {isAuthenticated ? (
          <p className="text-xs text-center mt-2 text-[var(--ink-tertiary)]">
            {user?.username} • {isSaving ? 'Saving chat...' : 'Chat saved'}
          </p>
        ) : (
          <p className="text-xs text-center mt-2 text-[var(--ink-tertiary)]">
            Sign in to save your chat history
          </p>
        )}
      </div>

      {/* Create Script Modal */}
      {showCreateScriptModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto bg-[var(--surface-raised)] text-[var(--ink-primary)] border border-[var(--surface-overlay)]">
            <div className="p-4 border-b border-[var(--surface-overlay)]">
              <h2 className="text-xl font-bold">Create New Script</h2>
              <p className="text-sm text-[var(--ink-tertiary)] mt-1">Save this code as a new PowerShell script</p>
            </div>

            <div className="p-4">
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 text-[var(--ink-secondary)]">Script Name</label>
                <input
                  type="text"
                  value={scriptName}
                  onChange={(e) => setScriptName(e.target.value)}
                  placeholder="script-name.ps1"
                  className={`w-full p-2 rounded ${inputStyles}`}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 text-[var(--ink-secondary)]">Description</label>
                <input
                  type="text"
                  value={scriptDescription}
                  onChange={(e) => setScriptDescription(e.target.value)}
                  placeholder="Brief description of what the script does"
                  className={`w-full p-2 rounded ${inputStyles}`}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 text-[var(--ink-secondary)]">Script Content</label>
                <div className={`w-full rounded border border-[var(--surface-overlay)] bg-[var(--surface-overlay)] p-2 h-60 overflow-y-auto`}>
                  <pre className="whitespace-pre-wrap font-mono text-sm text-[var(--ink-primary)]">
                    {scriptContent}
                  </pre>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[var(--surface-overlay)] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateScriptModal(false)}
                className={buttonSecondaryStyles}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createScript}
                className={buttonPrimaryStyles}
              >
                Create Script
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleChatWithAI;
