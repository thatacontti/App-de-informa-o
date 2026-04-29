import IORedis, { type Redis } from 'ioredis';

export function makeRedisConnection(url: string): Redis {
  return new IORedis(url, {
    // BullMQ requires this to be null.
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}
