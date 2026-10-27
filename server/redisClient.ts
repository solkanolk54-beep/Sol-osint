import Redis from 'ioredis';
import { EventEmitter } from 'events';

// In-Memory Fallback Cache Store
const redisStore = new Map<string, { value: string; expiresAt: number | null }>();
const pubSubEmitter = new EventEmitter();

// Connect to Redis with lazy connection & non-blocking fallback
export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  retryStrategy: () => null, // Never hang or block process loop if offline
  connectTimeout: 1500,
});

let isRedisUp = false;

redis.on('connect', () => {
  isRedisUp = true;
  console.log('[Redis] Connected successfully to Redis server');
});

redis.on('error', (err) => {
  if (isRedisUp) {
    console.warn('[Redis] Offline, falling back to fast in-memory store:', err.message);
  }
  isRedisUp = false;
});

// Prompt-specified helper: setCache
export const setCache = async (key: string, val: string, ttlSeconds: number = 300) => {
  try {
    if (isRedisUp) {
      await redis.set(key, val, 'EX', ttlSeconds);
      return;
    }
  } catch {}
  redisStore.set(key, { value: val, expiresAt: Date.now() + ttlSeconds * 1000 });
};

// Prompt-specified helper: getCache
export const getCache = async (key: string): Promise<string | null> => {
  try {
    if (isRedisUp) {
      const data = await redis.get(key);
      if (data !== null) return data;
    }
  } catch {}
  const item = redisStore.get(key);
  if (!item) return null;
  if (item.expiresAt && Date.now() > item.expiresAt) {
    redisStore.delete(key);
    return null;
  }
  return item.value;
};

// Unified CacheClient wrapper preserving compatibility with existing code
export const cache = {
  isRedisConnected(): boolean {
    return isRedisUp;
  },

  async get(key: string): Promise<string | null> {
    return getCache(key);
  },

  async set(key: string, value: string, mode?: string, duration?: number): Promise<'OK' | null> {
    const ttl = (mode === 'EX' && duration) ? duration : 300;
    await setCache(key, value, ttl);
    return 'OK';
  },

  async publish(channel: string, message: string): Promise<number> {
    if (isRedisUp) {
      try {
        await redis.publish(channel, message);
      } catch {}
    }
    pubSubEmitter.emit(channel, message);
    return 1;
  },

  subscribe(channel: string, callback: (message: string) => void): () => void {
    pubSubEmitter.on(channel, callback);
    return () => pubSubEmitter.off(channel, callback);
  },
};
