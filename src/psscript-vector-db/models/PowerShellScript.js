const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * PowerShellScript model
 * Represents a PowerShell script in the system
 */
const PowerShellScript = sequelize.define('PowerShellScript', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  author: {
    type: DataTypes.STRING,
    allowNull: true
  },
  source: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'URL or reference to where the script was found'
  },
  version: {
    type: DataTypes.STRING,
    allowNull: true
  },
  complexity: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Complexity score from 0-10'
  },
  rating: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'User rating from 0-5'
  },
  downloads: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  views: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  categoryId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Categories',
      key: 'id'
    }
  },
  embedding: {
    type: DataTypes.ARRAY(DataTypes.FLOAT),
    allowNull: true,
    comment: 'Vector embedding of the script content'
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Additional metadata about the script'
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
  tableName: 'powershell_scripts',
  indexes: [
    {
      name: 'idx_powershell_scripts_name',
      fields: ['name']
    },
    {
      name: 'idx_powershell_scripts_category',
      fields: ['categoryId']
    }
  ]
});

module.exports = PowerShellScript;
