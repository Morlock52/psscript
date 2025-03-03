import { Sequelize } from 'sequelize';
import User from './User';
import Script from './Script';
import Category from './Category';
import ScriptAnalysis from './ScriptAnalysis';
import Tag from './Tag';
import ScriptTag from './ScriptTag';
import ScriptVersion from './ScriptVersion';
import ScriptEmbedding from './ScriptEmbedding';
import ExecutionLog from './ExecutionLog';
import UserFavorite from './UserFavorite';
import Comment from './Comment';
import ChatHistory from './ChatHistory';

import dotenv from 'dotenv';
dotenv.config();

// Database connection configuration
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432');
const DB_NAME = process.env.DB_NAME || 'psscript';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';

// Initialize Sequelize
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

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
UserFavorite.initialize(sequelize);
Comment.initialize(sequelize);
ChatHistory.initialize(sequelize);

// Set up associations
User.associate();
Script.associate();
Category.associate();
ScriptAnalysis.associate();
Tag.associate();
ScriptTag.associate();
ScriptVersion.associate();
ScriptEmbedding.associate();
ExecutionLog.associate();
UserFavorite.associate();
Comment.associate();
ChatHistory.associate();

export {
  sequelize,
  User,
  Script,
  Category,
  ScriptAnalysis,
  Tag,
  ScriptTag,
  ScriptVersion,
  ScriptEmbedding,
  ExecutionLog,
  UserFavorite,
  Comment,
  ChatHistory
};