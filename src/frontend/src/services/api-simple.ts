import axios from 'axios';

// Chat service
export const chatService = {
  // Send a chat message to the AI
  sendMessage: async (messages: any[]) => {
    try {
      const response = await axios.post('http://localhost:8000/chat', { 
        messages: messages
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer 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'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error sending chat message:', error);
      return { 
        response: 'Sorry, I encountered an error. Please try again later.'
      };
    }
  }
};

// Simple script service
export const scriptService = {
  getScripts: async () => {
    return { scripts: [], total: 0 };
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
