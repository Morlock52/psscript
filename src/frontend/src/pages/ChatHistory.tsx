import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatService } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import Layout from '../components/Layout';
import ReactMarkdown from 'react-markdown';

// Reusable style constants for theme-aware styling
const sidebarStyles = "rounded-lg shadow-[var(--shadow-md)] p-4 bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)]";
const searchInputStyles = "w-full p-2 rounded bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none mb-3 placeholder:text-[var(--color-text-tertiary)]";
const categorySelectStyles = "text-xs px-2 py-1 rounded bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none";
const detailPanelStyles = "rounded-lg shadow-[var(--shadow-md)] bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)]";
const headerBorderStyles = "p-4 flex justify-between items-center border-b border-[var(--color-border-default)]";

interface ChatSession {
  id: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: Date;
  }>;
  timestamp: string;
  category?: string;
}

const ChatHistory: React.FC = () => {
  const { isAuthenticated, user: _user } = useAuth();
  const navigate = useNavigate();

  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);

  // Load chat history and categories
  useEffect(() => {
    if (!isAuthenticated) {
      try {
        navigate('/login', { replace: true });
      } catch (navError) {
        console.error('Navigation error:', navError);
        // If navigation fails, at least show a message
        alert('Please log in to view chat history');
      }
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      try {
        // Get chat history
        const response = await chatService.getChatHistory();
        const sessions = response.history.map((session: any) => ({
          ...session,
          timestamp: new Date(session.timestamp || Date.now()).toLocaleString(),
        }));
        setChatSessions(sessions);

        // Get categories
        const categoryList = await chatService.getChatCategories();
        setCategories(['all', 'uncategorized', ...categoryList]);
      } catch (error) {
        console.error('Error loading chat history data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isAuthenticated, navigate]);

  // Filter chat sessions by category and search query
  const filteredSessions = chatSessions.filter(session => {
    // Filter by category
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'uncategorized' && session.category) {
        return false;
      } else if (selectedCategory !== 'uncategorized' && session.category !== selectedCategory) {
        return false;
      }
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const hasMatch = session.messages.some(msg =>
        msg.content && msg.content.toLowerCase().includes(query)
      );
      return hasMatch;
    }

    return true;
  });

  // Set category for a chat session
  const setChatCategory = async (sessionId: string, category: string) => {
    try {
      await chatService.setChatCategory(sessionId, category);
      setChatSessions(prev =>
        prev.map(session =>
          session.id === sessionId
            ? { ...session, category }
            : session
        )
      );
    } catch (error) {
      console.error('Error setting chat category:', error);
    }
  };

  // Delete chat session
  const deleteSession = async (sessionId: string) => {
    if (window.confirm('Are you sure you want to delete this chat session?')) {
      try {
        // Check if the method exists
        if (typeof chatService.deleteChatSession === 'function') {
          await chatService.deleteChatSession(sessionId);
        } else {
          console.error('deleteChatSession method not available');
          throw new Error('Delete method not available');
        }

        // Update UI regardless of whether the deletion was successful
        setChatSessions(prev => prev.filter(session => session.id !== sessionId));
        if (selectedSession?.id === sessionId) {
          setSelectedSession(null);
        }
      } catch (error) {
        console.error('Error deleting chat session:', error);
        alert('Failed to delete chat session. It will be removed from the view but may still exist on the server.');

        // Still update UI even if the API call failed
        setChatSessions(prev => prev.filter(session => session.id !== sessionId));
        if (selectedSession?.id === sessionId) {
          setSelectedSession(null);
        }
      }
    }
  };

  // Continue chat from a previous session
  const continueChat = (session: ChatSession) => {
    try {
      // Make sure messages is valid
      if (session && Array.isArray(session.messages)) {
        localStorage.setItem('psscript_chat_history', JSON.stringify(session.messages));
        try {
          navigate('/chat');
        } catch (navError) {
          console.error('Navigation error:', navError);
          // Fallback to regular navigation
          window.location.href = '/chat';
        }
      } else {
        throw new Error('Invalid session data');
      }
    } catch (error) {
      console.error('Error continuing chat:', error);
      alert('Could not continue this chat. Starting a new chat...');
      try {
        localStorage.removeItem('psscript_chat_history');
        navigate('/chat');
      } catch (_e) {
        window.location.href = '/chat';
      }
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]">
        <div className="container mx-auto py-6 px-4">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Chat History</h1>
            <button
              onClick={() => navigate('/chat')}
              className="px-4 py-2 rounded font-medium bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white"
            >
              New Chat
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sidebar with filters and list */}
            <div className={`lg:col-span-1 ${sidebarStyles}`}>
              {/* Search and filters */}
              <div className="mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search chat history..."
                  className={searchInputStyles}
                />

                <div className="flex flex-wrap gap-2 mb-3">
                  {categories.map(category => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-3 py-1 text-sm rounded-full transition-colors ${
                        selectedCategory === category
                          ? 'bg-[var(--color-primary)] text-white'
                          : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-primary)]'
                      }`}
                    >
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat sessions list */}
              <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
                {isLoading ? (
                  <div className="py-10 text-center">
                    <div className="inline-block">
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 bg-[var(--color-primary)] rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-[var(--color-primary)] rounded-full animate-bounce delay-150"></div>
                        <div className="w-2 h-2 bg-[var(--color-primary)] rounded-full animate-bounce delay-300"></div>
                      </div>
                    </div>
                  </div>
                ) : filteredSessions.length > 0 ? (
                  filteredSessions.map(session => (
                    <div
                      key={session.id}
                      onClick={() => setSelectedSession(session)}
                      className={`p-3 mb-2 rounded cursor-pointer border transition-colors ${
                        selectedSession?.id === session.id
                          ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/30'
                          : 'bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-primary)] border-[var(--color-border-default)]'
                      }`}
                    >
                      <div className="flex justify-between">
                        <span className="text-xs text-[var(--color-text-tertiary)]">{session.timestamp}</span>
                        {session.category && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                            {session.category}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm truncate text-[var(--color-text-secondary)]">
                        {session.messages[0]?.content.substring(0, 100) || 'No content'}...
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-10 text-center text-[var(--color-text-tertiary)]">
                    No chat sessions found
                  </div>
                )}
              </div>
            </div>

            {/* Chat session detail view */}
            <div className={`lg:col-span-2 ${detailPanelStyles}`}>
              {selectedSession ? (
                <div className="h-full flex flex-col">
                  {/* Session header */}
                  <div className={headerBorderStyles}>
                    <div>
                      <span className="text-sm text-[var(--color-text-tertiary)]">Session: {selectedSession.timestamp}</span>
                      <div className="flex gap-2 mt-2">
                        <select
                          value={selectedSession.category || ''}
                          onChange={(e) => setChatCategory(selectedSession.id, e.target.value)}
                          className={categorySelectStyles}
                        >
                          <option value="">Uncategorized</option>
                          {categories.filter(c => c !== 'all' && c !== 'uncategorized').map(category => (
                            <option key={category} value={category}>{category}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => continueChat(selectedSession)}
                        className="px-3 py-1 text-sm rounded bg-green-600 hover:bg-green-500 text-white"
                      >
                        Continue Chat
                      </button>
                      <button
                        onClick={() => deleteSession(selectedSession.id)}
                        className="px-3 py-1 text-sm rounded bg-red-600 hover:bg-red-500 text-white"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Session content */}
                  <div className="flex-1 overflow-y-auto p-4">
                    {selectedSession.messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`mb-4 ${msg.role === 'user' ? 'ml-auto' : 'mr-auto'} max-w-[80%]`}
                      >
                        <div
                          className={`p-3 rounded-lg ${
                            msg.role === 'user'
                              ? 'bg-[var(--color-primary)] text-white'
                              : 'bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)]'
                          }`}
                        >
                          <ReactMarkdown className="prose prose-sm max-w-none dark:prose-invert">
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center p-10 text-center text-[var(--color-text-tertiary)]">
                  <div>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-16 w-16 mx-auto mb-4 opacity-20"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                      />
                    </svg>
                    <h3 className="text-lg font-medium mb-2 text-[var(--color-text-secondary)]">No Chat Session Selected</h3>
                    <p>Select a chat session from the list to view its contents</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ChatHistory;
