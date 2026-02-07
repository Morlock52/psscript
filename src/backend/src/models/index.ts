// @ts-nocheck - Required for circular model references and association handling
import User from './User';
import Script from './Script';
import Category from './Category';
import ScriptAnalysis from './ScriptAnalysis';
import Tag from './Tag';
import ScriptTag from './ScriptTag';
import ScriptVersion from './ScriptVersion';
import ScriptEmbedding from './ScriptEmbedding';
import ExecutionLog from './ExecutionLog';
import ChatHistory from './ChatHistory';
import Documentation from './Documentation';
import Comment from './Comment';
import UserFavorite from './UserFavorite';
import ScriptDependency from './ScriptDependency';
import CommandInsight from './CommandInsight';
import CommandEnrichmentJob from './CommandEnrichmentJob';

import dotenv from 'dotenv';
dotenv.config();

// Import the sequelize instance from database/connection.ts
import { sequelize } from '../database/connection';

// Initialize models
User.initialize(sequelize);
Script.initialize(sequelize);
Category.initialize(sequelize);
ScriptAnalysis.initialize(sequelize);
Tag.initialize(sequelize);
ScriptTag.initialize(sequelize);
ScriptVersion.initialize(sequelize);
ScriptEmbedding.initialize(sequelize);
ExecutionLog.initialize(sequelize);
ChatHistory.initialize(sequelize);
Documentation.initialize(sequelize);
Comment.initialize(sequelize);
UserFavorite.initialize(sequelize);
ScriptDependency.initialize(sequelize);
CommandInsight.initialize(sequelize);
CommandEnrichmentJob.initialize(sequelize);

// Set up associations - check if method exists first
function safeAssociate(model) {
  if (model && typeof model.associate === 'function') {
    try {
      model.associate();
    } catch (error) {
      console.warn(`Error in ${model.name || 'unknown model'} association:`, error);
    }
  }
}

// Safely call associate methods
safeAssociate(User);
safeAssociate(Script);
safeAssociate(Category);
safeAssociate(ScriptAnalysis);
safeAssociate(Tag);
safeAssociate(ScriptTag);
safeAssociate(ScriptVersion);
safeAssociate(ScriptEmbedding);
safeAssociate(ExecutionLog);
safeAssociate(ChatHistory);
safeAssociate(Documentation);
safeAssociate(Comment);
safeAssociate(UserFavorite);
safeAssociate(ScriptDependency);
safeAssociate(CommandInsight);
safeAssociate(CommandEnrichmentJob);

// Track connection events and diagnostics
import { dbConnectionInfo, connectionEvents } from '../database/connection';

export {
  sequelize,
  dbConnectionInfo,
  connectionEvents,
  User,
  Script,
  Category,
  ScriptAnalysis,
  Tag,
  ScriptTag,
  ScriptVersion,
  ScriptEmbedding,
  ExecutionLog,
  ChatHistory,
  Documentation,
  Comment,
  UserFavorite,
  ScriptDependency,
  CommandInsight,
  CommandEnrichmentJob
};
