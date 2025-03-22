const WebPage = require('./WebPage');
const ContentChunk = require('./ContentChunk');
const Conversation = require('./Conversation');
const { Message, MessageCitation } = require('./Message');
const { sequelize } = require('../config/database');

// Export all models
module.exports = {
  WebPage,
  ContentChunk,
  Conversation,
  Message,
  MessageCitation,
  sequelize
};
