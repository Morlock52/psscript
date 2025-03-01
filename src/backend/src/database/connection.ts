import { Sequelize } from 'sequelize';
import logger from '../utils/logger';

// Database connection with improved error handling and connection pooling
const sequelize = new Sequelize(
  process.env.DB_NAME || 'psscript',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'postgres',
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'postgres',
    logging: (msg) => logger.debug(msg),
    pool: {
      max: 20,
      min: 5,
      acquire: 60000,
      idle: 10000
    },
    retry: {
      match: [/Deadlock/i, /Lock/i, /Timeout/i],
      max: 3
    }
  }
);

export default sequelize;