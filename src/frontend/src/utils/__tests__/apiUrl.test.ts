import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getApiUrl,
  getAiServiceUrl,
  getAssistantsApiUrl,
  clearUrlCache,
  isLocalhost,
  getProtocol,
} from '../apiUrl';

describe('apiUrl utilities', () => {
  // Store original window.location
  const originalLocation = window.location;

  beforeEach(() => {
    // Clear cache before each test
    clearUrlCache();
    // Reset import.meta.env mocks
    vi.stubGlobal('import.meta.env', {});
  });

  afterEach(() => {
    // Restore original location
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
    vi.unstubAllGlobals();
  });

  const mockLocation = (hostname: string, protocol: string = 'http:') => {
    Object.defineProperty(window, 'location', {
      value: {
        hostname,
        protocol,
      },
      writable: true,
    });
  };

  describe('getApiUrl', () => {
    it('returns localhost URL when on localhost', () => {
      mockLocation('localhost');
      const url = getApiUrl();
      expect(url).toBe('http://localhost:4000/api');
    });

    it('returns localhost URL when on 127.0.0.1', () => {
      mockLocation('127.0.0.1');
      const url = getApiUrl();
      expect(url).toBe('http://127.0.0.1:4000/api');
    });

    it('returns tunnel URL (no port) when on remote hostname', () => {
      mockLocation('psscript.morloksmaze.com', 'https:');
      const url = getApiUrl();
      expect(url).toBe('https://psscript.morloksmaze.com/api');
    });

    it('uses https when protocol is https', () => {
      mockLocation('localhost', 'https:');
      const url = getApiUrl();
      expect(url).toBe('https://localhost:4000/api');
    });

    it('caches the URL after first call', () => {
      mockLocation('localhost');
      const url1 = getApiUrl();

      // Change location - should still return cached value
      mockLocation('different.host.com');
      const url2 = getApiUrl();

      expect(url1).toBe(url2);
      expect(url2).toBe('http://localhost:4000/api');
    });

    it('returns new URL after cache is cleared', () => {
      mockLocation('localhost');
      const url1 = getApiUrl();

      clearUrlCache();
      mockLocation('remote.host.com', 'https:');
      const url2 = getApiUrl();

      expect(url1).toBe('http://localhost:4000/api');
      expect(url2).toBe('https://remote.host.com/api');
    });
  });

  describe('getAiServiceUrl', () => {
    it('returns localhost:8000 when on localhost', () => {
      mockLocation('localhost');
      const url = getAiServiceUrl();
      expect(url).toBe('http://localhost:8000');
    });

    it('returns /ai path for remote hostnames', () => {
      mockLocation('psscript.morloksmaze.com', 'https:');
      const url = getAiServiceUrl();
      expect(url).toBe('https://psscript.morloksmaze.com/ai');
    });
  });

  describe('getAssistantsApiUrl', () => {
    it('returns localhost:4001/api when on localhost', () => {
      mockLocation('localhost');
      const url = getAssistantsApiUrl();
      expect(url).toBe('http://localhost:4001/api');
    });

    it('returns /assistants-api path for remote hostnames', () => {
      mockLocation('psscript.morloksmaze.com', 'https:');
      const url = getAssistantsApiUrl();
      expect(url).toBe('https://psscript.morloksmaze.com/assistants-api');
    });
  });

  describe('isLocalhost', () => {
    it('returns true for localhost', () => {
      mockLocation('localhost');
      expect(isLocalhost()).toBe(true);
    });

    it('returns true for 127.0.0.1', () => {
      mockLocation('127.0.0.1');
      expect(isLocalhost()).toBe(true);
    });

    it('returns false for remote hostname', () => {
      mockLocation('psscript.morloksmaze.com');
      expect(isLocalhost()).toBe(false);
    });
  });

  describe('getProtocol', () => {
    it('returns http for http protocol', () => {
      mockLocation('localhost', 'http:');
      expect(getProtocol()).toBe('http');
    });

    it('returns https for https protocol', () => {
      mockLocation('localhost', 'https:');
      expect(getProtocol()).toBe('https');
    });
  });
});
