// Express request type extensions
// Centralizes all Request augmentations so individual files don't need @ts-nocheck

interface CacheInterface {
  get: <T = any>(key: string) => T | null;
  set: (key: string, value: any, ttl?: number) => void;
  del: (key: string) => boolean | void;
  clear?: () => void;
  clearPattern: (pattern: string) => number | void;
  stats?: () => { size: number; keys: string[] };
}

declare global {
  namespace Express {
    interface Request {
      cache?: CacheInterface;
      user?: {
        id: number | string;
        username: string;
        email: string;
        role: string;
        [key: string]: any;
      };
      authInfo?: {
        tokenType: string;
        requestId: string;
        timestamp: number;
        ipAddress: string;
        userAgent: string;
      };
    }
  }
}

export {};
