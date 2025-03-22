// @ts-nocheck - Using multer types with Express requires complex type handling
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// Ensure upload directory exists with full path resolution for disk storage
let uploadDir = path.join(process.cwd(), 'uploads');

// Handle both backend root and parent directory running
if (process.cwd().includes('src/backend')) {
  uploadDir = path.join(process.cwd(), 'uploads');
} else {
  uploadDir = path.join(process.cwd(), 'src', 'backend', 'uploads');
}

// Create upload directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  logger.info(`Created upload directory: ${uploadDir}`);
}

// Configure disk storage (for production use)
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Create unique filename with timestamp and original extension
    const uniqueSuffix = `${Date.now()}-${path.basename(file.originalname)}`;
    cb(null, uniqueSuffix);
  }
});

// Use memory storage for immediate processing
const memoryStorage = multer.memoryStorage();

// Acceptable PowerShell-related file extensions
const ALLOWED_EXTENSIONS = [
  '.ps1',   // PowerShell script
  '.psm1',  // PowerShell module
  '.psd1',  // PowerShell data/manifest
  '.ps1xml', // PowerShell format/type definition
  '.txt',   // Also allow text files for flexibility
  '.json'   // Allow JSON files (can contain configuration for PowerShell)
];

// File filter to only allow PowerShell scripts and related files
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  try {
    logger.debug(`[UPLOAD] Processing file: ${file.originalname}, mimetype: ${file.mimetype}`);
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      logger.debug(`[UPLOAD] File extension ${ext} is allowed`);
      return cb(null, true);
    }
    
    // Fallback: If file has no extension but mimetype is acceptable, allow it
    if (!ext && (file.mimetype === 'text/plain' || file.mimetype === 'application/octet-stream')) {
      logger.debug(`[UPLOAD] File has no extension but acceptable mimetype: ${file.mimetype}`);
      return cb(null, true);
    }
    
    // Reject other file types
    logger.warn(`[UPLOAD] Rejected file with extension ${ext} and mimetype ${file.mimetype}`);
    cb(new Error(`Only PowerShell and text files (${ALLOWED_EXTENSIONS.join(', ')}) are allowed`));
  } catch (error) {
    logger.error('[UPLOAD] Error in file filter:', error);
    cb(new Error('File upload processing error'));
  }
};

// Custom error handling for multer with improved logging and error details
const handleMulterError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    // A Multer error occurred when uploading
    logger.error(`[UPLOAD] Multer error: ${err.code} - ${err.message}`);
    
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'file_too_large', 
        message: 'The uploaded file exceeds the maximum size limit of 10MB.',
        success: false
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'unexpected_field',
        message: 'Make sure the file is uploaded with field name "script_file"',
        success: false
      });
    }
    return res.status(400).json({ 
      error: err.code || 'multer_error', 
      message: err.message || 'An error occurred during file upload',
      success: false
    });
  } else if (err) {
    // An unknown error occurred
    logger.error('[UPLOAD] Upload error:', err);
    return res.status(400).json({ 
      error: 'upload_error', 
      message: err.message || 'An unknown error occurred during file upload',
      success: false
    });
  }
  next();
};

// Middleware to monitor upload progress and handle network errors
const handleUploadProgress = (req: Request, res: Response, next: NextFunction) => {
  // Record initial timestamp for upload timing
  const startTime = Date.now();
  let bytesReceived = 0;
  
  // Track upload progress for large files
  if (req.headers['content-length']) {
    const contentLength = parseInt(req.headers['content-length'], 10);
    
    // Setup progress tracking for large uploads
    if (contentLength > 1024 * 1024) { // Only track for files > 1MB
      logger.info(`[UPLOAD] Starting large file upload: ${contentLength} bytes`);
      
      req.on('data', (chunk) => {
        bytesReceived += chunk.length;
        
        // Log progress periodically (every ~25%)
        if (bytesReceived % Math.floor(contentLength / 4) < chunk.length) {
          const progress = Math.round((bytesReceived / contentLength) * 100);
          const elapsedSeconds = (Date.now() - startTime) / 1000;
          logger.info(`[UPLOAD] Progress: ${progress}%, ${bytesReceived}/${contentLength} bytes, elapsed: ${elapsedSeconds.toFixed(1)}s`);
        }
      });
    }
  }
  
  // Handle connection close events
  req.on('close', () => {
    if (!res.headersSent) {
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      logger.warn(`[UPLOAD] Client closed connection before response was sent after ${elapsedSeconds.toFixed(1)}s, bytes received: ${bytesReceived}`);
    }
  });
  
  // Handle end of request
  req.on('end', () => {
    const elapsedSeconds = (Date.now() - startTime) / 1000;
    logger.debug(`[UPLOAD] Request body fully received: ${bytesReceived} bytes in ${elapsedSeconds.toFixed(1)}s`);
  });
  
  next();
};

// Create multer upload instance with memory storage for immediate processing
const upload = multer({
  storage: memoryStorage, // Use memory storage for immediate access to buffer
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 1                    // Only allow one file per upload
  }
});

// Create disk-based upload instance for larger files or long-term storage
const diskUpload = multer({
  storage: diskStorage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB max file size
    files: 1                    // Only allow one file per upload
  }
});

export { handleMulterError, diskUpload, handleUploadProgress };
export default upload;
