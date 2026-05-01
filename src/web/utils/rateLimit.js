const { RateLimiterRedis } = require('rate-limiter-flexible');
const { ensureRedisReady, getRedisClient, createServiceUnavailableError } = require('@config/redis');

const limiterRegistry = new Map();

function createTooManyRequestsError({ msBeforeNext = 1000, code = 'RATE_LIMITED', message = 'Too many requests.' } = {}) {
  const retryAfterSeconds = Math.max(1, Math.ceil(msBeforeNext / 1000));
  const error = new Error(message);
  error.status = 429;
  error.code = code;
  error.retryAfterSeconds = retryAfterSeconds;
  error.msBeforeNext = msBeforeNext;
  return error;
}

function createLimiter(config) {
  return new RateLimiterRedis({
    storeClient: getRedisClient(),
    keyPrefix: config.keyPrefix,
    points: config.points,
    duration: config.duration,
    useRedisPackage: true,
  });
}

function getLimiter(name, config) {
  if (!limiterRegistry.has(name)) {
    limiterRegistry.set(name, createLimiter(config));
  }

  return limiterRegistry.get(name);
}

function isRateLimiterRes(error) {
  return Boolean(error && typeof error.msBeforeNext === 'number');
}

async function consumeLimiter(name, config, key, errorOptions = {}) {
  if (!key) {
    throw createServiceUnavailableError('Limiter key is required.');
  }

  await ensureRedisReady();
  const limiter = getLimiter(name, config);

  try {
    await limiter.consume(key);
  } catch (error) {
    if (isRateLimiterRes(error)) {
      throw createTooManyRequestsError({
        msBeforeNext: error.msBeforeNext,
        code: errorOptions.code,
        message: errorOptions.message,
      });
    }

    throw createServiceUnavailableError(`Rate limiter failed: ${error.message}`);
  }
}

async function getCachedJson(cacheKey) {
  await ensureRedisReady();
  const client = getRedisClient();
  const raw = await client.get(cacheKey);
  return raw ? JSON.parse(raw) : null;
}

async function setCachedJson(cacheKey, value, ttlSeconds) {
  await ensureRedisReady();
  const client = getRedisClient();
  await client.set(cacheKey, JSON.stringify(value), { EX: ttlSeconds });
}

module.exports = {
  consumeLimiter,
  createServiceUnavailableError,
  createTooManyRequestsError,
  getCachedJson,
  setCachedJson,
};
