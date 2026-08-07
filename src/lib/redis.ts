import { createClient as createRedisClient } from 'redis';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

let redisClient: ReturnType<typeof createRedisClient> | null = null;

export function createClient(config?: RedisConfig) {
  if (redisClient) return redisClient;

  const redisConfig: RedisConfig = {
    host: config?.host || process.env.REDIS_HOST || 'localhost',
    port: config?.port || parseInt(process.env.REDIS_PORT || '6379'),
    password: config?.password || process.env.REDIS_PASSWORD,
    db: config?.db || parseInt(process.env.REDIS_DB || '0'),
  };

  redisClient = createRedisClient({
    socket: { host: redisConfig.host, port: redisConfig.port },
    password: redisConfig.password,
    database: redisConfig.db,
  });

  redisClient.on('error', (err) => console.error('Redis Client Error:', err));
  redisClient.on('connect', () => console.log('Redis Client Connected'));
  redisClient.connect().catch(console.error);

  return redisClient;
}

export function getRedisClient() { return redisClient; }
export async function closeRedisClient() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

export default createClient;
