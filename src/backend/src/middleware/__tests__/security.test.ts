import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import {
  sanitizeInput,
  securityLogger,
  validateRequestSize,
} from '../security';

// Mock the console.warn for security logger tests
const originalConsoleWarn = console.warn;

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
    console.warn = jest.fn();
  });

  afterEach(() => {
    console.warn = originalConsoleWarn;
  });

  describe('sanitizeInput', () => {
    it('should pass through clean string input', () => {
      mockRequest.body = { name: 'John Doe', message: 'Hello World' };

      sanitizeInput(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.body).toEqual({ name: 'John Doe', message: 'Hello World' });
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should remove null bytes from strings', () => {
      mockRequest.body = { name: 'John\x00Doe' };

      sanitizeInput(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.body.name).toBe('JohnDoe');
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should remove control characters but preserve newlines and tabs', () => {
      // \x09 is tab, \x0A is newline - these should be preserved
      // \x00-\x08, \x0B, \x0C, \x0E-\x1F, \x7F should be removed
      mockRequest.body = {
        script: 'Get-Process\n\tFormat-Table',
        malicious: 'Hello\x01\x02World',
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.body.script).toBe('Get-Process\n\tFormat-Table');
      expect(mockRequest.body.malicious).toBe('HelloWorld');
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

      expect(console.warn).toHaveBeenCalled();
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should log XSS attempts', () => {
      mockRequest.body = { content: '<script>alert("xss")</script>' };

      securityLogger(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(console.warn).toHaveBeenCalled();
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should log SQL injection attempts', () => {
      mockRequest.body = { query: "'; UNION SELECT * FROM users--" };

      securityLogger(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(console.warn).toHaveBeenCalled();
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should log NoSQL injection attempts', () => {
      mockRequest.body = { filter: '{"$where": "this.password.length > 0"}' };

      securityLogger(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(console.warn).toHaveBeenCalled();
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should not log clean requests', () => {
      mockRequest.body = { name: 'John Doe', email: 'john@example.com' };

      securityLogger(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(console.warn).not.toHaveBeenCalled();
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should check query parameters too', () => {
      mockRequest.query = { redirect: '../../../etc/passwd' };

      securityLogger(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(console.warn).toHaveBeenCalled();
      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('validateRequestSize', () => {
    it('should allow requests within size limit', () => {
      mockRequest.headers = { 'content-length': '1000' }; // 1KB

      const middleware = validateRequestSize(1); // 1MB limit

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject requests exceeding size limit', () => {
      mockRequest.headers = { 'content-length': String(60 * 1024 * 1024) }; // 60MB

      const middleware = validateRequestSize(50); // 50MB limit

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(413);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Payload Too Large',
        })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should allow requests with no content-length', () => {
      mockRequest.headers = {};

      const middleware = validateRequestSize(50);

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should use default 50MB limit when no size specified', () => {
      mockRequest.headers = { 'content-length': String(40 * 1024 * 1024) }; // 40MB

      const middleware = validateRequestSize(); // Default 50MB

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });
  });
});
