import winston from 'winston';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'psscript-api' },
  transports: [
    // Write logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          (info) => `${info.timestamp} ${info.level}: ${info.message}`
        )
      ),
    }),
    // Write error logs to file
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      dirname: 'logs',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    // Write all logs to file
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      dirname: 'logs',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  ],
});

// Create log directory if it doesn't exist
// This would be handled by a file system module in a real implementation

// Export logger instance
export default logger;