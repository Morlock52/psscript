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
  const originalLocation = window.location;

  beforeEach(() => {
    clearUrlCache();
    vi.stubGlobal('import.meta.env', {});
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
    vi.unstubAllGlobals();
  });

  const mockLocation = (hostname: string, protocol: string = 'http:') => {
    const port = '3090';
    const origin = `${protocol}//${hostname}${port ? `:${port}` : ''}`;
    Object.defineProperty(window, 'location', {
      value: {
        hostname,
        protocol,
        port,
        origin,
      },
      writable: true,
    });
  };

  describe('getApiUrl', () => {
    it('returns same-origin /api when on localhost', () => {
      mockLocation('localhost');
      expect(getApiUrl()).toBe('/api');
    });

    it('returns same-origin /api when on 127.0.0.1', () => {
      mockLocation('127.0.0.1');
      expect(getApiUrl()).toBe('/api');
    });

    it('returns same-origin /api when on remote hostname', () => {
      mockLocation('psscript.morloksmaze.com', 'https:');
      expect(getApiUrl()).toBe('/api');
    });

    it('caches the URL after first call', () => {
      mockLocation('localhost');
      const url1 = getApiUrl();
      mockLocation('different.host.com');
      const url2 = getApiUrl();

      expect(url1).toBe(url2);
      expect(url2).toBe('/api');
    });

    it('returns new URL after cache is cleared', () => {
      mockLocation('localhost');
      const url1 = getApiUrl();

      clearUrlCache();
      mockLocation('remote.host.com', 'https:');
      const url2 = getApiUrl();

      expect(url1).toBe('/api');
      expect(url2).toBe('/api');
    });
  });

  describe('getAiServiceUrl', () => {
    it('returns localhost:8000 when on localhost', () => {
      mockLocation('localhost');
      expect(getAiServiceUrl()).toBe('http://localhost:8000');
    });

    it('returns /ai path for remote hostnames', () => {
      mockLocation('psscript.morloksmaze.com', 'https:');
      expect(getAiServiceUrl()).toBe('https://psscript.morloksmaze.com/ai');
    });
  });

  describe('getAssistantsApiUrl', () => {
    it('returns same-origin /api when on localhost', () => {
      mockLocation('localhost');
      expect(getAssistantsApiUrl()).toBe('/api');
    });

    it('returns same-origin /api path for remote hostnames', () => {
      mockLocation('psscript.morloksmaze.com', 'https:');
      expect(getAssistantsApiUrl()).toBe('/api');
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
