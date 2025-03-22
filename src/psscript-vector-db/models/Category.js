const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Category model
 * Represents a category for PowerShell scripts
 */
const Category = sequelize.define('Category', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  icon: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Icon name or path for the category'
  },
  color: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Color code for the category'
  },
  parentId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Categories',
      key: 'id'
    },
    comment: 'Parent category ID for hierarchical categories'
  },
  order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Display order for the category'
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Additional metadata about the category'
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
  tableName: 'categories',
  indexes: [
    {
      name: 'idx_categories_name',
      fields: ['name'],
      unique: true
    },
    {
      name: 'idx_categories_parent',
      fields: ['parentId']
    }
  ]
});

// Self-referential relationship for hierarchical categories
Category.hasMany(Category, { as: 'children', foreignKey: 'parentId' });
Category.belongsTo(Category, { as: 'parent', foreignKey: 'parentId' });

module.exports = Category;
