const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * ScriptAnalysis model
 * Represents analysis results for a PowerShell script
 */
const ScriptAnalysis = sequelize.define('ScriptAnalysis', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  scriptId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'PowerShellScripts',
      key: 'id'
    },
    comment: 'Reference to the PowerShell script'
  },
  complexity: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Complexity score from 0-10'
  },
  securityRisk: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Security risk score from 0-10'
  },
  performance: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Performance score from 0-10'
  },
  maintainability: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Maintainability score from 0-10'
  },
  documentation: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Documentation quality score from 0-10'
  },
  bestPractices: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Best practices adherence score from 0-10'
  },
  commandCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Number of commands in the script'
  },
  functionCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Number of functions in the script'
  },
  lineCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Number of lines in the script'
  },
  commentCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Number of comment lines in the script'
  },
  extractedCommands: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'JSON array of commands used in the script'
  },
  extractedFunctions: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'JSON array of functions defined in the script'
  },
  extractedModules: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'JSON array of modules used in the script'
  },
  extractedVariables: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'JSON array of variables used in the script'
  },
  securityIssues: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'JSON array of security issues found in the script'
  },
  performanceIssues: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'JSON array of performance issues found in the script'
  },
  bestPracticeIssues: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'JSON array of best practice issues found in the script'
  },
  summary: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'AI-generated summary of the script'
  },
  recommendations: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'JSON array of recommendations for improving the script'
  },
  analysisVersion: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Version of the analysis engine used'
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
  tableName: 'script_analyses',
  indexes: [
    {
      name: 'idx_script_analyses_script_id',
      fields: ['scriptId'],
      unique: true
    }
  ]
});

module.exports = ScriptAnalysis;
