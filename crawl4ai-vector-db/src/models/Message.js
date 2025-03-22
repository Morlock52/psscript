const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');
const Conversation = require('./Conversation');
const WebPage = require('./WebPage');

class Message extends Model {}

Message.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  conversationId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Conversation,
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  role: {
    type: DataTypes.ENUM('user', 'assistant', 'system'),
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {}
  }
}, {
  sequelize,
  modelName: 'Message',
  tableName: 'messages',
  timestamps: true,
  indexes: [
    {
      fields: ['conversationId']
    }
  ]
});

// Define the relationship
Message.belongsTo(Conversation, { foreignKey: 'conversationId', as: 'conversation' });
Conversation.hasMany(Message, { foreignKey: 'conversationId', as: 'messages' });

// Create a join table for message citations
const MessageCitation = sequelize.define('MessageCitation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  messageId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Message,
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  webPageId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: WebPage,
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  relevanceScore: {
    type: DataTypes.FLOAT,
    allowNull: true
  }
}, {
  tableName: 'message_citations',
  timestamps: true,
  indexes: [
    {
      fields: ['messageId']
    },
    {
      fields: ['webPageId']
    }
  ]
});

// Define the many-to-many relationship
Message.belongsToMany(WebPage, { through: MessageCitation, foreignKey: 'messageId', as: 'citedPages' });
WebPage.belongsToMany(Message, { through: MessageCitation, foreignKey: 'webPageId', as: 'citedInMessages' });

module.exports = { Message, MessageCitation };
