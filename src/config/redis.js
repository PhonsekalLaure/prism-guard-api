const { createClient } = require('redis');

let redisClient = null;
let connectPromise = null;

function createServiceUnavailableError(message) {
  const error = new Error(message);
  error.status = 503;
  error.code = 'RATE_LIMITER_UNAVAILABLE';
  return error;
}

function getRedisUrl() {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    throw createServiceUnavailableError('REDIS_URL is required for limiter-backed routes.');
  }

  return redisUrl;
}

function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      url: getRedisUrl(),
      socket: {
        reconnectStrategy: false,
      },
    });

    redisClient.on('error', (error) => {
      console.error('[Redis Error]:', error);
    });
  }

  return redisClient;
}

async function ensureRedisReady() {
  const client = getRedisClient();

  if (client.isReady) {
    return client;
  }

  if (!connectPromise) {
    connectPromise = client.connect()
      .catch((error) => {
        connectPromise = null;
        throw createServiceUnavailableError(
          `Redis is unavailable for limiter-backed routes: ${error.message}`
        );
      });
  }

  await connectPromise;
  return client;
}

module.exports = {
  createServiceUnavailableError,
  ensureRedisReady,
  getRedisClient,
};
