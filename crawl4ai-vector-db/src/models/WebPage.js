const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');
const pgvector = require('pgvector/sequelize');

class WebPage extends Model {}

WebPage.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  url: {
    type: DataTypes.STRING(2048),
    allowNull: false,
    unique: true
  },
  title: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  markdown: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {}
  },
  lastCrawled: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  // Fields for deep crawling support
  parentUrl: {
    type: DataTypes.STRING(2048),
    allowNull: true,
    comment: 'URL of the parent page that linked to this page'
  },
  parentId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'ID of the parent page that linked to this page'
  },
  depth: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: 'Depth level in the crawl tree (0 for root pages)'
  },
  crawlStrategy: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'Strategy used for crawling (BFS, DFS, BESTFIRST)'
  },
  relevanceScore: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Relevance score for this page (used in BESTFIRST strategy)'
  },
  isProcessed: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Whether the page has been processed (chunked and embedded)'
  }
}, {
  sequelize,
  modelName: 'WebPage',
  tableName: 'web_pages',
  timestamps: true,
  indexes: [
    {
      fields: ['url'],
      unique: true
    },
    {
      fields: ['lastCrawled']
    },
    {
      fields: ['parentId']
    },
    {
      fields: ['depth']
    },
    {
      fields: ['crawlStrategy']
    }
  ]
});

// Self-referential association for parent-child relationships
WebPage.associate = (models) => {
  WebPage.hasMany(models.WebPage, {
    as: 'childPages',
    foreignKey: 'parentId'
  });
  
  WebPage.belongsTo(models.WebPage, {
    as: 'parentPage',
    foreignKey: 'parentId'
  });
  
  WebPage.hasMany(models.ContentChunk, {
    as: 'chunks',
    foreignKey: 'webPageId'
  });
};

module.exports = WebPage;
