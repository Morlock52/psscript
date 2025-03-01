import winston from 'winston';
import fs from 'fs';
import path from 'path';

// Simplified logger for development purposes
const { createLogger, format, transports } = winston;

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

// Create custom format for console output
const consoleFormat = format.combine(
  format.colorize({ all: true }),
  format.timestamp({
    format: 'HH:mm:ss',
  }),
  format.printf(
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

// Create transports array - simplified for development
const transportList = [
  new transports.Console({
    format: consoleFormat,
    handleExceptions: true,
  }),
  new transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
  }),
  new transports.File({
    filename: path.join(logDir, 'combined.log'),
  }),
];

// Create logger instance
const logger = createLogger({
  level: logLevel,
  levels,
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  defaultMeta: { 
    service: 'psscript-api',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '0.1.0'
  },
  transports: transportList,
  exitOnError: false,
  silent: process.env.NODE_ENV === 'test' && process.env.LOG_IN_TESTS !== 'true',
});

// Create HTTP stream for morgan integration
const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Add stream property to logger
(logger as any).stream = stream;

// Log initialization
if (process.env.NODE_ENV !== 'test') {
  logger.info(`Logger initialized at level: ${logLevel}`);
}

// Export logger instance
export default logger;