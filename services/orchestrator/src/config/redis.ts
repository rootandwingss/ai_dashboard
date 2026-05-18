import IORedis from "ioredis";
import { env } from "./env";

let redisConnection: IORedis;

if (env.MOCK_MODE) {
  // Mock Redis for local testing
  redisConnection = new IORedis({ lazy: true });
  redisConnection.connect = async () => { /* no-op */ };
  redisConnection.ping = async () => "PONG";
  redisConnection.set = async () => "OK";
  redisConnection.get = async () => null;
  redisConnection.lpush = async () => 1;
  redisConnection.brpoplpush = async () => null;
  redisConnection.del = async () => 0;
} else {
  redisConnection = new IORedis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    maxRetriesPerRequest: null,
  });
}

export { redisConnection };

export function createRedisConnection() {
  if (env.MOCK_MODE) {
    const mock = new IORedis({ lazy: true });
    mock.connect = async () => {};
    return mock;
  }
  return new IORedis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    maxRetriesPerRequest: null,
  });
}