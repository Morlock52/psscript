import winston from 'winston';
import 'winston-daily-rotate-file';
import fs from 'fs';
import path from 'path';

// Make sure logs directory exists
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Define custom log levels
const levels = {
  error: 0,
  warn: 1, 
  info: 2,
  http: 3,
  debug: 4,
};

// Define level colors
winston.addColors({
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
});

// Create custom format for structured logging
const structuredLogFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS',
  }),
  winston.format.metadata({ 
    fillExcept: ['timestamp', 'level', 'message'] 
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({
    format: 'HH:mm:ss',
  }),
  winston.format.printf(
    (info) => {
      const { timestamp, level, message, ...meta } = info;
      const metaString = Object.keys(meta).length ? 
        `\n${JSON.stringify(meta, null, 2)}` : '';
      
      return `${timestamp} ${level}: ${message}${
        info.stack ? `\n${info.stack}` : ''
      }${metaString}`;
    }
  )
);

// Determine log level based on environment
const logLevel = process.env.LOG_LEVEL || 
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Create file transport with rotation
const errorFileTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '20m',
  maxFiles: '14d',
  format: structuredLogFormat,
  zippedArchive: true,
});

const combinedFileTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logDir, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '7d',
  format: structuredLogFormat,
  zippedArchive: true,
});

// Create transports array
const transports = [
  new winston.transports.Console({
    format: consoleFormat,
    handleExceptions: true,
  }),
];

// Only add file transports in production or if explicitly enabled
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_FILE_LOGS === 'true') {
  transports.push(errorFileTransport);
  transports.push(combinedFileTransport);
}

// Create logger instance
const logger = winston.createLogger({
  level: logLevel,
  levels,
  format: structuredLogFormat,
  defaultMeta: { 
    service: 'psscript-api',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '0.1.0'
  },
  transports,
  exitOnError: false,
  silent: process.env.NODE_ENV === 'test' && process.env.LOG_IN_TESTS !== 'true',
});

// Create HTTP stream for morgan integration
logger.stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Log initialization
if (process.env.NODE_ENV !== 'test') {
  logger.info(`Logger initialized at level: ${logLevel}`);
}

// Export logger instance
export default logger;