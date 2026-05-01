const { buildBadRequestError } = require('@utils/requestValidation');
const {
  consumeLimiter,
  getCachedJson,
  setCachedJson,
  createServiceUnavailableError,
} = require('@utils/rateLimit');

const GOOGLE_API_BASE_URL = 'https://maps.googleapis.com/maps/api/place';
const AUTOCOMPLETE_CACHE_TTL_SECONDS = 60;
const PLACE_DETAILS_CACHE_TTL_SECONDS = 600;

function getGoogleApiKey() {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim();
  if (!apiKey) {
    throw createServiceUnavailableError('GOOGLE_MAPS_SERVER_API_KEY is required for Google address lookup.');
  }

  return apiKey;
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw createServiceUnavailableError(`Google Places request failed with status ${response.status}.`);
  }

  return response.json();
}

function buildAutocompleteCacheKey(query) {
  return `cache:google:autocomplete:${query.trim().toLowerCase()}`;
}

function buildPlaceDetailsCacheKey(placeId) {
  return `cache:google:place-details:${placeId.trim()}`;
}

async function autocompletePlaces(query, actorKey) {
  const normalizedQuery = String(query || '').trim();
  if (normalizedQuery.length < 3) {
    throw buildBadRequestError('Address lookup requires at least 3 characters.');
  }

  await consumeLimiter(
    'googleAutocompleteUser',
    { keyPrefix: 'provider:google:autocomplete', points: 10, duration: 10 },
    actorKey || 'unknown-actor',
    {
      code: 'RATE_LIMITED_GOOGLE_AUTOCOMPLETE',
      message: 'Too many address lookup requests. Please try again later.',
    }
  );

  const cacheKey = buildAutocompleteCacheKey(normalizedQuery);
  const cached = await getCachedJson(cacheKey);
  if (cached) {
    return cached;
  }

  await consumeLimiter(
    'googleGlobal',
    { keyPrefix: 'provider:google:global', points: 300, duration: 60 },
    'global',
    {
      code: 'RATE_LIMITED_GOOGLE_GLOBAL',
      message: 'Address lookup is temporarily busy. Please try again later.',
    }
  );

  const apiKey = getGoogleApiKey();
  const params = new URLSearchParams({
    input: normalizedQuery,
    components: 'country:ph',
    types: 'address',
    key: apiKey,
  });

  const data = await fetchJson(`${GOOGLE_API_BASE_URL}/autocomplete/json?${params.toString()}`);
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw createServiceUnavailableError(`Google Places autocomplete failed: ${data.status}.`);
  }

  const result = {
    predictions: (data.predictions || []).map((prediction) => ({
      placeId: prediction.place_id,
      description: prediction.description,
      mainText: prediction.structured_formatting?.main_text || prediction.description,
      secondaryText: prediction.structured_formatting?.secondary_text || '',
    })),
  };

  await setCachedJson(cacheKey, result, AUTOCOMPLETE_CACHE_TTL_SECONDS);
  return result;
}

async function getPlaceDetails(placeId, actorKey) {
  const normalizedPlaceId = String(placeId || '').trim();
  if (!normalizedPlaceId) {
    throw buildBadRequestError('placeId is required.');
  }

  await consumeLimiter(
    'googlePlaceDetailsUser',
    { keyPrefix: 'provider:google:details', points: 30, duration: 60 },
    actorKey || 'unknown-actor',
    {
      code: 'RATE_LIMITED_GOOGLE_PLACE_DETAILS',
      message: 'Too many address detail requests. Please try again later.',
    }
  );

  const cacheKey = buildPlaceDetailsCacheKey(normalizedPlaceId);
  const cached = await getCachedJson(cacheKey);
  if (cached) {
    return cached;
  }

  await consumeLimiter(
    'googleGlobal',
    { keyPrefix: 'provider:google:global', points: 300, duration: 60 },
    'global',
    {
      code: 'RATE_LIMITED_GOOGLE_GLOBAL',
      message: 'Address lookup is temporarily busy. Please try again later.',
    }
  );

  const apiKey = getGoogleApiKey();
  const params = new URLSearchParams({
    place_id: normalizedPlaceId,
    fields: 'formatted_address,geometry,address_component',
    key: apiKey,
  });

  const data = await fetchJson(`${GOOGLE_API_BASE_URL}/details/json?${params.toString()}`);
  if (data.status !== 'OK' || !data.result?.geometry?.location) {
    throw createServiceUnavailableError(`Google Places details failed: ${data.status}.`);
  }

  const result = {
    formattedAddress: data.result.formatted_address,
    latitude: data.result.geometry.location.lat,
    longitude: data.result.geometry.location.lng,
    raw: data.result,
  };

  await setCachedJson(cacheKey, result, PLACE_DETAILS_CACHE_TTL_SECONDS);
  return result;
}

module.exports = {
  autocompletePlaces,
  getPlaceDetails,
};
