import { apiClient } from './api';

// Simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Define message type to match the one in useChat.tsx
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

// Define search result type to match the one in useChat.tsx
interface SearchResult {
  id?: string;
  messages: Message[];
  score: number;
  date: string;
  timestamp?: string | Date;
}

// Mock PowerShell responses for common queries
const POWERSHELL_RESPONSES: Record<string, string> = {
  "hello": "Hello! I'm your PowerShell assistant. How can I help you today?",
  "help": "I can help you with PowerShell scripting tasks. You can ask me questions about PowerShell commands, syntax, best practices, or how to accomplish specific tasks.",
  "script": "PowerShell scripts are files with a .ps1 extension containing a series of PowerShell commands. They allow you to automate tasks and create reusable functionality. Would you like to know how to create or run a PowerShell script?",
  "command": "PowerShell has many useful cmdlets. Some common ones include:\n\n- Get-Content: Reads the content of a file\n- Set-Content: Writes content to a file\n- Get-Process: Gets information about running processes\n- Invoke-RestMethod: Makes HTTP requests\n\nIs there a specific command you'd like to learn about?",
  "default": "As a PowerShell assistant, I can help you with PowerShell scripting. For example, I can explain commands, help debug scripts, or suggest how to automate tasks."
};

// Mock chat history for search
const MOCK_CHAT_HISTORY: SearchResult[] = [
  {
    id: 'mock-1',
    messages: [
      { role: 'user', content: 'How do I list running processes in PowerShell?', timestamp: new Date('2025-03-01T12:00:00Z') },
      { role: 'assistant', content: 'You can use the `Get-Process` cmdlet to list running processes in PowerShell. Here\'s a basic example:\n\n```powershell\nGet-Process\n```\n\nYou can also filter the results:\n\n```powershell\nGet-Process -Name chrome\n```\n\nOr sort them by memory usage:\n\n```powershell\nGet-Process | Sort-Object -Property WorkingSet -Descending | Select-Object -First 10\n```', timestamp: new Date('2025-03-01T12:01:00Z') }
    ],
    score: 0.95,
    date: '2025-03-01',
    timestamp: '2025-03-01T12:01:00Z'
  },
  {
    id: 'mock-2',
    messages: [
      { role: 'user', content: 'How do I create a function in PowerShell?', timestamp: new Date('2025-03-02T14:30:00Z') },
      { role: 'assistant', content: 'In PowerShell, you can create functions using the `function` keyword. Here\'s a basic example:\n\n```powershell\nfunction Get-Greeting {\n    param(\n        [string]$Name = "World"\n    )\n    \n    return "Hello, $Name!"\n}\n\n# Call the function\nGet-Greeting\nGet-Greeting -Name "PowerShell"\n```', timestamp: new Date('2025-03-02T14:31:00Z') }
    ],
    score: 0.85,
    date: '2025-03-02',
    timestamp: '2025-03-02T14:31:00Z'
  }
];

// Find the best matching response based on input
const findBestResponse = (input: string): string => {
  // Convert input to lowercase for case-insensitive matching
  const lowerInput = input.toLowerCase();
  
  // Try to find an exact match first
  for (const [key, response] of Object.entries(POWERSHELL_RESPONSES)) {
    if (lowerInput.includes(key)) {
      return response;
    }
  }
  
  // Return default response for unmatched inputs
  return POWERSHELL_RESPONSES.default;
};

// Chat service
export const chatService = {
  // Send a chat message to the AI
  sendMessage: async (messages: Message[], agent_type?: string, session_id?: string) => {
    const useMockMode = localStorage.getItem('psscript_mock_mode') === 'true';

    // Default: always use the real backend (which can use either a per-user key
    // via x-openai-api-key OR a server-side OPENAI_API_KEY).
    if (!useMockMode) {
      const apiKey = localStorage.getItem('openai_api_key') || '';
      const response = await apiClient.post(`/chat`, {
        messages: messages,
        agent_type: agent_type || "assistant",
        session_id: session_id
      }, {
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-openai-api-key': apiKey } : {})
        },
        timeout: 30000
      });
      return response.data;
    }

    // Explicit mock mode (only when the user enables it).
    console.log("Using mock response service (psscript_mock_mode=true)");
    await delay(250 + Math.random() * 250);

    const lastUserMessage = messages
      .filter(msg => msg.role === 'user')
      .pop();

    if (!lastUserMessage) {
      return { response: "I don't see a question. How can I help you?" };
    }

    return { response: findBestResponse(lastUserMessage.content) };
  },

  // Stream a chat message using Server-Sent Events (SSE)
  // January 2026: Real-time token streaming for improved UX
  streamMessage: async (
    messages: Message[],
    onToken: (token: string) => void,
    onDone: (metadata: { session_id?: string; tokens?: number; time?: number }) => void,
    onError?: (error: string) => void,
    agent_type?: string,
    session_id?: string
  ): Promise<void> => {
    try {
      const start = Date.now();
      const result = await chatService.sendMessage(messages, agent_type, session_id);
      const responseText = result?.response || '';
      const tokens = responseText.split(' ');

      for (const token of tokens) {
        onToken(token + ' ');
        // Light delay for streaming feel
        // eslint-disable-next-line no-await-in-loop
        await delay(10);
      }

      onDone({
        session_id,
        tokens: tokens.length,
        time: Date.now() - start
      });
    } catch (error) {
      console.error('Streaming error:', error);
      if (onError) {
        onError(error instanceof Error ? error.message : 'Unknown streaming error');
      }
    }
  },

  // Save chat history to server
  saveChatHistory: async (messages: Message[]) => {
    try {
      // In a real implementation, this would send the chat history to the server
      console.log("Mock: Saving chat history", messages.length, "messages");
      
      // Simulate network delay
      await delay(500 + Math.random() * 500);
      
      return { success: true };
    } catch (error) {
      console.error('Error saving chat history:', error);
      throw new Error('Failed to save chat history');
    }
  },

  // Clear chat history from server
  clearChatHistory: async () => {
    try {
      // In a real implementation, this would clear the chat history from the server
      console.log("Mock: Clearing chat history");
      
      // Simulate network delay
      await delay(300 + Math.random() * 300);
      
      return { success: true };
    } catch (error) {
      console.error('Error clearing chat history:', error);
      throw new Error('Failed to clear chat history');
    }
  },

  // Search chat history
  searchChatHistory: async (query: string): Promise<SearchResult[]> => {
    try {
      // In a real implementation, this would search the chat history on the server
      console.log("Mock: Searching chat history for", query);

      // Simulate network delay
      await delay(800 + Math.random() * 800);

      // Simple mock implementation that returns predefined results
      // In a real implementation, this would filter based on the query
      return MOCK_CHAT_HISTORY;
    } catch (error) {
      console.error('Error searching chat history:', error);
      throw new Error('Failed to search chat history');
    }
  },

  // Generate diff between original and improved code
  generateDiff: async (original: string, improved: string, detectImprovements: boolean = true) => {
    try {
      const apiKey = localStorage.getItem('openai_api_key') || '';
      const response = await apiClient.post(`/ai-agent/diff`, {
        original,
        improved,
        detect_improvements: detectImprovements
      }, {
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-openai-api-key': apiKey } : {})
        },
        timeout: 30000
      });
      return response.data;
    } catch (error) {
      console.error('Error generating diff:', error);
      throw new Error('Failed to generate diff');
    }
  },

  // Improve a script and get the diff
  improveScript: async (script: string) => {
    try {
      const apiKey = localStorage.getItem('openai_api_key') || '';
      const response = await apiClient.post(`/ai-agent/improve`, {
        script
      }, {
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-openai-api-key': apiKey } : {})
        },
        timeout: 60000 // 60 second timeout for AI improvements
      });
      return response.data;
    } catch (error) {
      console.error('Error improving script:', error);
      throw new Error('Failed to improve script');
    }
  },

  // Lint PowerShell script using PSScriptAnalyzer
  lintScript: async (script: string, format?: string) => {
    try {
      const apiKey = localStorage.getItem('openai_api_key') || '';
      const response = await apiClient.post(`/ai-agent/lint`, {
        content: script,  // Backend expects 'content' field
        format: format || 'json'
      }, {
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-openai-api-key': apiKey } : {})
        },
        timeout: 30000
      });
      return response.data;
    } catch (error) {
      console.error('Error linting script:', error);
      throw new Error('Failed to lint script');
    }
  },

  // Generate Pester tests for a script
  generateTests: async (script: string, scriptName?: string, coverage?: string) => {
    try {
      const apiKey = localStorage.getItem('openai_api_key') || '';
      const response = await apiClient.post(`/ai-agent/generate-tests`, {
        content: script,  // Backend expects 'content' field
        script_name: scriptName || 'Script.ps1',
        coverage: coverage || 'standard'
      }, {
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-openai-api-key': apiKey } : {})
        },
        timeout: 30000
      });
      return response.data;
    } catch (error) {
      console.error('Error generating tests:', error);
      throw new Error('Failed to generate tests');
    }
  },

  // Execute a script in the sandbox
  executeScript: async (script: string, timeout?: number) => {
    try {
      const apiKey = localStorage.getItem('openai_api_key') || '';
      const response = await apiClient.post(`/ai-agent/execute`, {
        script,
        timeout: timeout || 30
      }, {
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-openai-api-key': apiKey } : {})
        },
        timeout: 60000 // Long timeout for execution
      });
      return response.data;
    } catch (error) {
      console.error('Error executing script:', error);
      throw new Error('Failed to execute script');
    }
  },

  // Route a query to the appropriate model
  routeQuery: async (query: string, context?: Message[]) => {
    try {
      const apiKey = localStorage.getItem('openai_api_key') || '';
      const response = await apiClient.post(`/ai-agent/route`, {
        query,
        context: context || []
      }, {
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-openai-api-key': apiKey } : {})
        },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('Error routing query:', error);
      throw new Error('Failed to route query');
    }
  }
};

// Script data interface
interface ScriptData {
  name: string;
  content: string;
  description: string;
  isPublic: boolean;
}

// Simple script service
export const scriptService = {
  getScripts: async () => {
    return { scripts: [], total: 0 };
  },
  
  // Upload a script
  uploadScript: async (scriptData: ScriptData) => {
    try {
      // In a real implementation, this would upload the script to the server
      console.log("Mock: Uploading script", scriptData.name);
      
      // Simulate network delay
      await delay(1000 + Math.random() * 1000);
      
      return { 
        id: 'mock-script-' + Date.now(),
        name: scriptData.name,
        content: scriptData.content,
        description: scriptData.description,
        isPublic: scriptData.isPublic,
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error uploading script:', error);
      throw new Error('Failed to upload script');
    }
  }
};

// Simplified category service
export const categoryService = {
  getCategories: async () => {
    return { categories: [] };
  }
};

// Simplified tag service
export const tagService = {
  getTags: async () => {
    return { tags: [] };
  }
};
