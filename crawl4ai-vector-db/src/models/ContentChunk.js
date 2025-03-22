const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');
const pgvector = require('pgvector/sequelize');
const WebPage = require('./WebPage');

class ContentChunk extends Model {}

ContentChunk.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
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
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  embedding: {
    type: pgvector.Vector(1536), // Default dimension for OpenAI embeddings
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {}
  },
  chunkIndex: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'ContentChunk',
  tableName: 'content_chunks',
  timestamps: true,
  indexes: [
    {
      fields: ['webPageId']
    },
    {
      fields: ['webPageId', 'chunkIndex'],
      unique: true
    }
  ]
});

// Define the relationship
ContentChunk.belongsTo(WebPage, { foreignKey: 'webPageId', as: 'webPage' });
WebPage.hasMany(ContentChunk, { foreignKey: 'webPageId', as: 'chunks' });

module.exports = ContentChunk;
