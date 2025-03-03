import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { chatService, scriptService } from '../services/api';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Define message type
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

// Define search result type
interface SearchResult {
  id?: string;
  messages: Message[];
  score: number;
  date: string;
  timestamp?: string | Date;
}

const SimpleChatWithAI = () => {
  // Get theme and auth from context
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  // State for messages, input, loading, and search
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: 'Welcome to PowerShell AI Assistant! I can help you with PowerShell scripting tasks. What would you like help with today?' 
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showCreateScriptModal, setShowCreateScriptModal] = useState(false);
  const [scriptContent, setScriptContent] = useState('');
  const [scriptName, setScriptName] = useState('');
  const [scriptDescription, setScriptDescription] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save to localStorage and server if authenticated
  useEffect(() => {
    try {
      // Always save to localStorage
      localStorage.setItem('psscript_chat_history', JSON.stringify(messages));
    } catch (storageError) {
      console.error('Failed to save chat history to localStorage:', storageError);
      // If localStorage is full or unavailable, try to clear it and retry
      try {
        localStorage.removeItem('psscript_chat_history');
        localStorage.setItem('psscript_chat_history', JSON.stringify(messages.slice(-10))); // Save only last 10 messages
      } catch (retryError) {
        console.error('Failed to save even after clearing:', retryError);
      }
    }
    
    // If authenticated and chat has messages, also save to server
    const saveToServer = async () => {
      if (isAuthenticated && messages.length > 1) {
        setIsSaving(true);
        try {
          // Add a timeout to prevent hanging
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Save operation timed out')), 5000)
          );
          
          // Race the save operation against the timeout
          await Promise.race([
            chatService.saveChatHistory(messages),
            timeoutPromise
          ]);
        } catch (error) {
          console.error('Failed to save chat history to server:', error);
          // Don't show error to user, silently fail
        } finally {
          setIsSaving(false);
        }
      }
    };
    
    // Use a debounce to prevent too many server calls
    const timeoutId = setTimeout(() => {
      saveToServer();
    }, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [messages, isAuthenticated]); // chatService doesn't need to be in deps as it's stable

  // Simplified loading from localStorage only for now
  useEffect(() => {
    console.log('Loading chat history from localStorage');
    try {
      const saved = localStorage.getItem('psscript_chat_history');
      if (saved) {
        try {
          const parsedHistory = JSON.parse(saved);
          if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
            console.log('Found saved chat history with', parsedHistory.length, 'messages');
            setMessages(parsedHistory);
          } else {
            console.log('No usable history found in localStorage');
          }
        } catch (e) {
          console.error('Failed to parse saved chat:', e);
          // Clean up corrupted history
          localStorage.removeItem('psscript_chat_history');
        }
      } else {
        console.log('No saved chat history found');
      }
    } catch (e) {
      console.error('Error accessing localStorage:', e);
    }
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when search is closed
  useEffect(() => {
    if (!showSearch) {
      inputRef.current?.focus();
    }
  }, [showSearch]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Log for debugging
    console.log('Form submitted', { inputLength: input.length, input: input.substring(0, 20) + '...' });
    
    if (!input.trim()) {
      console.log('Empty input, ignoring submission');
      return;
    }

    try {
      // Create a copy of the user message
      const userMessage = { role: 'user' as const, content: input, timestamp: new Date() };
      
      // Update state in a single batch
      setInput('');
      setIsLoading(true);
      setMessages(prev => [...prev, userMessage]);

      console.log('Updated messages with user input, now sending to AI');
      
      // Simple fallback message in case API fails
      const fallbackResponse = { response: "I'm having trouble connecting to my backend. Please try again in a moment." };

      try {
        // Get the updated messages to send to the API
        const messagesToSend = [...messages, userMessage];
        
        // Call AI service with timeout
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timed out')), 30000)
        );
        
        // Race the API call against the timeout
        const response = await Promise.race([
          chatService.sendMessage(messagesToSend),
          timeoutPromise
        ]) as { response: string };
        
        console.log('Got AI response', { responseLength: response.response.length });
        
        // Add AI response
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: response.response, timestamp: new Date() }
        ]);
      } catch (apiError) {
        console.error('Error calling AI service:', apiError);
        // Add error message to chat
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: fallbackResponse.response, timestamp: new Date() }
        ]);
      }
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      alert('Something went wrong. Please try refreshing the page.');
    } finally {
      setIsLoading(false);
    }
  };

  // Clear chat history
  const clearChat = () => {
    if (window.confirm('Clear chat history?')) {
      setMessages([
        { role: 'assistant', content: '# Chat history cleared.\n\nHow can I help you with PowerShell today?' }
      ]);
      
      // Also clear from server if authenticated
      if (isAuthenticated) {
        chatService.clearChatHistory().catch(error => {
          console.error('Failed to clear chat history from server:', error);
        });
      }
    }
  };
  
  // Handle file selection
  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };
  
  // Handle file upload and analysis
  const handleFileUpload = async () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    
    try {
      // Read file content
      let fileContent = '';
      
      try {
        fileContent = await readFileAsText(selectedFile);
        console.log('File read successfully:', selectedFile.name, 'size:', fileContent.length);
        
        // Validate content is not binary or corrupted
        if (!fileContent || fileContent.includes('\u0000') || /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(fileContent)) {
          throw new Error('File appears to be binary or contains invalid characters');
        }
        
        // Limit size of very large files
        if (fileContent.length > 100000) {
          fileContent = fileContent.substring(0, 100000) + '\n\n... [Content truncated due to size] ...';
        }
      } catch (readError) {
        console.error('Error reading file:', readError);
        throw new Error('Could not read file contents');
      }
      
      // Create user message
      const userMessageContent = `I'm uploading a PowerShell script named "${selectedFile.name}" for analysis. Here's the content:\n\n\`\`\`powershell\n${fileContent}\n\`\`\`\n\nCan you analyze this script and provide feedback?`;
      const userMessage = { role: 'user' as const, content: userMessageContent, timestamp: new Date() };
      
      // Set loading state and add user message atomically
      setIsLoading(true);
      setMessages(prev => [...prev, userMessage]);
      
      try {
        // Get updated messages to send
        const messagesToSend = [...messages, userMessage];
        console.log('Sending message with file content to AI service');
        
        // Send to AI with timeout
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timed out')), 45000) // Longer timeout for file analysis
        );
        
        const response = await Promise.race([
          chatService.sendMessage(messagesToSend),
          timeoutPromise
        ]) as { response: string };
        
        console.log('Received AI response for file analysis');
        
        // Add AI response
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: response.response, timestamp: new Date() }
        ]);
      } catch (aiError) {
        console.error('Error getting AI response:', aiError);
        // Add error message
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: 'Sorry, I encountered an error analyzing your script. The script may be too large or complex. Please try again with a smaller script or paste a specific part you need help with.', timestamp: new Date() }
        ]);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      // Add error messages to chat
      setMessages(prev => [
        ...prev,
        { role: 'user', content: `I was trying to upload a file named "${selectedFile.name}" but encountered an error.`, timestamp: new Date() },
        { role: 'assistant', content: 'Sorry, I encountered an error processing your file. Please try again or paste the script directly.', timestamp: new Date() }
      ]);
    } finally {
      setIsUploading(false);
      setIsLoading(false);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  // Read file as text
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error('Failed to read file content'));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  };
  
  // Extract PowerShell code from message
  const extractPowerShellCode = (content: string): string => {
    // Look for PowerShell code blocks
    const regex = /```powershell\n([\s\S]*?)```/g;
    const matches = [...content.matchAll(regex)];
    
    if (matches.length > 0) {
      // Return the first match
      return matches[0][1];
    }
    
    // Try generic code blocks
    const genericRegex = /```([\s\S]*?)```/g;
    const genericMatches = [...content.matchAll(genericRegex)];
    
    if (genericMatches.length > 0) {
      return genericMatches[0][1];
    }
    
    return '';
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
        console.log('No code found in message:', message.content.substring(0, 100) + '...');
        alert('No PowerShell code found in this message. Please make sure the AI has generated code blocks.');
      }
    } catch (error) {
      console.error('Error opening script modal:', error);
      alert('There was an error processing this code. Please try again.');
    }
  };
  
  // Generate a script name based on content
  const generateScriptName = (content: string): string => {
    // Look for function name or comment header
    const functionMatch = content.match(/function\s+([A-Za-z0-9\-_]+)/);
    if (functionMatch && functionMatch[1]) {
      return `${functionMatch[1]}.ps1`;
    }
    
    // Look for first comment line that might describe the script
    const commentMatch = content.match(/^#\s*(.+)$/m);
    if (commentMatch && commentMatch[1]) {
      const commentWords = commentMatch[1].split(' ').slice(0, 3).join('-');
      return `${commentWords.toLowerCase().replace(/[^a-z0-9\-]/g, '')}.ps1`;
    }
    
    // Default name
    return 'new-script.ps1';
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
      setMessages([
        ...messages,
        { 
          role: 'assistant', 
          content: `Script "${scriptName}" has been saved successfully. You can find it in your scripts library.`, 
          timestamp: new Date() 
        }
      ]);
      
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
      
      // Add error message to chat instead of alert
      setMessages([
        ...messages,
        { 
          role: 'assistant', 
          content: `Sorry, I couldn't save the script "${scriptName}". There was an error. Please try again later or copy the code manually.`, 
          timestamp: new Date() 
        }
      ]);
    }
  };

  // Handle search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !isAuthenticated) return;
    
    setIsSearching(true);
    try {
      const results = await chatService.searchChatHistory(searchQuery);
      console.log('Search results received:', results);
      
      // Ensure the results are in the right format
      const formattedResults = Array.isArray(results) ? results.map(result => {
        return {
          id: result.id || String(Math.random()),
          messages: Array.isArray(result.messages) ? result.messages : [],
          score: typeof result.score === 'number' ? result.score : 1.0,
          date: result.date || new Date(result.timestamp || Date.now()).toLocaleDateString()
        };
      }) : [];
      
      console.log('Formatted search results:', formattedResults);
      setSearchResults(formattedResults);
    } catch (error) {
      console.error('Error searching chat history:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Load a chat history from search results
  const loadChatHistory = (messages: Message[]) => {
    console.log('Loading chat history from search results:', messages.length, 'messages');
    if (Array.isArray(messages) && messages.length > 0) {
      setMessages(messages);
      setShowSearch(false);
    } else {
      console.error('Cannot load chat history: no messages found or invalid format');
    }
  };

  // Custom renderer for code blocks in markdown
  const CodeBlock = ({ className, children }: { className?: string; children: React.ReactNode }) => {
    try {
      const language = className ? className.replace('language-', '') : 'powershell';
      const style = theme === 'dark' ? vscDarkPlus : prism;
      
      // Ensure children is a string
      const codeContent = String(children || '').replace(/\n$/, '');
      
      if (!codeContent.trim()) {
        // Return simple pre-formatted block for empty content
        return (
          <div className={`my-2 rounded-md overflow-hidden ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'} p-4`}>
            <pre className="font-mono text-sm">{codeContent}</pre>
          </div>
        );
      }
      
      // Use try-catch to handle potential syntax highlighter errors
      try {
        return (
          <div className="my-2 rounded-md overflow-hidden">
            <SyntaxHighlighter 
              language={language} 
              style={style}
              customStyle={{ 
                padding: '1em', 
                borderRadius: '0.375rem',
                fontSize: '0.9em',
                margin: 0
              }}
            >
              {codeContent}
            </SyntaxHighlighter>
          </div>
        );
      } catch (syntaxError) {
        console.error('Syntax highlighter error:', syntaxError);
        // Fallback to simple pre element if syntax highlighting fails
        return (
          <div className={`my-2 rounded-md overflow-hidden ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'} p-4`}>
            <pre className="font-mono text-sm">{codeContent}</pre>
          </div>
        );
      }
    } catch (error) {
      console.error('Error in CodeBlock component:', error);
      // Return empty div if component fails
      return <div className="my-2 bg-red-200 p-2 rounded">Error rendering code block</div>;
    }
  };

  return (
    <div className={`flex flex-col h-full ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
      {/* Header */}
      <div className={`p-4 flex justify-between items-center ${theme === 'dark' ? 'bg-gray-800' : 'bg-blue-600 text-white'}`}>
        <h1 className="text-xl font-bold">PowerShell AI Assistant</h1>
        <div className="flex gap-2 items-center">
          {isSaving && (
            <span className="text-xs opacity-70">Saving...</span>
          )}
          {isAuthenticated && (
            <>
              <button 
                onClick={() => {
                  console.log('Search toggle clicked, current state:', showSearch);
                  setShowSearch(prevState => !prevState);
                }}
                className="px-3 py-1 rounded bg-opacity-20 bg-white hover:bg-opacity-30 flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {showSearch ? 'Close' : 'Search'}
              </button>
              <button 
                onClick={() => {
                  console.log('History button clicked');
                  try {
                    navigate('/chat/history');
                  } catch (navError) {
                    console.error('Navigation error:', navError);
                    // Fallback to regular navigation
                    window.location.href = '/chat/history';
                  }
                }}
                className="px-3 py-1 rounded bg-opacity-20 bg-white hover:bg-opacity-30 flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                History
              </button>
            </>
          )}
          <button 
            onClick={() => {
              console.log('Theme toggle clicked');
              if (typeof toggleTheme === 'function') {
                toggleTheme();
              } else {
                console.error('toggleTheme is not a function:', toggleTheme);
                // Fallback toggle
                document.body.classList.toggle('dark-mode');
              }
            }}
            className="px-3 py-1 rounded bg-opacity-20 bg-white hover:bg-opacity-30"
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <button 
            onClick={() => {
              console.log('Clear chat clicked');
              clearChat();
            }}
            className="px-3 py-1 rounded bg-opacity-20 bg-white hover:bg-opacity-30"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Search panel */}
      {showSearch && (
        <div className={`p-4 ${theme === 'dark' ? 'bg-gray-800 border-b border-gray-700' : 'bg-white border-b border-gray-200'}`}>
          <form onSubmit={handleSearch} className="flex gap-2 mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your chat history..."
              className={`flex-1 p-2 rounded ${
                theme === 'dark' 
                  ? 'bg-gray-700 border-gray-600' 
                  : 'bg-gray-100 border-gray-300'
              } border focus:ring-2 focus:ring-blue-500 focus:outline-none`}
              disabled={isSearching || !isAuthenticated}
            />
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim() || !isAuthenticated}
              className={`px-4 py-2 rounded font-medium ${
                theme === 'dark'
                  ? 'bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700'
                  : 'bg-blue-600 text-white hover:bg-blue-500 disabled:bg-gray-300'
              }`}
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>
          
          {!isAuthenticated && (
            <div className="text-center py-2 text-yellow-500">
              Please log in to search your chat history
            </div>
          )}

          <div className={`max-h-60 overflow-y-auto rounded ${searchResults.length > 0 ? 'border' : ''} ${
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          }`}>
            {searchResults.map((result, idx) => (
              <div 
                key={result.id || idx}
                className={`p-3 cursor-pointer ${
                  theme === 'dark' 
                    ? 'hover:bg-gray-700 border-b border-gray-700' 
                    : 'hover:bg-gray-100 border-b border-gray-200'
                } ${idx === searchResults.length - 1 ? 'border-b-0' : ''}`}
                onClick={() => loadChatHistory(result.messages)}
              >
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">{result.date}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    theme === 'dark' ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800'
                  }`}>
                    Score: {result.score.toFixed(2)}
                  </span>
                </div>
                <div className="text-sm truncate">
                  {result.messages[0]?.content || 'No content'}
                </div>
              </div>
            ))}
            
            {searchResults.length === 0 && searchQuery.trim() !== '' && !isSearching && (
              <div className="p-4 text-center text-gray-500">
                No results found
              </div>
            )}
            
            {isSearching && (
              <div className="p-4 text-center">
                <div className="inline-block">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-150"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-300"></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className={`flex-1 p-4 overflow-y-auto ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p>No messages yet</p>
              <p className="text-sm mt-2">Start a conversation by typing a message below</p>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div 
              key={index}
              className={`mb-4 ${msg.role === 'user' ? 'ml-auto' : 'mr-auto'} max-w-[80%]`}
            >
              <div className="relative">
                <div 
                  className={`p-3 rounded-lg ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : theme === 'dark' 
                        ? 'bg-gray-800 border border-gray-700' 
                        : 'bg-white shadow'
                  }`}
                >
                  {/* Simple rendering for debugging */}
                  {false && (
                    <div className="whitespace-pre-wrap text-sm">
                      {msg.content}
                    </div>
                  )}
                  
                  {/* Render as markdown */}
                  {false ? (
                    // Simple text rendering (safer, no dependencies) 
                    <div className="whitespace-pre-wrap text-sm">
                      {msg.content || "No content"}
                    </div>
                  ) : (
                    // Markdown rendering - enable markdown support
                    <div className="markdown-content">
                      <ReactMarkdown
                        components={{
                          code: ({ node, inline, className, children, ...props }) => {
                            if (inline) {
                              return <code className={`${theme === 'dark' ? 'bg-gray-700 text-yellow-300' : 'bg-gray-200 text-blue-600'} px-1 rounded font-mono`} {...props}>{children}</code>;
                            }
                            return <CodeBlock className={className}>{children}</CodeBlock>;
                          },
                          h1: ({ children }) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-lg font-bold mb-2">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-base font-bold mb-1">{children}</h3>,
                          p: ({ children }) => <p className="mb-3">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-5 mb-3">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-5 mb-3">{children}</ol>,
                          li: ({ children }) => <li className="mb-1">{children}</li>,
                          a: ({ href, children }) => (
                            <a href={href} className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">
                              {children}
                            </a>
                          ),
                        }}
                      >
                        {msg.content || "No content"}
                      </ReactMarkdown>
                    </div>
                  )}
                  
                  {/* Message actions */}
                  {msg.role === 'assistant' && extractPowerShellCode(msg.content) && (
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={() => {
                          console.log('Save as Script clicked for message:', index);
                          openCreateScriptModal(msg);
                        }}
                        className={`text-xs px-2 py-1 rounded flex items-center ${
                          theme === 'dark'
                            ? 'bg-gray-700 hover:bg-gray-600 text-blue-400'
                            : 'bg-gray-100 hover:bg-gray-200 text-blue-600'
                        }`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        Save as Script
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center mb-4">
            <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-150"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-300"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef}></div>
      </div>

      {/* Input form */}
      <div className={`p-4 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border-t'}`}>
        <div className="flex gap-2 mb-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".ps1,.psm1,.psd1"
            onChange={handleFileSelect}
            className="hidden"
            multiple={false}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`px-3 py-1 rounded text-sm ${
              theme === 'dark'
                ? 'bg-gray-700 hover:bg-gray-600'
                : 'bg-gray-200 hover:bg-gray-300'
            }`}
            disabled={isLoading || isUploading}
          >
            Upload Script
          </button>
          {selectedFile && (
            <div className="flex-1 flex items-center">
              <span className="text-sm truncate">{selectedFile.name}</span>
              <button
                type="button"
                onClick={handleFileUpload}
                className={`ml-2 px-3 py-1 rounded text-sm ${
                  theme === 'dark'
                    ? 'bg-green-700 hover:bg-green-600 text-white'
                    : 'bg-green-600 hover:bg-green-500 text-white'
                }`}
                disabled={isLoading || isUploading}
              >
                {isUploading ? 'Uploading...' : 'Analyze'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className={`ml-2 px-3 py-1 rounded text-sm ${
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
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
            className={`flex-1 p-2 rounded ${
              theme === 'dark' 
                ? 'bg-gray-700 border-gray-600' 
                : 'bg-gray-100 border-gray-300'
            } border focus:ring-2 focus:ring-blue-500 focus:outline-none`}
            disabled={isLoading || isUploading}
          />
          <button
            type="submit"
            disabled={isLoading || isUploading || !input.trim()}
            className={`px-4 py-2 rounded font-medium ${
              theme === 'dark'
                ? 'bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700'
                : 'bg-blue-600 text-white hover:bg-blue-500 disabled:bg-gray-300'
            }`}
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </form>
        {isAuthenticated ? (
          <p className="text-xs text-center mt-2 opacity-60">
            {user?.username} • {isSaving ? 'Saving chat...' : 'Chat saved'}
          </p>
        ) : (
          <p className="text-xs text-center mt-2 opacity-60">
            Sign in to save your chat history
          </p>
        )}
      </div>
      
      {/* Create Script Modal */}
      {showCreateScriptModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-lg shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto
            ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
            <div className={`p-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
              <h2 className="text-xl font-bold">Create New Script</h2>
              <p className="text-sm opacity-70 mt-1">Save this code as a new PowerShell script</p>
            </div>
            
            <div className="p-4">
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Script Name</label>
                <input
                  type="text"
                  value={scriptName}
                  onChange={(e) => setScriptName(e.target.value)}
                  placeholder="script-name.ps1"
                  className={`w-full p-2 rounded ${
                    theme === 'dark' 
                      ? 'bg-gray-700 border-gray-600' 
                      : 'bg-gray-100 border-gray-300'
                  } border focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={scriptDescription}
                  onChange={(e) => setScriptDescription(e.target.value)}
                  placeholder="Brief description of what the script does"
                  className={`w-full p-2 rounded ${
                    theme === 'dark' 
                      ? 'bg-gray-700 border-gray-600' 
                      : 'bg-gray-100 border-gray-300'
                  } border focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Script Content</label>
                <div className={`w-full rounded ${
                  theme === 'dark' 
                    ? 'bg-gray-700 border-gray-600' 
                    : 'bg-gray-100 border-gray-300'
                } border p-2 h-60 overflow-y-auto`}>
                  <pre className="whitespace-pre-wrap font-mono text-sm">
                    {scriptContent}
                  </pre>
                </div>
              </div>
            </div>
            
            <div className={`p-4 border-t flex justify-end gap-2 ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
              <button
                type="button"
                onClick={() => setShowCreateScriptModal(false)}
                className={`px-4 py-2 rounded ${
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createScript}
                className={`px-4 py-2 rounded font-medium ${
                  theme === 'dark'
                    ? 'bg-blue-600 hover:bg-blue-500'
                    : 'bg-blue-600 text-white hover:bg-blue-500'
                }`}
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