import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import {
  sanitizeInput,
  securityLogger,
  validateRequestSize,
  csrfProtection,
} from '../security';

// Mock the logger module used by securityLogger
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import logger from '../../utils/logger';

describe('Security Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    mockRequest = {
      body: {},
      query: {},
      ip: '127.0.0.1',
      path: '/api/test',
      headers: {},
    };
    // Use type assertion for Express mock response
    const statusFn = jest.fn().mockReturnThis() as unknown;
    const jsonFn = jest.fn().mockReturnThis() as unknown;
    mockResponse = {
      status: statusFn as Response['status'],
      json: jsonFn as Response['json'],
    };
    nextFunction = jest.fn() as jest.Mock;
    (logger.warn as jest.Mock).mockClear();
  });

  describe('sanitizeInput', () => {
    it('should pass through clean string input', () => {
      mockRequest.body = { name: 'John Doe', message: 'Hello World' };

      sanitizeInput(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.body.name).toBe('John Doe');
      expect(mockRequest.body.message).toBe('Hello World');
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should remove null bytes from strings', () => {
      mockRequest.body = { name: 'John\x00Doe', message: 'Hello\x00World' };

      sanitizeInput(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.body.name).toBe('JohnDoe');
      expect(mockRequest.body.message).toBe('HelloWorld');
    });

    it('should remove control characters but preserve newlines and tabs', () => {
      mockRequest.body = {
        script: 'Line 1\nLine 2\tTabbed',
        dirty: 'Has\x01control\x02chars',
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.body.script).toBe('Line 1\nLine 2\tTabbed');
      expect(mockRequest.body.dirty).toBe('Hascontrolchars');
    });

    it('should sanitize nested objects', () => {
      mockRequest.body = {
        user: {
          name: 'John\x00Doe',
          details: {
            bio: 'Hello\x01World',
          },
        },
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.body.user.name).toBe('JohnDoe');
      expect(mockRequest.body.user.details.bio).toBe('HelloWorld');
    });

    it('should sanitize arrays', () => {
      mockRequest.body = {
        items: ['Clean', 'Dirty\x00', 'Also\x01Clean'],
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.body.items).toEqual(['Clean', 'Dirty', 'AlsoClean']);
    });

    it('should preserve non-string values', () => {
      mockRequest.body = {
        count: 42,
        active: true,
        data: null,
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.body.count).toBe(42);
      expect(mockRequest.body.active).toBe(true);
      expect(mockRequest.body.data).toBe(null);
    });

    it('should handle empty body', () => {
      mockRequest.body = undefined;

      sanitizeInput(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('securityLogger', () => {
    it('should log path traversal attempts', () => {
      mockRequest.body = { path: '../../../etc/passwd' };

      securityLogger(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(logger.warn).toHaveBeenCalled();
    });

    it('should log XSS attempts', () => {
      mockRequest.body = { input: '<script>alert("xss")</script>' };

      securityLogger(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(logger.warn).toHaveBeenCalled();
    });

    it('should log SQL injection attempts', () => {
      mockRequest.body = { query: "SELECT * FROM users UNION SELECT * FROM passwords" };

      securityLogger(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(logger.warn).toHaveBeenCalled();
    });

    it('should log NoSQL injection attempts', () => {
      mockRequest.body = { filter: '{"$where": "function() { return true; }"}' };

      securityLogger(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(logger.warn).toHaveBeenCalled();
    });

    it('should not log for clean requests', () => {
      mockRequest.body = { name: 'John Doe' };
      mockRequest.query = { page: '1' };

      securityLogger(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should check query parameters too', () => {
      mockRequest.query = { search: '../../../etc/shadow' };

      securityLogger(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('validateRequestSize', () => {
    it('should pass requests within size limit', () => {
      mockRequest.headers = { 'content-length': '1000' };

      const middleware = validateRequestSize(1); // 1MB limit
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should reject requests exceeding size limit', () => {
      mockRequest.headers = { 'content-length': String(60 * 1024 * 1024) }; // 60MB

      const middleware = validateRequestSize(50); // 50MB limit
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(413);
    });
  });

  describe('csrfProtection', () => {
    it('allows localhost development origins on alternate ports', () => {
      mockRequest.method = 'POST';
      mockRequest.headers = { origin: 'https://127.0.0.1:3191' };

      const middleware = csrfProtection();
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('blocks unknown origins for state-changing requests', () => {
      mockRequest.method = 'POST';
      mockRequest.headers = { origin: 'https://evil.example.com' };

      const middleware = csrfProtection();
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });
});
