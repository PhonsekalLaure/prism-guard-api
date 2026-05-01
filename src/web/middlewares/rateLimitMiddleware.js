const { consumeLimiter } = require('@utils/rateLimit');

const RATE_LIMIT_CONFIGS = {
  employeeWrite: {
    name: 'employeeWrite',
    limiter: { keyPrefix: 'write:employee', points: 5, duration: 600 },
    error: {
      code: 'RATE_LIMITED_WRITE_EMPLOYEE',
      message: 'Too many employee management requests. Please try again later.',
    },
  },
  clientWrite: {
    name: 'clientWrite',
    limiter: { keyPrefix: 'write:client', points: 5, duration: 600 },
    error: {
      code: 'RATE_LIMITED_WRITE_CLIENT',
      message: 'Too many client management requests. Please try again later.',
    },
  },
  adminWrite: {
    name: 'adminWrite',
    limiter: { keyPrefix: 'write:admin', points: 3, duration: 1800 },
    error: {
      code: 'RATE_LIMITED_WRITE_ADMIN',
      message: 'Too many admin management requests. Please try again later.',
    },
  },
  deploymentWrite: {
    name: 'deploymentWrite',
    limiter: { keyPrefix: 'write:deployment', points: 10, duration: 600 },
    error: {
      code: 'RATE_LIMITED_WRITE_DEPLOYMENT',
      message: 'Too many deployment requests. Please try again later.',
    },
  },
  deploymentRelieve: {
    name: 'deploymentRelieve',
    limiter: { keyPrefix: 'write:deployment:relieve', points: 20, duration: 600 },
    error: {
      code: 'RATE_LIMITED_RELIEVE_DEPLOYMENT',
      message: 'Too many relieve requests. Please try again later.',
    },
  },
  employeeNextId: {
    name: 'employeeNextId',
    limiter: { keyPrefix: 'utility:employee-next-id', points: 30, duration: 300 },
    error: {
      code: 'RATE_LIMITED_EMPLOYEE_NEXT_ID',
      message: 'Too many employee ID requests. Please try again later.',
    },
  },
  googleAutocomplete: {
    name: 'googleAutocomplete',
    limiter: { keyPrefix: 'provider:google:autocomplete', points: 10, duration: 10 },
    error: {
      code: 'RATE_LIMITED_GOOGLE_AUTOCOMPLETE',
      message: 'Too many address lookup requests. Please try again later.',
    },
  },
  googlePlaceDetails: {
    name: 'googlePlaceDetails',
    limiter: { keyPrefix: 'provider:google:details', points: 30, duration: 60 },
    error: {
      code: 'RATE_LIMITED_GOOGLE_PLACE_DETAILS',
      message: 'Too many address detail requests. Please try again later.',
    },
  },
};

function getRequestActorKey(req) {
  return req.user?.id || req.ip;
}

function createRateLimitMiddleware(configKey) {
  const config = RATE_LIMIT_CONFIGS[configKey];

  if (!config) {
    throw new Error(`Unknown rate limit config: ${configKey}`);
  }

  return async function rateLimitMiddleware(req, res, next) {
    try {
      await consumeLimiter(
        config.name,
        config.limiter,
        getRequestActorKey(req),
        config.error
      );
      next();
    } catch (error) {
      if (error.status === 429) {
        res.set('Retry-After', String(error.retryAfterSeconds));
      }

      return res.status(error.status || 503).json({
        error: error.message,
        code: error.code || 'RATE_LIMIT_FAILED',
        retryAfterSeconds: error.retryAfterSeconds || null,
      });
    }
  };
}

module.exports = {
  createRateLimitMiddleware,
};
