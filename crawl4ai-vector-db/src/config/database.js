const { Sequelize } = require('sequelize');
require('dotenv').config();
const pgvector = require('pgvector/sequelize');

// Create a new Sequelize instance with PostgreSQL
const sequelize = new Sequelize(
  process.env.DB_NAME || 'crawl4ai_vector',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'postgres',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: {
      ssl: process.env.DB_SSL === 'true' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    }
  }
);

// Register pgvector extension with Sequelize
pgvector.registerType(sequelize);

// Test the database connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
    
    // Create pgvector extension if it doesn't exist
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('Vector extension is enabled.');
    
    return true;
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    return false;
  }
};

module.exports = {
  sequelize,
  testConnection
};
