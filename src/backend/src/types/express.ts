export {};

interface CacheInterface {
  get: (key: string) => any;
  set: (key: string, value: any, ttl?: number) => void;
  del: (key: string) => boolean;
  clear: () => void;
  clearPattern: (pattern: string) => number;
  stats: () => { size: number; keys: string[] };
}

declare global {
  namespace Express {
    interface Request {
      cache?: CacheInterface;
      user?: {
        id?: number | string;
        username?: string;
        email?: string;
        role?: string;
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
