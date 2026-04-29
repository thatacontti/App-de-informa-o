import Redis from 'ioredis';
import { env } from './env';

declare global {
  // eslint-disable-next-line no-var
  var redisSingleton: Redis | undefined;
}

export const redis =
  globalThis.redisSingleton ??
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    // Defer connection until first command — keeps `next build` quiet
    // when Redis is not running (e.g. CI, Docker image build).
    lazyConnect: true,
    enableReadyCheck: true,
  });

if (process.env.NODE_ENV !== 'production') globalThis.redisSingleton = redis;
