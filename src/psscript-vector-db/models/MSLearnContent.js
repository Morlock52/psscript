const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * MSLearnContent model
 * Represents content from Microsoft Learn related to PowerShell
 */
const MSLearnContent = sequelize.define('MSLearnContent', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'The extracted content from the page'
  },
  contentType: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Type of content (article, tutorial, reference, etc.)'
  },
  summary: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'AI-generated summary of the content'
  },
  extractedCommands: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'JSON array of PowerShell commands extracted from the content'
  },
  extractedFunctions: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'JSON array of PowerShell functions extracted from the content'
  },
  extractedModules: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'JSON array of PowerShell modules mentioned in the content'
  },
  extractedConcepts: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'JSON array of PowerShell concepts explained in the content'
  },
  embedding: {
    type: DataTypes.ARRAY(DataTypes.FLOAT),
    allowNull: true,
    comment: 'Vector embedding of the content'
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Additional metadata about the content'
  },
  lastCrawled: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: 'When the content was last crawled'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'ms_learn_content',
  indexes: [
    {
      name: 'idx_ms_learn_content_url',
      fields: ['url'],
      unique: true
    },
    {
      name: 'idx_ms_learn_content_title',
      fields: ['title']
    },
    {
      name: 'idx_ms_learn_content_content_type',
      fields: ['contentType']
    }
  ]
});

module.exports = MSLearnContent;
