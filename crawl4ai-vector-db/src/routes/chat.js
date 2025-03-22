const express = require('express');
const router = express.Router();
const { ChatService } = require('../services');
const { WebPage } = require('../models');
const chatService = new ChatService();

/**
 * @route POST /api/chat/conversations
 * @description Create a new conversation
 * @access Public
 */
router.post('/conversations', async (req, res) => {
  try {
    const { title } = req.body;
    
    const conversation = await chatService.createConversation(title);
    
    res.status(201).json({
      message: 'Conversation created successfully',
      conversation: {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route GET /api/chat/conversations
 * @description Get all conversations
 * @access Public
 */
router.get('/conversations', async (req, res) => {
  try {
    const { Conversation, Message } = require('../models');
    
    const conversations = await Conversation.findAll({
      attributes: ['id', 'title', 'metadata', 'createdAt', 'updatedAt'],
      order: [['updatedAt', 'DESC']],
      include: [
        {
          model: Message,
          as: 'messages',
          attributes: ['id', 'role', 'createdAt'],
          limit: 1,
          order: [['createdAt', 'DESC']]
        }
      ]
    });
    
    res.json(conversations);
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route GET /api/chat/conversations/:id
 * @description Get a conversation by ID with messages
 * @access Public
 */
router.get('/conversations/:id', async (req, res) => {
  try {
    const conversation = await chatService.getConversation(req.params.id);
    
    res.json(conversation);
  } catch (error) {
    console.error(`Error getting conversation ${req.params.id}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route DELETE /api/chat/conversations/:id
 * @description Delete a conversation
 * @access Public
 */
router.delete('/conversations/:id', async (req, res) => {
  try {
    const { Conversation } = require('../models');
    
    const conversation = await Conversation.findByPk(req.params.id);
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    await conversation.destroy();
    
    res.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error(`Error deleting conversation ${req.params.id}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route POST /api/chat/conversations/:id/messages
 * @description Send a message in a conversation
 * @access Public
 */
router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ message: 'Message content is required' });
    }
    
    const message = await chatService.sendMessage(req.params.id, content);
    
    res.status(201).json({
      message: 'Message sent successfully',
      response: {
        id: message.id,
        content: message.content,
        role: message.role,
        createdAt: message.createdAt
      }
    });
  } catch (error) {
    console.error(`Error sending message in conversation ${req.params.id}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route GET /api/chat/messages/:id/citations
 * @description Get citations for a message
 * @access Public
 */
router.get('/messages/:id/citations', async (req, res) => {
  try {
    const { MessageCitation } = require('../models');
    
    const citations = await MessageCitation.findAll({
      where: { messageId: req.params.id },
      include: [
        {
          model: WebPage,
          as: 'webPage',
          attributes: ['id', 'url', 'title']
        }
      ]
    });
    
    const formattedCitations = citations.map(citation => ({
      id: citation.id,
      relevanceScore: citation.relevanceScore,
      webpage: {
        id: citation.webPage.id,
        url: citation.webPage.url,
        title: citation.webPage.title
      }
    }));
    
    res.json({
      messageId: req.params.id,
      count: formattedCitations.length,
      citations: formattedCitations
    });
  } catch (error) {
    console.error(`Error getting citations for message ${req.params.id}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
